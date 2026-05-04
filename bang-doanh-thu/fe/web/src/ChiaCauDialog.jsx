import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "./formatMoney.js";
import { CHIA_CAU_PRICE_OPTIONS, splitTotalEvenInt } from "./chiaCauUtils.js";

/**
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {Array<{ index: number, stt: number, name: string }>} players — chỉ dòng đã có tên hôm nay
 * @param {(p: { pickupIndex: number, participantIndices: number[], priceVnd: number }) => void} onApply
 */
export default function ChiaCauDialog({ open, onClose, players, onApply }) {
  const [pickup, setPickup] = useState("");
  const [priceVnd, setPriceVnd] = useState(/** @type {number | null} */ (null));
  const [participants, setParticipants] = useState(/** @type {number[]} */ ([]));
  const [err, setErr] = useState(/** @type {string | null} */ (null));

  const pickupNum = pickup === "" ? NaN : Number(pickup);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const preview = useMemo(() => {
    if (priceVnd == null || !Number.isFinite(priceVnd) || priceVnd <= 0) return null;
    const n = participants.length;
    if (n <= 0) return null;
    const parts = splitTotalEvenInt(priceVnd, n);
    if (parts.length === 0) return null;
    const t = parts.reduce((a, b) => a + b, 0);
    const uniq = new Set(parts);
    const eachFirst = Math.max(...parts);
    const eachRest = Math.min(...parts);
    return { n, eachFirst, eachRest, total: t, equal: uniq.size === 1 };
  }, [priceVnd, participants]);

  function onPickupChange(raw) {
    setErr(null);
    if (raw === "") {
      setPickup("");
      return;
    }
    const v = Number(raw);
    setPickup(v);
    setParticipants((prev) => (prev.includes(v) ? prev : [...prev, v].sort((a, b) => a - b)));
  }

  function toggleParticipant(idx) {
    setErr(null);
    setParticipants((prev) => {
      const has = prev.includes(idx);
      if (has) return prev.filter((x) => x !== idx).sort((a, b) => a - b);
      return [...prev, idx].sort((a, b) => a - b);
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setErr(null);
    if (!Number.isFinite(pickupNum)) {
      setErr("Chọn người lấy cầu.");
      return;
    }
    if (priceVnd == null || !Number.isFinite(priceVnd) || priceVnd <= 0) {
      setErr("Chọn giá cầu.");
      return;
    }
    if (participants.length === 0) {
      setErr("Tích chọn ít nhất một người cùng trả.");
      return;
    }
    if (!participants.includes(pickupNum)) {
      setErr("Người lấy cầu phải được tích trong danh sách cùng trả.");
      return;
    }
    onApply({
      pickupIndex: pickupNum,
      participantIndices: [...participants],
      priceVnd: Math.round(priceVnd),
    });
  }

  if (!open) return null;

  return (
    <div
      className="name-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="name-modal chia-cau-dialog" role="dialog" aria-modal="true" aria-labelledby="chia-cau-title">
        <div className="chia-cau-dialog-head">
          <h2 id="chia-cau-title" className="name-modal-title chia-cau-dialog-title">
            Chia cầu
          </h2>
          <button type="button" className="quick-register-dialog-close" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="chia-cau-lead">
          Chỉ hiện <strong>người đã có tên</strong> trên phiếu hôm nay. Tiền <strong>chia đều</strong> cho những người được
          tích; mỗi người sẽ thấy dòng <strong>Cầu</strong> trong lịch sử (STT trên bảng).
        </p>

        {players.length === 0 ? (
          <>
            <p className="chia-cau-msg chia-cau-msg--err">Chưa có ai trong danh sách — nhập tên ở cột Tên trước.</p>
            <div className="chia-cau-actions">
              <button type="button" className="quick-register-dialog-cancel" onClick={onClose}>
                Đóng
              </button>
            </div>
          </>
        ) : (
          <form className="chia-cau-form" onSubmit={handleSubmit}>
            <div className="chia-cau-block">
              <span className="chia-cau-label" id="chia-cau-pickup-label">
                Ai lấy cầu?
              </span>
              <select
                className="chia-cau-select"
                aria-labelledby="chia-cau-pickup-label"
                value={pickup === "" ? "" : String(pickup)}
                onChange={(e) => onPickupChange(e.target.value)}
              >
                <option value="">— Chọn —</option>
                {players.map((p) => (
                  <option key={p.index} value={String(p.index)}>
                    STT {p.stt} · {p.name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="chia-cau-block chia-cau-fieldset">
              <legend className="chia-cau-label">Giá cầu (1 loại)</legend>
              <div className="chia-cau-price-grid" role="group" aria-label="Giá cầu">
                {CHIA_CAU_PRICE_OPTIONS.map((opt) => (
                  <button
                    key={opt.vnd}
                    type="button"
                    className={`chia-cau-price-btn${priceVnd === opt.vnd ? " chia-cau-price-btn--on" : ""}`}
                    onClick={() => {
                      setErr(null);
                      setPriceVnd(opt.vnd);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="chia-cau-block chia-cau-fieldset">
              <legend className="chia-cau-label">Ai cùng trả? (tích hết người góp, gồm cả người lấy cầu)</legend>
              <div className="chia-cau-check-list">
                {players.map((p) => (
                  <label key={p.index} className="chia-cau-check-row">
                    <input
                      type="checkbox"
                      checked={participants.includes(p.index)}
                      onChange={() => toggleParticipant(p.index)}
                    />
                    <span>
                      STT {p.stt} · {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {preview && (
              <p className="chia-cau-preview" role="status">
                {preview.equal ? (
                  <>
                    Mỗi người trả <strong>{formatMoney(preview.eachRest, { blankZero: false })}đ</strong> ({preview.n}{" "}
                    người, tổng {formatMoney(preview.total, { blankZero: false })}đ).
                  </>
                ) : (
                  <>
                    Một phần người trả <strong>{formatMoney(preview.eachFirst, { blankZero: false })}đ</strong>, phần
                    còn lại <strong>{formatMoney(preview.eachRest, { blankZero: false })}đ</strong> (tổng{" "}
                    {formatMoney(preview.total, { blankZero: false })}đ, {preview.n} người).
                  </>
                )}
              </p>
            )}

            {err ? (
              <p className="chia-cau-msg chia-cau-msg--err" role="alert">
                {err}
              </p>
            ) : null}

            <div className="chia-cau-actions">
              <button type="button" className="quick-register-dialog-cancel" onClick={onClose}>
                Đóng
              </button>
              <button type="submit" className="name-modal-submit chia-cau-submit" disabled={players.length === 0}>
                Chia cầu
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
