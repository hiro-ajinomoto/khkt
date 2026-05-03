import { Router } from "express";
import { getSheetsCollection } from "./db.js";
import { peopleRouter } from "./peopleRouter.js";
import {
  aggregateSheetsInsight,
  buildPersonHistory,
  computeTotals,
  daysInMonth,
  emptyCellLedger,
  emptyConNoLedger,
  emptyRow,
  fillMissingLedgerFromRows,
  mergeCellTimes,
  getCalendarWeekSlice,
  metaFromReportDate,
  normalizeCellLedger,
  normalizeConNoLedger,
  normalizeRows,
  pruneLedgerZeroRows,
  syncRowsStringsFromLedger,
  ROW_COUNT,
} from "./revenueUtils.js";

export const revenueRouter = Router();

revenueRouter.use("/people", peopleRouter);

/**
 * @returns {{ ok: true } & Record<string, unknown> | { ok: false; status: number; body: Record<string, unknown> }}
 * `scope`: day | month | month_calendar_week | week | year
 */
function parsePeriodFilter(query) {
  const year = parseInt(String(query.year || ""), 10);
  if (!Number.isFinite(year)) {
    return { ok: false, status: 400, body: { error: "year_required" } };
  }
  const monthRaw = query.month;
  const weekRaw = query.week;
  const dayRaw = query.day;
  const cwRaw = query.calendarWeek ?? query.calendar_week;
  const cwProvided = cwRaw !== undefined && String(cwRaw).trim() !== "";

  const dayProvided = dayRaw !== undefined && String(dayRaw).trim() !== "";
  if (dayProvided && (monthRaw === undefined || monthRaw === "")) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "day_requires_month",
        hint: "Thêm month= (và year=) khi dùng day= (ngày trong tháng 1–31).",
      },
    };
  }

  if (monthRaw !== undefined && monthRaw !== "") {
    const month = parseInt(String(monthRaw), 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return { ok: false, status: 400, body: { error: "invalid_month" } };
    }

    if (dayProvided) {
      if (cwProvided) {
        return {
          ok: false,
          status: 400,
          body: {
            error: "day_conflict_calendar_week",
            hint: "Chỉ dùng một trong hai: day= (một ngày) hoặc calendarWeek= (tuần trong tháng).",
          },
        };
      }
      const dayNum = parseInt(String(dayRaw), 10);
      if (!Number.isFinite(dayNum) || dayNum < 1) {
        return { ok: false, status: 400, body: { error: "invalid_day" } };
      }
      const dim = daysInMonth(year, month);
      if (dayNum > dim) {
        return {
          ok: false,
          status: 400,
          body: {
            error: "invalid_day_for_month",
            hint: `Tháng ${month}/${year} có tối đa ${dim} ngày.`,
          },
        };
      }
      return {
        ok: true,
        filter: { year, month, day: dayNum },
        scope: "day",
        year,
        month,
        day: dayNum,
      };
    }

    if (cwProvided) {
      const calendarWeek = parseInt(String(cwRaw), 10);
      if (!Number.isFinite(calendarWeek) || calendarWeek < 1) {
        return {
          ok: false,
          status: 400,
          body: { error: "invalid_calendar_week" },
        };
      }
      const slice = getCalendarWeekSlice(year, month, calendarWeek);
      if (!slice) {
        return {
          ok: false,
          status: 400,
          body: { error: "invalid_calendar_week_range" },
        };
      }
      return {
        ok: true,
        filter: {
          year,
          month,
          day: { $gte: slice.startDay, $lte: slice.endDay },
        },
        scope: "month_calendar_week",
        year,
        month,
        calendarWeek,
        dayStart: slice.startDay,
        dayEnd: slice.endDay,
      };
    }

    return { ok: true, filter: { year, month }, scope: "month", year, month };
  }

  if (cwProvided) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "calendar_week_requires_month",
        hint: "Thêm month= (tháng 1–12) khi dùng calendarWeek=.",
      },
    };
  }

  if (weekRaw !== undefined && weekRaw !== "") {
    const week = parseInt(String(weekRaw), 10);
    if (!Number.isFinite(week) || week < 1 || week > 53) {
      return { ok: false, status: 400, body: { error: "invalid_week" } };
    }
    return {
      ok: true,
      filter: { isoWeekYear: year, isoWeek: week },
      scope: "week",
      year,
      isoWeek: week,
    };
  }
  return { ok: true, filter: { year }, scope: "year", year };
}

/** GET /api/revenue/sheets?year=…&month=…[&day=D | &calendarWeek=W] | &week=… (ISO) */
revenueRouter.get("/sheets", async (req, res) => {
  const pf = parsePeriodFilter(req.query);
  if (!pf.ok) return res.status(pf.status).json(pf.body);

  const coll = getSheetsCollection();
  const docs = await coll
    .find(pf.filter, { projection: { rows: 0 } })
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

/** GET /api/revenue/aggregate — tổng hợp (tháng, một ngày, tuần trong tháng, tuần ISO). */
revenueRouter.get("/aggregate", async (req, res) => {
  const pf = parsePeriodFilter(req.query);
  if (!pf.ok) return res.status(pf.status).json(pf.body);
  if (pf.scope === "year") {
    return res.status(400).json({
      error: "aggregate_requires_month_or_week",
      hint: "Thêm month= (và tuỳ chọn day=D cho một ngày, hoặc calendarWeek= cho tuần trong tháng) hoặc week= (tuần ISO; year= là năm ISO tuần).",
    });
  }

  const coll = getSheetsCollection();
  const docs = await coll
    .find(pf.filter, { projection: { rows: 1, cellLedger: 1, conNoLedger: 1, reportDate: 1 } })
    .sort({ reportDate: 1 })
    .toArray();

  const agg = aggregateSheetsInsight(docs);

  const meta =
    pf.scope === "month"
      ? { scope: pf.scope, year: pf.year, month: pf.month }
      : pf.scope === "day"
        ? { scope: pf.scope, year: pf.year, month: pf.month, day: pf.day }
        : pf.scope === "month_calendar_week"
          ? {
              scope: pf.scope,
              year: pf.year,
              month: pf.month,
              calendarWeek: pf.calendarWeek,
              dayStart: pf.dayStart,
              dayEnd: pf.dayEnd,
            }
          : { scope: pf.scope, isoWeekYear: pf.year, isoWeek: pf.isoWeek };

  res.json({ meta, ...agg });
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
      totals: computeTotals(
        Array.from({ length: ROW_COUNT }, () => emptyRow()),
        emptyConNoLedger(),
      ),
      cellLedger: emptyCellLedger(),
      conNoLedger: emptyConNoLedger(),
      createdAt: null,
      updatedAt: null,
    });
  }
  const rowsNormalized = normalizeRows(Array.isArray(doc.rows) ? doc.rows : []);
  const rowsSafe =
    rowsNormalized ?? Array.from({ length: ROW_COUNT }, () => emptyRow());
  const conNoLedgerSafe =
    doc.conNoLedger != null
      ? normalizeConNoLedger(doc.conNoLedger, new Date())
      : emptyConNoLedger();
  res.json({
    reportDate: doc.reportDate,
    year: doc.year,
    month: doc.month,
    day: doc.day,
    isoWeekYear: doc.isoWeekYear,
    isoWeek: doc.isoWeek,
    rows: rowsSafe,
    totals: computeTotals(rowsSafe, conNoLedgerSafe),
    cellLedger:
      doc.cellLedger != null
        ? normalizeCellLedger(doc.cellLedger, new Date())
        : emptyCellLedger(),
    conNoLedger: conNoLedgerSafe,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
});

/** GET /api/revenue/history/:stt — STT 1..ROW_COUNT; mỗi ô tiền một dòng, sắp theo mốc ghi nhận. */
revenueRouter.get("/history/:stt", async (req, res) => {
  const stt = parseInt(String(req.params.stt), 10);
  if (!Number.isFinite(stt) || stt < 1 || stt > ROW_COUNT) {
    return res
      .status(400)
      .json({ error: "invalid_stt", min: 1, max: ROW_COUNT });
  }
  const rowIndex = stt - 1;
  const coll = getSheetsCollection();
  const docs = await coll
    .find(
      {},
      {
        projection: {
          reportDate: 1,
          rows: 1,
          updatedAt: 1,
          cellTimes: 1,
          cellLedger: 1,
        },
      },
    )
    .toArray();
  const { ten, items, grandTotal, totalPaid } = buildPersonHistory(
    rowIndex,
    docs,
  );
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

  const bodyLedgerProvided =
    req.body != null && Array.isArray(req.body.cellLedger);

  let ledger;
  if (bodyLedgerProvided) {
    ledger = normalizeCellLedger(req.body.cellLedger, now);
    ledger = pruneLedgerZeroRows(ledger, rowsInput);
  } else {
    ledger = pruneLedgerZeroRows(
      normalizeCellLedger(existing?.cellLedger, now),
      rowsInput,
    );
    ledger = fillMissingLedgerFromRows(
      ledger,
      rowsInput,
      existing,
      existing?.updatedAt,
      now,
    );
  }

  const rowsSynced = syncRowsStringsFromLedger(rowsInput, ledger);

  const bodyConNoLedgerProvided =
    req.body != null && Array.isArray(req.body.conNoLedger);
  const conNoLedger = bodyConNoLedgerProvided
    ? normalizeConNoLedger(req.body.conNoLedger, now)
    : normalizeConNoLedger(existing?.conNoLedger, now);

  const totals = computeTotals(rowsSynced, conNoLedger);

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
        conNoLedger,
        cellTimes,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const doc = await coll.findOne({ reportDate });
  const conNoOut =
    doc.conNoLedger != null
      ? normalizeConNoLedger(doc.conNoLedger, new Date())
      : emptyConNoLedger();
  res.json({
    reportDate: doc.reportDate,
    year: doc.year,
    month: doc.month,
    isoWeekYear: doc.isoWeekYear,
    isoWeek: doc.isoWeek,
    rows: doc.rows,
    totals: doc.totals ?? computeTotals(normalizeRows(doc.rows) ?? [], conNoOut),
    cellLedger:
      doc.cellLedger != null
        ? normalizeCellLedger(doc.cellLedger, new Date())
        : emptyCellLedger(),
    conNoLedger: conNoOut,
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
});
