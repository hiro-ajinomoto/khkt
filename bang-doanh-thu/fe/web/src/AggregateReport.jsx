import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { formatMoney } from "./formatMoney.js";
import { getCalendarWeekSpansInMonth } from "./calendarSpans.js";
import "./App.css";

const PRODUCT_ROWS = [
  { key: "san", label: "Sân" },
  { key: "cuonCan", label: "Cuốn cán" },
  { key: "cau", label: "Cầu" },
  { key: "suoi5k", label: "Suối (5k)" },
  { key: "nuocNgot10k", label: "Nước ngọt (10k)" },
  { key: "doAn", label: "Đồ ăn" },
  { key: "noCu", label: "Nợ cũ" },
];

/** @typedef {{ meta: Record<string, unknown>; sheetCount: number; sumMoney: Record<string, number>; ledgerTxnCount: Record<string, number>; legacyCellCount: Record<string, number>; impliedUnits: Record<string, number | null>; impliedUnitPrices: Record<string, number> }} Agg */

function fmtUnits(n) {
  if (n == null || n === "") return "—";
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function AggregateReport() {
  const now = useMemo(() => new Date(), []);
  const [mode, setMode] = useState(/** @type {"month_full"|"month_week"|"iso"} */ ("month_full"));
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterCalendarWeek, setFilterCalendarWeek] = useState(1);
  const [filterIsoYear, setFilterIsoYear] = useState(() => getISOWeekYear(now));
  const [filterIsoWeek, setFilterIsoWeek] = useState(() => getISOWeek(now));

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
    } else {
      params.set("year", String(filterIsoYear));
      params.set("week", String(filterIsoWeek));
    }
    fetch(`/api/revenue/aggregate?${params}`)
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
  }, [mode, filterYear, filterMonth, filterCalendarWeek, filterIsoYear, filterIsoWeek]);

  const subtitle = data?.meta ? (
    data.meta.scope === "month" ? (
      <>
        Tháng <strong>{data.meta.month}</strong>/<strong>{data.meta.year}</strong> (cả tháng)
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
        <Link to="/" className="history-back aggregate-back">
          ← Bảng doanh thu
        </Link>
        <h1 className="sheet-title aggregate-title">Tổng hợp doanh thu theo kỳ</h1>
        <p className="aggregate-intro">
          Gộp tất cả phiếu ngày trong kỳ: <strong>tổng tiền</strong> theo mặt hàng,{" "}
          <strong>số lần bán qua ±</strong> (mỗi dòng trong sổ chi tiết = một lần), và ô nhập không có chi tiết
          (phiếu cũ). Với đơn giá cố định (±{data?.impliedUnitPrices?.san ?? 15} sân · ±
          {data?.impliedUnitPrices?.cuonCan ?? 10} cuốn · ±{data?.impliedUnitPrices?.suoi5k ?? 5} suối · ±
          {data?.impliedUnitPrices?.nuocNgot10k ?? 10} NN) có{" "}
          <strong>số đơn vị ước lượng</strong>; <strong>cầu</strong> và <strong>đồ ăn</strong> có nhiều mức giá
          — đối chiếu chủ yếu bằng tổng tiền và số lần bấm ±.
        </p>

        <div className="aggregate-toolbar">
          <label className="aggregate-field">
            <span>Xem theo</span>
            <select
              className="select-input"
              value={mode}
              onChange={(e) => {
                const v = /** @type {"month_full"|"month_week"|"iso"} */ (e.target.value);
                setMode(v);
                if (v === "iso") {
                  const t = new Date();
                  setFilterIsoYear(getISOWeekYear(t));
                  setFilterIsoWeek(getISOWeek(t));
                }
              }}
              aria-label="Kiểu kỳ"
            >
              <option value="month_full">Tháng (cả tháng)</option>
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
                      ? "Giá ±6·7·7,5·8 — chỉ có lần bán và tổng tiền"
                      : key === "doAn"
                        ? "Giá ±5…10 — chỉ có lần bán và tổng tiền"
                        : key === "noCu"
                          ? "Tổng nợ cũ trong kỳ — không chia đơn vị"
                          : denom
                            ? `Tổng tiền ÷ ${denom} (đơn một lần bấm ±${denom})`
                            : "—";

                  const imp = /** @type {number | null} */ (
                    ["san", "cuonCan", "suoi5k", "nuocNgot10k"].includes(key) ? data.impliedUnits?.[key] : null
                  );

                  return (
                    <tr key={key}>
                      <td>
                        <strong>{label}</strong>
                      </td>
                      <td className="cell-num-report">{formatMoney(data.sumMoney?.[key] ?? 0, { blankZero: false })}</td>
                      <td>{(data.ledgerTxnCount?.[key] ?? 0).toLocaleString("vi-VN")}</td>
                      <td>{(data.legacyCellCount?.[key] ?? 0).toLocaleString("vi-VN")}</td>
                      <td className="cell-num-report">
                        {["san", "cuonCan", "suoi5k", "nuocNgot10k"].includes(key) ? fmtUnits(imp) : "—"}
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
              {data.impliedUnitPrices?.suoi5k ?? 5} suối, ±{data.impliedUnitPrices?.nuocNgot10k ?? 10} NN).{" "}
              <strong>Gõ tay</strong> một số vào ô mà không dùng ± vẫn đúng tiền nhưng chỉ được đếm ở cột{' '}
              <em>Chỉ gõ tay</em> (ưu độ chính xác tổng tiền, không chia đơn vị). So với kiểm kê thực tế phải tự nhớ cả các
              mức giá khác và trả khách sau phiếu.
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
