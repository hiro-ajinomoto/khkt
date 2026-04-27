import express from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDB } from "../db.js";
import { config } from "../config.js";
import {
  uploadFileToS3,
  deleteFileFromS3,
  extractS3Key,
  getPresignedUrl,
} from "../services/s3Service.js";
import {
  authenticate,
  requireTeacher,
  optionalAuthenticate,
} from "../middleware/auth.js";
import {
  todayStrHoChiMinh,
  isAssignmentReleased,
} from "../utils/assignmentRelease.js";
import {
  parseMaxSubmissionsRaw,
  storedMaxSubmissionsForApi,
} from "../utils/submissionLimits.js";
import {
  assertClassNamesRegistered,
  validateClassNameFormat,
} from "../schoolClasses.js";
import {
  getTeacherScopedClassSet,
  canTeacherManageAssignmentDb,
  listScopedAssignmentObjectIdsForTeacher,
  assertTeacherClassesAllowed,
} from "../utils/teacherClassScope.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/** Ngày mở bài (YYYY-MM-DD) hoặc null = hiển thị ngay */
function normalizeAvailableFromDate(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { value: null };
  }
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return {
      error:
        "Ngày mở bài không hợp lệ (định dạng YYYY-MM-DD, ví dụ 2026-04-15)",
    };
  }
  return { value: s };
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "..", config.imageUpload.dir);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});

// Configure multer with file size limits
// Allow up to 10MB per file, max 10 files
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files
  },
});

/**
 * Normalize S3 URL - if it's a presigned URL, extract the base S3 URL
 * @param {string} url - S3 URL (presigned or base)
 * @returns {string} Base S3 URL
 */
function normalizeS3Url(url) {
  if (!url) return null;

  // Remove query parameters if present (presigned URL)
  const urlWithoutQuery = url.split("?")[0];

  // Check if it's an S3 URL pattern
  // Pattern: https://bucket-name.s3.region.amazonaws.com/key
  const s3Pattern = /https:\/\/([^/]+)\.s3(?:\.([^.]+))?\.amazonaws\.com\/(.+)/;
  const match = urlWithoutQuery.match(s3Pattern);

  if (match) {
    const bucketName = match[1];
    const region = match[2] || config.aws.region || "us-east-1";
    const key = decodeURIComponent(match[3]);

    // Reconstruct base S3 URL
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  }

  // If it's already a base S3 URL or not an S3 URL, return as is
  return url;
}

/**
 * Convert S3 URL or local path to accessible URL
 * If it's an S3 URL, generate presigned URL for access
 * @param {string} urlOrPath - S3 URL, local path, or http/https URL
 * @returns {Promise<string|null>} Accessible URL or null
 */
async function convertToAccessibleUrl(urlOrPath) {
  if (!urlOrPath) return null;

  // If it's already a full URL (http/https), check if it's S3
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    // Check if it's an S3 URL
    const s3Key = extractS3Key(urlOrPath);
    if (s3Key) {
      // Generate presigned URL for S3 object (valid for 1 hour)
      try {
        const presignedUrl = await getPresignedUrl(s3Key, 3600);
        return presignedUrl;
      } catch (error) {
        console.error("Failed to generate presigned URL for S3 object:", error);
        // Fallback to original URL (might work if bucket is public)
        return urlOrPath;
      }
    }
    // Not an S3 URL, return as is
    return urlOrPath;
  }

  // If it's a local path, convert to static file URL (for backward compatibility)
  const filename = path.basename(urlOrPath);
  const baseUrl =
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
  return `${baseUrl}/uploads/${filename}`;
}

function assignmentCreatedByString(created_by) {
  if (!created_by) return null;
  try {
    return (
      created_by instanceof ObjectId
        ? created_by
        : ObjectId.createFromHexString(String(created_by))
    ).toString();
  } catch {
    return null;
  }
}

async function loadCreatorMapForAssignments(db, assignments) {
  const idSet = new Set();
  for (const a of assignments) {
    const s = assignmentCreatedByString(a.created_by);
    if (s) idSet.add(s);
  }
  if (idSet.size === 0) return new Map();
  const oids = [...idSet].map((s) => ObjectId.createFromHexString(s));
  const users = await db
    .collection("users")
    .find({ _id: { $in: oids } })
    .project({ name: 1, username: 1 })
    .toArray();
  const map = new Map();
  for (const u of users) {
    map.set(u._id.toString(), {
      name: (u.name && String(u.name).trim()) || u.username || u._id.toString(),
      username: u.username,
    });
  }
  return map;
}

const ASSIGNMENT_PROBLEM_REPORTS = "assignment_problem_reports";
const PROBLEM_REPORT_FLAG_THRESHOLD = 5;

let problemReportIndexesEnsured = false;

async function ensureProblemReportIndexes(db) {
  if (problemReportIndexesEnsured) return;
  const c = db.collection(ASSIGNMENT_PROBLEM_REPORTS);
  await c.createIndex(
    { assignment_id: 1, student_id: 1 },
    { unique: true },
  );
  await c.createIndex({ assignment_id: 1 });
  problemReportIndexesEnsured = true;
}

async function loadProblemReportAggregates(db, assignmentOids, viewer) {
  if (!assignmentOids.length) {
    return { countById: new Map(), studentReportedIds: new Set() };
  }
  await ensureProblemReportIndexes(db);
  const countById = new Map();
  const agg = await db
    .collection(ASSIGNMENT_PROBLEM_REPORTS)
    .aggregate([
      { $match: { assignment_id: { $in: assignmentOids } } },
      { $group: { _id: "$assignment_id", count: { $sum: 1 } } },
    ])
    .toArray();
  for (const row of agg) {
    countById.set(row._id.toString(), row.count);
  }
  const studentReportedIds = new Set();
  if (viewer?.role === "student") {
    const sid = ObjectId.createFromHexString(viewer.id);
    const docs = await db
      .collection(ASSIGNMENT_PROBLEM_REPORTS)
      .find({
        assignment_id: { $in: assignmentOids },
        student_id: sid,
      })
      .project({ assignment_id: 1 })
      .toArray();
    for (const d of docs) {
      studentReportedIds.add(d.assignment_id.toString());
    }
  }
  return { countById, studentReportedIds };
}

function buildListReportContextObject(viewer, { countById, studentReportedIds }) {
  if (
    !viewer ||
    !["teacher", "admin", "student"].includes(viewer.role)
  ) {
    return null;
  }
  return {
    viewerRole: viewer.role,
    countById,
    studentReportedIds,
  };
}

async function mapAssignmentDocToApi(item, creatorMap, listCtx = null, opts = {}) {
  const cid = assignmentCreatedByString(item.created_by);
  const cr = cid ? creatorMap.get(cid) : null;
  // Ở chế độ list, ảnh đáp án gốc KHÔNG hiển thị trên card (chỉ dùng ở trang
  // chi tiết + so sánh AI). Bỏ presign S3 cho field này giúp giảm một nửa số
  // request S3 khi render danh sách dài. Detail/create/update vẫn presign
  // bình thường.
  const listMode = Boolean(opts.listMode);
  const [questionImageUrl, modelSolutionImageUrl] = await Promise.all([
    convertToAccessibleUrl(item.question_image_url),
    listMode
      ? Promise.resolve(item.model_solution_image_url || null)
      : convertToAccessibleUrl(item.model_solution_image_url),
  ]);
  const base = {
    id: item._id.toString(),
    title: item.title,
    description: item.description || null,
    subject: item.subject,
    grade_level: item.grade_level || null,
    model_solution: item.model_solution,
    question_image_url: questionImageUrl,
    model_solution_image_url: modelSolutionImageUrl,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null,
    available_from_date: item.available_from_date ?? null,
    due_date: item.due_date ?? null,
    max_submissions_per_student: storedMaxSubmissionsForApi(item),
    created_by: cid,
    created_by_name: cr ? cr.name : null,
    created_by_username: cr ? cr.username : null,
  };
  if (listCtx) {
    if (listCtx.viewerRole === "teacher" || listCtx.viewerRole === "admin") {
      const n = listCtx.countById.get(base.id) ?? 0;
      base.problem_report_count = n;
      base.problem_flagged = n >= PROBLEM_REPORT_FLAG_THRESHOLD;
    }
    if (listCtx.viewerRole === "student") {
      base.student_reported_problem = listCtx.studentReportedIds.has(
        base.id,
      );
    }
  }
  return base;
}

/**
 * GET /assignments
 * List assignments
 * - Students: only see assignments assigned to their class
 * - Admins: see all assignments
 * - Teachers: assignments for their assigned classes + bản nháp (chưa gán lớp) do chính họ tạo
 * - Unauthenticated: always []
 */
router.get("/", optionalAuthenticate, async (req, res) => {
  try {
    const db = getDB();
    let assignmentIds = [];

    console.log(
      "GET /assignments - req.user:",
      req.user ? { id: req.user.id, role: req.user.role } : "not authenticated",
    );

    // If user is authenticated and is a student, filter by their class
    if (req.user && req.user.role === "student") {
      // Get student's class_name
      const student = await db.collection("users").findOne({
        _id: ObjectId.createFromHexString(req.user.id),
      });

      console.log(
        "Student found:",
        student
          ? { id: student._id.toString(), class_name: student.class_name }
          : "not found",
      );

      if (student && student.class_name) {
        // Get assignment IDs assigned to this class
        const assignmentClasses = await db
          .collection("assignment_classes")
          .find({ class_name: student.class_name })
          .toArray();

        assignmentIds = assignmentClasses
          .map((ac) => ac.assignment_id)
          .filter(Boolean)
          .map((id) => {
            if (id instanceof ObjectId) return id;
            try {
              return ObjectId.createFromHexString(String(id));
            } catch {
              return null;
            }
          })
          .filter(Boolean);
        console.log(
          `Found ${assignmentIds.length} assignments for class ${student.class_name}`,
        );
      } else {
        // Student has no class, return empty array
        console.log("Student has no class_name, returning empty array");
        return res.json([]);
      }
    }
    // Teachers and admins see all assignments (no filter)

    // Build query
    let query = {};

    if (req.user && req.user.role === "student") {
      // Students: only show assignments assigned to their class
      if (assignmentIds.length > 0) {
        const todayStr = todayStrHoChiMinh();
        query = {
          $and: [
            { _id: { $in: assignmentIds } },
            {
              $or: [
                { available_from_date: { $exists: false } },
                { available_from_date: null },
                { available_from_date: "" },
                { available_from_date: { $lte: todayStr } },
              ],
            },
          ],
        };
        console.log("Student query:", JSON.stringify(query));
      } else {
        // Student has class but no assignments assigned yet
        console.log(
          "Student has class but no assignments assigned, returning empty array",
        );
        return res.json([]);
      }
    } else if (req.user && req.user.role === "admin") {
      query = {};
      console.log("Admin query: {} (all assignments)");
    } else if (req.user && req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ids = await listScopedAssignmentObjectIdsForTeacher(
        db,
        req.user.id,
        scoped,
      );
      if (ids.length === 0) {
        console.log("Teacher has no scoped assignments, returning []");
        return res.json([]);
      }
      query = { _id: { $in: ids } };
      console.log(`Teacher scoped query: ${ids.length} assignments`);
    } else {
      console.log("Unauthenticated user, returning empty array");
      return res.json([]);
    }

    const assignments = await db
      .collection("assignments")
      .find(query)
      .sort({ created_at: -1 }) // Sort by newest first
      .toArray();

    console.log(`Found ${assignments.length} assignments`);

    const creatorMap = await loadCreatorMapForAssignments(db, assignments);
    const oids = assignments.map((a) => a._id);
    let listCtx = null;
    if (
      req.user &&
      (req.user.role === "teacher" ||
        req.user.role === "admin" ||
        req.user.role === "student")
    ) {
      const agg = await loadProblemReportAggregates(db, oids, req.user);
      listCtx = buildListReportContextObject(req.user, agg);
    }
    const result = await Promise.all(
      assignments.map((item) =>
        mapAssignmentDocToApi(item, creatorMap, listCtx, { listMode: true }),
      ),
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ detail: "Failed to fetch assignments" });
  }
});

/**
 * GET /assignments/by-date?date=YYYY-MM-DD
 * List assignments created on a specific date
 */
router.get("/by-date", optionalAuthenticate, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res
        .status(400)
        .json({ detail: "Missing date query parameter (YYYY-MM-DD)" });
    }

    // Parse date as UTC range [start, end)
    const start = new Date(date);
    if (Number.isNaN(start.getTime())) {
      return res
        .status(400)
        .json({ detail: "Invalid date format, expected YYYY-MM-DD" });
    }
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const db = getDB();
    let assignments = await db
      .collection("assignments")
      .find({
        created_at: {
          $gte: start,
          $lt: end,
        },
      })
      .sort({ created_at: -1 }) // Sort by newest first
      .toArray();

    if (req.user?.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const allowed = new Set(
        (
          await listScopedAssignmentObjectIdsForTeacher(
            db,
            req.user.id,
            scoped,
          )
        ).map((x) => x.toString()),
      );
      assignments = assignments.filter((a) => allowed.has(a._id.toString()));
    }

    const creatorMap = await loadCreatorMapForAssignments(db, assignments);
    const result = await Promise.all(
      assignments.map((item) =>
        mapAssignmentDocToApi(item, creatorMap, null, { listMode: true }),
      ),
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching assignments by date:", error);
    res.status(500).json({ detail: "Failed to fetch assignments by date" });
  }
});

/**
 * GET /assignments/by-month?year=YYYY&month=MM
 * List assignments created in a specific month
 */
router.get("/by-month", optionalAuthenticate, async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res
        .status(400)
        .json({ detail: "Missing year or month query parameter (YYYY, MM)" });
    }

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (
      Number.isNaN(yearNum) ||
      Number.isNaN(monthNum) ||
      monthNum < 1 ||
      monthNum > 12
    ) {
      return res.status(400).json({ detail: "Invalid year or month format" });
    }

    // Parse month as UTC range [start, end)
    const start = new Date(Date.UTC(yearNum, monthNum - 1, 1));
    const end = new Date(Date.UTC(yearNum, monthNum, 1));

    const db = getDB();
    let assignments = await db
      .collection("assignments")
      .find({
        created_at: {
          $gte: start,
          $lt: end,
        },
      })
      .sort({ created_at: -1 }) // Sort by newest first
      .toArray();

    if (req.user?.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const allowed = new Set(
        (
          await listScopedAssignmentObjectIdsForTeacher(
            db,
            req.user.id,
            scoped,
          )
        ).map((x) => x.toString()),
      );
      assignments = assignments.filter((a) => allowed.has(a._id.toString()));
    }

    const creatorMap = await loadCreatorMapForAssignments(db, assignments);
    const result = await Promise.all(
      assignments.map((item) =>
        mapAssignmentDocToApi(item, creatorMap, null, { listMode: true }),
      ),
    );

    res.json(result);
  } catch (error) {
    console.error("Error fetching assignments by month:", error);
    res.status(500).json({ detail: "Failed to fetch assignments by month" });
  }
});

/**
 * GET /assignments/:id
 * Get a single assignment by ID
 * — Học sinh: chỉ xem được nếu bài gán lớp và đã đến ngày mở; GV/Admin: luôn xem
 */
router.get("/:id", optionalAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid assignment id" });
    }

    const db = getDB();
    const assignment = await db.collection("assignments").findOne({
      _id: objectId,
    });

    if (!assignment) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    if (!req.user) {
      return res.status(401).json({
        detail: "Vui lòng đăng nhập để xem bài tập.",
      });
    }

    const isTeacherOrAdmin =
      req.user.role === "teacher" || req.user.role === "admin";

    if (req.user.role === "student") {
      const student = await db.collection("users").findOne({
        _id: ObjectId.createFromHexString(req.user.id),
      });
      if (!student?.class_name) {
        return res.status(403).json({ detail: "Forbidden" });
      }
      const assigned = await db.collection("assignment_classes").findOne({
        assignment_id: objectId,
        class_name: student.class_name,
      });
      if (!assigned || !isAssignmentReleased(assignment)) {
        return res.status(404).json({
          detail:
            "Không tìm thấy bài tập hoặc bài chưa đến ngày mở cho học sinh",
        });
      }
    } else if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ok = await canTeacherManageAssignmentDb(
        db,
        req.user,
        objectId,
        scoped,
      );
      if (!ok) {
        return res.status(404).json({
          detail:
            "Không tìm thấy bài tập hoặc bài chưa đến ngày mở cho học sinh",
        });
      }
    } else if (!isTeacherOrAdmin && !isAssignmentReleased(assignment)) {
      return res.status(404).json({
        detail: "Không tìm thấy bài tập hoặc bài chưa đến ngày mở",
      });
    }

    const creatorMap = await loadCreatorMapForAssignments(db, [assignment]);
    let listCtx = null;
    if (
      req.user &&
      (req.user.role === "teacher" ||
        req.user.role === "admin" ||
        req.user.role === "student")
    ) {
      const agg = await loadProblemReportAggregates(db, [objectId], req.user);
      listCtx = buildListReportContextObject(req.user, agg);
    }
    const result = await mapAssignmentDocToApi(assignment, creatorMap, listCtx);

    if (req.user && req.user.role === "student") {
      result.my_submission_count = await db
        .collection("submissions")
        .countDocuments({
          assignment_id: objectId,
          student_id: ObjectId.createFromHexString(req.user.id),
        });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching assignment:", error);
    res.status(500).json({ detail: "Failed to fetch assignment" });
  }
});

/**
 * POST /assignments/:id/report-problem — hoc sinh bao de co loi (toi da 1 lan / hoc sinh / bai).
 */
router.post("/:id/report-problem", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        detail: "Chi hoc sinh moi co the bao loi de bai.",
      });
    }

    const { id } = req.params;
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch {
      return res.status(400).json({ detail: "Invalid assignment id" });
    }

    const db = getDB();
    const assignment = await db.collection("assignments").findOne({
      _id: objectId,
    });
    if (!assignment) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    if (!isAssignmentReleased(assignment)) {
      return res.status(403).json({
        detail: "Bai tap chua den ngay mo. Khong the bao loi de.",
      });
    }

    const studentId = ObjectId.createFromHexString(req.user.id);
    const student = await db.collection("users").findOne({ _id: studentId });
    if (!student?.class_name) {
      return res.status(403).json({ detail: "Học sinh chưa được gán lớp." });
    }

    const assigned = await db.collection("assignment_classes").findOne({
      assignment_id: objectId,
      class_name: student.class_name,
    });
    if (!assigned) {
      return res.status(403).json({
        detail: "Bài tập không được gán cho lớp của bạn.",
      });
    }

    await ensureProblemReportIndexes(db);
    const coll = db.collection(ASSIGNMENT_PROBLEM_REPORTS);
    try {
      await coll.insertOne({
        assignment_id: objectId,
        student_id: studentId,
        created_at: new Date(),
      });
      return res.json({ ok: true, already_reported: false });
    } catch (err) {
      if (err.code === 11000) {
        return res.json({ ok: true, already_reported: true });
      }
      throw err;
    }
  } catch (error) {
    console.error("Error reporting assignment problem:", error);
    res.status(500).json({ detail: "Khong ghi nhan duoc bao loi de." });
  }
});

/**
 * Chuẩn hóa danh sách lớp từ body (JSON hoặc multipart: chuỗi JSON).
 * @returns {{ names: string[] } | { error: string }}
 */
function parseClassNamesFromBody(raw) {
  if (raw == null || raw === "") return { names: [] };
  let arr;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      return { error: "class_names phải là mảng JSON hợp lệ" };
    }
  } else if (Array.isArray(raw)) {
    arr = raw;
  } else {
    return { error: "class_names không hợp lệ" };
  }
  if (!Array.isArray(arr)) {
    return { error: "class_names phải là mảng" };
  }
  const normalized = [];
  for (const rawName of arr) {
    const v = validateClassNameFormat(rawName);
    if (!v.ok) return { error: v.error };
    normalized.push(v.name);
  }
  return { names: [...new Set(normalized)] };
}

async function upsertAssignmentClasses(
  db,
  assignmentObjectId,
  normalizedClassNames,
  assignedByUserId,
) {
  if (!normalizedClassNames.length) return;
  const assignmentClasses = normalizedClassNames.map((className) => ({
    assignment_id: assignmentObjectId,
    class_name: className,
    assigned_by: assignedByUserId,
    assigned_at: new Date(),
  }));
  const operations = assignmentClasses.map((ac) => ({
    updateOne: {
      filter: {
        assignment_id: ac.assignment_id,
        class_name: ac.class_name,
      },
      update: { $set: ac },
      upsert: true,
    },
  }));
  await db.collection("assignment_classes").bulkWrite(operations);
}

/**
 * POST /assignments
 * Create a new assignment (Teacher only)
 * Required fields:
 * - title: string (required)
 * - question_image: file upload (multipart/form-data) OR question_image_url: string (required)
 * - model_solution_image: file upload (multipart/form-data) OR model_solution_image_url: string (required)
 * Optional fields:
 * - description: string
 * - subject: string (default: "math")
 * - class_names: JSON string (multipart) hoặc mảng — gán lớp ngay khi tạo
 */
router.post(
  "/",
  authenticate,
  requireTeacher,
  upload.any(), // Accept any field names for flexibility
  async (req, res) => {
    try {
      const {
        title,
        description,
        subject = "math",
        grade_level,
        question_image_url,
        model_solution_image_url,
        available_from_date: availableFromRaw,
        due_date: dueFromRaw,
        max_submissions_per_student: maxSubRaw,
      } = req.body;

      const parsedDate = normalizeAvailableFromDate(availableFromRaw);
      if (parsedDate.error) {
        return res.status(400).json({ detail: parsedDate.error });
      }

      const parsedDue = normalizeAvailableFromDate(dueFromRaw);
      if (parsedDue.error) {
        return res.status(400).json({ detail: parsedDue.error });
      }

      if (
        parsedDate.value &&
        parsedDue.value &&
        parsedDue.value < parsedDate.value
      ) {
        return res.status(400).json({
          detail: "Hạn nộp không được trước ngày mở bài cho học sinh.",
        });
      }

      const parsedMax = parseMaxSubmissionsRaw(maxSubRaw);
      if (parsedMax.error) {
        return res.status(400).json({ detail: parsedMax.error });
      }

      const files = req.files || [];

      // Find uploaded files by field name
      const questionImageFile = files.find(
        (f) => f.fieldname === "question_image",
      );
      const solutionImageFile = files.find(
        (f) => f.fieldname === "model_solution_image",
      );

      // Validation - required fields
      if (!title) {
        return res.status(400).json({
          detail: "Missing required field: title is required",
        });
      }

      // Validation - images are required
      const hasQuestionImage = questionImageFile || question_image_url;
      const hasSolutionImage = solutionImageFile || model_solution_image_url;

      if (!hasQuestionImage) {
        return res.status(400).json({
          detail:
            "Missing required field: question_image (file upload or question_image_url) is required",
        });
      }

      if (!hasSolutionImage) {
        return res.status(400).json({
          detail:
            "Missing required field: model_solution_image (file upload or model_solution_image_url) is required",
        });
      }

      // Determine image URLs - upload to S3 if files provided
      // Priority: uploaded files (upload to S3) > URLs from body
      let finalQuestionImageUrl = null;
      let finalSolutionImageUrl = null;

      if (questionImageFile) {
        // Upload to S3
        const file = questionImageFile;
        const ext = path.extname(file.originalname) || ".png";
        const s3Key = `assignments/question/${uuidv4()}${ext}`;
        const contentType = file.mimetype || "image/png";

        try {
          const s3Url = await uploadFileToS3(file.path, s3Key, contentType);
          finalQuestionImageUrl = s3Url;

          // Clean up local file after upload
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error("Failed to upload question image to S3:", error);
          // Fallback to local path if S3 upload fails
          finalQuestionImageUrl = file.path;
        }
      } else if (question_image_url) {
        // Use provided URL
        finalQuestionImageUrl = question_image_url;
      }

      if (solutionImageFile) {
        // Upload to S3
        const file = solutionImageFile;
        const ext = path.extname(file.originalname) || ".png";
        const s3Key = `assignments/solution/${uuidv4()}${ext}`;
        const contentType = file.mimetype || "image/png";

        try {
          const s3Url = await uploadFileToS3(file.path, s3Key, contentType);
          finalSolutionImageUrl = s3Url;

          // Clean up local file after upload
          fs.unlinkSync(file.path);
        } catch (error) {
          console.error("Failed to upload solution image to S3:", error);
          // Fallback to local path if S3 upload fails
          finalSolutionImageUrl = file.path;
        }
      } else if (model_solution_image_url) {
        // Use provided URL
        finalSolutionImageUrl = model_solution_image_url;
      }

      const db = getDB();
      const assignment = {
        title,
        description: description || null,
        subject: "math", // Const value
        grade_level: grade_level || null, // Grade level (e.g., "Lớp 10", "Lớp 11", "Lớp 12")
        question: null, // No longer required, can be extracted from image
        model_solution: null, // No longer required, can be extracted from image
        question_image_url: finalQuestionImageUrl,
        model_solution_image_url: finalSolutionImageUrl,
        created_at: new Date(),
        available_from_date: parsedDate.value,
        due_date: parsedDue.value,
        max_submissions_per_student: parsedMax.value,
        created_by: ObjectId.createFromHexString(req.user.id),
      };

      const result = await db.collection("assignments").insertOne(assignment);

      const classParse = parseClassNamesFromBody(req.body.class_names);
      if (classParse.error) {
        await db.collection("assignments").deleteOne({ _id: result.insertedId });
        return res.status(400).json({ detail: classParse.error });
      }

      if (classParse.names.length > 0) {
        if (req.user.role === "teacher") {
          const scoped = await getTeacherScopedClassSet(db, req.user);
          if (!assertTeacherClassesAllowed(scoped, classParse.names, res)) {
            await db.collection("assignments").deleteOne({ _id: result.insertedId });
            return;
          }
        }
        try {
          await assertClassNamesRegistered(db, classParse.names);
        } catch (e) {
          await db.collection("assignments").deleteOne({ _id: result.insertedId });
          if (e.status === 400) {
            return res.status(400).json({ detail: e.message });
          }
          throw e;
        }
        await upsertAssignmentClasses(
          db,
          result.insertedId,
          classParse.names,
          ObjectId.createFromHexString(req.user.id),
        );
      }

      const inserted = await db.collection("assignments").findOne({
        _id: result.insertedId,
      });

      const creatorMap = await loadCreatorMapForAssignments(db, [inserted]);
      const body = await mapAssignmentDocToApi(inserted, creatorMap);
      res.status(201).json(body);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(500).json({ detail: "Failed to create assignment" });
    }
  },
);

/**
 * PATCH /assignments/:id
 * Update an existing assignment
 * All fields are optional - only provided fields will be updated
 * Supports file uploads:
 * - question_image: file upload (multipart/form-data) OR question_image_url: string
 * - model_solution_image: file upload (multipart/form-data) OR model_solution_image_url: string
 * Text fields:
 * - title: string
 * - description: string
 * - subject: string
 */
router.patch(
  "/:id",
  authenticate,
  requireTeacher,
  upload.any(), // Accept any field names for flexibility
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        subject,
        grade_level,
        question_image_url,
        model_solution_image_url,
        available_from_date: availableFromRaw,
        due_date: dueFromRaw,
        max_submissions_per_student: maxSubRaw,
      } = req.body;

      const files = req.files || [];

      // Find uploaded files by field name
      const questionImageFile = files.find(
        (f) => f.fieldname === "question_image",
      );
      const solutionImageFile = files.find(
        (f) => f.fieldname === "model_solution_image",
      );

      // Validate ID
      let objectId;
      try {
        objectId = ObjectId.createFromHexString(id);
      } catch (error) {
        return res.status(400).json({ detail: "Invalid assignment id" });
      }

      // Check if assignment exists
      const db = getDB();
      const assignment = await db.collection("assignments").findOne({
        _id: objectId,
      });

      if (!assignment) {
        return res.status(404).json({ detail: "Assignment not found" });
      }

      if (req.user.role === "teacher") {
        const scoped = await getTeacherScopedClassSet(db, req.user);
        const ok = await canTeacherManageAssignmentDb(
          db,
          req.user,
          objectId,
          scoped,
        );
        if (!ok) {
          return res.status(404).json({ detail: "Assignment not found" });
        }
      }

      // Build update object
      const updateData = {};

      // Update title if provided
      if (title !== undefined) {
        if (!title || title.trim() === "") {
          return res.status(400).json({
            detail: "Title cannot be empty",
          });
        }
        updateData.title = title;
      }

      // Update description if provided
      if (description !== undefined) {
        updateData.description = description || null;
      }

      // Update subject if provided
      if (subject !== undefined) {
        updateData.subject = subject;
      }

      // Update grade_level if provided
      if (grade_level !== undefined) {
        updateData.grade_level = grade_level || null;
      }

      if (availableFromRaw !== undefined) {
        const parsed = normalizeAvailableFromDate(availableFromRaw);
        if (parsed.error) {
          return res.status(400).json({ detail: parsed.error });
        }
        updateData.available_from_date = parsed.value;
      }

      if (dueFromRaw !== undefined) {
        const parsed = normalizeAvailableFromDate(dueFromRaw);
        if (parsed.error) {
          return res.status(400).json({ detail: parsed.error });
        }
        updateData.due_date = parsed.value;
      }

      if (maxSubRaw !== undefined) {
        const parsed = parseMaxSubmissionsRaw(maxSubRaw);
        if (parsed.error) {
          return res.status(400).json({ detail: parsed.error });
        }
        updateData.max_submissions_per_student = parsed.value;
      }

      // Handle question image update
      if (questionImageFile) {
        // Upload new image to S3
        const file = questionImageFile;
        const ext = path.extname(file.originalname) || ".png";
        const s3Key = `assignments/question/${uuidv4()}${ext}`;
        const contentType = file.mimetype || "image/png";

        try {
          const s3Url = await uploadFileToS3(file.path, s3Key, contentType);
          updateData.question_image_url = s3Url;

          // Clean up local file after upload
          fs.unlinkSync(file.path);

          // Delete old image from S3 if it exists
          if (assignment.question_image_url) {
            const oldS3Key = extractS3Key(assignment.question_image_url);
            if (oldS3Key) {
              try {
                await deleteFileFromS3(oldS3Key);
                console.log(`Deleted old question image from S3: ${oldS3Key}`);
              } catch (error) {
                console.error(
                  `Failed to delete old question image from S3: ${oldS3Key}`,
                  error,
                );
                // Continue even if deletion fails
              }
            }
          }
        } catch (error) {
          console.error("Failed to upload question image to S3:", error);
          // Fallback to local path if S3 upload fails
          updateData.question_image_url = file.path;
        }
      } else if (question_image_url !== undefined) {
        // Normalize URL - if it's a presigned URL, extract base S3 URL
        const normalizedUrl =
          normalizeS3Url(question_image_url) || question_image_url;
        updateData.question_image_url = normalizedUrl || null;

        // Delete old image from S3 if it exists and new URL is different
        const oldNormalizedUrl =
          normalizeS3Url(assignment.question_image_url) ||
          assignment.question_image_url;
        if (oldNormalizedUrl && oldNormalizedUrl !== normalizedUrl) {
          const oldS3Key = extractS3Key(oldNormalizedUrl);
          if (oldS3Key) {
            try {
              await deleteFileFromS3(oldS3Key);
              console.log(`Deleted old question image from S3: ${oldS3Key}`);
            } catch (error) {
              console.error(
                `Failed to delete old question image from S3: ${oldS3Key}`,
                error,
              );
              // Continue even if deletion fails
            }
          }
        }
      }

      // Handle solution image update
      if (solutionImageFile) {
        // Upload new image to S3
        const file = solutionImageFile;
        const ext = path.extname(file.originalname) || ".png";
        const s3Key = `assignments/solution/${uuidv4()}${ext}`;
        const contentType = file.mimetype || "image/png";

        try {
          const s3Url = await uploadFileToS3(file.path, s3Key, contentType);
          updateData.model_solution_image_url = s3Url;

          // Clean up local file after upload
          fs.unlinkSync(file.path);

          // Delete old image from S3 if it exists
          if (assignment.model_solution_image_url) {
            const oldS3Key = extractS3Key(assignment.model_solution_image_url);
            if (oldS3Key) {
              try {
                await deleteFileFromS3(oldS3Key);
                console.log(`Deleted old solution image from S3: ${oldS3Key}`);
              } catch (error) {
                console.error(
                  `Failed to delete old solution image from S3: ${oldS3Key}`,
                  error,
                );
                // Continue even if deletion fails
              }
            }
          }
        } catch (error) {
          console.error("Failed to upload solution image to S3:", error);
          // Fallback to local path if S3 upload fails
          updateData.model_solution_image_url = file.path;
        }
      } else if (model_solution_image_url !== undefined) {
        // Normalize URL - if it's a presigned URL, extract base S3 URL
        const normalizedUrl =
          normalizeS3Url(model_solution_image_url) || model_solution_image_url;
        updateData.model_solution_image_url = normalizedUrl || null;

        // Delete old image from S3 if it exists and new URL is different
        const oldNormalizedUrl =
          normalizeS3Url(assignment.model_solution_image_url) ||
          assignment.model_solution_image_url;
        if (oldNormalizedUrl && oldNormalizedUrl !== normalizedUrl) {
          const oldS3Key = extractS3Key(oldNormalizedUrl);
          if (oldS3Key) {
            try {
              await deleteFileFromS3(oldS3Key);
              console.log(`Deleted old solution image from S3: ${oldS3Key}`);
            } catch (error) {
              console.error(
                `Failed to delete old solution image from S3: ${oldS3Key}`,
                error,
              );
              // Continue even if deletion fails
            }
          }
        }
      }

      const nextAvailable =
        updateData.available_from_date !== undefined
          ? updateData.available_from_date
          : assignment.available_from_date;
      const nextDue =
        updateData.due_date !== undefined
          ? updateData.due_date
          : assignment.due_date;
      if (nextAvailable && nextDue && nextDue < nextAvailable) {
        return res.status(400).json({
          detail: "Hạn nộp không được trước ngày mở bài cho học sinh.",
        });
      }

      if (!assignment.created_by) {
        updateData.created_by = ObjectId.createFromHexString(req.user.id);
      }

      // If no fields to update, return error
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          detail: "No fields provided to update",
        });
      }

      updateData.updated_at = new Date();

      // Update assignment in database
      await db
        .collection("assignments")
        .updateOne({ _id: objectId }, { $set: updateData });

      // Fetch updated assignment
      const updated = await db.collection("assignments").findOne({
        _id: objectId,
      });

      const creatorMap = await loadCreatorMapForAssignments(db, [updated]);
      const body = await mapAssignmentDocToApi(updated, creatorMap);
      res.json(body);
    } catch (error) {
      console.error("Error updating assignment:", error);
      res.status(500).json({ detail: "Failed to update assignment" });
    }
  },
);

/**
 * DELETE /assignments
 * Delete multiple assignments by IDs (Teacher only)
 * Request body: { ids: ["id1", "id2", ...] }
 * Also deletes associated images from S3
 * NOTE: This route must be defined BEFORE /:id to avoid route conflicts
 */
router.delete("/", authenticate, requireTeacher, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        detail: "Missing or invalid 'ids' array in request body",
      });
    }

    // Convert string IDs to ObjectIds
    const objectIds = [];
    const invalidIds = [];

    for (const id of ids) {
      try {
        objectIds.push(ObjectId.createFromHexString(id));
      } catch (error) {
        invalidIds.push(id);
      }
    }

    if (invalidIds.length > 0) {
      return res.status(400).json({
        detail: `Invalid assignment ids: ${invalidIds.join(", ")}`,
      });
    }

    const db = getDB();

    if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      for (const oid of objectIds) {
        const ok = await canTeacherManageAssignmentDb(db, req.user, oid, scoped);
        if (!ok) {
          return res.status(403).json({
            detail: "Bạn không có quyền xóa một hoặc nhiều bài tập trong danh sách.",
          });
        }
      }
    }

    // Find assignments to get image URLs before deletion
    const assignments = await db
      .collection("assignments")
      .find({ _id: { $in: objectIds } })
      .toArray();

    const foundIds = assignments.map((a) => a._id.toString());
    const notFoundIds = ids.filter((id) => !foundIds.includes(id));

    // Delete images from S3
    const imagesToDelete = [];
    for (const assignment of assignments) {
      if (assignment.question_image_url) {
        const s3Key = extractS3Key(assignment.question_image_url);
        if (s3Key) {
          imagesToDelete.push(s3Key);
        }
      }
      if (assignment.model_solution_image_url) {
        const s3Key = extractS3Key(assignment.model_solution_image_url);
        if (s3Key) {
          imagesToDelete.push(s3Key);
        }
      }
    }

    // Delete images from S3 (don't fail if deletion fails)
    for (const key of imagesToDelete) {
      try {
        await deleteFileFromS3(key);
        console.log(`Deleted S3 image: ${key}`);
      } catch (error) {
        console.error(`Failed to delete S3 image ${key}:`, error);
        // Continue even if S3 deletion fails
      }
    }

    // Gỡ gán lớp trước khi xóa bài
    await db.collection("assignment_classes").deleteMany({
      assignment_id: { $in: objectIds },
    });

    // Delete assignments from database
    const result = await db.collection("assignments").deleteMany({
      _id: { $in: objectIds },
    });

    res.status(200).json({
      success: true,
      message: "Assignments deleted successfully",
      deletedCount: result.deletedCount,
      deletedIds: foundIds,
      notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
    });
  } catch (error) {
    console.error("Error deleting assignments:", error);
    res.status(500).json({ detail: "Failed to delete assignments" });
  }
});

/**
 * DELETE /assignments/:id
 * Delete a single assignment by ID (Teacher only)
 * Also deletes associated images from S3
 * NOTE: This route must be defined AFTER / to avoid route conflicts
 */
router.delete("/:id", authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid assignment id" });
    }

    const db = getDB();
    const assignment = await db.collection("assignments").findOne({
      _id: objectId,
    });

    if (!assignment) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ok = await canTeacherManageAssignmentDb(
        db,
        req.user,
        objectId,
        scoped,
      );
      if (!ok) {
        return res.status(404).json({ detail: "Assignment not found" });
      }
    }

    // Delete images from S3 if they exist
    const imagesToDelete = [];

    if (assignment.question_image_url) {
      // Normalize URL before extracting key (handle presigned URLs)
      const normalizedUrl =
        normalizeS3Url(assignment.question_image_url) ||
        assignment.question_image_url;
      const s3Key = extractS3Key(normalizedUrl);
      if (s3Key) {
        imagesToDelete.push(s3Key);
      }
    }

    if (assignment.model_solution_image_url) {
      // Normalize URL before extracting key (handle presigned URLs)
      const normalizedUrl =
        normalizeS3Url(assignment.model_solution_image_url) ||
        assignment.model_solution_image_url;
      const s3Key = extractS3Key(normalizedUrl);
      if (s3Key) {
        imagesToDelete.push(s3Key);
      }
    }

    // Delete images from S3 (don't fail if deletion fails)
    for (const key of imagesToDelete) {
      try {
        await deleteFileFromS3(key);
        console.log(`Deleted S3 image: ${key}`);
      } catch (error) {
        console.error(`Failed to delete S3 image ${key}:`, error);
        // Continue even if S3 deletion fails
      }
    }

    await db.collection("assignment_classes").deleteMany({
      assignment_id: objectId,
    });

    // Delete assignment from database
    const result = await db.collection("assignments").deleteOne({
      _id: objectId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
      deletedId: id,
    });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    res.status(500).json({ detail: "Failed to delete assignment" });
  }
});

/**
 * POST /assignments/:id/assign
 * Assign an assignment to one or more classes (Teacher only)
 * Body: { class_names: ["8A1", "8A2", ...] }
 */
router.post("/:id/assign", authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    const { class_names } = req.body;

    // Validate ID
    let assignmentObjectId;
    try {
      assignmentObjectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid assignment id" });
    }

    const parsed = parseClassNamesFromBody(class_names);
    if (parsed.error) {
      return res.status(400).json({ detail: parsed.error });
    }
    if (parsed.names.length === 0) {
      return res.status(400).json({
        detail: "class_names must be a non-empty array",
      });
    }

    const normalizedClassNames = parsed.names;

    const db = getDB();

    try {
      await assertClassNamesRegistered(db, normalizedClassNames);
    } catch (e) {
      if (e.status === 400) {
        return res.status(400).json({ detail: e.message });
      }
      throw e;
    }

    // Check if assignment exists
    const assignment = await db.collection("assignments").findOne({
      _id: assignmentObjectId,
    });

    if (!assignment) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ok = await canTeacherManageAssignmentDb(
        db,
        req.user,
        assignmentObjectId,
        scoped,
      );
      if (!ok) {
        return res.status(404).json({ detail: "Assignment not found" });
      }
      if (!assertTeacherClassesAllowed(scoped, normalizedClassNames, res)) {
        return;
      }
    }

    await upsertAssignmentClasses(
      db,
      assignmentObjectId,
      normalizedClassNames,
      ObjectId.createFromHexString(req.user.id),
    );

    res.status(200).json({
      message: "Assignment assigned to classes successfully",
      assignment_id: id,
      class_names: normalizedClassNames,
    });
  } catch (error) {
    console.error("Error assigning assignment to classes:", error);
    res.status(500).json({ detail: "Failed to assign assignment to classes" });
  }
});

/**
 * GET /assignments/:id/classes
 * Get list of classes that an assignment is assigned to (Teacher only)
 */
router.get("/:id/classes", authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    let assignmentObjectId;
    try {
      assignmentObjectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid assignment id" });
    }

    const db = getDB();

    const assignment = await db.collection("assignments").findOne({
      _id: assignmentObjectId,
    });
    if (!assignment) {
      return res.status(404).json({ detail: "Assignment not found" });
    }

    if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ok = await canTeacherManageAssignmentDb(
        db,
        req.user,
        assignmentObjectId,
        scoped,
      );
      if (!ok) {
        return res.status(404).json({ detail: "Assignment not found" });
      }
    }

    // Get all classes this assignment is assigned to
    const assignmentClasses = await db
      .collection("assignment_classes")
      .find({ assignment_id: assignmentObjectId })
      .toArray();

    const result = assignmentClasses.map((ac) => ({
      class_name: ac.class_name,
      assigned_at: ac.assigned_at,
      assigned_by: ac.assigned_by.toString(),
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching assignment classes:", error);
    res.status(500).json({ detail: "Failed to fetch assignment classes" });
  }
});

export default router;
