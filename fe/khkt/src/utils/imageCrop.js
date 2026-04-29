const MAX_OUTPUT_EDGE = 2048;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = src;
  });
}

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/** Kích thước bbox của hình chữ nhật naturalWidth×naturalHeight sau khi xoay (độ). */
function rotateBoundingSize(width, height, rotationDeg) {
  const rotRad = getRadianAngle(rotationDeg);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

function canvasToFile(canvas, fileNameBase, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Không tạo được ảnh'));
          return;
        }
        const ext =
          mimeType === 'image/png'
            ? '.png'
            : mimeType === 'image/webp'
              ? '.webp'
              : '.jpg';
        const safeBase =
          fileNameBase.replace(/\.[^.]+$/, '') || 'bai-lam';
        resolve(
          new File([blob], `${safeBase}${ext}`, {
            type: blob.type || mimeType,
          }),
        );
      },
      mimeType,
      quality,
    );
  });
}

function scaleCanvasIfNeeded(sourceCanvas, maxEdge) {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const m = Math.max(w, h);
  if (m <= maxEdge) return sourceCanvas;
  const scale = maxEdge / m;
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));
  const out = document.createElement('canvas');
  out.width = tw;
  out.height = th;
  const ctx = out.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0, tw, th);
  return out;
}

/**
 * Cắt ảnh theo vùng pixel từ react-easy-crop (đã gồm rotation).
 * @param {string} imageSrc - Object URL
 * @param {{ x: number, y: number, width: number, height: number }} pixelCrop
 * @param {string} originalName
 * @param {string} [preferredMime]
 * @param {number} [rotationDeg] - cùng giá trị rotation đã truyền vào <Cropper />
 */
export async function getCroppedImageFile(
  imageSrc,
  pixelCrop,
  originalName,
  preferredMime,
  rotationDeg = 0,
) {
  const image = await loadImage(imageSrc);
  const nw = image.naturalWidth;
  const nh = image.naturalHeight;
  const ctxCanvas = document.createElement('canvas');
  const ctx = ctxCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas không khả dụng');

  const rot = ((((rotationDeg || 0) % 360) + 360) % 360);
  const rotRad = getRadianAngle(rot);
  const { width: boxW, height: boxH } = rotateBoundingSize(nw, nh, rot);

  ctxCanvas.width = Math.max(1, Math.round(boxW));
  ctxCanvas.height = Math.max(1, Math.round(boxH));

  ctx.translate(ctxCanvas.width / 2, ctxCanvas.height / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(image, -nw / 2, -nh / 2);

  const cx = Math.max(0, Math.round(pixelCrop.x));
  const cy = Math.max(0, Math.round(pixelCrop.y));
  const cw = Math.max(1, Math.round(pixelCrop.width));
  const ch = Math.max(1, Math.round(pixelCrop.height));

  let data;
  try {
    data = ctx.getImageData(cx, cy, cw, ch);
  } catch {
    throw new Error('Vùng cắt không hợp lệ. Thử chỉnh zoom hoặc xoay lại.');
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = cw;
  outCanvas.height = ch;
  const octx = outCanvas.getContext('2d');
  if (!octx) throw new Error('Canvas không khả dụng');
  octx.putImageData(data, 0, 0);

  const scaled = scaleCanvasIfNeeded(outCanvas, MAX_OUTPUT_EDGE);

  const mime =
    preferredMime === 'image/png' || preferredMime === 'image/webp'
      ? preferredMime
      : 'image/jpeg';
  const quality = mime === 'image/jpeg' ? 0.9 : undefined;

  return canvasToFile(scaled, originalName || 'bai-lam', mime, quality);
}
