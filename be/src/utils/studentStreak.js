import { shiftVietnamYmd } from "./teacherSubmissionActivity.js";

function vietnamTodayYmd() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Cập nhật streak khi học sinh có hoạt động nộp bài (mỗi ngày VN tính một lần).
 * @param {import('mongodb').Db} db
 * @param {ObjectId} studentObjectId
 */
export async function applyStreakOnSubmission(db, studentObjectId) {
  const today = vietnamTodayYmd();
  const yesterday = shiftVietnamYmd(today, -1);

  const user = await db.collection("users").findOne(
    { _id: studentObjectId },
    {
      projection: {
        role: 1,
        streak_current: 1,
        streak_longest: 1,
        streak_last_activity_ymd: 1,
      },
    },
  );

  if (!user || user.role !== "student") return null;

  const last = user.streak_last_activity_ymd
    ? String(user.streak_last_activity_ymd).trim()
    : null;
  const current = Number.isFinite(user.streak_current)
    ? user.streak_current
    : 0;
  const longest = Number.isFinite(user.streak_longest)
    ? user.streak_longest
    : 0;

  if (last === today) {
    return {
      streak_current: current,
      streak_longest: Math.max(longest, current),
      streak_last_activity_ymd: today,
    };
  }

  let nextCurrent;
  if (!last) {
    nextCurrent = 1;
  } else if (last === yesterday) {
    nextCurrent = current > 0 ? current + 1 : 1;
  } else {
    nextCurrent = 1;
  }

  const nextLongest = Math.max(longest, nextCurrent);

  await db.collection("users").updateOne(
    { _id: studentObjectId },
    {
      $set: {
        streak_current: nextCurrent,
        streak_longest: nextLongest,
        streak_last_activity_ymd: today,
      },
    },
  );

  return {
    streak_current: nextCurrent,
    streak_longest: nextLongest,
    streak_last_activity_ymd: today,
  };
}

/**
 * Nếu đã qua hơn một ngày VN không có hoạt động, streak hiện tại = 0 (kỷ lục giữ nguyên).
 * Gọi từ /auth/me và login để UI khớp lịch.
 */
export async function normalizeStreakForCalendar(db, studentObjectId) {
  const user = await db.collection("users").findOne(
    { _id: studentObjectId },
    {
      projection: {
        role: 1,
        streak_current: 1,
        streak_last_activity_ymd: 1,
      },
    },
  );

  if (!user || user.role !== "student") return null;

  const today = vietnamTodayYmd();
  const yesterday = shiftVietnamYmd(today, -1);
  const last = user.streak_last_activity_ymd
    ? String(user.streak_last_activity_ymd).trim()
    : null;

  if (!last || last === today || last === yesterday) return null;

  if (last < yesterday && (user.streak_current || 0) > 0) {
    await db.collection("users").updateOne(
      { _id: studentObjectId },
      { $set: { streak_current: 0 } },
    );
    return { streak_current: 0 };
  }
  return null;
}
