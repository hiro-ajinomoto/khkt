import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatViDateTime } from "./formatMoney.js";
import "./App.css";

/** @typedef {{ id: string; name: string; nickname: string; phone: string; createdAt?: string | null; updatedAt?: string | null }} Person */

export default function MembersPage() {
  const [people, setPeople] = useState(/** @type {Person[]} */ ([]));
  const [loadErr, setLoadErr] = useState(/** @type {string | null} */ (null));
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState(/** @type {string | null} */ (null));
  const [formName, setFormName] = useState("");
  const [formNick, setFormNick] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formMsg, setFormMsg] = useState(/** @type {{ type: "ok" | "err"; text: string } | null} */ (null));

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await fetch("/api/revenue/people");
      if (!r.ok) throw new Error("load_failed");
      const j = await r.json();
      setPeople(Array.isArray(j.people) ? j.people : []);
    } catch {
      setLoadErr("Không tải được danh sách.");
      setPeople([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditingId("new");
    setFormName("");
    setFormNick("");
    setFormPhone("");
    setFormMsg(null);
  }

  /** @param {Person} p */
  function openEdit(p) {
    setEditingId(p.id);
    setFormName(p.name);
    setFormNick(p.nickname || "");
    setFormPhone(p.phone || "");
    setFormMsg(null);
  }

  function closeForm() {
    setEditingId(null);
    setFormMsg(null);
  }

  async function submitForm(e) {
    e.preventDefault();
    setFormMsg(null);
    const name = formName.trim().replace(/\s+/g, " ");
    if (!name) {
      setFormMsg({ type: "err", text: "Nhập họ tên." });
      return;
    }
    setBusy(true);
    try {
      if (editingId === "new") {
        const r = await fetch("/api/revenue/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, nickname: formNick.trim(), phone: formPhone.trim() }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.status === 409) {
          setFormMsg({ type: "err", text: "Tên này đã có trong Trả nợ." });
          return;
        }
        if (r.status === 400 && j.error === "invalid_phone") {
          setFormMsg({
            type: "err",
            text: "Số điện thoại không hợp lệ (để trống hoặc 9–12 chữ số).",
          });
          return;
        }
        if (!r.ok) {
          setFormMsg({ type: "err", text: "Không lưu được." });
          return;
        }
        await load();
        closeForm();
      } else if (editingId) {
        const r = await fetch(`/api/revenue/people/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, nickname: formNick.trim(), phone: formPhone.trim() }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.status === 404) {
          setFormMsg({ type: "err", text: "Bản ghi không còn tồn tại." });
          await load();
          return;
        }
        if (r.status === 409) {
          setFormMsg({ type: "err", text: "Tên trùng với người khác." });
          return;
        }
        if (r.status === 400 && j.error === "invalid_phone") {
          setFormMsg({ type: "err", text: "Số điện thoại không hợp lệ." });
          return;
        }
        if (!r.ok) {
          setFormMsg({ type: "err", text: "Không cập nhật được." });
          return;
        }
        await load();
        closeForm();
      }
    } finally {
      setBusy(false);
    }
  }

  /** @param {Person} p */
  async function deletePerson(p) {
    if (!window.confirm(`Xóa «${p.name}» khỏi Trả nợ?`)) return;
    setBusy(true);
    setLoadErr(null);
    try {
      const r = await fetch(`/api/revenue/people/${encodeURIComponent(p.id)}`, { method: "DELETE" });
      if (r.status === 404) {
        setLoadErr("Bản ghi không còn tồn tại.");
        await load();
        return;
      }
      if (!r.ok && r.status !== 204) {
        setLoadErr("Không xóa được.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app app--members">
      <header className="sheet-header members-header">
        <div className="sheet-header-top">
          <h1 className="sheet-title">Trả nợ</h1>
          <nav className="header-nav-links" aria-label="Điều hướng">
            <Link to="/" className="header-nav-link">
              Bảng doanh thu
            </Link>
            <Link to="/tong-hop" className="header-nav-link">
              Tổng hợp kỳ
            </Link>
          </nav>
        </div>
        <p className="members-intro">
          Quản lý họ tên, biệt danh và số điện thoại dùng cho gợi ý ô Tên trên bảng doanh thu. Bấm{" "}
          <strong>họ tên</strong> để xem nợ cộng dồn (ghi nợ khi bấm ô Còn nợ trên phiếu).
        </p>
        <div className="members-toolbar">
          <button type="button" className="members-btn members-btn--primary" onClick={openCreate} disabled={busy}>
            + Thêm thành viên
          </button>
          <button type="button" className="members-btn members-btn--ghost" onClick={() => load()} disabled={busy}>
            Làm mới
          </button>
        </div>
      </header>

      {loadErr && <p className="mongo-warn">{loadErr}</p>}

      {editingId && (
        <div className="members-form-overlay" role="dialog" aria-modal="true" aria-labelledby="members-form-title">
          <form className="members-form-card" onSubmit={submitForm}>
            <h2 id="members-form-title" className="members-form-title">
              {editingId === "new" ? "Thêm thành viên" : "Sửa thành viên"}
            </h2>
            <label className="quick-register-field members-form-field">
              <span>Họ tên</span>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                maxLength={200}
                autoComplete="name"
              />
            </label>
            <label className="quick-register-field members-form-field">
              <span>Biệt danh</span>
              <input value={formNick} onChange={(e) => setFormNick(e.target.value)} maxLength={200} />
            </label>
            <label className="quick-register-field members-form-field">
              <span>Số điện thoại (tuỳ chọn)</span>
              <input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                inputMode="tel"
                placeholder="Để trống hoặc vd. 0912345678"
                autoComplete="tel"
              />
            </label>
            {formMsg && (
              <p
                className={
                  formMsg.type === "ok" ? "quick-register-msg quick-register-msg--ok" : "quick-register-msg quick-register-msg--err"
                }
              >
                {formMsg.text}
              </p>
            )}
            <div className="members-form-actions">
              <button type="submit" className="members-btn members-btn--primary" disabled={busy}>
                {busy ? "Đang lưu…" : "Lưu"}
              </button>
              <button type="button" className="members-btn members-btn--ghost" onClick={closeForm} disabled={busy}>
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrap members-table-wrap">
        <table className="revenue-table members-table">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Biệt danh</th>
              <th>SĐT</th>
              <th>Cập nhật (VN)</th>
              <th className="members-th-actions" />
            </tr>
          </thead>
          <tbody>
            {people.length === 0 && !loadErr ? (
              <tr>
                <td colSpan={5} className="members-empty">
                  Chưa có thành viên. Bấm «Thêm thành viên».
                </td>
              </tr>
            ) : (
              people.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`/thanh-vien/${encodeURIComponent(p.id)}`} className="member-name-link">
                      <strong>{p.name}</strong>
                    </Link>
                  </td>
                  <td>{p.nickname || "—"}</td>
                  <td className="cell-num-report">{p.phone || "—"}</td>
                  <td className="members-meta">
                    {p.updatedAt || p.createdAt ? formatViDateTime(p.updatedAt || p.createdAt) : "—"}
                  </td>
                  <td className="members-actions">
                    <button type="button" className="members-action-btn" onClick={() => openEdit(p)} disabled={busy}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="members-action-btn members-action-btn--danger"
                      onClick={() => deletePerson(p)}
                      disabled={busy}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
