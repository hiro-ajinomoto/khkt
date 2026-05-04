import { useEffect, useState } from "react";
import { CHIA_CAU_MAX_PARTICIPANTS, CHIA_CAU_PRICE_OPTIONS } from "./chiaCauUtils.js";

/**
 * Lưu «cầu đánh độ» vào hàng đợi (chưa chia tiền).
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {Array<{ index: number, stt: number, name: string }>} players
 * @param {(p: { pickupRowIndex: number, pickupTen: string, priceVnd: number, participantRowIndices: number[] }) => void} onSaveQueue
 */
export default function CauDoEnqueueDialog({ open, onClose, players, onSaveQueue }) {
  const [pickup, setPickup] = useState("");
  const [priceVnd, setPriceVnd] = useState(/** @type {number | null} */ (null));
  const [participantIndices, setParticipantIndices] = useState(/** @type {number[]} */ ([]));
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

  useEffect(() => {
    if (!open) {
      setPickup("");
      setPriceVnd(null);
      setParticipantIndices([]);
      setErr(null);
    }
  }, [open]);

  function togglePlayer(idx) {
    setErr(null);
    setParticipantIndices((prev) => {
      const has = prev.includes(idx);
      if (has) return prev.filter((x) => x !== idx).sort((a, b) => a - b);
      if (prev.length >= CHIA_CAU_MAX_PARTICIPANTS) {
        queueMicrotask(() => setErr(`Chỉ được chọn tối đa ${CHIA_CAU_MAX_PARTICIPANTS} người đánh.`));
        return prev;
      }
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
    if (participantIndices.length === 0) {
      setErr("Tích ít nhất một người đánh (gợi ý khi chia tiền).");
      return;
    }
    if (participantIndices.length > CHIA_CAU_MAX_PARTICIPANTS) {
      setErr(`Chỉ được chọn tối đa ${CHIA_CAU_MAX_PARTICIPANTS} người đánh.`);
      return;
    }
    const p = players.find((x) => x.index === pickupNum);
    if (!p) {
      setErr("Không tìm thấy người đã chọn.");
      return;
    }
    onSaveQueue({
      pickupRowIndex: pickupNum,
      pickupTen: p.name,
      priceVnd: Math.round(priceVnd),
      participantRowIndices: [...participantIndices],
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
      <div className="name-modal chia-cau-dialog" role="dialog" aria-modal="true" aria-labelledby="cau-do-enq-title">
        <div className="chia-cau-dialog-head">
          <h2 id="cau-do-enq-title" className="name-modal-title chia-cau-dialog-title">
            Cầu độ — lưu hàng đợi
          </h2>
          <button type="button" className="quick-register-dialog-close" aria-label="Đóng" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="chia-cau-lead">
          Chọn <strong>người lấy cầu</strong>, <strong>ai đánh</strong> (để sau bấm <strong>Chia tiền</strong> danh sách
          cùng trả đã được tích sẵn) và <strong>giá</strong>. Tiền chỉ vào cột Cầu sau khi chia từ hàng đợi.
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
              <span className="chia-cau-label" id="cau-do-enq-pickup">
                Ai lấy cầu?
              </span>
              <select
                className="chia-cau-select"
                aria-labelledby="cau-do-enq-pickup"
                value={pickup === "" ? "" : String(pickup)}
                onChange={(e) => {
                  setErr(null);
                  const raw = e.target.value;
                  if (raw === "") {
                    setPickup("");
                    return;
                  }
                  const n = Number(raw);
                  setPickup(raw);
                  if (Number.isFinite(n)) {
                    setErr(null);
                    setParticipantIndices((prev) => {
                      if (prev.includes(n)) return prev;
                      if (prev.length >= CHIA_CAU_MAX_PARTICIPANTS) {
                        queueMicrotask(() =>
                          setErr(`Chỉ được chọn tối đa ${CHIA_CAU_MAX_PARTICIPANTS} người đánh.`),
                        );
                        return prev;
                      }
                      return [...prev, n].sort((a, b) => a - b);
                    });
                  }
                }}
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
              <legend className="chia-cau-label">{`Ai đánh? (tối đa ${CHIA_CAU_MAX_PARTICIPANTS} người — khi «Chia tiền» sẽ tích sẵn cùng trả)`}</legend>
              <div className="chia-cau-check-list">
                {players.map((p) => (
                  <label key={p.index} className="chia-cau-check-row">
                    <input
                      type="checkbox"
                      checked={participantIndices.includes(p.index)}
                      disabled={
                        participantIndices.length >= CHIA_CAU_MAX_PARTICIPANTS &&
                        !participantIndices.includes(p.index)
                      }
                      onChange={() => togglePlayer(p.index)}
                    />
                    <span>
                      STT {p.stt} · {p.name}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

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
                Lưu vào hàng đợi
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
