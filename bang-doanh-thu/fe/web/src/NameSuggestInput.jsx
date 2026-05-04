import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch } from "./apiClient.js";

/** Giống `normalizePersonKey` phía BE (chuẩn so khớp tên). */
function normalizeKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKC")
    .toLowerCase();
}

/** Ô «Tên» + gợi ý từ Mongo + nút lưu người mới. */
export function NameSuggestInput({ rowIndex, value, onChange }) {
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const modalBackdropRef = useRef(null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [pos, setPos] = useState(/** @type {{ top: number; left: number; width: number } | null} */ (null));
  const [people, setPeople] = useState(/** @type {{ name: string; nickname: string; phone: string }[]} */ ([]));
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [nickDraft, setNickDraft] = useState("");
  const [createRegCode, setCreateRegCode] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  const qTrim = String(value ?? "").trim();
  const hasQuery = qTrim.length > 0;
  const hasExact = people.some((p) => normalizeKey(p.name) === normalizeKey(qTrim));

  const updatePosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + 4,
      left: r.left,
      width: Math.max(232, r.width),
    });
  }, []);

  useLayoutEffect(() => {
    if (!panelOpen) return;
    updatePosition();
  }, [panelOpen, people.length, loading, updatePosition]);

  useEffect(() => {
    if (!(panelOpen || createOpen)) return;

    function onResize() {
      updatePosition();
    }

    function onScroll() {
      setPanelOpen(false);
    }

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [panelOpen, createOpen, updatePosition]);

  useEffect(() => {
    if (!(panelOpen || createOpen)) return;

    function onMouseDown(e) {
      const t = /** @type {Node} */ (e.target);
      if (wrapRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      if (modalBackdropRef.current?.contains(t)) return;
      setPanelOpen(false);
      setCreateOpen(false);
    }

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [panelOpen, createOpen]);

  useEffect(() => {
    if (!panelOpen && !createOpen) return;
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (createOpen) setCreateOpen(false);
      else setPanelOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, createOpen]);

  useEffect(() => {
    if (!panelOpen || !hasQuery) {
      setPeople([]);
      setLoading(false);
      return undefined;
    }

    const ac = new AbortController();
    const tid = window.setTimeout(() => {
      setLoading(true);
      (async () => {
        try {
          const r = await apiFetch(`/api/revenue/people/suggest?q=${encodeURIComponent(qTrim)}`, {
            signal: ac.signal,
          });
          const j = await r.json();
          if (ac.signal.aborted) return;
          const list = Array.isArray(j.people) ? j.people : [];
          setPeople(
            list.map((p) => ({
              name: String(p?.name ?? ""),
              nickname: String(p?.nickname ?? ""),
              phone: String(p?.phone ?? ""),
            })),
          );
        } catch {
          if (ac.signal.aborted) return;
          setPeople([]);
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    }, 260);

    return () => {
      ac.abort();
      window.clearTimeout(tid);
      setLoading(false);
    };
  }, [qTrim, panelOpen, hasQuery]);

  async function submitCreate(nicknameExtra) {
    const name = qTrim || String(value ?? "").trim();
    if (!name) return;
    const registrationCode = createRegCode.trim();
    if (!registrationCode) {
      window.alert("Nhập mã đăng ký (do quản trị cấp).");
      return;
    }
    setCreateSaving(true);
    try {
      const r = await apiFetch("/api/revenue/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, nickname: nicknameExtra, phone: "", registrationCode }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409) {
        window.alert(
          typeof j?.error === "string"
            ? "Tên này đã có trong Trả nợ. Chọn ở gợi ý hoặc đổi tên một chút."
            : "Tên này đã có trong Trả nợ.",
        );
        setCreateSaving(false);
        return;
      }
      if (r.status === 403) {
        window.alert(typeof j.message === "string" ? j.message : "Mã đăng ký không đúng.");
        setCreateSaving(false);
        return;
      }
      if (!r.ok) throw new Error("save_person_failed");
      onChange(j.name ?? name);
      setCreateOpen(false);
      setPanelOpen(false);
      setNickDraft("");
      setCreateRegCode("");
    } catch {
      window.alert("Không lưu được. Kiểm tra kết nối API.");
    } finally {
      setCreateSaving(false);
    }
  }

  function openCreateModal() {
    setNickDraft("");
    setCreateRegCode("");
    setCreateOpen(true);
    setPanelOpen(true);
    queueMicrotask(() => updatePosition());
  }

  const dropdownPanel =
    panelOpen && pos && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            id={`name-panel-float-${rowIndex}`}
            className="name-suggest-panel"
            style={{
              position: "fixed",
              top: pos.top,
              left: Math.min(pos.left, window.innerWidth - pos.width - 8),
              width: pos.width,
            }}
            role="listbox"
            aria-label="Gợi ý khách trong Trả nợ"
          >
            {!hasQuery && (
              <div className="name-suggest-hint">Gõ tên, biệt danh hoặc một phần số điện thoại để tìm.</div>
            )}
            {loading && <div className="name-suggest-hint">Đang tìm…</div>}
            {!loading && hasQuery && people.length === 0 && (
              <div className="name-suggest-hint">Không có tên khớp trong Trả nợ.</div>
            )}
            {people.map((p) => (
              <button
                key={`${normalizeKey(p.name)}-${normalizeKey(p.nickname)}-${p.phone || ""}`}
                type="button"
                className="name-suggest-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(p.name);
                  setPanelOpen(false);
                }}
              >
                <span className="name-suggest-item-name">{p.name}</span>
                <span className="name-suggest-item-nick">
                  {p.nickname ? <>Biệt danh: {p.nickname}</> : <>Biệt danh: —</>}
                </span>
                {p.phone ? (
                  <span className="name-suggest-item-phone">ĐT: {p.phone}</span>
                ) : (
                  <span className="name-suggest-item-phone name-suggest-item-phone--empty">ĐT: —</span>
                )}
              </button>
            ))}
            {hasQuery && !hasExact && (
              <button
                type="button"
                className="name-suggest-add"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openCreateModal}
              >
                <span aria-hidden className="name-suggest-add-glyph">
                  +
                </span>{" "}
                Thêm «{qTrim.length > 42 ? `${qTrim.slice(0, 41)}…` : qTrim}» vào Trả nợ
              </button>
            )}
          </div>,
          document.body,
        )
      : null;

  const modalOverlay =
    createOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={modalBackdropRef}
            className="name-modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`name-modal-title-${rowIndex}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setCreateOpen(false);
            }}
          >
            <div className="name-modal">
              <h2 id={`name-modal-title-${rowIndex}`} className="name-modal-title">
                Lưu người vào Trả nợ
              </h2>
              <label className="name-modal-field">
                <span>Tên trong bảng</span>
                <input type="text" readOnly value={qTrim || value} />
              </label>
              <label className="name-modal-field">
                <span>Biệt danh (tuỳ chọn)</span>
                <input
                  type="text"
                  autoFocus
                  value={nickDraft}
                  placeholder="vd. Béo, A2, …"
                  onChange={(e) => setNickDraft(e.target.value)}
                />
              </label>
              <label className="name-modal-field">
                <span>Mã đăng ký</span>
                <input
                  type="password"
                  autoComplete="off"
                  value={createRegCode}
                  placeholder="Do quản trị cấp"
                  maxLength={200}
                  onChange={(e) => setCreateRegCode(e.target.value)}
                />
              </label>
              <div className="name-modal-actions">
                <button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)}>
                  Huỷ
                </button>
                <button
                  type="button"
                  className="name-modal-submit"
                  disabled={createSaving || !qTrim}
                  onClick={() => submitCreate(nickDraft.trim())}
                >
                  {createSaving ? "Đang lưu…" : "Lưu"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={wrapRef} className="name-cell-wrap">
        <input
          ref={inputRef}
          className="cell-input cell-text name-suggest-input"
          value={value}
          aria-autocomplete="list"
          aria-expanded={panelOpen}
          aria-controls={`name-panel-float-${rowIndex}`}
          placeholder="—"
          onFocus={() => {
            setPanelOpen(true);
            queueMicrotask(() => updatePosition());
          }}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {dropdownPanel}
      {modalOverlay}
    </>
  );
}
