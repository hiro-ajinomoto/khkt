import { ObjectId } from "mongodb";
import { isAssignmentReleasedOnYmd } from "./assignmentRelease.js";
import {
  getTeacherScopedClassSet,
  listScopedAssignmentObjectIdsForTeacher,
} from "./teacherClassScope.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @returns {{ start: Date, end: Date }} — biên ngày theo timezone VN cho chuỗi YYYY-MM-DD
 */
export function vietnamDayBoundsInclusive(fromYmd, toYmd) {
  const start = new Date(`${fromYmd}T00:00:00.000+07:00`);
  const end = new Date(`${toYmd}T23:59:59.999+07:00`);
  return { start, end };
}

/**
 * @param {number} deltaDays âm để lui
 */
export function shiftVietnamYmd(fromYmd, deltaDays) {
  const ms = new Date(`${fromYmd}T12:00:00+07:00`).getTime();
  const n = ms + deltaDays * DAY_MS;
  return new Date(n).toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Mặc định: đến hôm nay (VN), lùi (daysBack - 1) ngày (tổng `daysBack` ngày). */
export function defaultVnRangeYmd(daysBack = 14) {
  const toYmd = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const fromYmd = shiftVietnamYmd(toYmd, -(daysBack - 1));
  return { fromYmd, toYmd };
}

/** Liệt kê các ngày YYYY-MM-DD từ from → to (inclusive), theo lịch VN */
export function eachVietnamDayKeyInclusive(fromYmd, toYmd) {
  const out = [];
  const startMs = new Date(`${fromYmd}T12:00:00+07:00`).getTime();
  const limMs = new Date(`${toYmd}T12:00:00+07:00`).getTime();
  for (let ts = startMs; ts <= limMs; ts += DAY_MS) {
    const key = new Date(ts).toLocaleDateString("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    out.push(key);
  }
  return out;
}

/**
 * Chuỗi ngày theo timezone VN của một instant UTC.
 */
export function vietnamDayKey(dateValue) {
  const d =
    typeof dateValue === "string" || typeof dateValue === "number"
      ? new Date(dateValue)
      : dateValue instanceof Date
        ? dateValue
        : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function effectiveScore(sub) {
  const o = sub?.teacher_review?.score_override;
  if (typeof o === "number" && Number.isFinite(o)) return o;
  const s = sub?.ai_result?.score;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  return null;
}

/**
 * Các assignment_id (ObjectId) duy nhất đã gán lớp và còn tồn tại trong `assignments`.
 * Tránh đếm trùng trong `assignment_classes` và link mồ côi sau khi xóa bài.
 */
export async function resolveExistingAssignmentIdsForClass(db, className) {
  const links = await db
    .collection("assignment_classes")
    .find({ class_name: className })
    .project({ assignment_id: 1 })
    .toArray();

  const byStr = new Map();
  for (const row of links) {
    const id = row.assignment_id;
    if (!id) continue;
    try {
      const oid =
        id instanceof ObjectId ? id : ObjectId.createFromHexString(String(id));
      byStr.set(oid.toString(), oid);
    } catch {
      /* skip */
    }
  }
  const candidates = [...byStr.values()];
  if (candidates.length === 0) return [];

  const existing = await db
    .collection("assignments")
    .find({ _id: { $in: candidates } })
    .project({ _id: 1 })
    .toArray();

  return existing.map((a) => a._id);
}

/**
 * Bài đang gán lớp (còn tồn tại) và khớp phạm vi GV như GET /assignments.
 * Admin: toàn bộ bài gán lớp.
 */
export async function resolveClassAssignmentIdsForTeacherView(db, className, viewer) {
  const base = await resolveExistingAssignmentIdsForClass(db, className);
  if (!viewer || viewer.role === "admin") return base;
  if (viewer.role !== "teacher") return base;
  const scoped = await getTeacherScopedClassSet(db, viewer);
  const allowed = await listScopedAssignmentObjectIdsForTeacher(
    db,
    viewer.id,
    scoped,
  );
  const allowSet = new Set(allowed.map((id) => id.toString()));
  return base.filter((id) => allowSet.has(id.toString()));
}

/**
 * Chỉ các bài đã mở cho HS vào ngày `ymd` (giống bộ lọc GET /assignments của học sinh).
 */
export async function filterAssignmentIdsReleasedByVnYmd(db, objectIds, ymd) {
  if (!objectIds?.length) return [];
  const rows = await db
    .collection("assignments")
    .find({ _id: { $in: objectIds } })
    .project({ available_from_date: 1 })
    .toArray();
  return rows
    .filter((a) => isAssignmentReleasedOnYmd(a, ymd))
    .map((a) => a._id);
}

async function loadAssignmentReleaseMetaById(db, objectIds) {
  /** @type {Map<string, { available_from_date?: unknown }>} */
  const map = new Map();
  if (!objectIds?.length) return map;
  const rows = await db
    .collection("assignments")
    .find({ _id: { $in: objectIds } })
    .project({ available_from_date: 1 })
    .toArray();
  for (const r of rows) map.set(r._id.toString(), r);
  return map;
}

/**
 * Tổng quan nộp bài theo ngày (lịch VN) cho một lớp.
 * @param {import('mongodb').Db} db
 * @param {string} className
 * @param {string} fromYmd
 * @param {string} toYmd
 */
export async function buildClassSubmissionActivityByDay(
  db,
  className,
  fromYmd,
  toYmd,
  viewer,
) {
  const { start, end } = vietnamDayBoundsInclusive(fromYmd, toYmd);

  const scopedAssignmentIds = await resolveClassAssignmentIdsForTeacherView(
    db,
    className,
    viewer,
  );
  const releaseMetaById = await loadAssignmentReleaseMetaById(
    db,
    scopedAssignmentIds,
  );

  const students = await db
    .collection("users")
    .find({ role: "student", class_name: className })
    .project({ name: 1, username: 1 })
    .toArray();

  const studentIds = students.map((u) => u._id);
  const studentNameById = new Map(
    students.map((u) => [
      u._id.toString(),
      (u.name && String(u.name).trim()) || u.username || u._id.toString(),
    ]),
  );

  if (scopedAssignmentIds.length === 0 || studentIds.length === 0) {
    const dayKeys = eachVietnamDayKeyInclusive(fromYmd, toYmd);
    return {
      class_name: className,
      from: fromYmd,
      to: toYmd,
      days: dayKeys.map((date) => ({
        date,
        submission_count: 0,
        graded_submission_count: 0,
        unique_students: 0,
        avg_score: null,
        students: [],
      })),
      totals: {
        submission_count: 0,
        graded_submission_count: 0,
        unique_students: 0,
        avg_score: null,
      },
    };
  }

  const submissionsRaw = await db
    .collection("submissions")
    .find({
      assignment_id: { $in: scopedAssignmentIds },
      student_id: { $in: studentIds },
      created_at: { $gte: start, $lte: end },
    })
    .project({
      student_id: 1,
      assignment_id: 1,
      created_at: 1,
      ai_result: 1,
      teacher_review: 1,
    })
    .toArray();

  const submissions = submissionsRaw.filter((sub) => {
    const dayKey = vietnamDayKey(sub.created_at);
    if (!dayKey) return false;
    const aid = sub.assignment_id?.toString();
    const meta = aid ? releaseMetaById.get(aid) : null;
    return !!(meta && isAssignmentReleasedOnYmd(meta, dayKey));
  });

  /** @type {Map<string, { submission_count: number, graded: number, scores: number[], byStudent: Map<string, number> }>} */
  const byDay = new Map();

  const studentsWhoSubmitted = new Set();

  for (const sub of submissions) {
    const sid = sub.student_id?.toString();
    if (!sid) continue;
    const dayKey = vietnamDayKey(sub.created_at);
    if (!dayKey) continue;

    if (!byDay.has(dayKey)) {
      byDay.set(dayKey, {
        submission_count: 0,
        graded: 0,
        scores: [],
        byStudent: new Map(),
      });
    }
    const bucket = byDay.get(dayKey);
    bucket.submission_count += 1;
    bucket.byStudent.set(sid, (bucket.byStudent.get(sid) || 0) + 1);

    const sc = effectiveScore(sub);
    if (sc != null) {
      bucket.graded += 1;
      bucket.scores.push(sc);
    }
    studentsWhoSubmitted.add(sid);
  }

  const dayKeys = eachVietnamDayKeyInclusive(fromYmd, toYmd);
  const days = dayKeys.map((date) => {
    const b = byDay.get(date);
    if (!b) {
      return {
        date,
        submission_count: 0,
        graded_submission_count: 0,
        unique_students: 0,
        avg_score: null,
        students: [],
      };
    }
    const avg =
      b.scores.length > 0
        ? Math.round(
            (b.scores.reduce((a, x) => a + x, 0) / b.scores.length) * 100,
          ) / 100
        : null;
    const studentsArr = [...b.byStudent.entries()]
      .map(([student_id, submission_count]) => ({
        student_id,
        student_name: studentNameById.get(student_id) || student_id,
        submission_count,
      }))
      .sort((a, b) =>
        a.student_name.localeCompare(b.student_name, "vi", { numeric: true }),
      );
    return {
      date,
      submission_count: b.submission_count,
      graded_submission_count: b.graded,
      unique_students: b.byStudent.size,
      avg_score: avg,
      students: studentsArr,
    };
  });

  const totalGradedScores = submissions
    .map(effectiveScore)
    .filter((x) => x != null);
  const totalsAvg =
    totalGradedScores.length > 0
      ? Math.round(
          (totalGradedScores.reduce((a, x) => a + x, 0) /
            totalGradedScores.length) *
            100,
        ) / 100
      : null;

  return {
    class_name: className,
    from: fromYmd,
    to: toYmd,
    days,
    totals: {
      submission_count: submissions.length,
      graded_submission_count: totalGradedScores.length,
      unique_students: studentsWhoSubmitted.size,
      avg_score: totalsAvg,
    },
  };
}

function roundAvg(scores) {
  if (!scores?.length) return null;
  return (
    Math.round(
      (scores.reduce((a, x) => a + x, 0) / scores.length) * 100,
    ) / 100
  );
}

/**
 * Chi tiết một ngày (lịch VN): từng học sinh có nộp, điểm TB trong ngày, lượt nộp,
 * số bài tập (không trùng) có nộp trong ngày / tổng bài được gán lớp.
 */
export async function buildClassSubmissionActivityDayDetail(
  db,
  className,
  dayYmd,
  viewer,
) {
  const { start, end } = vietnamDayBoundsInclusive(dayYmd, dayYmd);

  const scopedIds = await resolveClassAssignmentIdsForTeacherView(
    db,
    className,
    viewer,
  );
  const assignmentIds = await filterAssignmentIdsReleasedByVnYmd(
    db,
    scopedIds,
    dayYmd,
  );

  const assignments_total = assignmentIds.length;

  const students = await db
    .collection("users")
    .find({ role: "student", class_name: className })
    .project({ name: 1, username: 1 })
    .toArray();

  const studentIds = students.map((u) => u._id);
  const studentNameById = new Map(
    students.map((u) => [
      u._id.toString(),
      (u.name && String(u.name).trim()) || u.username || u._id.toString(),
    ]),
  );

  if (assignmentIds.length === 0 || studentIds.length === 0) {
    return {
      class_name: className,
      date: dayYmd,
      assignments_total: 0,
      students: [],
      label: {
        assignments_note:
          "Điểm TB chỉ các lượt có điểm trong ngày (ưu tiên điểm giáo viên). Tổng bài: chỉ bài đã mở cho HS tính đến ngày này (theo Mở cho HS).",
      },
    };
  }

  const submissions = await db
    .collection("submissions")
    .find({
      assignment_id: { $in: assignmentIds },
      student_id: { $in: studentIds },
      created_at: { $gte: start, $lte: end },
    })
    .project({
      student_id: 1,
      assignment_id: 1,
      created_at: 1,
      ai_result: 1,
      teacher_review: 1,
    })
    .toArray();

  /** @type {Map<string, { submission_count: number, scores: number[], aids: Set<string> }>} */
  const byStudent = new Map();

  for (const sub of submissions) {
    const sid = sub.student_id?.toString();
    if (!sid) continue;
    if (vietnamDayKey(sub.created_at) !== dayYmd) continue;

    if (!byStudent.has(sid)) {
      byStudent.set(sid, { submission_count: 0, scores: [], aids: new Set() });
    }
    const b = byStudent.get(sid);
    b.submission_count += 1;
    const aid = sub.assignment_id?.toString();
    if (aid) b.aids.add(aid);
    const sc = effectiveScore(sub);
    if (sc != null) b.scores.push(sc);
  }

  const studentsOut = [...byStudent.entries()]
    .map(([student_id, agg]) => ({
      student_id,
      student_name: studentNameById.get(student_id) || student_id,
      submission_count: agg.submission_count,
      avg_score: roundAvg(agg.scores),
      assignments_done: agg.aids.size,
      assignments_total,
    }))
    .sort((a, b) =>
      a.student_name.localeCompare(b.student_name, "vi", { numeric: true }),
    );

  return {
    class_name: className,
    date: dayYmd,
    assignments_total,
    students: studentsOut,
    label: {
      assignments_note:
        "Bài trong ngày: số bài tập khác nhau có ít nhất một lượt nộp trong ngày (chỉ bài đã mở cho HS tính đến ngày đó). Tổng bài: bài gán lớp trong phạm vi xem của bạn — đã mở cho HS tính đến ngày này (khớp đề HS thấy trong /assignments).",
    },
  };
}
