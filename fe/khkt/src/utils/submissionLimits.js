/** Đồng bộ logic với be/src/utils/submissionLimits.js — 0 = không giới hạn; mặc định 5 */

export function resolveMaxSubmissionsClient(assignment) {
  const v = assignment?.max_submissions_per_student;
  if (v === 0 || v === '0') return Infinity;
  if (v === undefined || v === null || v === '') return 5;
  const n = Number(v);
  if (n === 0) return Infinity;
  if ([3, 5, 10].includes(n)) return n;
  return 5;
}

export function isAtSubmissionLimit(assignment) {
  if (!assignment || assignment.my_submission_count == null) return false;
  const max = resolveMaxSubmissionsClient(assignment);
  if (!Number.isFinite(max)) return false;
  return assignment.my_submission_count >= max;
}

/** Chuỗi hiển thị cho HS: "Đã nộp 2/5 lần" hoặc "Đã nộp 3 lần (không giới hạn)" */
export function formatSubmissionQuota(assignment) {
  const count = assignment?.my_submission_count;
  if (count == null) return null;
  const max = resolveMaxSubmissionsClient(assignment);
  if (!Number.isFinite(max)) {
    return `Đã nộp ${count} lần (không giới hạn số lần nộp)`;
  }
  return `Đã nộp ${count}/${max} lần`;
}
