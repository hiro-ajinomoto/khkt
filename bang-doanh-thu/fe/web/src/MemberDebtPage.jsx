import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatMoney, formatViDateTime, parseMoney } from "./formatMoney.js";
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

  const [truAmount, setTruAmount] = useState("");
  const [truNote, setTruNote] = useState("");
  const [truBusy, setTruBusy] = useState(false);
  const [truMsg, setTruMsg] = useState(/** @type {{ type: "ok" | "err"; text: string } | null} */ (null));

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
  const yearTotalConNo = typeof payload?.yearTotalConNo === "number" ? payload.yearTotalConNo : 0;

  async function submitTruNo(e) {
    e.preventDefault();
    if (!personId || truBusy) return;
    setTruMsg(null);
    const amt = Math.round(parseMoney(truAmount) * 100) / 100;
    if (!(amt > 0)) {
      setTruMsg({ type: "err", text: "Nhập số tiền trừ nợ lớn hơn 0." });
      return;
    }
    setTruBusy(true);
    try {
      const r = await fetch(`/api/revenue/people/${encodeURIComponent(personId)}/debt/tru`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, note: truNote.trim(), year }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 400 && j.error === "no_sheet_row") {
        setTruMsg({ type: "err", text: String(j.message || "Chưa có dòng trùng tên trên phiếu.") });
        return;
      }
      if (r.status === 400 && j.error === "invalid_amount") {
        setTruMsg({ type: "err", text: "Số tiền không hợp lệ." });
        return;
      }
      if (!r.ok) {
        setTruMsg({ type: "err", text: "Không lưu được trừ nợ." });
        return;
      }
      const atStr = typeof j.at === "string" ? j.at : "";
      setTruMsg({
        type: "ok",
        text: `Đã trừ nợ ${formatMoney(amt, { blankZero: false })} · ${atStr ? formatViDateTime(atStr) : ""}${j.reportDate ? ` · phiếu ${j.reportDate}` : ""}`,
      });
      setTruAmount("");
      setTruNote("");
      await load();
    } catch {
      setTruMsg({ type: "err", text: "Mất kết nối API." });
    } finally {
      setTruBusy(false);
    }
  }

  const monthLineSum = months.reduce((s, m) => s + (typeof m.lineCount === "number" ? m.lineCount : 0), 0);

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
        <p className="members-intro member-debt-scope-note">
          Trên <Link to="/">bảng doanh thu</Link>, cột <strong>Còn nợ</strong> là <strong>theo từng ngày phiếu</strong> (mỗi dòng một
          ngày), không phải tổng cả tháng trong ô. Trang này gộp <strong>theo năm</strong> nhiều phiếu và dòng sổ bên dưới.
        </p>
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

      {!busy && payload && (
        <section className="member-debt-balance-card" aria-label="Tổng có dấu theo lịch sử">
          <div className="member-debt-balance-card-label">Tổng có dấu (năm {payload.year})</div>
          <div className="member-debt-balance-card-value">{formatMoney(yearTotalConNo, { blankZero: false })}</div>
          <p className="member-debt-balance-card-hint">
            Bằng cộng tay bảng lịch sử: ghi / ghi nhận (+), trả (−). Khớp tổng theo tháng bên dưới.
          </p>
        </section>
      )}

      {!busy && personId && (
        <section className="member-debt-tru-panel" aria-label="Trừ nợ">
          <h2 className="member-debt-tru-title">Trừ nợ (trả nợ)</h2>
          <p className="member-debt-tru-intro">
            Ghi một lần trừ nợ: hệ thống lưu <strong>thời điểm giao dịch</strong> (theo giờ máy chủ) và hiển thị trong
            bảng lịch sử dưới đây (loại «Trả nợ»). Tổng có dấu năm / theo tháng sẽ cập nhật.
          </p>
          <form className="member-debt-tru-form" onSubmit={submitTruNo}>
            <label className="member-debt-tru-field">
              <span>Số tiền trừ</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="vd. 50000 hoặc 50.000"
                value={truAmount}
                onChange={(e) => setTruAmount(e.target.value)}
                disabled={truBusy}
                className="member-debt-tru-input"
              />
            </label>
            <label className="member-debt-tru-field member-debt-tru-field--grow">
              <span>Ghi chú (tuỳ chọn)</span>
              <input
                type="text"
                maxLength={500}
                value={truNote}
                onChange={(e) => setTruNote(e.target.value)}
                disabled={truBusy}
                className="member-debt-tru-input"
              />
            </label>
            <button type="submit" className="members-btn member-debt-tru-submit" disabled={truBusy}>
              {truBusy ? "Đang lưu…" : "Ghi trừ nợ"}
            </button>
          </form>
          {truMsg && (
            <p className={truMsg.type === "ok" ? "member-debt-tru-msg member-debt-tru-msg--ok" : "member-debt-tru-msg"}>
              {truMsg.text}
            </p>
          )}
        </section>
      )}

      {payload?.help?.conNo && <p className="members-intro member-debt-help">{String(payload.help.conNo)}</p>}

      {err && <p className="mongo-warn">{err}</p>}
      {busy && !err && <p className="members-intro">Đang tải…</p>}

      {!busy && payload && totals && (
        <p className="member-debt-year-total">
          Chi tiết sổ (năm {payload.year}): Đã ghi thêm nợ{" "}
          <strong>{formatMoney(totals.cong, { blankZero: false })}</strong>
          {" · "}
          Đã ghi trả / trừ: <strong>{formatMoney(totals.tru, { blankZero: false })}</strong>
          {typeof totals.ghi === "number" && totals.ghi > 0 ? (
            <>
              {" · "}
                Ghi nhận số nợ (bấm ô Còn nợ): <strong>{formatMoney(totals.ghi, { blankZero: false })}</strong>
            </>
          ) : null}
        </p>
      )}

      {!busy && (
        <div className="table-wrap members-table-wrap">
          <h2 className="aggregate-section-title" style={{ marginBottom: "0.5rem" }}>
            Lịch sử ghi nợ / trả nợ / ghi nhận (cộng dồn theo tên)
          </h2>
          {debtLines.length === 0 ? (
            <p className="members-intro member-debt-empty-history">Chưa có dòng lịch sử trong năm {year}.</p>
          ) : (
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
                      {ln.kind === "cong"
                        ? "Ghi nợ"
                        : ln.kind === "tru"
                          ? "Trả nợ"
                          : ln.kind === "ghi"
                            ? "Ghi nhận"
                            : ln.kind}
                    </td>
                    <td className="cell-num-report">
                      {formatMoney(ln.kind === "tru" ? -ln.amount : ln.amount, { blankZero: false })}
                    </td>
                    <td>{ln.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="table-wrap members-table-wrap" style={{ marginTop: "1.5rem" }}>
        <h2 className="aggregate-section-title" style={{ marginBottom: "0.5rem" }}>
          Tổng theo tháng (cộng có dấu từ lịch sử)
        </h2>
        <table className="revenue-table members-table member-debt-table">
          <thead>
            <tr>
              <th>Tháng</th>
              <th className="cell-num-report">Số dòng</th>
              <th className="cell-num-report">Tổng (±)</th>
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
              <>
                {months.map((m) => (
                  <tr key={`${m.year}-${m.month}`}>
                    <td>
                      Tháng {m.month}/{m.year}
                    </td>
                    <td className="cell-num-report">{m.lineCount}</td>
                    <td className="cell-num-report">{formatMoney(m.totalConNo, { blankZero: false })}</td>
                  </tr>
                ))}
                {months.length > 0 && !busy && payload && (
                  <tr className="member-debt-month-footer">
                    <td>
                      <strong>Tổng cả năm</strong>
                    </td>
                    <td className="cell-num-report">{monthLineSum}</td>
                    <td className="cell-num-report">
                      <strong>{formatMoney(yearTotalConNo, { blankZero: false })}</strong>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
