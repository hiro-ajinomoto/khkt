import { computeStickerStatsFromSubmissionRows } from "./stickers.js";

export const REDEMPTION_ALLOWED_COSTS = Object.freeze([30, 180, 220]);

/**
 * @param {unknown} n
 * @returns {boolean}
 */
export function isValidRedemptionCost(n) {
  const x = Number(n);
  return Number.isInteger(x) && REDEMPTION_ALLOWED_COSTS.includes(x);
}

/**
 * @param {import('mongodb').Db} db
 * @param {import('mongodb').ObjectId} studentId
 */
export async function getStudentStickerEarnedTotal(db, studentId) {
  const subs = await db
    .collection("submissions")
    .find({ student_id: studentId })
    .project({ assignment_id: 1, created_at: 1, ai_result: 1 })
    .toArray();
  return computeStickerStatsFromSubmissionRows(subs).total_sticker_count;
}

/**
 * Sum of sticker_cost already redeemed for this student.
 * @param {import('mongodb').Db} db
 * @param {import('mongodb').ObjectId} studentId
 */
export async function getStudentRedeemedTotal(db, studentId) {
  const agg = await db
    .collection("sticker_redemptions")
    .aggregate([
      { $match: { student_id: studentId } },
      { $group: { _id: null, t: { $sum: "$sticker_cost" } } },
    ])
    .toArray();
  return agg[0]?.t ?? 0;
}

/**
 * @param {import('mongodb').Db} db
 * @returns {Promise<Array<{
 *   id: string,
 *   username: string,
 *   name: string,
 *   class_name: string | null,
 *   stickers_earned: number,
 *   stickers_redeemed: number,
 *   stickers_available: number
 * }>>}
 */
export async function getStickerRedeemOverviewForAllStudents(db) {
  const students = await db
    .collection("users")
    .find({ role: "student" })
    .project({ username: 1, name: 1, class_name: 1 })
    .toArray();

  if (students.length === 0) return [];

  const ids = students.map((s) => s._id);
  const submissions = await db
    .collection("submissions")
    .find({ student_id: { $in: ids } })
    .project({ student_id: 1, assignment_id: 1, created_at: 1, ai_result: 1 })
    .toArray();

  /** @type {Map<string, Array>} */
  const byStudent = new Map();
  for (const sub of submissions) {
    const sid = sub.student_id.toString();
    if (!byStudent.has(sid)) byStudent.set(sid, []);
    byStudent.get(sid).push(sub);
  }

  const redeemedAgg = await db
    .collection("sticker_redemptions")
    .aggregate([
      { $match: { student_id: { $in: ids } } },
      { $group: { _id: "$student_id", total: { $sum: "$sticker_cost" } } },
    ])
    .toArray();

  /** @type {Map<string, number>} */
  const redeemedMap = new Map(
    redeemedAgg.map((r) => [r._id.toString(), r.total])
  );

  const rows = students.map((s) => {
    const sid = s._id.toString();
    const earned = computeStickerStatsFromSubmissionRows(
      byStudent.get(sid) || []
    ).total_sticker_count;
    const redeemed = redeemedMap.get(sid) ?? 0;
    return {
      id: sid,
      username: s.username,
      name: s.name || s.username,
      class_name: s.class_name || null,
      stickers_earned: earned,
      stickers_redeemed: redeemed,
      stickers_available: Math.max(0, earned - redeemed),
    };
  });

  rows.sort((a, b) => a.username.localeCompare(b.username, "vi"));
  return rows;
}
