import { useEffect, useRef, useState } from "react";
import { formatMoney } from "./formatMoney.js";

const HOVER_HOLD_MS = 500;

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
  const [holdOpen, setHoldOpen] = useState(false);
  const [justCommitted, setJustCommitted] = useState(false);
  const holdTimerRef = useRef(null);

  const cancelHoldTimer = () => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  useEffect(() => () => cancelHoldTimer(), []);

  useEffect(() => {
    setJustCommitted(false);
  }, [effectiveConNo]);

  const handleEnter = () => {
    cancelHoldTimer();
    setHoldOpen(true);
  };

  const handleLeave = () => {
    cancelHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      setHoldOpen(false);
      setJustCommitted(false);
      holdTimerRef.current = null;
    }, HOVER_HOLD_MS);
  };

  const n = roundAmt(effectiveConNo);
  const recorded = justCommitted;

  return (
    <td className={`cell-remaining cell-conno-hover${holdOpen ? " cell-conno-hover--open" : ""}`}>
      <div className="cell-conno-wrap" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        <span
          className="cell-conno-display"
          title="Hover → Ghi nợ: lưu đúng số đang hiển thị (Danh bạ), không đổi số trong ô"
        >
          {formatMoney(effectiveConNo, { blankZero: doanhThu === 0 && effectiveConNo === 0 })}
        </span>
        <div className="cell-conno-panel" role="region" aria-label={`Ghi nợ dòng ${rowIndex + 1}`}>
          <div className="cell-conno-form cell-conno-form--minimal">
            <button
              type="button"
              className={`cell-conno-add-btn${recorded ? " cell-conno-add-btn--recorded" : ""}`}
              disabled={n <= 0 || recorded}
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
        </div>
      </div>
    </td>
  );
}
