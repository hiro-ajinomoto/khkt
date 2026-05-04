import { useEffect, useMemo, useState } from "react";
import MainNavBar from "./MainNavBar.jsx";
import BrandBlock from "./BrandBlock.jsx";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { apiFetch } from "./apiClient.js";
import { formatMoney, formatViDate } from "./formatMoney.js";
import { getCalendarWeekSpansInMonth } from "./calendarSpans.js";
import { getCauClicksPerQua } from "./cauShuttleRates.js";
import "./App.css";

const PRODUCT_ROWS = [
  { key: "san", label: "Sân" },
  { key: "cuonCan", label: "Cuốn cán" },
  { key: "cau", label: "Cầu" },
  { key: "suoi5k", label: "Suối (5k)" },
  { key: "nuocNgot10k", label: "Nước ngọt (10k)" },
  { key: "doAn", label: "Đồ ăn" },
];

/** Khớp `CAU_STEPS` và BE `LEDGER_PRICE_STEPS_CAU`. */
const CAU_PRICE_STEPS = [6, 7, 7.5, 8];
/** Khớp `DO_AN_STEPS` và BE `LEDGER_PRICE_STEPS_DO_AN`. */
const DO_AN_PRICE_STEPS = [5, 6, 7, 8, 9, 10];

/** @typedef {{ meta: Record<string, unknown>; sheetCount: number; sumMoney: Record<string, number>; ledgerTxnCount: Record<string, number>; legacyCellCount: Record<string, number>; ledgerTierTxnCount?: Record<string, Record<string, number>>; impliedUnits: Record<string, number | null>; impliedUnitPrices: Record<string, number> }} Agg */

function fmtUnits(n) {
  if (n == null || n === "") return "—";
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Hiển thị nhãn bước giá Vi (7,5 thay cho 7.5). */
function fmtPriceStep(step) {
  if (Number.isInteger(step)) return String(step);
  return String(step).replace(".", ",");
}

/** @param {Record<string, number> | undefined} tiers */
function sumKnownTierTxns(tiers, stepOrder) {
  if (!tiers || typeof tiers !== "object") return 0;
  return stepOrder.reduce((s, step) => s + (Number(tiers[String(step)]) || 0), 0);
}

/**
 * Mỗi mức giá một dòng trong danh sách (cầu).
 * @param {Record<string, number> | undefined} tiers
 * @returns {import("react").JSX.Element[]}
 */
function cauTierRows(tiers, stepOrder) {
  /** @type {import("react").JSX.Element[]} */
  const out = [];
  if (!tiers || typeof tiers !== "object") return out;
  for (const s of stepOrder) {
    const n = Number(tiers[String(s)]) || 0;
    if (n <= 0) continue;
    const perQua = getCauClicksPerQua(s);
    const qua = n / perQua;
    out.push(
      <li key={`cau-${String(s)}`} className="aggregate-tier-stack-row">
        <span className="aggregate-tier-stack-step">±{fmtPriceStep(s)}:</span>{" "}
        <span className="aggregate-tier-stack-metric">
          {n.toLocaleString("vi-VN")} lần → ≈ <strong>{fmtUnits(qua)} quả</strong>
        </span>
        <span className="aggregate-tier-stack-rule"> ({perQua} lần = 1 quả)</span>
      </li>,
    );
  }
  const ot = tiers.other;
  if (typeof ot === "number" && ot > 0) {
    out.push(
      <li key="cau-other" className="aggregate-tier-stack-row aggregate-tier-stack-row--muted">
        {ot.toLocaleString("vi-VN")} lần không khớp bước ± (không quy được số quả)
      </li>,
    );
  }
  return out;
}

/**
 * @param {Record<string, number> | undefined} tiers
 * @returns {import("react").JSX.Element[]}
 */
function doAnTierRows(tiers, stepOrder) {
  /** @type {import("react").JSX.Element[]} */
  const out = [];
  if (!tiers || typeof tiers !== "object") return out;
  for (const s of stepOrder) {
    const n = Number(tiers[String(s)]) || 0;
    if (n <= 0) continue;
    out.push(
      <li key={`doAn-${String(s)}`} className="aggregate-tier-stack-row">
        <span className="aggregate-tier-stack-step">±{fmtPriceStep(s)}:</span>{" "}
        <strong>{n.toLocaleString("vi-VN")} suất</strong>
        <span className="aggregate-tier-stack-rule"> (1 lần ± = 1 suất)</span>
      </li>,
    );
  }
  const ot = tiers.other;
  if (typeof ot === "number" && ot > 0) {
    out.push(
      <li key="doAn-other" className="aggregate-tier-stack-row aggregate-tier-stack-row--muted">
        {ot.toLocaleString("vi-VN")} lần không khớp bước ±
      </li>,
    );
  }
  return out;
}

/** Quả (ước) từ các mức đã nhận dạng; không tính `other`. */
function sumEstimatedCauQua(tiers, stepOrder) {
  if (!tiers || typeof tiers !== "object") return 0;
  let sum = 0;
  for (const s of stepOrder) {
    const n = Number(tiers[String(s)]) || 0;
    if (n <= 0) continue;
    sum += n / getCauClicksPerQua(s);
  }
  return sum;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @param {number} year @param {number} month 1–12 @param {number} day */
function isoDateLocal(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export default function AggregateReport() {
  const now = useMemo(() => new Date(), []);
  const [mode, setMode] = useState(/** @type {"month_full"|"month_week"|"iso"|"day"} */ ("month_full"));
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterCalendarWeek, setFilterCalendarWeek] = useState(1);
  const [filterIsoYear, setFilterIsoYear] = useState(() => getISOWeekYear(now));
  const [filterIsoWeek, setFilterIsoWeek] = useState(() => getISOWeek(now));
  const [filterDayISO, setFilterDayISO] = useState(() =>
    isoDateLocal(now.getFullYear(), now.getMonth() + 1, now.getDate()),
  );

  /** @type {Agg | null} */
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const weekOptions = useMemo(() => Array.from({ length: 53 }, (_, i) => i + 1), []);
  const monthWeekSpans = useMemo(
    () => getCalendarWeekSpansInMonth(filterYear, filterMonth),
    [filterYear, filterMonth],
  );

  useEffect(() => {
    if (filterCalendarWeek > monthWeekSpans.length) {
      setFilterCalendarWeek(Math.max(1, monthWeekSpans.length));
    }
  }, [monthWeekSpans.length, filterCalendarWeek]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (mode === "month_full" || mode === "month_week") {
      params.set("year", String(filterYear));
      params.set("month", String(filterMonth));
      if (mode === "month_week") {
        params.set("calendarWeek", String(filterCalendarWeek));
      }
    } else if (mode === "day") {
      const mch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(filterDayISO);
      if (!mch) {
        setData(null);
        setLoadErr("Ngày không hợp lệ.");
        return () => {
          cancelled = true;
        };
      }
      const y = Number(mch[1]);
      const mo = Number(mch[2]);
      const dd = Number(mch[3]);
      if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(dd)) {
        setData(null);
        setLoadErr("Ngày không hợp lệ.");
        return () => {
          cancelled = true;
        };
      }
      params.set("year", String(y));
      params.set("month", String(mo));
      params.set("day", String(dd));
    } else {
      params.set("year", String(filterIsoYear));
      params.set("week", String(filterIsoWeek));
    }
    apiFetch(`/api/revenue/aggregate?${params}`)
      .then(async (r) => {
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try {
            const j = await r.json();
            const err = typeof j.error === "string" ? j.error : "";
            if (err) msg += ` — ${err}`;
            if (j.hint && typeof j.hint === "string") msg += ` (${j.hint})`;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        return r.json();
      })
      .then((j) => {
        if (!cancelled) {
          /** @type {Agg} */
          const ok = j;
          setData(ok);
          setLoadErr(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setData(null);
          setLoadErr(e instanceof Error ? e.message : String(e || "Không tải được."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, filterYear, filterMonth, filterCalendarWeek, filterIsoYear, filterIsoWeek, filterDayISO]);

  const subtitle = data?.meta ? (
    data.meta.scope === "month" ? (
      <>
        Tháng <strong>{data.meta.month}</strong>/<strong>{data.meta.year}</strong> (cả tháng)
      </>
    ) : data.meta.scope === "day" ? (
      <>
        {formatViDate(
          `${Number(data.meta.year)}-${pad2(Number(data.meta.month))}-${pad2(Number(data.meta.day))}`,
        ) || (
          <>
            Ngày <strong>{data.meta.day}</strong>/<strong>{data.meta.month}</strong>/<strong>{data.meta.year}</strong>
          </>
        )}
      </>
    ) : data.meta.scope === "month_calendar_week" ? (
      <>
        Tuần <strong>{data.meta.calendarWeek}</strong> trong tháng <strong>{data.meta.month}</strong>/
        <strong>{data.meta.year}</strong> (ngày <strong>{data.meta.dayStart}</strong>–
        <strong>{data.meta.dayEnd}</strong>)
      </>
    ) : (
      <>
        Tuần ISO <strong>{data.meta.isoWeek}</strong> · năm tuần <strong>{data.meta.isoWeekYear}</strong>
      </>
    )
  ) : null;

  return (
    <div className="app app--aggregate">
      <header className="aggregate-header">
        <div className="sheet-header-top">
          <BrandBlock
            extraBrandClass="aggregate-header-brand"
            subtitle="Tổng hợp doanh thu theo kỳ"
            subtitleClassName="aggregate-brand-subtitle"
          />
          <MainNavBar />
        </div>

        <div className="aggregate-toolbar">
          <label className="aggregate-field">
            <span>Xem theo</span>
            <select
              className="select-input"
              value={mode}
              onChange={(e) => {
                const v = /** @type {"month_full"|"month_week"|"iso"|"day"} */ (e.target.value);
                setMode(v);
                if (v === "iso") {
                  const t = new Date();
                  setFilterIsoYear(getISOWeekYear(t));
                  setFilterIsoWeek(getISOWeek(t));
                }
                if (v === "day") {
                  const t = new Date();
                  setFilterDayISO(isoDateLocal(t.getFullYear(), t.getMonth() + 1, t.getDate()));
                }
              }}
              aria-label="Kiểu kỳ"
            >
              <option value="month_full">Tháng (cả tháng)</option>
              <option value="day">Một ngày</option>
              <option value="month_week">Tuần trong tháng (7 ngày liên tiếp từ ngày 1)</option>
              <option value="iso">Tuần (ISO)</option>
            </select>
          </label>
          {(mode === "month_full" || mode === "month_week") ? (
            <>
              <label className="aggregate-field">
                <span>Năm</span>
                <input
                  type="number"
                  className="num-input"
                  min={2020}
                  max={2040}
                  value={filterYear}
                  onChange={(e) => setFilterYear(Number(e.target.value) || filterYear)}
                />
              </label>
              <label className="aggregate-field">
                <span>Tháng</span>
                <select
                  className="select-input"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Tháng {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              {mode === "month_week" && (
                <label className="aggregate-field">
                  <span>Tuần trong tháng</span>
                  <select
                    className="select-input"
                    value={filterCalendarWeek}
                    onChange={(e) => setFilterCalendarWeek(Number(e.target.value))}
                  >
                    {monthWeekSpans.map((s) => (
                      <option key={s.index} value={s.index}>
                        Tuần {s.index} · ngày {s.startDay}–{s.endDay}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          ) : mode === "day" ? (
            <label className="aggregate-field">
              <span>Ngày</span>
              <input
                type="date"
                value={filterDayISO}
                onChange={(e) => setFilterDayISO(e.target.value)}
                className="date-input"
                aria-label="Chọn ngày để tổng hợp"
              />
            </label>
          ) : (
            <>
              <label className="aggregate-field">
                <span>Năm ISO</span>
                <input
                  type="number"
                  className="num-input"
                  min={2020}
                  max={2040}
                  value={filterIsoYear}
                  onChange={(e) => setFilterIsoYear(Number(e.target.value) || filterIsoYear)}
                />
              </label>
              <label className="aggregate-field">
                <span>Tuần</span>
                <select
                  className="select-input"
                  value={filterIsoWeek}
                  onChange={(e) => setFilterIsoWeek(Number(e.target.value))}
                >
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>
                      Tuần {w}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {!loadErr && data && (
          <p className="aggregate-period">
            {subtitle} · <strong>{data.sheetCount}</strong> phiếu trong kỳ
          </p>
        )}
      </header>

      {loadErr && <p className="mongo-warn aggregate-err">{loadErr}</p>}

      {!loadErr && !data && <p className="history-note aggregate-loading">Đang tải…</p>}

      {data && (
        <>
          <div className="table-wrap aggregate-tables">
            <h2 className="aggregate-section-title">Mặt hàng — tiền &amp; đếm</h2>
            <table className="revenue-table aggregate-detail-table">
              <thead>
                <tr>
                  <th>Hạng mục</th>
                  <th>Tổng tiền (đ)</th>
                  <th>Lần bán qua ± (dòng sổ)</th>
                  <th>Chỉ gõ tay (không có sổ dòng)</th>
                  <th>Ước đơn vị (*)</th>
                  <th>Ghi (*)</th>
                </tr>
              </thead>
              <tbody>
                {PRODUCT_ROWS.map(({ key, label }) => {
                  const denom = /** @type {number | undefined} */ (data.impliedUnitPrices?.[key]);
                  const note =
                    key === "cau"
                      ? "Không phải 1 lần ± = 1 quả — số lần / 1 quả theo từng mức: chỉnh src/cauShuttleRates.js (±6 đang 4 lần = 1 quả)"
                      : key === "doAn"
                        ? "Quy ước 1 lần ± khớp bước = 1 suất — tổng = cộng các mức (xem ô bên)"
                        : denom
                            ? `Tổng tiền ÷ ${denom} (đơn một lần bấm ±${denom})`
                            : "—";

                  const imp = /** @type {number | null} */ (
                    ["san", "cuonCan", "suoi5k", "nuocNgot10k"].includes(key) ? data.impliedUnits?.[key] : null
                  );

                  const tierRows =
                    key === "cau"
                      ? cauTierRows(data.ledgerTierTxnCount?.cau, CAU_PRICE_STEPS)
                      : key === "doAn"
                        ? doAnTierRows(data.ledgerTierTxnCount?.doAn, DO_AN_PRICE_STEPS)
                        : [];
                  const cauClicksKnown =
                    key === "cau"
                      ? sumKnownTierTxns(data.ledgerTierTxnCount?.cau, CAU_PRICE_STEPS)
                      : null;
                  const cauQuaEstimated =
                    key === "cau"
                      ? sumEstimatedCauQua(data.ledgerTierTxnCount?.cau, CAU_PRICE_STEPS)
                      : null;

                  const tierSumSuat =
                    key === "doAn"
                      ? sumKnownTierTxns(data.ledgerTierTxnCount?.doAn, DO_AN_PRICE_STEPS)
                      : null;

                  return (
                    <tr key={key}>
                      <td>
                        <strong>{label}</strong>
                      </td>
                      <td className="cell-num-report">{formatMoney(data.sumMoney?.[key] ?? 0, { blankZero: false })}</td>
                      <td>{(data.ledgerTxnCount?.[key] ?? 0).toLocaleString("vi-VN")}</td>
                      <td>{(data.legacyCellCount?.[key] ?? 0).toLocaleString("vi-VN")}</td>
                      <td className="aggregate-tier-units-cell">
                        {tierRows.length > 0 ? (
                          <>
                            <ul
                              className="aggregate-tier-row-list"
                              aria-label={key === "cau" ? "Cầu theo mức giá" : "Đồ ăn theo mức giá"}
                            >
                              {tierRows}
                            </ul>
                            {key === "cau" &&
                            typeof cauClicksKnown === "number" &&
                            cauClicksKnown > 0 &&
                            Number.isFinite(cauQuaEstimated) &&
                            cauQuaEstimated > 0 ? (
                              <div className="aggregate-tier-total-line">
                                <strong>Tổng quả (ước):</strong> ≈ {fmtUnits(cauQuaEstimated)} quả ·{" "}
                                <span className="aggregate-tier-subdued">
                                  {cauClicksKnown.toLocaleString("vi-VN")} lần vào các mức đã nhận dạng
                                </span>
                              </div>
                            ) : null}
                            {key === "doAn" &&
                            typeof tierSumSuat === "number" &&
                            tierSumSuat > 0 ? (
                              <div className="aggregate-tier-total-line">
                                <strong>Tổng {DO_AN_PRICE_STEPS.length} mức giá (đồ ăn):</strong>{" "}
                                {tierSumSuat.toLocaleString("vi-VN")}{" "}
                                <span className="aggregate-tier-unit-name">suất</span>
                                {" (1 lần ± đúng bước = 1 suất)"}
                              </div>
                            ) : null}
                          </>
                        ) : ["san", "cuonCan", "suoi5k", "nuocNgot10k"].includes(key) ? (
                          <span className="cell-num-report">{fmtUnits(imp)}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="aggregate-notes-cell">{note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h2 className="aggregate-section-title">Tổng phiếu</h2>
            <table className="revenue-table aggregate-summary-table">
              <tbody>
                <tr>
                  <th>Tổng doanh thu (gộp)</th>
                  <td>{formatMoney(data.sumMoney.doanhThu, { blankZero: false })}</td>
                </tr>
                <tr>
                  <th>Hôm nay trả (gộp)</th>
                  <td>{formatMoney(data.sumMoney.homNayTra, { blankZero: false })}</td>
                </tr>
                <tr>
                  <th>Còn nợ sau phiếu (gộp công)</th>
                  <td>{formatMoney(data.sumMoney.conNo, { blankZero: false })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <footer className="aggregate-footnotes">
            <p>
              <strong>* Ước đơn vị</strong> chỉ có nghĩa nếu mọi lần bán đều đúng bước cố định (±
              {data.impliedUnitPrices?.san ?? 15} sân, ±{data.impliedUnitPrices?.cuonCan ?? 10} cuốn, ±
              {data.impliedUnitPrices?.suoi5k ?? 5} suối, ±{data.impliedUnitPrices?.nuocNgot10k ?? 10} NN). Với{" "}
              <strong>cầu</strong>, tổng <strong>số quả là ước</strong>: cộng theo đúng{' '}
              <strong>bao nhiêu lần ± / 1 quả</strong> tại từng mức (đang cấu hình trong{" "}
              <code className="aggregate-code-ref">src/cauShuttleRates.js</code>). Với <strong>đồ ăn</strong>, hiện vẫn{" "}
              <strong>1 lần ± đúng bước = 1 suất</strong>. Dòng sổ không khớp bước ± không quy vào số quả / suất này.{" "}
              <strong>Gõ tay</strong> vào ô không dùng ± chỉ phản ánh ở tổng tiền và cột <em>Chỉ gõ tay</em>.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
