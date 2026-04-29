import { useCallback, useEffect, useId, useState } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImageFile } from '../../utils/imageCrop';
import './ImageCropModal.css';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRotation(deg) {
  return (((deg % 360) + 360) % 360);
}

function sanitizeZoomLimits(minIn, maxIn, prevMax) {
  let minV = Number(minIn);
  let maxV = Number(maxIn);
  if (!Number.isFinite(minV)) minV = 0.25;
  if (!Number.isFinite(maxV)) maxV = prevMax ?? 8;
  minV = clamp(minV, 0.1, 12);
  maxV = clamp(maxV, 0.2, 20);
  if (maxV <= minV) maxV = minV + 0.15;
  return { min: minV, max: maxV };
}

function isValidCrop(area) {
  return (
    area &&
    Number.isFinite(area.width) &&
    Number.isFinite(area.height) &&
    area.width > 1 &&
    area.height > 1
  );
}

/**
 * Modal fullscreen crop — chọn vùng rồi xuất File (JPEG hoặc giữ PNG khi ảnh gốc PNG).
 */
export default function ImageCropModal({
  file,
  indexOneBased,
  total,
  onConfirm,
  onUseOriginal,
  onAbort,
}) {
  const headingId = useId();
  const zoomSliderId = useId();
  const [objectUrl, setObjectUrl] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [zoomLimits, setZoomLimits] = useState({ min: 0.25, max: 8 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
    setCroppedAreaPixels(null);
    setError(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    setZoom((z) => clamp(z, zoomLimits.min, zoomLimits.max));
  }, [zoomLimits.min, zoomLimits.max]);

  const onCropAreaChange = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const bumpRotation = (deltaDeg) => {
    setRotation((r) => normalizeRotation(r + deltaDeg));
    setCrop({ x: 0, y: 0 });
  };

  function handleZoomMinChange(e) {
    const next = sanitizeZoomLimits(e.target.value, zoomLimits.max, zoomLimits.max);
    setZoomLimits(next);
  }

  function handleZoomMaxChange(e) {
    const next = sanitizeZoomLimits(zoomLimits.min, e.target.value, zoomLimits.max);
    setZoomLimits(next);
  }

  async function handleConfirm() {
    if (!objectUrl || !isValidCrop(croppedAreaPixels)) return;
    setBusy(true);
    setError(null);
    try {
      const out = await getCroppedImageFile(
        objectUrl,
        croppedAreaPixels,
        file.name,
        file.type?.startsWith('image/') ? file.type : 'image/jpeg',
        rotation,
      );
      onConfirm(out);
    } catch (e) {
      setError(e?.message || 'Không cắt được ảnh. Thử « Giữ nguyên ảnh ».');
    } finally {
      setBusy(false);
    }
  }

  if (!objectUrl) return null;

  const zoomPct = Math.round(zoom * 100);

  return (
    <div
      className="image-crop-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
    >
      <div className="image-crop-modal__backdrop" aria-hidden />
      <div className="image-crop-modal__panel">
        <header className="image-crop-modal__head">
          <h2 id={headingId} className="image-crop-modal__title">
            Cắt ảnh bài làm ({indexOneBased}/{total})
          </h2>
          <p className="image-crop-modal__hint">
            Kéo khung crop, chỉnh zoom (thanh + giới hạn dưới), xoay 90° nếu ảnh
            ngang/dọc lệch. Hai ngón trên trackpad/một số máy cũng xoay/zoom.
          </p>
        </header>

        <div className="image-crop-modal__stage">
          <Cropper
            image={objectUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={undefined}
            minZoom={zoomLimits.min}
            maxZoom={zoomLimits.max}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropAreaChange={onCropAreaChange}
            onCropComplete={onCropAreaChange}
            restrictPosition={false}
          />
        </div>

        <div className="image-crop-modal__save-strip">
          <button
            type="button"
            className="image-crop-modal__btn image-crop-modal__btn--primary image-crop-modal__btn--save"
            onClick={handleConfirm}
            disabled={busy || !isValidCrop(croppedAreaPixels)}
          >
            {busy ? 'Đang lưu…' : '✓ Cắt & lưu ảnh này'}
          </button>
          <p className="image-crop-modal__save-hint">
            Khi đã zoom/kéo đúng vùng trong khung, bấm để lưu và sang ảnh tiếp
            theo (nếu có).
          </p>
        </div>

        <div className="image-crop-modal__tool-block">
          <div className="image-crop-modal__tool-row image-crop-modal__tool-row--rotate">
            <span className="image-crop-modal__tool-label">Xoay ảnh</span>
            <div className="image-crop-modal__rotate-btns">
              <button
                type="button"
                className="image-crop-modal__icon-btn"
                onClick={() => bumpRotation(-90)}
                disabled={busy}
                title="Xoay 90° ngược chiều kim đồng hồ"
              >
                ⟲ Trái
              </button>
              <button
                type="button"
                className="image-crop-modal__icon-btn"
                onClick={() => bumpRotation(90)}
                disabled={busy}
                title="Xoay 90° theo chiều kim đồng hồ"
              >
                Phải ⟳
              </button>
            </div>
            <span className="image-crop-modal__rotation-readout" aria-live="polite">
              {normalizeRotation(rotation)}°
            </span>
          </div>

          <div className="image-crop-modal__tool-row">
            <label className="image-crop-modal__tool-label" htmlFor={zoomSliderId}>
              Zoom <strong>{zoomPct}%</strong>
            </label>
            <input
              id={zoomSliderId}
              type="range"
              min={zoomLimits.min}
              max={zoomLimits.max}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          <div className="image-crop-modal__zoom-range-edit">
            <span className="image-crop-modal__zoom-range-label">
              Giới hạn zoom (kéo/phóng tối đa–tối thiểu)
            </span>
            <div className="image-crop-modal__zoom-range-inputs">
              <label className="image-crop-modal__sr-only" htmlFor="crop-zoom-min">
                Zoom tối thiểu
              </label>
              <input
                id="crop-zoom-min"
                type="number"
                step="0.05"
                min={0.1}
                max={12}
                value={zoomLimits.min}
                onChange={handleZoomMinChange}
                title="Mức zoom nhỏ nhất (thu nhỏ, thấy nhiều nền)"
              />
              <span className="image-crop-modal__zoom-range-sep">—</span>
              <label className="image-crop-modal__sr-only" htmlFor="crop-zoom-max">
                Zoom tối đa
              </label>
              <input
                id="crop-zoom-max"
                type="number"
                step={0.1}
                min={0.5}
                max={20}
                value={zoomLimits.max}
                onChange={handleZoomMaxChange}
                title="Mức zoom lớn nhất (phóng sâu vào ảnh)"
              />
            </div>
          </div>
        </div>

        {error ? (
          <p className="image-crop-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="image-crop-modal__actions">
          <button
            type="button"
            className="image-crop-modal__btn image-crop-modal__btn--ghost"
            onClick={onAbort}
            disabled={busy}
          >
            Hủy tất cả
          </button>
          <button
            type="button"
            className="image-crop-modal__btn image-crop-modal__btn--secondary"
            onClick={onUseOriginal}
            disabled={busy}
          >
            Giữ nguyên ảnh này
          </button>
          <button
            type="button"
            className="image-crop-modal__btn image-crop-modal__btn--primary"
            onClick={handleConfirm}
            disabled={busy || !isValidCrop(croppedAreaPixels)}
          >
            {busy ? 'Đang lưu…' : 'Cắt & lưu ảnh này'}
          </button>
        </div>
      </div>
    </div>
  );
}
