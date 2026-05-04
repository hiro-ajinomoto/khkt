/** Giá 1 loại cầu (VNĐ). */
export const CHIA_CAU_PRICE_OPTIONS = Object.freeze([
  { vnd: 24000, label: "24.000đ" },
  { vnd: 28000, label: "28.000đ" },
  { vnd: 30000, label: "30.000đ" },
  { vnd: 32000, label: "32.000đ" },
]);

/** Chia tổng tiền (VNĐ, số nguyên) đều cho `n` người; tổng các phần = `totalVnd`. */
export function splitTotalEvenInt(totalVnd, n) {
  if (!Number.isFinite(totalVnd) || totalVnd <= 0 || !Number.isFinite(n) || n <= 0) return [];
  const t = Math.round(totalVnd);
  const base = Math.floor(t / n);
  const rem = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
