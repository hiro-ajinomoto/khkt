import {
  shiftVietnamYmd,
  vietnamDayBoundsInclusive,
  resolveExistingAssignmentIdsForClass,
} from "./teacherSubmissionActivity.js";

function effectiveScore(sub) {
  const o = sub?.teacher_review?.score_override;
  if (typeof o === "number" && Number.isFinite(o)) return o;
  const s = sub?.ai_result?.score;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  return null;
}

function vietnamTodayYmd() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** Thứ Hai = 0 … Chủ nhật = 6 theo lịch VN. */
function vnWeekdayMon0FromYmd(ymd) {
  const w = new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
  });
  const key = String(w).replace(/\.$/, "").slice(0, 3);
  const map = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[key] ?? 0;
}

function weekBoundsVnMondayToSunday(ymd) {
  const mon0 = vnWeekdayMon0FromYmd(ymd);
  const startYmd = shiftVietnamYmd(ymd, -mon0);
  const endYmd = shiftVietnamYmd(startYmd, 6);
  return { startYmd, endYmd };
}

function monthBoundsVnContaining(ymd) {
  const ym = ymd.slice(0, 7);
  const startYmd = `${ym}-01`;
  let endYmd = startYmd;
  let candidate = shiftVietnamYmd(endYmd, 1);
  while (candidate.slice(0, 7) === ym) {
    endYmd = candidate;
    candidate = shiftVietnamYmd(candidate, 1);
  }
  return { startYmd, endYmd };
}

function formatYmdViShort(ymd) {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

/**
 * @param {import('mongodb').Db} db
 * @param {Date} start
 * @param {Date} end
 * @param {{ students: object[], assignmentIds: import('mongodb').ObjectId[] }} cached
 * @param {{ allTime?: boolean }} [options] allTime = true → mọi lượt nộp có điểm (không lọc theo ngày).
 */
async function buildRankedEntriesForWindow(db, start, end, cached, options = {}) {
  const { students, assignmentIds } = cached;
  const allTime = Boolean(options.allTime);

  /** @type {Map<string, Map<string, number>>} */
  const bestByStudent = new Map();
  for (const u of students) {
    bestByStudent.set(u._id.toString(), new Map());
  }

  if (assignmentIds.length > 0 && students.length > 0) {
    const studentIds = students.map((s) => s._id);
    const filter = {
      student_id: { $in: studentIds },
      assignment_id: { $in: assignmentIds },
    };
    if (!allTime) {
      filter.created_at = { $gte: start, $lte: end };
    }
    const submissions = await db
      .collection("submissions")
      .find(filter)
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

  return entries;
}

/**
 * Xếp hạng lớp — bốn kỳ: ĐTB tổng (toàn thời gian), hôm nay, tuần (Thứ Hai–CN, VN), tháng (VN).
 * Kỳ có khoảng ngày: chỉ lượt nộp có điểm trong khoảng (theo giờ VN).
 * Kỳ tổng: mọi lượt nộp có điểm; mỗi bài lấy điểm cao nhất mọi thời điểm.
 *
 * @param {import('mongodb').Db} db
 * @param {string} className
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

  const cached = { students, assignmentIds };

  const today = vietnamTodayYmd();
  const { startYmd: weekStart, endYmd: weekEnd } =
    weekBoundsVnMondayToSunday(today);
  const { startYmd: monthStart, endYmd: monthEnd } =
    monthBoundsVnContaining(today);

  const dayBounds = vietnamDayBoundsInclusive(today, today);
  const weekBounds = vietnamDayBoundsInclusive(weekStart, weekEnd);
  const monthBounds = vietnamDayBoundsInclusive(monthStart, monthEnd);

  const [overallEntries, dayEntries, weekEntries, monthEntries] = await Promise.all([
    buildRankedEntriesForWindow(db, null, null, cached, { allTime: true }),
    buildRankedEntriesForWindow(db, dayBounds.start, dayBounds.end, cached),
    buildRankedEntriesForWindow(db, weekBounds.start, weekBounds.end, cached),
    buildRankedEntriesForWindow(db, monthBounds.start, monthBounds.end, cached),
  ]);

  const dayLabel = `Hôm nay (${formatYmdViShort(today)})`;
  const weekLabel = `Tuần này (${formatYmdViShort(weekStart)} — ${formatYmdViShort(weekEnd)})`;
  const [ty, tm] = today.split("-");
  const monthLabel = `Tháng ${Number(tm)}/${ty}`;

  return {
    class_name: className,
    overall: {
      period: "overall",
      from_ymd: null,
      to_ymd: null,
      range_label: "ĐTB tổng (toàn thời gian)",
      metric_label:
        "Trên tất cả bài tập đã gán cho lớp: với mỗi bài, lấy điểm cao nhất mọi lượt nộp (ưu tiên điểm giáo viên). ĐTB = trung bình các bài đã có điểm — dùng để xếp hạng theo điểm ổn định.",
      entries: overallEntries,
    },
    day: {
      period: "day",
      from_ymd: today,
      to_ymd: today,
      range_label: dayLabel,
      metric_label:
        "Chỉ các lượt nộp trong ngày hôm nay (giờ Việt Nam), có điểm; mỗi bài trong ngày lấy điểm cao nhất (ưu tiên điểm giáo viên). ĐTB trung bình trên các bài có điểm trong ngày.",
      entries: dayEntries,
    },
    week: {
      period: "week",
      from_ymd: weekStart,
      to_ymd: weekEnd,
      range_label: weekLabel,
      metric_label:
        "Tuần từ Thứ Hai đến Chủ nhật (giờ VN), chỉ lượt nộp có điểm trong khoảng đó; mỗi bài lấy điểm cao nhất trong tuần.",
      entries: weekEntries,
    },
    month: {
      period: "month",
      from_ymd: monthStart,
      to_ymd: monthEnd,
      range_label: monthLabel,
      metric_label:
        "Trong tháng dương lịch hiện tại (giờ VN), lượt nộp có điểm; mỗi bài lấy điểm cao nhất trong tháng.",
      entries: monthEntries,
    },
  };
}
