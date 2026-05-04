import crypto from "node:crypto";
import { config } from "./config.js";

/**
 * So khớp mã đăng ký với biến môi trường `REGISTRATION_CODE` (timing-safe khi cùng độ dài).
 * @param {unknown} submitted
 */
export function verifyRegistrationCode(submitted) {
  const expected = config.registrationCode;
  if (typeof expected !== "string" || !expected.trim()) return false;
  const a = Buffer.from(String(submitted ?? "").trim(), "utf8");
  const b = Buffer.from(expected.trim(), "utf8");
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}
