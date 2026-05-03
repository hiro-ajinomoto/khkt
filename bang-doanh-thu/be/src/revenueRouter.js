import { Router } from "express";
import { getSheetsCollection } from "./db.js";
import { peopleRouter } from "./peopleRouter.js";
import {
  buildPersonHistory,
  computeTotals,
  emptyCellLedger,
  emptyRow,
  fillMissingLedgerFromRows,
  mergeCellTimes,
  metaFromReportDate,
  normalizeCellLedger,
  normalizeRows,
  pruneLedgerZeroRows,
  syncRowsStringsFromLedger,
  ROW_COUNT,
} from "./revenueUtils.js";

export const revenueRouter = Router();

revenueRouter.use("/people", peopleRouter);

/** GET /api/revenue/sheets?year=2026&month=5 | &week=18 (tuần ISO, isoWeekYear = year) */
revenueRouter.get("/sheets", async (req, res) => {
  const year = parseInt(String(req.query.year || ""), 10);
  if (!Number.isFinite(year)) {
    return res.status(400).json({ error: "year_required" });
  }
  const monthRaw = req.query.month;
  const weekRaw = req.query.week;

  const coll = getSheetsCollection();
  /** @type {import('mongodb').Filter<import('mongodb').Document>} */
  let filter = {};

  if (monthRaw !== undefined && monthRaw !== "") {
    const month = parseInt(String(monthRaw), 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "invalid_month" });
    }
    filter = { year, month };
  } else if (weekRaw !== undefined && weekRaw !== "") {
    const week = parseInt(String(weekRaw), 10);
    if (!Number.isFinite(week) || week < 1 || week > 53) {
      return res.status(400).json({ error: "invalid_week" });
    }
    filter = { isoWeekYear: year, isoWeek: week };
  } else {
    filter = { year };
  }

  const docs = await coll
    .find(filter, { projection: { rows: 0 } })
    .sort({ reportDate: -1 })
    .toArray();

  const sheets = docs.map((d) => ({
    reportDate: d.reportDate,
    totals: d.totals,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
    year: d.year,
    month: d.month,
    isoWeekYear: d.isoWeekYear,
    isoWeek: d.isoWeek,
  }));

  const summary = docs.reduce(
    (acc, d) => {
      const t = d.totals || {};
      acc.totalDoanhThu += Number(t.doanhThu) || 0;
      acc.totalHomNayTra += Number(t.homNayTra) || 0;
      acc.totalConNo += Number(t.conNo) || 0;
      acc.sheetCount += 1;
      return acc;
    },
    { totalDoanhThu: 0, totalHomNayTra: 0, totalConNo: 0, sheetCount: 0 },
  );

  res.json({ sheets, summary });
});

/** GET /api/revenue/sheets/:reportDate */
revenueRouter.get("/sheets/:reportDate", async (req, res) => {
  const reportDate = req.params.reportDate;
  const meta = metaFromReportDate(reportDate);
  if (!meta) return res.status(400).json({ error: "invalid_date" });

  const coll = getSheetsCollection();
  const doc = await coll.findOne({ reportDate });
  if (!doc) {
    return res.json({
      reportDate,
      ...meta,
      rows: Array.from({ length: ROW_COUNT }, () => emptyRow()),
      totals: computeTotals(Array.from({ length: ROW_COUNT }, () => emptyRow())),
      cellLedger: emptyCellLedger(),
      createdAt: null,
      updatedAt: null,
    });
  }
  res.json({
    reportDate: doc.reportDate,
    year: doc.year,
    month: doc.month,
    day: doc.day,
    isoWeekYear: doc.isoWeekYear,
    isoWeek: doc.isoWeek,
    rows: doc.rows,
    totals: doc.totals,
    cellLedger:
      doc.cellLedger != null ? normalizeCellLedger(doc.cellLedger, new Date()) : emptyCellLedger(),
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
});

/** GET /api/revenue/history/:stt — STT 1..ROW_COUNT; mỗi ô tiền một dòng, sắp theo mốc ghi nhận. */
revenueRouter.get("/history/:stt", async (req, res) => {
  const stt = parseInt(String(req.params.stt), 10);
  if (!Number.isFinite(stt) || stt < 1 || stt > ROW_COUNT) {
    return res.status(400).json({ error: "invalid_stt", min: 1, max: ROW_COUNT });
  }
  const rowIndex = stt - 1;
  const coll = getSheetsCollection();
  const docs = await coll
    .find({}, { projection: { reportDate: 1, rows: 1, updatedAt: 1, cellTimes: 1, cellLedger: 1 } })
    .toArray();
  const { ten, items, grandTotal, totalPaid } = buildPersonHistory(rowIndex, docs);
  res.json({ stt, ten, items, grandTotal, totalPaid });
});

/** PUT /api/revenue/sheets/:reportDate body: { rows } */
revenueRouter.put("/sheets/:reportDate", async (req, res) => {
  const reportDate = req.params.reportDate;
  const meta = metaFromReportDate(reportDate);
  if (!meta) return res.status(400).json({ error: "invalid_date" });

  const rowsInput = normalizeRows(req.body?.rows);
  if (!rowsInput) {
    return res.status(400).json({ error: "invalid_rows", expect: ROW_COUNT });
  }

  const now = new Date();
  const coll = getSheetsCollection();
  const existing = await coll.findOne({ reportDate });

  const bodyLedgerProvided = req.body != null && Array.isArray(req.body.cellLedger);

  let ledger;
  if (bodyLedgerProvided) {
    ledger = normalizeCellLedger(req.body.cellLedger, now);
    ledger = pruneLedgerZeroRows(ledger, rowsInput);
  } else {
    ledger = pruneLedgerZeroRows(normalizeCellLedger(existing?.cellLedger, now), rowsInput);
    ledger = fillMissingLedgerFromRows(ledger, rowsInput, existing, existing?.updatedAt, now);
  }

  const rowsSynced = syncRowsStringsFromLedger(rowsInput, ledger);
  const totals = computeTotals(rowsSynced);

  const cellTimes = mergeCellTimes(
    existing?.rows,
    existing?.cellTimes,
    rowsSynced,
    now,
    existing?.updatedAt,
  );

  await coll.updateOne(
    { reportDate },
    {
      $set: {
        ...meta,
        rows: rowsSynced,
        totals,
        updatedAt: now,
        cellLedger: ledger,
        cellTimes,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const doc = await coll.findOne({ reportDate });
  res.json({
    reportDate: doc.reportDate,
    year: doc.year,
    month: doc.month,
    isoWeekYear: doc.isoWeekYear,
    isoWeek: doc.isoWeek,
    rows: doc.rows,
    totals: doc.totals,
    cellLedger: doc.cellLedger != null ? normalizeCellLedger(doc.cellLedger, new Date()) : emptyCellLedger(),
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
});
