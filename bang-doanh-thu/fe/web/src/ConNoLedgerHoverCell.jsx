import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatMoney } from "./formatMoney.js";

function roundAmt(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.abs(n) * 100) / 100;
}

function parseMoney(v) {
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

export function emptyClientConNoLedger() {
  return Array.from({ length: 40 }, () => []);
}

/** @typedef {{ kind: "cong" | "tru" | "ghi"; amount: number; at: string; note: string }} ConNoLine */

/** @param {unknown} raw */
export function normalizeApiConNoLedger(raw) {
  const out = emptyClientConNoLedger();
  if (!Array.isArray(raw)) return out;
  for (let i = 0; i < 40; i++) {
    const arr = raw[i];
    if (!Array.isArray(arr)) continue;
    /** @type {ConNoLine[]} */
    const lines = [];
    for (const e of arr) {
      if (!e || typeof e !== "object") continue;
      const kind =
        e.kind === "tru" ? "tru" : e.kind === "cong" ? "cong" : e.kind === "ghi" ? "ghi" : null;
      if (!kind) continue;
      let amount =
        typeof e.amount === "number" && Number.isFinite(e.amount)
          ? roundAmt(e.amount)
          : roundAmt(parseMoney(String(e.amount ?? "")));
      if (amount <= 0) continue;
      let atStr = "";
      try {
        atStr =
          e.at != null ? new Date(/** @type {string | number} */ (e.at)).toISOString() : new Date().toISOString();
      } catch {
        atStr = new Date().toISOString();
      }
      const note = typeof e.note === "string" ? e.note.trim().slice(0, 500) : "";
      lines.push({ kind, amount, at: atStr, note });
    }
    if (lines.length) out[i] = lines;
  }
  return out;
}

/**
 * @param {{
 *   rowIndex: number;
 *   ten: string;
 *   doanhThu: number;
 *   effectiveConNo: number;
 *   onGhiNo: (amount: number) => void;
 * }} props
 */
export default function ConNoLedgerHoverCell({ rowIndex, ten, doanhThu, effectiveConNo, onGhiNo }) {
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [justCommitted, setJustCommitted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, minW: 200 });

  useEffect(() => {
    setJustCommitted(false);
  }, [effectiveConNo]);

  useEffect(() => {
    if (!open) setJustCommitted(false);
  }, [open]);

  const n = roundAmt(effectiveConNo);
  const recorded = justCommitted;

  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const minW = Math.max(200, r.width);
    let left = r.right - minW;
    const vw = window.innerWidth;
    if (left < 8) left = 8;
    if (left + minW > vw - 8) left = Math.max(8, vw - 8 - minW);
    setPos({ top: r.bottom + 4, left, minW });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = e.target;
      if (!(t instanceof Node)) return;
      if (panelRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <td className={`cell-remaining cell-conno-cell${open ? " cell-conno--open" : ""}`}>
      <button
        ref={anchorRef}
        type="button"
        className="cell-conno-trigger"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => reposition());
        }}
        title="Bấm để ghi nợ (Danh bạ)"
      >
        {formatMoney(effectiveConNo, { blankZero: doanhThu === 0 && effectiveConNo === 0 })}
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="cell-conno-panel cell-conno-panel--floating"
            style={{ top: pos.top, left: pos.left, minWidth: pos.minW }}
            role="region"
            aria-label={`Ghi nợ dòng ${rowIndex + 1}`}
          >
            <div className="cell-conno-form cell-conno-form--minimal">
              <button
                type="button"
                className={`cell-conno-add-btn${recorded ? " cell-conno-add-btn--recorded" : ""}`}
                disabled={n <= 0 || recorded}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (n <= 0 || recorded) return;
                  onGhiNo(n);
                  setJustCommitted(true);
                }}
                aria-label={
                  recorded
                    ? `Đã ghi nợ ${formatMoney(n, { blankZero: false })} — dòng ${rowIndex + 1}`
                    : `Ghi nợ ${formatMoney(n, { blankZero: false })} — dòng ${rowIndex + 1}${ten.trim() ? `, ${ten.trim()}` : ""}`
                }
              >
                {recorded ? "Đã ghi nợ" : "Ghi nợ"}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </td>
  );
}
