import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";

export const ROW_COUNT = 18;

export const emptyRow = () => ({
  ten: "",
  san: "",
  cuonCan: "",
  cau: "",
  suoi5k: "",
  nuocNgot10k: "",
  doAn: "",
  noCu: "",
  homNayTra: "",
  ghiChu: "",
});

export function parseMoney(v) {
  if (v === "" || v == null) return 0;
  let s = String(v).replace(/\s/g, "").trim();
  if (!s) return 0;
  if (/^(\d{1,3})(\.\d{3})+$/.test(s)) {
    return Number(s.replace(/\./g, "")) || 0;
  }
  if (/^\d+,\d+$/.test(s)) {
    return Number(s.replace(",", ".")) || 0;
  }
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function computeRow(r) {
  const doanhThu =
    parseMoney(r.san) +
    parseMoney(r.cuonCan) +
    parseMoney(r.cau) +
    parseMoney(r.suoi5k) +
    parseMoney(r.nuocNgot10k) +
    parseMoney(r.doAn) +
    parseMoney(r.noCu);
  const conNo = doanhThu - parseMoney(r.homNayTra);
  return { doanhThu, conNo };
}

export function computeTotals(rows) {
  let san = 0;
  let cuonCan = 0;
  let cau = 0;
  let suoi5k = 0;
  let nuocNgot10k = 0;
  let doAn = 0;
  let noCu = 0;
  let doanhThu = 0;
  let homNayTra = 0;
  let conNo = 0;
  const derived = rows.map((r) => computeRow(r));
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    san += parseMoney(r.san);
    cuonCan += parseMoney(r.cuonCan);
    cau += parseMoney(r.cau);
    suoi5k += parseMoney(r.suoi5k);
    nuocNgot10k += parseMoney(r.nuocNgot10k);
    doAn += parseMoney(r.doAn);
    noCu += parseMoney(r.noCu);
    doanhThu += derived[i].doanhThu;
    homNayTra += parseMoney(r.homNayTra);
    conNo += derived[i].conNo;
  }
  return { san, cuonCan, cau, suoi5k, nuocNgot10k, doAn, noCu, doanhThu, homNayTra, conNo };
}

/** @param {string} reportDate YYYY-MM-DD */
export function metaFromReportDate(reportDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return null;
  const d = parseISO(reportDate);
  if (Number.isNaN(d.getTime())) return null;
  return {
    reportDate,
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    isoWeekYear: getISOWeekYear(d),
    isoWeek: getISOWeek(d),
  };
}

export function normalizeRows(raw) {
  if (!Array.isArray(raw) || raw.length !== ROW_COUNT) return null;
  const allowed = new Set(Object.keys(emptyRow()));
  return raw.map((r) => {
    const o = emptyRow();
    if (!r || typeof r !== "object") return o;
    for (const k of allowed) {
      if (typeof r[k] === "string") o[k] = r[k];
    }
    return o;
  });
}

/** Cột tiền tạo doanh thu — dùng cho ledger + cellTimes + lịch sử. */
export const HISTORY_LINE_FIELDS = [
  { key: "san", label: "Sân" },
  { key: "cuonCan", label: "Cuốn cán" },
  { key: "cau", label: "Cầu" },
  { key: "suoi5k", label: "Suối" },
  { key: "nuocNgot10k", label: "Nước ngọt" },
  { key: "doAn", label: "Đồ ăn" },
  { key: "noCu", label: "Nợ cũ" },
];

/** Ledger: đọc / ghi các dòng chi tiết theo từng lần bán (không gộp ô thành 1 giá duy nhất trong lịch sử). */
export function emptyCellLedger() {
  return Array.from({ length: ROW_COUNT }, () => /** @type {Record<string, { amount: number; at: Date }[]>} */ ({}));
}

/** @returns {number} */
export function sumLedgerEntries(entries) {
  if (!Array.isArray(entries)) return 0;
  let s = 0;
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    const a = typeof e.amount === "number" && Number.isFinite(e.amount) ? Math.round(Math.abs(e.amount)) : 0;
    if (a > 0) s += a;
  }
  return s;
}

function coerceLedgerDate(v, serverNow) {
  if (v == null) return serverNow;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return serverNow;
  const maxSkewMs = 5 * 60 * 1000;
  if (d.getTime() > serverNow.getTime() + maxSkewMs) return serverNow;
  return d;
}

/**
 * @param {unknown} raw
 * @param {Date} [serverNow]
 */
export function normalizeCellLedger(raw, serverNow = new Date()) {
  const out = emptyCellLedger();
  if (!Array.isArray(raw) || raw.length !== ROW_COUNT) return out;
  for (let i = 0; i < ROW_COUNT; i++) {
    const blob = raw[i];
    if (!blob || typeof blob !== "object" || Array.isArray(blob)) continue;
    for (const { key } of HISTORY_LINE_FIELDS) {
      const arr = blob[key];
      if (!Array.isArray(arr)) continue;
      /** @type {Array<{ amount: number; at: Date }>} */
      const lines = [];
      for (const e of arr) {
        if (!e || typeof e !== "object") continue;
        let amount =
          typeof e.amount === "number" && Number.isFinite(e.amount)
            ? Math.round(Math.abs(e.amount))
            : 0;
        if (typeof e.amount === "string" && e.amount.trim() !== "") {
          amount = Math.round(parseMoney(e.amount));
          if (!Number.isFinite(amount) || amount < 0) amount = 0;
        }
        if (amount <= 0) continue;
        lines.push({
          amount,
          at: coerceLedgerDate("at" in e ? e.at : undefined, serverNow),
        });
      }
      if (lines.length > 0) out[i][key] = lines;
    }
  }
  return out;
}

/**
 * Ghi ô tiền từ ledger (tổng các dòng) hoặc giữ ô gốc nếu chưa có dòng trong ledger.
 * @param {ReturnType<typeof normalizeRows>} rows
 * @param {ReturnType<typeof normalizeCellLedger>} ledger
 */
export function syncRowsStringsFromLedger(rows, ledger) {
  const base = normalizeRows(rows);
  if (!base) return rows;
  for (let i = 0; i < ROW_COUNT; i++) {
    for (const { key } of HISTORY_LINE_FIELDS) {
      const entries = ledger[i]?.[key];
      const count = Array.isArray(entries) ? entries.length : 0;
      if (count === 0) continue;
      const sum = sumLedgerEntries(entries);
      base[i][key] = sum === 0 ? "" : String(sum);
    }
  }
  return base;
}

/** Bù phiếu cũ: có số trong `rows`, chưa có dòng trong ledger → một dòng synth. */
export function fillMissingLedgerFromRows(ledger, rows, docFallback, sheetUpdatedAt, serverNow = new Date()) {
  const lb = ledger.map((row) =>
    typeof row === "object" && row && !Array.isArray(row) ? { ...row } : {},
  );
  const fbRaw = sheetUpdatedAt ?? docFallback?.updatedAt;
  const fallback =
    fbRaw instanceof Date ? fbRaw : fbRaw ? new Date(fbRaw) : serverNow;
  const rowsNorm = normalizeRows(rows);
  if (!rowsNorm) return lb;

  for (let i = 0; i < ROW_COUNT; i++) {
    for (const { key } of HISTORY_LINE_FIELDS) {
      const cur = lb[i]?.[key];
      if (Array.isArray(cur) && cur.length > 0) continue;
      const n = parseMoney(rowsNorm[i][key]);
      if (n <= 0) continue;
      const atGuess = coerceLedgerDate(
        docFallback?.cellTimes?.[i]?.[key],
        coerceLedgerDate(fallback, serverNow),
      );
      lb[i][key] = [{ amount: n, at: atGuess }];
    }
  }
  return lb;
}

/** API cũ chỉ gửi `rows`: xóa ledger tại ô có tổng 0 trong rows. */
export function pruneLedgerZeroRows(ledger, rows) {
  const rn = normalizeRows(rows);
  if (!rn) {
    return ledger.map((row) =>
      typeof row === "object" && row && !Array.isArray(row) ? { ...row } : {},
    );
  }
  return ledger.map((row, i) => {
    const o = typeof row === "object" && row && !Array.isArray(row) ? { ...row } : {};
    for (const { key } of HISTORY_LINE_FIELDS) {
      if (parseMoney(rn[i][key]) <= 0) delete o[key];
    }
    return o;
  });
}

/**
 * Cập nhật mốc thời gian theo từng ô (không gộp mặt hàng): khi số tiền ô đổi thì ghi nhận `when`.
 * Phiếu cũ chưa có `cellTimes` được bù bằng `legacySheetUpdatedAt` trên lần lưu / khi đọc lịch sử.
 *
 * @param {unknown[] | null | undefined} prevRows
 * @param {unknown[] | null | undefined} prevCellTimes
 * @param {unknown[]} newRows
 * @param {Date} when
 * @param {Date | null | undefined} legacySheetUpdatedAt  `updatedAt` của phiếu trước khi lưu
 */
export function mergeCellTimes(prevRows, prevCellTimes, newRows, when, legacySheetUpdatedAt) {
  const now = when instanceof Date ? when : new Date(when);
  const fallbackTime =
    legacySheetUpdatedAt instanceof Date
      ? legacySheetUpdatedAt
      : legacySheetUpdatedAt
        ? new Date(legacySheetUpdatedAt)
        : now;

  const next = Array.from({ length: ROW_COUNT }, (_, i) => {
    const prev = prevCellTimes?.[i];
    return prev && typeof prev === "object" && !Array.isArray(prev) ? { ...prev } : {};
  });

  for (let i = 0; i < ROW_COUNT; i++) {
    const oldR = prevRows?.[i];
    const newR = newRows[i];
    for (const { key } of HISTORY_LINE_FIELDS) {
      const o = oldR && typeof oldR === "object" ? parseMoney(oldR[key]) : 0;
      const n = newR && typeof newR === "object" ? parseMoney(newR[key]) : 0;

      if (n === 0) {
        if (key in next[i]) delete next[i][key];
        continue;
      }
      if (o !== n) {
        next[i][key] = now;
      }
    }
  }

  for (let i = 0; i < ROW_COUNT; i++) {
    const newR = newRows[i];
    for (const { key } of HISTORY_LINE_FIELDS) {
      const n = newR && typeof newR === "object" ? parseMoney(newR[key]) : 0;
      if (n > 0 && next[i][key] == null) {
        next[i][key] = fallbackTime;
      }
    }
  }

  return next;
}

/** @typedef {{ reportDate: string, rows?: unknown[], updatedAt?: Date, cellTimes?: unknown[], cellLedger?: unknown[] }} HistoryDocLike */

function historyRecordedAt(doc, rowIndex, key) {
  const raw = doc.cellTimes?.[rowIndex]?.[key];
  if (raw != null) {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (doc.updatedAt != null) {
    const u = doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt);
    if (!Number.isNaN(u.getTime())) return u;
  }
  return null;
}

/**
 * @param {number} rowIndex 0..ROW_COUNT-1
 * @param {HistoryDocLike[]} docs
 */
export function buildPersonHistory(rowIndex, docs) {
  const items = [];
  let totalPaid = 0;
  const sorted = [...docs].sort((a, b) => String(a.reportDate).localeCompare(String(b.reportDate)));

  for (const doc of sorted) {
    const row = doc.rows?.[rowIndex];
    if (!row || typeof row !== "object") continue;
    for (let fi = 0; fi < HISTORY_LINE_FIELDS.length; fi++) {
      const { key, label } = HISTORY_LINE_FIELDS[fi];
      const rawLedger = doc.cellLedger?.[rowIndex]?.[key];
      const ledgerLines = Array.isArray(rawLedger) ? rawLedger : [];

      if (ledgerLines.length > 0) {
        for (let lineIx = 0; lineIx < ledgerLines.length; lineIx++) {
          const entry = ledgerLines[lineIx];
          const amount =
            entry && typeof entry.amount === "number" && Number.isFinite(entry.amount)
              ? Math.round(Math.abs(entry.amount))
              : parseMoney(entry?.amount);
          if (amount <= 0) continue;

          let recordedAt = null;
          const rawAt = entry?.at;
          if (rawAt != null) {
            recordedAt = rawAt instanceof Date ? rawAt : new Date(rawAt);
            if (Number.isNaN(recordedAt.getTime())) recordedAt = null;
          }
          if (recordedAt == null) {
            recordedAt = historyRecordedAt(doc, rowIndex, key);
          }

          items.push({
            reportDate: doc.reportDate,
            item: label,
            amount,
            recordedAt,
            _fieldIx: fi,
            _lineIx: lineIx,
          });
        }
      } else {
        const amount = parseMoney(row[key]);
        if (amount > 0) {
          items.push({
            reportDate: doc.reportDate,
            item: label,
            amount,
            recordedAt: historyRecordedAt(doc, rowIndex, key),
            _fieldIx: fi,
            _lineIx: 0,
          });
        }
      }
    }
    totalPaid += parseMoney(row.homNayTra);
  }

  let ten = "";
  for (let i = sorted.length - 1; i >= 0; i--) {
    const r = sorted[i].rows?.[rowIndex];
    const t = r && typeof r.ten === "string" ? r.ten.trim() : "";
    if (t) {
      ten = t;
      break;
    }
  }

  items.sort((a, b) => {
    if (!a.recordedAt && !b.recordedAt) {
      const dc = String(a.reportDate).localeCompare(String(b.reportDate));
      if (dc !== 0) return dc;
      const fic = a._fieldIx - b._fieldIx;
      if (fic !== 0) return fic;
      return (a._lineIx ?? 0) - (b._lineIx ?? 0);
    }
    if (!a.recordedAt) return 1;
    if (!b.recordedAt) return -1;
    const ta = new Date(a.recordedAt).getTime();
    const tb = new Date(b.recordedAt).getTime();
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    if (na !== nb) return na - nb;
    const dc = String(a.reportDate).localeCompare(String(b.reportDate));
    if (dc !== 0) return dc;
    const fic = a._fieldIx - b._fieldIx;
    if (fic !== 0) return fic;
    return (a._lineIx ?? 0) - (b._lineIx ?? 0);
  });

  const outward = items.map(({ _fieldIx: _omit, _lineIx: _omitLi, ...rest }) => rest);

  const grandTotal = outward.reduce((s, x) => s + x.amount, 0);
  return { ten, items: outward, grandTotal, totalPaid };
}
