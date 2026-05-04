/**
 * Chuẩn hoá hàng đợi cầu độ (khớp logic `be/src/cauDoQueue.js`).
 * @param {unknown} raw
 * @param {number} rowLen
 */
export function normalizeCauDoQueueClient(raw, rowLen = 0) {
  const nowIso = new Date().toISOString();
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

/**
 * @param {{ pickupRowIndex: number, pickupTen: string, priceVnd: number }} p
 */
export function newCauDoQueueItem(p) {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `q-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  return {
    id,
    pickupRowIndex: Math.max(0, Math.floor(Number(p.pickupRowIndex) || 0)),
    pickupTen: String(p.pickupTen ?? "").trim().slice(0, 200),
    priceVnd: Math.round(Number(p.priceVnd) || 0),
    queuedAt: new Date().toISOString(),
  };
}
