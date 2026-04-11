/**
 * Giới hạn số lần nộp bài / học sinh / bài tập (giảm tải server).
 * 0 = không giới hạn; mặc định khi thiếu trường = 5; cho phép 3 | 5 | 10 | 0.
 */

export const DEFAULT_MAX_SUBMISSIONS_PER_STUDENT = 5;

export const ALLOWED_MAX_SUBMISSIONS = Object.freeze([0, 3, 5, 10]);

/**
 * @param {unknown} raw — từ multipart body (string)
 * @returns {{ value?: number, error?: string }}
 */
export function parseMaxSubmissionsRaw(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { value: DEFAULT_MAX_SUBMISSIONS_PER_STUDENT };
  }
  const n = parseInt(String(raw).trim(), 10);
  if (Number.isNaN(n) || !ALLOWED_MAX_SUBMISSIONS.includes(n)) {
    return {
      error:
        "Số lần nộp tối đa phải là 3, 5, 10 hoặc 0 (không giới hạn).",
    };
  }
  return { value: n };
}

/**
 * @param {object} assignment — document từ MongoDB
 * @returns {number} — số lần tối đa, hoặc Infinity nếu không giới hạn
 */
export function resolveMaxSubmissionsLimit(assignment) {
  const v = assignment?.max_submissions_per_student;
  if (v === undefined || v === null) {
    return DEFAULT_MAX_SUBMISSIONS_PER_STUDENT;
  }
  const n = Number(v);
  if (n === 0) return Infinity;
  if ([3, 5, 10].includes(n)) return n;
  return DEFAULT_MAX_SUBMISSIONS_PER_STUDENT;
}

/**
 * Giá trị lưu trong DB / trả về API (0 = không giới hạn; thiếu → 5)
 */
export function storedMaxSubmissionsForApi(assignment) {
  const v = assignment?.max_submissions_per_student;
  if (v === undefined || v === null) {
    return DEFAULT_MAX_SUBMISSIONS_PER_STUDENT;
  }
  const n = Number(v);
  if (ALLOWED_MAX_SUBMISSIONS.includes(n)) return n;
  return DEFAULT_MAX_SUBMISSIONS_PER_STUDENT;
}
