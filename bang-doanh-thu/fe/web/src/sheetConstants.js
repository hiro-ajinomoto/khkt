/** Số dòng tối thiểu / mặc định / tối đa trên một phiếu — phải khớp `revenueUtils.js` (backend). */
export const ROW_COUNT_MIN = 15;
export const ROW_COUNT_DEFAULT = 15;
/** Tối đa dòng khi bấm «+» thêm hàng; phiếu mới vẫn bắt đầu `ROW_COUNT_DEFAULT` dòng. */
export const ROW_COUNT_MAX = 60;

/** STT tối đa (link lịch sử, GET /history/:stt). */
export const ROW_COUNT = ROW_COUNT_MAX;

/**
 * @param {number} len
 * @returns {number}
 */
export function sheetRowCountFromLength(len) {
  const n = Number.isFinite(len) ? Math.floor(len) : 0;
  if (n < 1) return ROW_COUNT_DEFAULT;
  return Math.min(ROW_COUNT_MAX, Math.max(ROW_COUNT_MIN, n));
}
