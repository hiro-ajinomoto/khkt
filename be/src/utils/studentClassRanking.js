import { resolveExistingAssignmentIdsForClass } from "./teacherSubmissionActivity.js";

function effectiveScore(sub) {
  const o = sub?.teacher_review?.score_override;
  if (typeof o === "number" && Number.isFinite(o)) return o;
  const s = sub?.ai_result?.score;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  return null;
}

/**
 * Bảng xếp hạng lớp theo điểm: với mỗi bài gán lớp lấy điểm cao nhất của HS,
 * rồi trung bình các điểm đó (chỉ các bài đã có ít nhất một lần chấm).
 * @param {import('mongodb').Db} db
 * @param {string} className
 * @returns {Promise<{ class_name: string, metric_label: string, entries: Array<{ student_id: string, display_name: string, avg_score: number|null, assignments_graded: number, rank: number }> }>}
 */
export async function buildStudentClassRanking(db, className) {
  const students = await db
    .collection("users")
    .find({ role: "student", class_name: className })
    .project({ name: 1, username: 1 })
    .toArray();

  const assignmentIds = await resolveExistingAssignmentIdsForClass(
    db,
    className,
  );

  /** @type {Map<string, Map<string, number>>} */
  const bestByStudent = new Map();
  for (const u of students) {
    bestByStudent.set(u._id.toString(), new Map());
  }

  if (assignmentIds.length > 0 && students.length > 0) {
    const studentIds = students.map((s) => s._id);
    const submissions = await db
      .collection("submissions")
      .find({
        student_id: { $in: studentIds },
        assignment_id: { $in: assignmentIds },
      })
      .project({
        student_id: 1,
        assignment_id: 1,
        ai_result: 1,
        teacher_review: 1,
      })
      .toArray();

    for (const sub of submissions) {
      const sc = effectiveScore(sub);
      if (sc == null) continue;
      const sid = sub.student_id?.toString();
      const aid = sub.assignment_id?.toString();
      if (!sid || !aid) continue;
      const perAssign = bestByStudent.get(sid);
      if (!perAssign) continue;
      const prev = perAssign.get(aid);
      if (prev == null || sc > prev) perAssign.set(aid, sc);
    }
  }

  const entries = students.map((u) => {
    const perAssign = bestByStudent.get(u._id.toString());
    const scores = perAssign ? [...perAssign.values()] : [];
    const graded = scores.length;
    const avg =
      graded > 0
        ? Math.round((scores.reduce((a, x) => a + x, 0) / graded) * 100) / 100
        : null;
    const display =
      (u.name && String(u.name).trim()) || u.username || u._id.toString();
    return {
      student_id: u._id.toString(),
      display_name: display,
      avg_score: avg,
      assignments_graded: graded,
      rank: 0,
    };
  });

  entries.sort((a, b) => {
    if (a.avg_score == null && b.avg_score == null) {
      return a.display_name.localeCompare(b.display_name, "vi", {
        numeric: true,
      });
    }
    if (a.avg_score == null) return 1;
    if (b.avg_score == null) return -1;
    if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
    if (b.assignments_graded !== a.assignments_graded) {
      return b.assignments_graded - a.assignments_graded;
    }
    return a.display_name.localeCompare(b.display_name, "vi", {
      numeric: true,
    });
  });

  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      entries[i].rank = 1;
    } else if (entries[i].avg_score === entries[i - 1].avg_score) {
      entries[i].rank = entries[i - 1].rank;
    } else {
      entries[i].rank = i + 1;
    }
  }

  return {
    class_name: className,
    metric_label:
      "Xếp hạng theo điểm trung bình các bài tập đã gán cho lớp (mỗi bài lấy điểm cao nhất của bạn, ưu tiên điểm giáo viên).",
    entries,
  };
}
