import { Router } from "express";
import { getPeopleCollection } from "./db.js";

export const peopleRouter = Router();

/** Chuẩn hoá để trùng không phân biệt hoa thường / khoảng trắng. */
export function normalizePersonKey(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFKC")
    .toLowerCase();
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Chỉ giữ chữ số; +84 → 0… — lưu DB để tìm theo số. */
export function normalizePhoneDigits(raw) {
  let s = String(raw ?? "").replace(/[\s().-]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 10 && /^84\d+$/.test(s)) s = "0" + s.slice(2);
  return s.replace(/\D/g, "").slice(0, 15);
}

function isValidPhoneDigits(digits) {
  if (digits.length === 0) return true;
  return digits.length >= 9 && digits.length <= 12 && /^\d+$/.test(digits);
}

/** GET /api/revenue/people/suggest?q=… */
peopleRouter.get("/suggest", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 1) {
    return res.json({ people: [] });
  }

  const rawLimit = parseInt(String(req.query.limit ?? "12"), 10);
  const limit = Math.min(20, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 12));

  const coll = getPeopleCollection();
  const re = new RegExp(escapeRegex(q), "i");
  const qDigits = q.replace(/\D/g, "");

  /** @type {object[]} */
  const orConditions = [{ name: re }, { nickname: re }];
  if (qDigits.length >= 2) {
    orConditions.push({ phone: new RegExp(escapeRegex(qDigits)) });
  }

  const docs = await coll
    .find({ $or: orConditions }, { projection: { _id: 0, name: 1, nickname: 1, phone: 1 } })
    .sort({ name: 1 })
    .limit(limit)
    .toArray();

  res.json({
    people: docs.map((d) => ({
      name: d.name,
      nickname: d.nickname || "",
      phone: d.phone != null ? String(d.phone) : "",
    })),
  });
});

/** POST /api/revenue/people — { name, nickname?, phone? } */
peopleRouter.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "").trim().replace(/\s+/g, " ");
  const nickname = String(req.body?.nickname ?? "").trim();
  const phoneNorm = normalizePhoneDigits(req.body?.phone);

  if (!name) {
    return res.status(400).json({ error: "name_required" });
  }
  if (name.length > 200 || nickname.length > 200) {
    return res.status(400).json({ error: "too_long" });
  }
  if (!isValidPhoneDigits(phoneNorm)) {
    return res.status(400).json({ error: "invalid_phone" });
  }

  const nameNorm = normalizePersonKey(name);
  if (!nameNorm) {
    return res.status(400).json({ error: "name_required" });
  }

  const coll = getPeopleCollection();
  const now = new Date();

  try {
    await coll.insertOne({
      name,
      nickname,
      phone: phoneNorm,
      nameNorm,
      createdAt: now,
      updatedAt: now,
    });
    return res.status(201).json({ name, nickname, phone: phoneNorm });
  } catch (e) {
    if (/** @type {{ code?: number }} */ (e).code === 11000) {
      return res.status(409).json({ error: "duplicate_name" });
    }
    throw e;
  }
});
