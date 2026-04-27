import axios from "axios";
import sharp from "sharp";
import { config } from "../config.js";

/**
 * Tải ảnh từ URL về buffer (phục vụ resize trước khi gửi OpenAI Vision).
 */
export async function fetchImageUrlToBuffer(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: config.openai.visionFetchTimeoutMs,
    maxContentLength: config.openai.visionFetchMaxBytes,
    maxBodyLength: config.openai.visionFetchMaxBytes,
    validateStatus: (s) => s >= 200 && s < 300,
  });
  return Buffer.from(res.data);
}

/**
 * Thu nhỏ / nén ảnh cho vision: giữ trong khung maxEdge, JPEG mozjpeg.
 * Nền trắng khi flatten alpha (bài viết tay trên giấy).
 */
export async function optimizeImageBufferForVision(inputBuffer) {
  const edge = config.openai.visionImageMaxEdgePx;
  const q = config.openai.visionImageJpegQuality;

  const meta = await sharp(inputBuffer, { failOn: "none" }).metadata();
  const hasAlpha =
    meta.hasAlpha === true ||
    (meta.channels != null && meta.channels === 4);

  let pipeline = sharp(inputBuffer, {
    failOn: "none",
    sequentialRead: true,
  }).rotate();

  pipeline = pipeline.resize(edge, edge, {
    fit: "inside",
    withoutEnlargement: true,
  });

  if (hasAlpha) {
    pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
  }

  return pipeline.jpeg({ quality: q, mozjpeg: true }).toBuffer();
}

export function jpegBufferToDataUrl(jpegBuffer) {
  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}
