/**
 * Quy đổi ô **Cầu**: mỗi lần bấm ± ghi vào ô là **một lần vào đúng mức tiền**,
 * chứ không phải một quả hoàn chỉnh. Bảng dưới cho biết **bao nhiêu lần** như vậy
 * thì được **1 quả** cầu ứng với loại ± đó (theo nút trong `App.jsx` CAU_STEPS).
 *
 * Ví dụ đã xác nhận: **4 lần ±6 (6000đ)** ⇒ **1 quả**. Chỉnh các mục `"7"`, `"7.5"`, `"8"`
 * khi bạn có quy ước thực tế (đang mặc định giống ±6 có thể sửa được).
 */

/** Khóa = chữ thập phân giống `ledgerTierTxnCount` (vd. "7.5"). */
export const CAU_CLICKS_PER_QUA_BY_STEP = Object.freeze({
  "6": 4,
  "7": 4,
  "7.5": 4,
  "8": 4,
});

/**
 * @param {number | string} step — bước giá cầu (6, 7, 7.5, …)
 * @returns {number} luôn ≥ 1 (fallback 1 nếu cấu hình thiếu)
 */
export function getCauClicksPerQua(step) {
  const n = CAU_CLICKS_PER_QUA_BY_STEP[String(step)];
  return typeof n === "number" && n > 0 ? n : 1;
}
