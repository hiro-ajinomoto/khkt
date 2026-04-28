import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import './ImageLightbox.css';

const SCALE_MIN = 0.25;
const SCALE_MAX = 5;

/**
 * Overlay xem ảnh đầy màn với xoay 90°, zoom, đặt lại.
 */
export default function ImageLightbox({ open, onClose, src, alt = '', title }) {
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);

  const resetTransforms = useCallback(() => {
    setRotation(0);
    setScale(1);
  }, []);

  useEffect(() => {
    if (open && src) {
      resetTransforms();
    }
  }, [open, src, resetTransforms]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pctLabel = useMemo(() => `${Math.round(scale * 100)}%`, [scale]);

  const clampScale = useCallback((s) => {
    return Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));
  }, []);

  const onWheelCapture = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      setScale((s) => clampScale(s * factor));
    },
    [clampScale],
  );

  const rotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
  const rotateRight = () => setRotation((r) => (r + 90) % 360);

  if (!open || !src) return null;

  const transformCss = `rotate(${rotation}deg) scale(${scale})`;

  return createPortal(
    <div className="image-lightbox-overlay" role="presentation">
      <div
        className="image-lightbox-backdrop"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="image-lightbox-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Ảnh phóng to'}
      >
        {title ? <div className="image-lightbox-title">{title}</div> : null}
        <div className="image-lightbox-toolbar">
          <button
            type="button"
            className="image-lightbox-tool"
            onClick={rotateLeft}
            aria-label="Xoay sang trái 90 độ"
            title="Xoay trái"
          >
            ⟲ Trái
          </button>
          <button
            type="button"
            className="image-lightbox-tool"
            onClick={rotateRight}
            aria-label="Xoay sang phải 90 độ"
            title="Xoay phải"
          >
            ⟳ Phải
          </button>
          <button
            type="button"
            className="image-lightbox-tool"
            onClick={() =>
              setScale((s) => clampScale(Math.max(SCALE_MIN, s / 1.2)))
            }
            aria-label="Thu nhỏ"
          >
            −
          </button>
          <span className="image-lightbox-zoom-label" aria-live="polite">
            {pctLabel}
          </span>
          <button
            type="button"
            className="image-lightbox-tool"
            onClick={() =>
              setScale((s) => clampScale(Math.min(SCALE_MAX, s * 1.2)))
            }
            aria-label="Phóng to"
          >
            +
          </button>
          <button
            type="button"
            className="image-lightbox-tool"
            onClick={resetTransforms}
            title="Đặt lại góc và tỉ lệ"
          >
            Đặt lại
          </button>
          <button
            type="button"
            className="image-lightbox-tool image-lightbox-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        <div
          className="image-lightbox-stage"
          onWheel={onWheelCapture}
          tabIndex={-1}
        >
          <div
            className="image-lightbox-transform-wrap"
            style={{ transform: transformCss }}
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text -- alt from props */}
            <img src={src} alt={alt} />
          </div>
        </div>
        <p className="image-lightbox-hint">
          Cuộn để zoom. Esc hoặc bấm nền tối quanh khung để đóng.
        </p>
      </div>
    </div>,
    document.body,
  );
}
