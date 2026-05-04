import { getISOWeek, getISOWeekYear, parseISO } from "date-fns";

export const ROW_COUNT_MIN = 15;
export const ROW_COUNT_DEFAULT = 15;
/** Tối đa dòng / phiếu (chuẩn hoá & API; khớp `sheetConstants.js`). */
export const ROW_COUNT_MAX = 60;
/** STT tối đa (history API, v.v.). */
export const ROW_COUNT = ROW_COUNT_MAX;

export function sheetRowCountFromLength(len) {
  const n = Number.isFinite(len) ? Math.floor(len) : 0;
  if (n < 1) return ROW_COUNT_DEFAULT;
  return Math.min(ROW_COUNT_MAX, Math.max(ROW_COUNT_MIN, n));
}

export const emptyRow = () => ({
  ten: "",
  san: "",
  cuonCan: "",
  cau: "",
  suoi5k: "",
  nuocNgot10k: "",
  doAn: "",
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

/** Một dòng ledger: tối đa 2 chữ thập phân (vd. cầu 7,5). */
function roundLedgerAmt(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100) / 100;
}

export function computeRow(r) {
  const doanhThu =
    parseMoney(r.san) +
    parseMoney(r.cuonCan) +
    parseMoney(r.cau) +
    parseMoney(r.suoi5k) +
    parseMoney(r.nuocNgot10k) +
    parseMoney(r.doAn);
  const conNo = doanhThu - parseMoney(r.homNayTra);
  return { doanhThu, conNo };
}

/**
 * @param {ReturnType<typeof normalizeRows>} rows
 * @param {unknown} [conNoLedgerRaw] — mỗi hàng: `{ kind: 'cong'|'tru'|'ghi', amount, at, note? }[]`
 */
export function computeTotals(rows, conNoLedgerRaw = null) {
  let san = 0;
  let cuonCan = 0;
  let cau = 0;
  let suoi5k = 0;
  let nuocNgot10k = 0;
  let doAn = 0;
  let doanhThu = 0;
  let homNayTra = 0;
  let conNo = 0;
  const derived = rows.map((r) => computeRow(r));
  const cnNorm =
    conNoLedgerRaw != null ? normalizeConNoLedger(conNoLedgerRaw, new Date(), rows.length) : null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    san += parseMoney(r.san);
    cuonCan += parseMoney(r.cuonCan);
    cau += parseMoney(r.cau);
    suoi5k += parseMoney(r.suoi5k);
    nuocNgot10k += parseMoney(r.nuocNgot10k);
    doAn += parseMoney(r.doAn);
    doanhThu += derived[i].doanhThu;
    homNayTra += parseMoney(r.homNayTra);
    const adj = cnNorm ? sumConNoLedgerNetForRow(cnNorm[i]) : 0;
    conNo += derived[i].conNo + adj;
  }
  return {
    san,
    cuonCan,
    cau,
    suoi5k,
    nuocNgot10k,
    doAn,
    doanhThu,
    homNayTra,
    conNo,
  };
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

/** Số ngày trong tháng dương lịch (month 1–12). */
export function daysInMonth(year, month1based) {
  return new Date(year, month1based, 0).getDate();
}

/**
 * Chia tháng thành các tuần liên tiếp 7 ngày: tuần 1 = ngày 1–7, tuần 2 = 8–14, …
 * @returns {{ index: number; startDay: number; endDay: number }[]}
 */
export function getCalendarWeekSpansInMonth(year, month1based) {
  const dim = daysInMonth(year, month1based);
  /** @type {{ index: number; startDay: number; endDay: number }[]} */
  const spans = [];
  let d = 1;
  while (d <= dim) {
    const end = Math.min(d + 6, dim);
    spans.push({ index: spans.length + 1, startDay: d, endDay: end });
    d = end + 1;
  }
  return spans;
}

/**
 * @param {number} weekIndex1based  tuần thứ mấy trong tháng dương lịch, bắt đầu từ 1
 */
export function getCalendarWeekSlice(year, month1based, weekIndex1based) {
  const spans = getCalendarWeekSpansInMonth(year, month1based);
  const ix = Number(weekIndex1based);
  if (!Number.isFinite(ix) || ix < 1 || ix > spans.length) return null;
  return spans[ix - 1];
}

export function normalizeRows(raw) {
  if (!Array.isArray(raw)) return null;
  const allowed = new Set(Object.keys(emptyRow()));
  const n = sheetRowCountFromLength(raw.length);
  return Array.from({ length: n }, (_, i) => {
    const r = raw[i];
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
];

/** Ledger: đọc / ghi các dòng chi tiết theo từng lần bán (không gộp ô thành 1 giá duy nhất trong lịch sử). */
export function emptyCellLedger(rowCount = ROW_COUNT_DEFAULT) {
  const n = sheetRowCountFromLength(rowCount);
  return Array.from(
    { length: n },
    () => /** @type {Record<string, { amount: number; at: Date }[]>} */ ({}),
  );
}

/** @returns {number} */
export function sumLedgerEntries(entries) {
  if (!Array.isArray(entries)) return 0;
  let s = 0;
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    let a = 0;
    if (typeof e.amount === "number" && Number.isFinite(e.amount)) {
      a = roundLedgerAmt(e.amount);
    } else if (typeof e.amount === "string" && e.amount.trim() !== "") {
      a = roundLedgerAmt(parseMoney(e.amount));
    }
    if (a > 0) s += a;
  }
  return roundLedgerAmt(s);
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
export function normalizeCellLedger(raw, serverNow = new Date(), rowCount) {
  const n =
    rowCount != null && Number.isFinite(rowCount)
      ? sheetRowCountFromLength(rowCount)
      : sheetRowCountFromLength(Array.isArray(raw) ? raw.length : 0);
  const out = emptyCellLedger(n);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < n; i++) {
    const blob = raw[i];
    if (!blob || typeof blob !== "object" || Array.isArray(blob)) continue;
    for (const { key } of HISTORY_LINE_FIELDS) {
      const arr = blob[key];
      if (!Array.isArray(arr)) continue;
      /** @type {Array<{ amount: number; at: Date }>} */
      const lines = [];
      for (const e of arr) {
        if (!e || typeof e !== "object") continue;
        let amount = 0;
        if (typeof e.amount === "number" && Number.isFinite(e.amount)) {
          amount = roundLedgerAmt(e.amount);
        } else if (typeof e.amount === "string" && e.amount.trim() !== "") {
          amount = roundLedgerAmt(parseMoney(e.amount));
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

function roundConNoLedgerAmt(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100) / 100;
}

/** Mỗi hàng: các dòng ghi nợ (+) / trả nợ (−) điều chỉnh cột «Còn nợ» hiển thị. */
export function emptyConNoLedger(rowCount = ROW_COUNT_DEFAULT) {
  const n = sheetRowCountFromLength(rowCount);
  return Array.from(
    { length: n },
    () => /** @type {Array<{ kind: string; amount: number; at: Date; note: string }>} */ ([]),
  );
}

/** `cong` cộng vào còn nợ hiển thị, `tru` trừ (đã trả). `ghi` chỉ lịch sử (Trả nợ), không đổi ô. */
export function sumConNoLedgerNetForRow(lines) {
  if (!Array.isArray(lines)) return 0;
  let net = 0;
  for (const e of lines) {
    if (!e || typeof e !== "object") continue;
    const kind = e.kind === "tru" ? "tru" : e.kind === "cong" ? "cong" : null;
    if (!kind) continue;
    const a = roundConNoLedgerAmt(
      typeof e.amount === "number" && Number.isFinite(e.amount)
        ? e.amount
        : parseMoney(String(e.amount ?? "")),
    );
    if (a <= 0) continue;
    net += kind === "cong" ? a : -a;
  }
  return Math.round(net * 100) / 100;
}

/**
 * @param {unknown} raw
 * @param {Date} [serverNow]
 */
export function normalizeConNoLedger(raw, serverNow = new Date(), rowCount) {
  const n =
    rowCount != null && Number.isFinite(rowCount)
      ? sheetRowCountFromLength(rowCount)
      : sheetRowCountFromLength(Array.isArray(raw) ? raw.length : 0);
  const out = emptyConNoLedger(n);
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < n; i++) {
    const arr = raw[i];
    if (!Array.isArray(arr)) continue;
    const lines = [];
    for (const e of arr) {
      if (!e || typeof e !== "object") continue;
      const kind =
        e.kind === "tru" ? "tru" : e.kind === "cong" ? "cong" : e.kind === "ghi" ? "ghi" : null;
      if (!kind) continue;
      let amount = 0;
      if (typeof e.amount === "number" && Number.isFinite(e.amount)) {
        amount = roundConNoLedgerAmt(e.amount);
      } else if (typeof e.amount === "string" && e.amount.trim() !== "") {
        amount = roundConNoLedgerAmt(parseMoney(e.amount));
      }
      if (amount <= 0) continue;
      let note = "";
      if (typeof e.note === "string") {
        note = e.note.trim().slice(0, 500);
      }
      lines.push({
        kind,
        amount,
        at: coerceLedgerDate("at" in e ? e.at : undefined, serverNow),
        note,
      });
    }
    if (lines.length > 0) {
      lines.sort((a, b) => a.at.getTime() - b.at.getTime());
      out[i] = lines;
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
  for (let i = 0; i < base.length; i++) {
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
export function fillMissingLedgerFromRows(
  ledger,
  rows,
  docFallback,
  sheetUpdatedAt,
  serverNow = new Date(),
) {
  const lb = ledger.map((row) =>
    typeof row === "object" && row && !Array.isArray(row) ? { ...row } : {},
  );
  const fbRaw = sheetUpdatedAt ?? docFallback?.updatedAt;
  const fallback =
    fbRaw instanceof Date ? fbRaw : fbRaw ? new Date(fbRaw) : serverNow;
  const rowsNorm = normalizeRows(rows);
  if (!rowsNorm) return lb;

  while (lb.length < rowsNorm.length) lb.push({});
  if (lb.length > rowsNorm.length) lb.length = rowsNorm.length;

  for (let i = 0; i < rowsNorm.length; i++) {
    for (const { key } of HISTORY_LINE_FIELDS) {
      const cur = lb[i]?.[key];
      if (Array.isArray(cur) && cur.length > 0) continue;
      const n = parseMoney(rowsNorm[i][key]);
      if (n <= 0) continue;
      const atGuess = coerceLedgerDate(
        docFallback?.cellTimes?.[i]?.[key],
        coerceLedgerDate(fallback, serverNow),
      );
      lb[i][key] = [{ amount: roundLedgerAmt(n), at: atGuess }];
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
  return Array.from({ length: rn.length }, (_, i) => {
    const row = ledger[i];
    const o =
      typeof row === "object" && row && !Array.isArray(row) ? { ...row } : {};
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
export function mergeCellTimes(
  prevRows,
  prevCellTimes,
  newRows,
  when,
  legacySheetUpdatedAt,
) {
  const now = when instanceof Date ? when : new Date(when);
  const fallbackTime =
    legacySheetUpdatedAt instanceof Date
      ? legacySheetUpdatedAt
      : legacySheetUpdatedAt
        ? new Date(legacySheetUpdatedAt)
        : now;

  const n = newRows.length;
  const next = Array.from({ length: n }, (_, i) => {
    const prev = prevCellTimes?.[i];
    return prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...prev }
      : {};
  });

  for (let i = 0; i < n; i++) {
    const oldR = prevRows?.[i];
    const newR = newRows[i];
    for (const { key } of HISTORY_LINE_FIELDS) {
      const o = oldR && typeof oldR === "object" ? parseMoney(oldR[key]) : 0;
      const nv = newR && typeof newR === "object" ? parseMoney(newR[key]) : 0;

      if (nv === 0) {
        if (key in next[i]) delete next[i][key];
        continue;
      }
      if (o !== nv) {
        next[i][key] = now;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const newR = newRows[i];
    for (const { key } of HISTORY_LINE_FIELDS) {
      const nz = newR && typeof newR === "object" ? parseMoney(newR[key]) : 0;
      if (nz > 0 && next[i][key] == null) {
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
    const u =
      doc.updatedAt instanceof Date ? doc.updatedAt : new Date(doc.updatedAt);
    if (!Number.isNaN(u.getTime())) return u;
  }
  return null;
}

/**
 * @param {number} rowIndex 0..ROW_COUNT_MAX-1
 * @param {HistoryDocLike[]} docs
 */
export function buildPersonHistory(rowIndex, docs) {
  const items = [];
  let totalPaid = 0;
  const sorted = [...docs].sort((a, b) =>
    String(a.reportDate).localeCompare(String(b.reportDate)),
  );

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
            entry &&
            typeof entry.amount === "number" &&
            Number.isFinite(entry.amount)
              ? roundLedgerAmt(entry.amount)
              : roundLedgerAmt(parseMoney(entry?.amount));
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

  const outward = items.map(
    ({ _fieldIx: _omit, _lineIx: _omitLi, ...rest }) => rest,
  );

  const grandTotal = outward.reduce((s, x) => s + x.amount, 0);
  return { ten, items: outward, grandTotal, totalPaid };
}

/**
 * Ước số lần bấm ± theo **tiền VNĐ mỗi lần** (nút vẫn hiện «15» nhưng thực tế +15.000đ).
 * Không áp cố định cho cầu / đồ ăn (xem tier).
 */
const IMPLIED_UNIT_PRICE = {
  san: 15000,
  cuonCan: 10000,
  suoi5k: 5000,
  nuocNgot10k: 10000,
};

/** Khớp bước giá ô Cầu (web App.jsx `CAU_STEPS`). */
export const LEDGER_PRICE_STEPS_CAU = Object.freeze([6, 7, 7.5, 8]);
/** Khớp bước giá ô Đồ ăn (web `DO_AN_STEPS`). */
export const LEDGER_PRICE_STEPS_DO_AN = Object.freeze([5, 6, 7, 8, 9, 10]);

function normalizeLedgerLineAmount(amount) {
  const n =
    typeof amount === "number" && Number.isFinite(amount)
      ? amount
      : parseMoney(String(amount ?? ""));
  return Math.round(Math.abs(n) * 100) / 100;
}

/**
 * Chuẩn hóa một dòng ± về một bước giá trong `steps`; null nếu không khớp (gõ tay / sai bước).
 * @param {number[]} steps
 */
function classifyLedgerTxnByPriceStep(amount, steps) {
  const aNorm = normalizeLedgerLineAmount(amount);
  const cents = Math.round(aNorm * 100);
  for (const s of steps) {
    const sn = Math.abs(Number(s));
    const scLegacy = Math.round(sn * 100);
    if (scLegacy === cents) return s;
    /** Web: nhãn «6» = 6.000đ — khớp cả dòng sổ cũ (6) và mới (6000). */
    const scVnd = Math.round(sn * 1000 * 100);
    if (scVnd === cents) return s;
  }
  return null;
}

/**
 * Đếm số **dòng sổ** (mỗi lần ± = 1) theo đúng đơn vị tiền từng bước.
 * Khóa là chuỗi (vd. "7.5"); `other` = dòng không khớp bước nào.
 * @returns {Record<string, number>}
 */
function emptyTierBuckets(steps) {
  /** @type {Record<string, number>} */
  const o = {};
  for (const s of steps) o[String(s)] = 0;
  o.other = 0;
  return o;
}

/**
 * @param {Record<string, number>} buckets
 */
function mergeTierBuckets(buckets, ledger, fieldKey, steps) {
  for (let i = 0; i < ledger.length; i++) {
    const entries = ledger[i]?.[fieldKey];
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const matched = classifyLedgerTxnByPriceStep(e?.amount, steps);
      if (matched == null) buckets.other += 1;
      else buckets[String(matched)] += 1;
    }
  }
}

/**
 * Gộp tất cả phiếu trong kỳ để đối chiếu tiền vs "số lần bán" từ ledger.
 * @param {Array<{ rows?: unknown; cellLedger?: unknown }>} docs — nên chứa đủ rows + cellLedger
 */
export function aggregateSheetsInsight(docs) {
  const sumMoney = {
    san: 0,
    cuonCan: 0,
    cau: 0,
    suoi5k: 0,
    nuocNgot10k: 0,
    doAn: 0,
    doanhThu: 0,
    homNayTra: 0,
    conNo: 0,
  };

  /** @type {Record<string, number>} */
  const ledgerTxnCount = {};
  /** @type {Record<string, number>} */
  const legacyCellCount = {};
  for (const { key } of HISTORY_LINE_FIELDS) {
    ledgerTxnCount[key] = 0;
    legacyCellCount[key] = 0;
  }

  const tierBucketsCau = emptyTierBuckets(LEDGER_PRICE_STEPS_CAU);
  const tierBucketsDoAn = emptyTierBuckets(LEDGER_PRICE_STEPS_DO_AN);

  const serverNow = new Date();
  for (const doc of docs) {
    const rows = normalizeRows(Array.isArray(doc.rows) ? doc.rows : []);
    if (!rows) continue;
    const ledger = normalizeCellLedger(doc.cellLedger, serverNow, rows.length);
    const t = computeTotals(rows, doc.conNoLedger);
    sumMoney.san += t.san;
    sumMoney.cuonCan += t.cuonCan;
    sumMoney.cau += t.cau;
    sumMoney.suoi5k += t.suoi5k;
    sumMoney.nuocNgot10k += t.nuocNgot10k;
    sumMoney.doAn += t.doAn;
    sumMoney.doanhThu += t.doanhThu;
    sumMoney.homNayTra += t.homNayTra;
    sumMoney.conNo += t.conNo;

    for (let i = 0; i < rows.length; i++) {
      for (const { key } of HISTORY_LINE_FIELDS) {
        const entries = ledger[i]?.[key];
        const n = Array.isArray(entries) ? entries.length : 0;
        if (n > 0) ledgerTxnCount[key] += n;
        else if (parseMoney(rows[i]?.[key]) > 0) legacyCellCount[key] += 1;
      }
    }

    mergeTierBuckets(tierBucketsCau, ledger, "cau", LEDGER_PRICE_STEPS_CAU);
    mergeTierBuckets(tierBucketsDoAn, ledger, "doAn", LEDGER_PRICE_STEPS_DO_AN);
  }

  /** @type {Record<string, number | null>} */
  const impliedUnits = {};
  for (const { key } of HISTORY_LINE_FIELDS) impliedUnits[key] = null;

  impliedUnits.san =
    sumMoney.san > 0
      ? Math.round((sumMoney.san / IMPLIED_UNIT_PRICE.san) * 100) / 100
      : null;
  impliedUnits.cuonCan =
    sumMoney.cuonCan > 0
      ? Math.round((sumMoney.cuonCan / IMPLIED_UNIT_PRICE.cuonCan) * 100) / 100
      : null;
  impliedUnits.suoi5k =
    sumMoney.suoi5k > 0
      ? Math.round((sumMoney.suoi5k / IMPLIED_UNIT_PRICE.suoi5k) * 100) / 100
      : null;
  impliedUnits.nuocNgot10k =
    sumMoney.nuocNgot10k > 0
      ? Math.round(
          (sumMoney.nuocNgot10k / IMPLIED_UNIT_PRICE.nuocNgot10k) * 100,
        ) / 100
      : null;

  return {
    sheetCount: docs.length,
    sumMoney,
    ledgerTxnCount,
    legacyCellCount,
    ledgerTierTxnCount: {
      cau: tierBucketsCau,
      doAn: tierBucketsDoAn,
    },
    impliedUnits,
    impliedUnitPrices: { ...IMPLIED_UNIT_PRICE },
  };
}

function roundSignedMoney(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Giống `normalizePersonKey` trong peopleRouter (tránh import vòng). */
function rowNameNorm(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKC")
    .toLowerCase();
}

/**
 * Các dòng ghi nợ / trả nợ trên phiếu (theo tên chuẩn), mới nhất trước.
 */
export function aggregatePersonConNoLedgerLines(nameNorm, sheetDocs) {
  /** @type {Array<{ reportDate: string; stt: number; kind: string; amount: number; at: string; note: string }>} */
  const lines = [];
  let sumCong = 0;
  let sumTru = 0;
  let sumGhi = 0;
  if (!nameNorm || !Array.isArray(sheetDocs)) {
    return { debtLedgerLines: lines, debtLedgerTotals: { cong: 0, tru: 0, ghi: 0 } };
  }

  for (const doc of sheetDocs) {
    const rows = normalizeRows(Array.isArray(doc.rows) ? doc.rows : []);
    if (!rows) continue;
    const reportDate = doc.reportDate;
    if (typeof reportDate !== "string") continue;
    const cnNorm = normalizeConNoLedger(doc.conNoLedger, new Date(), rows.length);
    for (let i = 0; i < rows.length; i++) {
      if (rowNameNorm(rows[i].ten) !== nameNorm) continue;
      const rowLines = cnNorm[i] || [];
      for (const entry of rowLines) {
        const amt = roundConNoLedgerAmt(entry.amount);
        const iso =
          entry.at instanceof Date ? entry.at.toISOString() : new Date(entry.at).toISOString();
        lines.push({
          reportDate,
          stt: i + 1,
          kind: entry.kind,
          amount: amt,
          at: iso,
          note: entry.note || "",
        });
        if (entry.kind === "cong") sumCong += amt;
        else if (entry.kind === "tru") sumTru += amt;
        else if (entry.kind === "ghi") sumGhi += amt;
      }
    }
  }
  lines.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : b.stt - a.stt));
  return {
    debtLedgerLines: lines,
    debtLedgerTotals: {
      cong: roundSignedMoney(sumCong),
      tru: roundSignedMoney(sumTru),
      ghi: roundSignedMoney(sumGhi),
    },
  };
}

/**
 * Tổng có dấu từ từng dòng `conNoLedger` (ghi / cộng: +, trả: −), gộp theo tháng dương lịch của **ngày phiếu**.
 * Khớp khi cộng tay các dòng trong «Lịch sử ghi nợ / trả nợ / ghi nhận» (cột số tiền có dấu).
 */
export function aggregatePersonLedgerSignedByCalendarMonth(nameNorm, sheetDocs) {
  const { debtLedgerLines } = aggregatePersonConNoLedgerLines(nameNorm, sheetDocs);
  if (!nameNorm || !Array.isArray(sheetDocs)) {
    return { months: [], yearTotal: 0 };
  }

  /** @type {Map<string, { year: number; month: number; totalSigned: number; lineCount: number }>} */
  const monthMap = new Map();

  for (const ln of debtLedgerLines) {
    const meta = metaFromReportDate(ln.reportDate);
    if (!meta) continue;
    const amt = roundConNoLedgerAmt(ln.amount);
    const signed = ln.kind === "tru" ? -amt : amt;
    const mKey = `${meta.year}-${meta.month}`;
    let mAgg = monthMap.get(mKey);
    if (!mAgg) {
      mAgg = { year: meta.year, month: meta.month, totalSigned: 0, lineCount: 0 };
      monthMap.set(mKey, mAgg);
    }
    mAgg.totalSigned += signed;
    mAgg.lineCount += 1;
  }

  const months = Array.from(monthMap.values())
    .map((m) => ({
      year: m.year,
      month: m.month,
      totalConNo: roundSignedMoney(m.totalSigned),
      lineCount: m.lineCount,
      days: [],
    }))
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

  let yearTotal = 0;
  for (const mo of months) {
    yearTotal += mo.totalConNo;
  }

  return { months, yearTotal: roundSignedMoney(yearTotal) };
}

/**
 * Còn nợ hiển thị (phiếu + ghi nợ/trả nợ) gộp theo tháng cho dòng trùng `nameNorm`.
 */
export function aggregatePersonDebtByYearMonth(nameNorm, sheetDocs) {
  if (!nameNorm || !Array.isArray(sheetDocs)) {
    return { months: [], yearTotal: 0 };
  }

  /** @type {Map<string, { year: number; month: number; totalConNo: number; lineCount: number; days: Map<string, { totalConNo: number; lineCount: number; entries: { stt: number; conNo: number; conNoBase: number; conNoAdjust: number; doanhThu: number; homNayTra: number }[] }> }>} */
  const monthMap = new Map();

  for (const doc of sheetDocs) {
    const rows = normalizeRows(Array.isArray(doc.rows) ? doc.rows : []);
    if (!rows) continue;
    const reportDate = doc.reportDate;
    if (typeof reportDate !== "string") continue;

    let year = doc.year;
    let month = doc.month;
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      const meta = metaFromReportDate(reportDate);
      if (!meta) continue;
      year = meta.year;
      month = meta.month;
    }

    const cnNorm = normalizeConNoLedger(doc.conNoLedger, new Date(), rows.length);
    const mKey = `${year}-${month}`;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (rowNameNorm(r.ten) !== nameNorm) continue;
      const { doanhThu, conNo: conNoBase } = computeRow(r);
      const adj = sumConNoLedgerNetForRow(cnNorm[i]);
      const conNo = roundSignedMoney(conNoBase + adj);

      let mAgg = monthMap.get(mKey);
      if (!mAgg) {
        mAgg = { year, month, totalConNo: 0, lineCount: 0, days: new Map() };
        monthMap.set(mKey, mAgg);
      }
      mAgg.totalConNo += conNo;
      mAgg.lineCount += 1;

      let dAgg = mAgg.days.get(reportDate);
      if (!dAgg) {
        dAgg = { totalConNo: 0, lineCount: 0, entries: [] };
        mAgg.days.set(reportDate, dAgg);
      }
      dAgg.totalConNo += conNo;
      dAgg.lineCount += 1;
      dAgg.entries.push({
        stt: i + 1,
        conNo,
        conNoBase: roundSignedMoney(conNoBase),
        conNoAdjust: roundSignedMoney(adj),
        doanhThu: roundSignedMoney(doanhThu),
        homNayTra: roundSignedMoney(parseMoney(r.homNayTra)),
      });
    }
  }

  const months = Array.from(monthMap.values())
    .map((m) => ({
      year: m.year,
      month: m.month,
      totalConNo: roundSignedMoney(m.totalConNo),
      lineCount: m.lineCount,
      days: Array.from(m.days.entries())
        .map(([rd, d]) => ({
          reportDate: rd,
          totalConNo: roundSignedMoney(d.totalConNo),
          lineCount: d.lineCount,
          entries: d.entries.sort((a, b) => a.stt - b.stt),
        }))
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate)),
    }))
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

  let yearTotal = 0;
  for (const mo of months) {
    yearTotal += mo.totalConNo;
  }

  return { months, yearTotal: roundSignedMoney(yearTotal) };
}
