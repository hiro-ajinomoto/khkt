import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { getUsersCollection } from "./db.js";
import { requireAuth } from "./authMiddleware.js";
import { verifyRegistrationCode } from "./registrationCode.js";

export const authRouter = Router();

function normalizeUsername(raw) {
  return String(raw ?? "")
    .trim()
    .normalize("NFKC")
    .toLowerCase();
}

/** Tên đăng nhập: chữ, số, gạch dưới/giữa, dấu chấm; độ dài sau chuẩn hoá. */
const USERNAME_RE = /^[\p{L}\p{N}._-]{3,32}$/u;

function signToken(userId, username) {
  return jwt.sign({ sub: userId, username }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

authRouter.post("/register", async (req, res) => {
  if (!config.registrationCode?.trim()) {
    return res.status(403).json({
      error: "registration_disabled",
      message: "Đăng ký chưa bật — cần đặt REGISTRATION_CODE trên server.",
    });
  }
  if (!verifyRegistrationCode(req.body?.registrationCode)) {
    return res.status(403).json({
      error: "invalid_registration_code",
      message: "Mã đăng ký không đúng.",
    });
  }

  const usernameNorm = normalizeUsername(req.body?.username);
  const password = String(req.body?.password ?? "");

  if (!USERNAME_RE.test(usernameNorm)) {
    return res.status(400).json({
      error: "invalid_username",
      message: "Tên đăng nhập 3–32 ký tự: chữ, số, . _ - (không khoảng trắng).",
    });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "weak_password", message: "Mật khẩu ít nhất 8 ký tự." });
  }
  if (password.length > 200) {
    return res.status(400).json({ error: "password_too_long" });
  }

  const coll = getUsersCollection();
  const now = new Date();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await coll.insertOne({
      username: usernameNorm,
      usernameNorm,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });
    const id = result.insertedId.toString();
    const token = signToken(id, usernameNorm);
    return res.status(201).json({
      token,
      user: { id, username: usernameNorm },
    });
  } catch (e) {
    if (/** @type {{ code?: number }} */ (e).code === 11000) {
      return res.status(409).json({ error: "username_taken", message: "Tên đăng nhập đã được dùng." });
    }
    throw e;
  }
});

authRouter.post("/login", async (req, res) => {
  const usernameNorm = normalizeUsername(req.body?.username);
  const password = String(req.body?.password ?? "");

  if (!usernameNorm || !password) {
    return res.status(400).json({ error: "credentials_required" });
  }

  const coll = getUsersCollection();
  const user = await coll.findOne(
    { usernameNorm },
    { projection: { passwordHash: 1, username: 1 } },
  );
  if (!user || typeof user.passwordHash !== "string") {
    return res.status(401).json({ error: "invalid_credentials", message: "Sai tên đăng nhập hoặc mật khẩu." });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "invalid_credentials", message: "Sai tên đăng nhập hoặc mật khẩu." });
  }

  const id = user._id.toString();
  const username = typeof user.username === "string" ? user.username : usernameNorm;
  const token = signToken(id, username);
  res.json({ token, user: { id, username } });
});
