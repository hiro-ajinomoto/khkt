import { Router } from "express";
import { ObjectId } from "mongodb";
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
  else if (s.startsWith("84") && s.length >= 10 && /^84\d+$/.test(s))
    s = "0" + s.slice(2);
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
  const limit = Math.min(
    20,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 12),
  );

  const coll = getPeopleCollection();
  const re = new RegExp(escapeRegex(q), "i");
  const qDigits = q.replace(/\D/g, "");

  /** @type {object[]} */
  const orConditions = [{ name: re }, { nickname: re }];
  if (qDigits.length >= 2) {
    orConditions.push({ phone: new RegExp(escapeRegex(qDigits)) });
  }

  const docs = await coll
    .find(
      { $or: orConditions },
      { projection: { _id: 0, name: 1, nickname: 1, phone: 1 } },
    )
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

/** GET /api/revenue/people — danh sách (sắp theo tên). */
peopleRouter.get("/", async (req, res) => {
  const coll = getPeopleCollection();
  const rawLimit = parseInt(String(req.query.limit ?? "2000"), 10);
  const limit = Math.min(
    5000,
    Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 2000),
  );

  const docs = await coll
    .find(
      {},
      {
        projection: {
          name: 1,
          nickname: 1,
          phone: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .sort({ name: 1 })
    .limit(limit)
    .toArray();

  res.json({
    people: docs.map((d) => ({
      id: d._id.toString(),
      name: d.name,
      nickname: d.nickname || "",
      phone: d.phone != null ? String(d.phone) : "",
      createdAt: d.createdAt ?? null,
      updatedAt: d.updatedAt ?? null,
    })),
  });
});

/** GET /api/revenue/people/:id */
peopleRouter.get("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(String(req.params.id));
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }
  const coll = getPeopleCollection();
  const doc = await coll.findOne(
    { _id: oid },
    {
      projection: {
        name: 1,
        nickname: 1,
        phone: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );
  if (!doc) {
    return res.status(404).json({ error: "not_found" });
  }
  res.json({
    id: doc._id.toString(),
    name: doc.name,
    nickname: doc.nickname || "",
    phone: doc.phone != null ? String(doc.phone) : "",
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  });
});

/** POST /api/revenue/people — { name, nickname?, phone? } */
peopleRouter.post("/", async (req, res) => {
  const name = String(req.body?.name ?? "")
    .trim()
    .replace(/\s+/g, " ");
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
    const result = await coll.insertOne({
      name,
      nickname,
      phone: phoneNorm,
      nameNorm,
      createdAt: now,
      updatedAt: now,
    });
    return res.status(201).json({
      id: result.insertedId.toString(),
      name,
      nickname,
      phone: phoneNorm,
    });
  } catch (e) {
    if (/** @type {{ code?: number }} */ (e).code === 11000) {
      return res.status(409).json({ error: "duplicate_name" });
    }
    throw e;
  }
});

/** PUT /api/revenue/people/:id — { name?, nickname?, phone? } */
peopleRouter.put("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(String(req.params.id));
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }

  const coll = getPeopleCollection();
  const existing = await coll.findOne({ _id: oid });
  if (!existing) {
    return res.status(404).json({ error: "not_found" });
  }

  const name =
    req.body?.name !== undefined
      ? String(req.body.name).trim().replace(/\s+/g, " ")
      : String(existing.name || "")
          .trim()
          .replace(/\s+/g, " ");
  const nickname =
    req.body?.nickname !== undefined
      ? String(req.body.nickname).trim()
      : String(existing.nickname ?? "").trim();
  const phoneNorm =
    req.body?.phone !== undefined
      ? normalizePhoneDigits(req.body.phone)
      : normalizePhoneDigits(existing.phone);

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

  if (nameNorm !== existing.nameNorm) {
    const dup = await coll.findOne({ nameNorm, _id: { $ne: oid } });
    if (dup) {
      return res.status(409).json({ error: "duplicate_name" });
    }
  }

  const now = new Date();
  await coll.updateOne(
    { _id: oid },
    { $set: { name, nickname, phone: phoneNorm, nameNorm, updatedAt: now } },
  );

  res.json({
    id: oid.toString(),
    name,
    nickname,
    phone: phoneNorm,
    createdAt: existing.createdAt ?? null,
    updatedAt: now,
  });
});

/** DELETE /api/revenue/people/:id */
peopleRouter.delete("/:id", async (req, res) => {
  let oid;
  try {
    oid = new ObjectId(String(req.params.id));
  } catch {
    return res.status(400).json({ error: "invalid_id" });
  }
  const coll = getPeopleCollection();
  const result = await coll.deleteOne({ _id: oid });
  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "not_found" });
  }
  res.status(204).send();
});
