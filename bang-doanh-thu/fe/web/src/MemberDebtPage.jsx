import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMoney, formatViDateTime } from "./formatMoney.js";
import "./App.css";

/** @typedef {{ id: string; name: string; nickname: string; phone: string }} Person */

/** @typedef {{ reportDate: string; stt: number; kind: string; amount: number; at: string; note: string }} LedgerLine */

export default function MemberDebtPage() {
  const { personId } = useParams();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [person, setPerson] = useState(/** @type {Person | null} */ (null));
  const [payload, setPayload] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [err, setErr] = useState(/** @type {string | null} */ (null));
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!personId) return;
    setErr(null);
    setBusy(true);
    try {
      const [pr, dr] = await Promise.all([
        fetch(`/api/revenue/people/${encodeURIComponent(personId)}`),
        fetch(`/api/revenue/people/${encodeURIComponent(personId)}/debt?year=${year}`),
      ]);
      if (pr.status === 404) {
        setPerson(null);
        setPayload(null);
        setErr("Không tìm thấy thành viên.");
        return;
      }
      if (!pr.ok) throw new Error("person");
      setPerson(await pr.json());
      if (!dr.ok) throw new Error("debt");
      setPayload(await dr.json());
    } catch {
      setErr("Không tải được dữ liệu.");
      setPerson(null);
      setPayload(null);
    } finally {
      setBusy(false);
    }
  }, [personId, year]);

  useEffect(() => {
    load();
  }, [load]);

  const months = Array.isArray(payload?.months) ? payload.months : [];
  const debtLines = Array.isArray(payload?.debtLedgerLines) ? /** @type {LedgerLine[]} */ (payload.debtLedgerLines) : [];
  const totals = payload?.debtLedgerTotals;

  return (
    <div className="app app--members">
      <header className="sheet-header members-header">
        <div className="sheet-header-top">
          <h1 className="sheet-title">Nợ theo người</h1>
          <nav className="header-nav-links" aria-label="Điều hướng">
            <Link to="/" className="header-nav-link">
              Bảng doanh thu
            </Link>
            <Link to="/thanh-vien" className="header-nav-link">
              Danh bạ
            </Link>
          </nav>
        </div>
        {person && (
          <p className="members-intro member-debt-headline">
            <strong>{person.name}</strong>
            {person.nickname ? ` · ${person.nickname}` : ""}
            {person.phone ? ` · ${person.phone}` : ""}
          </p>
        )}
        <div className="members-toolbar member-debt-toolbar">
          <label className="member-debt-year-label">
            <span>Năm</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              className="member-debt-year-input"
            />
          </label>
          <button type="button" className="members-btn members-btn--ghost" onClick={() => load()} disabled={busy}>
            Làm mới
          </button>
        </div>
      </header>

      {payload?.help?.conNo && <p className="members-intro member-debt-help">{String(payload.help.conNo)}</p>}

      {err && <p className="mongo-warn">{err}</p>}
      {busy && !err && <p className="members-intro">Đang tải…</p>}

      {!busy && payload && totals && (
        <p className="member-debt-year-total">
          Tổng «Còn nợ» (phiếu + ghi nợ) trong năm {payload.year}:{" "}
          <strong>{formatMoney(/** @type {number} */ (payload.yearTotalConNo), { blankZero: false })}</strong>
          <span className="member-debt-year-total-note">
            {" "}
            · Đã ghi thêm nợ: <strong>{formatMoney(totals.cong, { blankZero: false })}</strong>
            {" · "}
            Đã ghi trả: <strong>{formatMoney(totals.tru, { blankZero: false })}</strong>
            {typeof totals.ghi === "number" && totals.ghi > 0 ? (
              <>
                {" · "}
                Ghi nhận số nợ (hover): <strong>{formatMoney(totals.ghi, { blankZero: false })}</strong>
              </>
            ) : null}
          </span>
        </p>
      )}

      {!busy && debtLines.length > 0 && (
        <div className="table-wrap members-table-wrap">
          <h2 className="aggregate-section-title" style={{ marginBottom: "0.5rem" }}>
            Lịch sử ghi nợ / trả nợ / ghi nhận (cộng dồn theo tên)
          </h2>
          <table className="revenue-table members-table">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Ngày phiếu</th>
                <th>STT</th>
                <th>Loại</th>
                <th className="cell-num-report">Số tiền</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {debtLines.map((ln, i) => (
                <tr key={`${ln.at}-${i}`}>
                  <td className="members-meta">{formatViDateTime(ln.at)}</td>
                  <td>
                    <Link to={`/?date=${encodeURIComponent(ln.reportDate)}`}>{ln.reportDate}</Link>
                  </td>
                  <td>{ln.stt}</td>
                  <td>
                    {ln.kind === "cong" ? "Ghi nợ" : ln.kind === "tru" ? "Trả nợ" : ln.kind === "ghi" ? "Ghi nhận" : ln.kind}
                  </td>
                  <td className="cell-num-report">
                    {formatMoney(ln.kind === "tru" ? -ln.amount : ln.amount, { blankZero: false })}
                  </td>
                  <td>{ln.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="table-wrap members-table-wrap" style={{ marginTop: "1.5rem" }}>
        <h2 className="aggregate-section-title" style={{ marginBottom: "0.5rem" }}>
          Còn nợ theo tháng (trên phiếu)
        </h2>
        <table className="revenue-table members-table member-debt-table">
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="cell-num-report">Số dòng</th>
              <th className="cell-num-report">Tổng còn nợ</th>
            </tr>
          </thead>
          <tbody>
            {months.length === 0 && !busy && !err ? (
              <tr>
                <td colSpan={3} className="members-empty">
                  Không có dòng trùng tên trên phiếu trong năm {year}.
                </td>
              </tr>
            ) : (
              months.map((m) => (
                <tr key={`${m.year}-${m.month}`}>
                  <td>
                    Tháng {m.month}/{m.year}
                  </td>
                  <td className="cell-num-report">{m.lineCount}</td>
                  <td className="cell-num-report">{formatMoney(m.totalConNo, { blankZero: false })}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
