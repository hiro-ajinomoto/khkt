/**
 * Hàng đợi «cầu đánh độ» trên phiếu: lưu trước, chia tiền cột Cầu sau khi đánh xong.
 * @param {unknown} raw
 * @param {Date} [serverNow]
 * @param {number} [rowLen] — số dòng phiếu (clamp pickupRowIndex)
 */
export function normalizeCauDoQueue(raw, serverNow = new Date(), rowLen = 0) {
  const nowIso =
    serverNow instanceof Date && !Number.isNaN(serverNow.getTime())
      ? serverNow.toISOString()
      : new Date().toISOString();
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  const maxIdx = rowLen > 0 ? rowLen - 1 : 0;
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    let id = typeof x.id === "string" && x.id.trim() ? x.id.trim().slice(0, 80) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const pickupTen = String(x.pickupTen ?? "").trim().slice(0, 200);
    if (!pickupTen) continue;
    let pickupRowIndex = Number(x.pickupRowIndex);
    if (!Number.isFinite(pickupRowIndex)) pickupRowIndex = 0;
    pickupRowIndex = Math.max(0, Math.min(maxIdx, Math.floor(pickupRowIndex)));
    let priceVnd = Number(x.priceVnd);
    if (!Number.isFinite(priceVnd) || priceVnd <= 0) continue;
    priceVnd = Math.round(priceVnd);
    let queuedAt = typeof x.queuedAt === "string" && x.queuedAt.trim() ? x.queuedAt.trim() : nowIso;
    if (Number.isNaN(new Date(queuedAt).getTime())) queuedAt = nowIso;
    out.push({ id, pickupRowIndex, pickupTen, priceVnd, queuedAt });
  }
  return out;
}
