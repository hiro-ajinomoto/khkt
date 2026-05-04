import jwt from "jsonwebtoken";
import { config } from "./config.js";

/**
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  const token = typeof h === "string" && h.startsWith("Bearer ") ? h.slice(7).trim() : null;
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    const sub = typeof payload.sub === "string" ? payload.sub : String(payload.sub ?? "");
    const username =
      typeof payload.username === "string" ? payload.username : String(payload.username ?? "");
    if (!sub || !username) {
      return res.status(401).json({ error: "invalid_token" });
    }
    req.user = { id: sub, username };
    next();
  } catch {
    return res.status(401).json({ error: "invalid_token" });
  }
}
