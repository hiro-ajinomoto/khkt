import express from "express";
import multer from "multer";
import { ObjectId } from "mongodb";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDB } from "../db.js";
import { config } from "../config.js";
import { gradeSubmissionWithAI } from "../services/aiService.js";
import {
  isAssignmentReleased,
  isBeforeOrOnDeadline,
} from "../utils/assignmentRelease.js";
import { resolveMaxSubmissionsLimit } from "../utils/submissionLimits.js";
import { uploadFileToS3 } from "../services/s3Service.js";
import { authenticate, requireTeacher } from "../middleware/auth.js";
import {
  getTeacherScopedClassSet,
  canTeacherManageAssignmentDb,
  listScopedAssignmentObjectIdsForTeacher,
  teacherCanAccessSubmission,
} from "../utils/teacherClassScope.js";
import {
  STICKER_TIER_ORDER,
  computeStickerStatsFromSubmissionRows,
  scoreToStickerTier,
  stickerTierPublicMeta,
} from "../utils/stickers.js";
import { getStudentRedeemedTotal } from "../utils/stickerRedemptions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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

/** @param {object} assignment */
function assignmentStoredSolutionImageUrls(assignment) {
  if (
    Array.isArray(assignment.model_solution_image_urls) &&
    assignment.model_solution_image_urls.length > 0
  ) {
    return assignment.model_solution_image_urls.filter(Boolean);
  }
  return assignment.model_solution_image_url
    ? [assignment.model_solution_image_url]
    : [];
}

/**
 * Convert local file path to accessible URL
 * @param {string} filePath - Local file path
 * @returns {string|null} URL or null if path is invalid
 */
function pathToUrl(filePath) {
  if (!filePath) return null;

  // If it's already a URL (http/https), return as is
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }

  // If it's a local path, convert to URL
  // Extract filename from path (e.g., /path/to/uploads/abc123.png -> abc123.png)
  const filename = path.basename(filePath);

  // Get base URL from config or use default
  const baseUrl =
    process.env.BASE_URL || `http://localhost:${process.env.PORT || 8000}`;

  // Return URL: http://localhost:8000/uploads/filename.png
  return `${baseUrl}/uploads/${filename}`;
}

/**
 * GET /submissions/mock
 * Return fake submission data (no database required)
 * For testing frontend/API format only
 * MUST be defined BEFORE /:id route to avoid conflicts
 */
router.get("/mock", (req, res) => {
  const now = new Date();
  const mockSubmission = {
    id: "mock-submission-123",
    assignment_id: "mock-assignment-456",
    image_paths: [
      "uploads/mock-student-work-1.jpg",
      "uploads/mock-student-work-2.jpg",
    ],
    created_at: now,
    ai_result: {
      summary:
        "Học sinh đã giải đúng phương trình nhưng thiếu bước kiểm tra nghiệm.",
      score: 7,
      mistakes: [
        "Thiếu bước thay nghiệm vào phương trình gốc để kiểm tra",
        "Chưa ghi rõ điều kiện của phương trình",
      ],
      nextSteps: [
        "Kiểm tra lại nghiệm bằng cách thay vào phương trình gốc",
        "Ghi rõ điều kiện xác định của phương trình",
      ],
      practiceSets: {
        similar: [
          {
            problem: "Giải phương trình x^2 - 7x + 12 = 0",
            solution: "x = 3 hoặc x = 4",
          },
          {
            problem: "Giải phương trình x^2 - 9x + 20 = 0",
            solution: "x = 4 hoặc x = 5",
          },
          {
            problem: "Giải phương trình x^2 - 6x + 8 = 0",
            solution: "x = 2 hoặc x = 4",
          },
          {
            problem: "Giải phương trình x^2 - 8x + 15 = 0",
            solution: "x = 3 hoặc x = 5",
          },
        ],
        remedial: [
          {
            problem: "Giải phương trình x^2 - 4 = 0",
            solution: "x = 2 hoặc x = -2",
          },
          {
            problem: "Giải phương trình x^2 - 9 = 0",
            solution: "x = 3 hoặc x = -3",
          },
          {
            problem: "Giải phương trình x^2 - 16 = 0",
            solution: "x = 4 hoặc x = -4",
          },
          {
            problem: "Giải phương trình x^2 - 25 = 0",
            solution: "x = 5 hoặc x = -5",
          },
        ],
      },
    },
  };

  res.json(mockSubmission);
});

/**
 * GET /submissions/my-submissions
 * Get all submissions of the authenticated student
 * Must be defined BEFORE /:id route to avoid conflicts
 */
router.get("/my-submissions", authenticate, async (req, res) => {
  try {
    // Only students can view their own submissions
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ detail: "Only students can view their submissions" });
    }

    const db = getDB();
    const studentId = ObjectId.createFromHexString(req.user.id);

    // Chỉ lấy các field màn danh sách thực sự cần. Đặc biệt CHỈ giữ
    // ai_result.score (dùng cho badge điểm + điểm trung bình), bỏ qua
    // summary/mistakes/nextSteps/practiceSets vốn có thể nặng vài chục KB
    // mỗi bài. Chi tiết đầy đủ sẽ được lazy-fetch qua GET /submissions/:id
    // khi học sinh bấm "Xem chi tiết".
    const submissions = await db
      .collection("submissions")
      .find({ student_id: studentId })
      .project({
        assignment_id: 1,
        image_paths: 1,
        created_at: 1,
        "ai_result.score": 1,
        // Chỉ kéo score_override + flag để HS thấy badge "Đã có nhận xét". Toàn
        // bộ comment text sẽ được fetch khi mở chi tiết qua GET /submissions/:id.
        "teacher_review.score_override": 1,
      })
      .sort({ created_at: -1 })
      .toArray();

    // Batch-load tất cả assignment liên quan bằng MỘT query $in, thay cho
    // vòng Promise.all + findOne theo từng submission (N+1 round-trip).
    const uniqueAssignmentIds = Array.from(
      new Map(
        submissions
          .filter((s) => s.assignment_id)
          .map((s) => [s.assignment_id.toString(), s.assignment_id]),
      ).values(),
    );

    /** @type {Map<string, { title?: string, subject?: string }>} */
    const assignmentMap = new Map();
    if (uniqueAssignmentIds.length > 0) {
      const assignments = await db
        .collection("assignments")
        .find({ _id: { $in: uniqueAssignmentIds } })
        .project({ title: 1, subject: 1 })
        .toArray();
      for (const a of assignments) {
        assignmentMap.set(a._id.toString(), a);
      }
    }

    const result = submissions.map((submission) => {
      const aid = submission.assignment_id
        ? submission.assignment_id.toString()
        : null;
      const assignment = aid ? assignmentMap.get(aid) : null;
      const score =
        submission.ai_result && typeof submission.ai_result.score === "number"
          ? submission.ai_result.score
          : null;
      const reviewScore =
        submission.teacher_review &&
        typeof submission.teacher_review.score_override === "number"
          ? submission.teacher_review.score_override
          : null;
      return {
        id: submission._id.toString(),
        assignment_id: aid,
        assignment_title: assignment ? assignment.title : "Unknown Assignment",
        assignment_subject: assignment ? assignment.subject : null,
        image_paths: submission.image_paths
          ? submission.image_paths.map((path) => pathToUrl(path))
          : [],
        created_at: submission.created_at,
        // Payload rút gọn: chỉ score cho badge; FE gọi /submissions/:id để
        // xem chi tiết đầy đủ khi người dùng mở card.
        ai_result: score !== null ? { score } : null,
        // Chỉ trả flag + score_override cho list. Comment đầy đủ nằm ở
        // GET /submissions/:id để tránh kéo text dài cho mọi card.
        teacher_review:
          reviewScore !== null || submission.teacher_review
            ? { score_override: reviewScore }
            : null,
        has_teacher_review: !!submission.teacher_review,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching student submissions:", error);
    res.status(500).json({ detail: "Failed to fetch submissions" });
  }
});

/**
 * GET /submissions/my-submission-counts
 * Bản rút gọn của /my-submissions phục vụ riêng cho màn danh sách bài tập.
 * Chỉ trả về số lần học sinh đã nộp theo từng assignment, tránh tải về
 * toàn bộ ai_result (vốn rất nặng). Dùng aggregate để một query duy nhất
 * thay cho N+1 findOne ở /my-submissions.
 * Response: [{ assignment_id: string, count: number }]
 */
router.get("/my-submission-counts", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res
        .status(403)
        .json({ detail: "Only students can view their submission counts" });
    }

    const db = getDB();
    const studentId = ObjectId.createFromHexString(req.user.id);

    const rows = await db
      .collection("submissions")
      .aggregate([
        { $match: { student_id: studentId } },
        { $group: { _id: "$assignment_id", count: { $sum: 1 } } },
      ])
      .toArray();

    const result = rows.map((row) => ({
      assignment_id: row._id ? row._id.toString() : null,
      count: row.count || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching student submission counts:", error);
    res.status(500).json({ detail: "Failed to fetch submission counts" });
  }
});

/**
 * GET /submissions/my-stickers
 * Aggregated sticker counts (first graded attempt per assignment).
 */
router.get("/my-stickers", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        detail: "Only students can view sticker stats",
      });
    }

    const db = getDB();
    const studentId = ObjectId.createFromHexString(req.user.id);

    // computeStickerStatsFromSubmissionRows chỉ cần ai_result.score, nên chỉ
    // project đúng field đó thay vì kéo cả ai_result về (giảm mạnh BSON đọc
    // khi học sinh có nhiều bài nộp lâu dài).
    const submissions = await db
      .collection("submissions")
      .find({ student_id: studentId })
      .project({
        assignment_id: 1,
        created_at: 1,
        "ai_result.score": 1,
      })
      .toArray();

    const summary = computeStickerStatsFromSubmissionRows(submissions);
    const stickersEarnedTotal = summary.total_sticker_count;
    const stickersRedeemedTotal = await getStudentRedeemedTotal(db, studentId);
    const total_sticker_count = Math.max(
      0,
      stickersEarnedTotal - stickersRedeemedTotal,
    );

    /** @type {Record<string, { code: string, label: string, emoji: string, count: number }>} */
    const by_tier_detail = {};
    for (const code of STICKER_TIER_ORDER) {
      const n = summary.by_tier[code] || 0;
      if (n > 0) {
        by_tier_detail[code] = { ...stickerTierPublicMeta(code), count: n };
      }
    }

    res.json({
      ...summary,
      total_sticker_count,
      stickers_earned_total: stickersEarnedTotal,
      stickers_redeemed_total: stickersRedeemedTotal,
      by_tier_detail,
      completion_emoji: "\uD83C\uDF38",
      explanation:
        "M\u1ED7i b\u00E0i \u0111\u00E3 ch\u1EA5m \u0111\u01B0\u1EE3c 1 huy hi\u1EC7u ho\u00E0n th\u00E0nh v\u00E0 1 huy hi\u1EC7u m\u1EE9c \u0111i\u1EC3m ngay t\u1EEB l\u1EA7n n\u1ED9p \u0111\u1EA7u ti\u00EAn \u0111\u01B0\u1EE3c ch\u1EA5m. N\u1ED9p b\u00E0i l\u1EA1i kh\u00F4ng \u0111\u1ED5i huy hi\u1EC7u.",
    });
  } catch (error) {
    console.error("Error fetching sticker stats:", error);
    res.status(500).json({ detail: "Failed to fetch sticker stats" });
  }
});

/**
 * Chuẩn hoá teacher_review trước khi trả về client. Trả null nếu chưa nhận xét.
 * Giữ ObjectId reviewer_id dưới dạng hex string để FE dễ so sánh quyền sửa/xóa.
 */
function formatTeacherReview(review) {
  if (!review || typeof review !== "object") return null;
  return {
    comment: typeof review.comment === "string" ? review.comment : "",
    score_override:
      typeof review.score_override === "number" ? review.score_override : null,
    reviewer_id: review.reviewer_id ? review.reviewer_id.toString() : null,
    reviewer_username: review.reviewer_username || null,
    reviewer_full_name: review.reviewer_full_name || null,
    created_at: review.created_at || null,
    updated_at: review.updated_at || null,
  };
}

/**
 * Validate body cho upsert teacher_review.
 * Trả { error } nếu sai, { value } nếu ok.
 */
function validateReviewPayload(body) {
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  if (!comment) {
    return { error: "Nhận xét không được để trống." };
  }
  if (comment.length > 4000) {
    return { error: "Nhận xét quá dài (tối đa 4000 ký tự)." };
  }

  let scoreOverride = null;
  if (
    body?.score_override !== undefined &&
    body?.score_override !== null &&
    body?.score_override !== ""
  ) {
    const n = Number(body.score_override);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      return { error: "Điểm chấm tay phải nằm trong khoảng 0-10." };
    }
    // Cho phép tối đa 1 chữ số thập phân để FE tự do nhập 7.5 / 8.25 → làm tròn 1 số
    scoreOverride = Math.round(n * 10) / 10;
  }

  return { value: { comment, score_override: scoreOverride } };
}

/**
 * GET /submissions/teacher
 * List bài nộp cho GV/Admin chấm tay.
 * Query params:
 *   - assignment_id (optional): lọc theo 1 assignment
 *   - class_name (optional): lọc theo lớp HS
 *   - has_review (optional): "true" → chỉ bài đã có nhận xét; "false" → chưa nhận xét; mặc định = tất cả
 *   - submitted_on (optional): YYYY-MM-DD theo ngày Việt Nam (Asia/Ho_Chi_Minh), lọc created_at trong ngày đó
 *   - limit (optional, default 100, max 500)
 *   - offset (optional, default 0)
 *
 * Mỗi bản ghi trả về meta nhẹ (không kéo full ai_result để tránh payload lớn).
 */
router.get("/teacher", authenticate, requireTeacher, async (req, res) => {
  try {
    const db = getDB();
    const { assignment_id, class_name, has_review, submitted_on } = req.query;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 100, 1),
      500,
    );
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const scoped = await getTeacherScopedClassSet(db, req.user);

    const filter = {};

    if (req.user.role === "teacher") {
      if (scoped.size === 0) {
        return res.json({ items: [], total: 0, limit, offset });
      }
      const classArr = [...scoped];
      const allowedAssignmentIds =
        await listScopedAssignmentObjectIdsForTeacher(db, req.user.id, scoped);
      const studentsInScope = await db
        .collection("users")
        .find({ role: "student", class_name: { $in: classArr } })
        .project({ _id: 1 })
        .toArray();
      const allowedStudentIds = studentsInScope.map((s) => s._id);
      if (allowedStudentIds.length === 0 || allowedAssignmentIds.length === 0) {
        return res.json({ items: [], total: 0, limit, offset });
      }
      filter.$and = [
        { assignment_id: { $in: allowedAssignmentIds } },
        { student_id: { $in: allowedStudentIds } },
      ];
    }

    if (assignment_id) {
      let aid;
      try {
        aid = ObjectId.createFromHexString(String(assignment_id));
      } catch (_err) {
        return res.status(400).json({ detail: "Invalid assignment_id" });
      }
      if (req.user.role === "teacher") {
        const ok = await canTeacherManageAssignmentDb(
          db,
          req.user,
          aid,
          scoped,
        );
        if (!ok) {
          return res.status(403).json({ detail: "Forbidden" });
        }
      }
      filter.assignment_id = aid;
    }

    // class_name lọc gián tiếp qua student_id → cần lookup users trước
    let studentIdFilter = null;
    if (class_name) {
      const cn = String(class_name);
      if (req.user.role === "teacher" && !scoped.has(cn)) {
        return res.status(403).json({ detail: "Forbidden" });
      }
      const students = await db
        .collection("users")
        .find({ role: "student", class_name: cn })
        .project({ _id: 1 })
        .toArray();
      if (students.length === 0) {
        // Lớp không có HS → trả về list rỗng luôn cho gọn.
        return res.json({ items: [], total: 0, limit, offset });
      }
      studentIdFilter = students.map((s) => s._id);
      filter.student_id = { $in: studentIdFilter };
    }

    if (has_review === "true") {
      filter.teacher_review = { $exists: true, $ne: null };
    } else if (has_review === "false") {
      filter.$or = [
        { teacher_review: { $exists: false } },
        { teacher_review: null },
      ];
    }

    if (submitted_on) {
      const m = String(submitted_on).match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) {
        return res.status(400).json({
          detail: "submitted_on phải là YYYY-MM-DD (theo ngày Việt Nam)",
        });
      }
      const ymd = `${m[1]}-${m[2]}-${m[3]}`;
      const dayStart = new Date(`${ymd}T00:00:00+07:00`);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      filter.created_at = { $gte: dayStart, $lt: dayEnd };
    }

    const total = await db.collection("submissions").countDocuments(filter);

    const rows = await db
      .collection("submissions")
      .find(filter)
      .project({
        assignment_id: 1,
        student_id: 1,
        image_paths: 1,
        created_at: 1,
        "ai_result.score": 1,
        teacher_review: 1,
      })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    // Batch resolve assignments + students bằng $in để tránh N+1 round-trip.
    const assignmentIds = Array.from(
      new Map(
        rows
          .filter((r) => r.assignment_id)
          .map((r) => [r.assignment_id.toString(), r.assignment_id]),
      ).values(),
    );
    const studentIds = Array.from(
      new Map(
        rows
          .filter((r) => r.student_id)
          .map((r) => [r.student_id.toString(), r.student_id]),
      ).values(),
    );

    const [assignmentDocs, studentDocs] = await Promise.all([
      assignmentIds.length
        ? db
            .collection("assignments")
            .find({ _id: { $in: assignmentIds } })
            .project({ title: 1, subject: 1 })
            .toArray()
        : Promise.resolve([]),
      studentIds.length
        ? db
            .collection("users")
            .find({ _id: { $in: studentIds } })
            .project({ username: 1, full_name: 1, class_name: 1 })
            .toArray()
        : Promise.resolve([]),
    ]);

    const assignmentMap = new Map(
      assignmentDocs.map((a) => [a._id.toString(), a]),
    );
    const studentMap = new Map(studentDocs.map((s) => [s._id.toString(), s]));

    const items = rows.map((r) => {
      const aid = r.assignment_id ? r.assignment_id.toString() : null;
      const sid = r.student_id ? r.student_id.toString() : null;
      const a = aid ? assignmentMap.get(aid) : null;
      const s = sid ? studentMap.get(sid) : null;
      const review = formatTeacherReview(r.teacher_review);
      return {
        id: r._id.toString(),
        assignment_id: aid,
        assignment_title: a ? a.title : null,
        assignment_subject: a ? a.subject : null,
        student_id: sid,
        student_username: s ? s.username : null,
        student_full_name: s ? s.full_name || null : null,
        student_class: s ? s.class_name || null : null,
        // Thumbnail đầu tiên là đủ cho list view; FE bấm vào sẽ load full chi tiết.
        thumbnail_url:
          r.image_paths && r.image_paths.length > 0
            ? pathToUrl(r.image_paths[0])
            : null,
        created_at: r.created_at,
        ai_score:
          r.ai_result && typeof r.ai_result.score === "number"
            ? r.ai_result.score
            : null,
        teacher_review: review,
        has_review: !!review,
      };
    });

    res.json({ items, total, limit, offset });
  } catch (error) {
    console.error("Error listing teacher submissions:", error);
    res.status(500).json({ detail: "Failed to list submissions" });
  }
});

/**
 * PUT /submissions/:id/review
 * Tạo hoặc cập nhật nhận xét thủ công của GV/Admin cho 1 bài nộp.
 * Body: { comment: string (bắt buộc), score_override?: number 0-10 | null }
 */
router.put("/:id/review", authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (_err) {
      return res.status(400).json({ detail: "Invalid submission id" });
    }

    const validated = validateReviewPayload(req.body);
    if (validated.error) {
      return res.status(400).json({ detail: validated.error });
    }

    const db = getDB();
    const submission = await db
      .collection("submissions")
      .findOne({ _id: objectId });
    if (!submission) {
      return res.status(404).json({ detail: "Submission not found" });
    }

    if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ok = await teacherCanAccessSubmission(
        db,
        req.user,
        submission,
        scoped,
      );
      if (!ok) {
        return res.status(403).json({ detail: "Forbidden" });
      }
    }

    // Lookup GV để snapshot full_name vào review (FE list view không cần
    // populate users/lookup mỗi lần render).
    const reviewerId = ObjectId.createFromHexString(req.user.id);
    const reviewerDoc = await db
      .collection("users")
      .findOne(
        { _id: reviewerId },
        { projection: { username: 1, full_name: 1 } },
      );

    const now = new Date();
    const existing = submission.teacher_review || null;

    const review = {
      comment: validated.value.comment,
      score_override: validated.value.score_override,
      reviewer_id: reviewerId,
      reviewer_username: reviewerDoc?.username || req.user.username || null,
      reviewer_full_name: reviewerDoc?.full_name || null,
      created_at: existing?.created_at || now,
      updated_at: now,
    };

    await db
      .collection("submissions")
      .updateOne({ _id: objectId }, { $set: { teacher_review: review } });

    res.json({ teacher_review: formatTeacherReview(review) });
  } catch (error) {
    console.error("Error upserting teacher review:", error);
    res.status(500).json({ detail: "Failed to save review" });
  }
});

/**
 * DELETE /submissions/:id/review
 * Xóa nhận xét thủ công.
 */
router.delete("/:id/review", authenticate, requireTeacher, async (req, res) => {
  try {
    const { id } = req.params;
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (_err) {
      return res.status(400).json({ detail: "Invalid submission id" });
    }

    const db = getDB();
    const submission = await db
      .collection("submissions")
      .findOne({ _id: objectId });
    if (!submission) {
      return res.status(404).json({ detail: "Submission not found" });
    }

    if (req.user.role === "teacher") {
      const scoped = await getTeacherScopedClassSet(db, req.user);
      const ok = await teacherCanAccessSubmission(
        db,
        req.user,
        submission,
        scoped,
      );
      if (!ok) {
        return res.status(403).json({ detail: "Forbidden" });
      }
    }

    const result = await db
      .collection("submissions")
      .updateOne({ _id: objectId }, { $unset: { teacher_review: "" } });

    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: "Submission not found" });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("Error deleting teacher review:", error);
    res.status(500).json({ detail: "Failed to delete review" });
  }
});

/**
 * GET /submissions/:id
 * Get a submission by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: "Invalid submission id" });
    }

    const db = getDB();
    const submission = await db.collection("submissions").findOne({
      _id: objectId,
    });

    if (!submission) {
      return res.status(404).json({ detail: "Submission not found" });
    }

    res.json({
      id: submission._id.toString(),
      assignment_id: submission.assignment_id.toString(),
      image_paths: submission.image_paths
        ? submission.image_paths.map((path) => pathToUrl(path))
        : [],
      created_at: submission.created_at,
      ai_result: submission.ai_result || null,
      teacher_review: formatTeacherReview(submission.teacher_review),
    });
  } catch (error) {
    console.error("Error fetching submission:", error);
    res.status(500).json({ detail: "Failed to fetch submission" });
  }
});

/**
 * POST /submissions
 * Create a new submission with image uploads
 */
router.post("/", authenticate, upload.array("files"), async (req, res) => {
  try {
    const { assignment_id } = req.body;
    const files = req.files;
    const studentId = ObjectId.createFromHexString(req.user.id);

    // Validation
    if (!assignment_id) {
      return res.status(400).json({ detail: "Missing assignment_id" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ detail: "No files uploaded" });
    }

    // Validate assignment exists
    let assignmentObjectId;
    try {
      assignmentObjectId = ObjectId.createFromHexString(assignment_id);
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

    if (req.user.role === "student" && !isAssignmentReleased(assignment)) {
      return res.status(403).json({
        detail: "Bài tập chưa đến ngày mở. Vui lòng quay lại sau.",
      });
    }

    if (req.user.role === "student" && !isBeforeOrOnDeadline(assignment)) {
      return res.status(403).json({
        detail: "Đã quá hạn nộp bài.",
      });
    }

    // Check if student is allowed to submit to this assignment
    // Only students need this check
    if (req.user.role === "student") {
      const student = await db.collection("users").findOne({ _id: studentId });
      if (!student || !student.class_name) {
        return res
          .status(403)
          .json({ detail: "Student not assigned to a class" });
      }

      const assigned = await db.collection("assignment_classes").findOne({
        assignment_id: assignmentObjectId,
        class_name: student.class_name,
      });

      if (!assigned) {
        return res
          .status(403)
          .json({ detail: "Assignment not assigned to your class" });
      }

      const limit = resolveMaxSubmissionsLimit(assignment);
      if (Number.isFinite(limit)) {
        const priorCount = await db.collection("submissions").countDocuments({
          assignment_id: assignmentObjectId,
          student_id: studentId,
        });
        if (priorCount >= limit) {
          return res.status(403).json({
            detail: `Bạn đã nộp đủ ${limit} lần cho bài này. Không thể nộp thêm.`,
          });
        }
      }
    }

    // Validate required fields in assignment
    // Assignment must have either:
    // 1. question_image_url AND model_solution_image_url (images only)
    // 2. question AND model_solution (text only)
    // 3. Or combination of both
    const hasQuestionImage = !!assignment.question_image_url;
    const hasSolutionImage =
      assignmentStoredSolutionImageUrls(assignment).length > 0;
    const hasQuestionText = !!assignment.question;
    const hasSolutionText = !!assignment.model_solution;

    const hasImages = hasQuestionImage && hasSolutionImage;
    const hasText = hasQuestionText && hasSolutionText;

    if (!hasImages && !hasText) {
      return res.status(400).json({
        detail:
          "Assignment is missing required fields. Must have either: (question_image_url AND model_solution_image_url) OR (question AND model_solution)",
      });
    }

    // Warn if some fields are missing (but don't fail)
    if (hasImages && !hasText) {
      console.log(
        `Assignment ${assignment_id} uses images only. AI grading will use images.`,
      );
    } else if (hasText && !hasImages) {
      console.warn(
        `Assignment ${assignment_id} uses text only. AI grading will use text.`,
      );
    }

    // Upload images to S3 and get URLs
    const imageUrls = [];
    for (const file of files) {
      try {
        const ext = path.extname(file.originalname) || ".png";
        const s3Key = `submissions/${uuidv4()}${ext}`;
        const contentType = file.mimetype || "image/png";

        const s3Url = await uploadFileToS3(file.path, s3Key, contentType);
        imageUrls.push(s3Url);

        // Clean up local file after upload
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error("Failed to upload submission image to S3:", error);
        // Fallback to local path if S3 upload fails
        imageUrls.push(file.path);
      }
    }

    // Create submission document
    const submissionDoc = {
      assignment_id: assignmentObjectId,
      student_id: studentId, // Store student ID
      image_paths: imageUrls, // Store S3 URLs instead of local paths
      created_at: new Date(),
      ai_result: null,
    };

    const result = await db.collection("submissions").insertOne(submissionDoc);
    const submissionId = result.insertedId;

    // Call AI grading
    let aiResult;
    try {
      // Filter out null/undefined/empty image URLs - only send if they exist
      const questionImageUrls = assignment.question_image_url
        ? [assignment.question_image_url].filter(Boolean)
        : [];
      const solutionImageUrls = assignmentStoredSolutionImageUrls(assignment);

      aiResult = await gradeSubmissionWithAI(
        imageUrls, // Use S3 URLs instead of local paths
        assignment.model_solution || "",
        assignment.question || "",
        questionImageUrls, // Optional - can be empty array
        solutionImageUrls, // Optional - can be empty array
      );
    } catch (error) {
      // Log detailed error information for debugging
      const errorStatus = error.response?.status;
      const errorMessage = error.message;
      const errorData = error.response?.data;

      console.error("AI grading failed:");
      console.error("  Status:", errorStatus);
      console.error("  Message:", errorMessage);
      console.error("  Response data:", errorData);
      console.error("  Full error:", error);

      // Determine error type and provide appropriate message
      let errorSummary = "AI grading failed";
      let errorNextSteps = [
        "Hệ thống đang gặp sự cố. Vui lòng liên hệ quản trị viên.",
      ];

      if (errorStatus === 429) {
        errorSummary =
          "AI grading tạm thời không khả dụng do quá tải. Vui lòng thử lại sau.";
        errorNextSteps = ["Vui lòng thử lại sau vài phút"];
      } else if (errorStatus === 401) {
        errorSummary = "Lỗi xác thực API. Vui lòng kiểm tra API key.";
        errorNextSteps = ["Kiểm tra cấu hình OPENAI_API_KEY trong file .env"];
      } else if (errorStatus === 400) {
        errorSummary =
          "Yêu cầu không hợp lệ. Vui lòng kiểm tra dữ liệu đầu vào.";
        errorNextSteps = ["Kiểm tra format của hình ảnh và dữ liệu assignment"];
      } else if (
        errorStatus === 500 ||
        errorStatus === 502 ||
        errorStatus === 503
      ) {
        errorSummary = "Lỗi từ phía server AI. Vui lòng thử lại sau.";
        errorNextSteps = [
          "Thử lại sau vài phút",
          "Nếu vẫn lỗi, liên hệ quản trị viên",
        ];
      } else if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        errorSummary =
          "Không thể kết nối đến server AI. Vui lòng kiểm tra kết nối mạng.";
        errorNextSteps = ["Kiểm tra kết nối internet", "Thử lại sau"];
      } else if (errorMessage?.includes("JSON")) {
        errorSummary = "Lỗi xử lý phản hồi từ AI. Dữ liệu không hợp lệ.";
        errorNextSteps = ["Thử lại với submission khác"];
      }

      // Store failure info
      // Don't store system errors as student mistakes
      aiResult = {
        summary: errorSummary,
        score: 0,
        mistakes: [], // Don't store system errors as student mistakes
        nextSteps: errorNextSteps,
        practiceSets: {
          similar: [],
          remedial: [],
        },
        // Store error details for debugging (optional, can be removed in production)
        _error:
          process.env.NODE_ENV === "development"
            ? {
                status: errorStatus,
                message: errorMessage,
                type: error.code || "unknown",
              }
            : undefined,
      };
    }

    // Update submission with AI result
    await db
      .collection("submissions")
      .updateOne({ _id: submissionId }, { $set: { ai_result: aiResult } });

    // Fetch updated submission
    const created = await db.collection("submissions").findOne({
      _id: submissionId,
    });

    let stickers = null;
    if (req.user.role === "student" && created?.ai_result != null) {
      const attemptCount = await db.collection("submissions").countDocuments({
        assignment_id: assignmentObjectId,
        student_id: studentId,
      });
      const firstGraded = await db
        .collection("submissions")
        .find({
          assignment_id: assignmentObjectId,
          student_id: studentId,
          ai_result: { $ne: null },
        })
        .sort({ created_at: 1 })
        .limit(1)
        .toArray();
      const basis = firstGraded[0] || created;
      const tierCode = scoreToStickerTier(basis.ai_result.score);
      stickers = {
        completion: true,
        tier: stickerTierPublicMeta(tierCode),
        attempt_number: attemptCount,
        locked_to_first_graded_attempt: true,
        note:
          attemptCount > 1
            ? "Huy hi\u1EC7u ho\u00E0n th\u00E0nh v\u00E0 m\u1EE9c \u0111i\u1EC3m gi\u1EEF theo l\u1EA7n n\u1ED9p \u0111\u1EA7u ti\u00EAn \u0111\u01B0\u1EE3c ch\u1EA5m. L\u1EA7n n\u1ED9p n\u00E0y kh\u00F4ng \u0111\u1ED5i huy hi\u1EC7u."
            : null,
      };
    }

    res.status(201).json({
      id: created._id.toString(),
      assignment_id: created.assignment_id.toString(),
      student_id: created.student_id ? created.student_id.toString() : null,
      image_paths: created.image_paths
        ? created.image_paths.map((path) => pathToUrl(path))
        : [],
      created_at: created.created_at,
      ai_result: created.ai_result,
      stickers,
    });
  } catch (error) {
    console.error("Error creating submission:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      detail: "Failed to create submission",
      error: error.message,
    });
  }
});

export default router;
