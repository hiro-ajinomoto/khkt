import { randomBytes } from 'crypto';
import { ObjectId } from 'mongodb';

export const TEACHER_INVITE_CODE_COLLECTION = 'teacher_invite_codes';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 10;

export function normalizeTeacherInviteCode(raw) {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function randomCode() {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export async function ensureTeacherInviteCodeIndexes(database) {
  await database
    .collection(TEACHER_INVITE_CODE_COLLECTION)
    .createIndex({ code: 1 }, { unique: true, name: 'teacher_invite_code_unique' });
  await database
    .collection(TEACHER_INVITE_CODE_COLLECTION)
    .createIndex({ created_at: -1 }, { name: 'teacher_invite_created_desc' });
}

/**
 * @param {import('mongodb').Db} db
 * @param {{ createdByUserId: string, maxUses?: number, expiresInDays?: number }} opts
 */
export async function createTeacherInviteCode(db, { createdByUserId, maxUses = 1, expiresInDays = 90 }) {
  const createdBy = ObjectId.createFromHexString(createdByUserId);
  const days = Number(expiresInDays);
  const safeDays = Number.isFinite(days) ? Math.min(365 * 2, Math.max(1, Math.round(days))) : 90;
  const mu = Number(maxUses);
  const safeMax = Number.isFinite(mu) ? Math.min(500, Math.max(1, Math.round(mu))) : 1;

  const coll = db.collection(TEACHER_INVITE_CODE_COLLECTION);
  const expires_at = new Date(Date.now() + safeDays * 86400000);

  for (let attempt = 0; attempt < 12; attempt++) {
    const code = randomCode();
    try {
      const doc = {
        code,
        max_uses: safeMax,
        use_count: 0,
        created_at: new Date(),
        created_by: createdBy,
        expires_at,
        revoked_at: null,
      };
      const r = await coll.insertOne(doc);
      return {
        id: r.insertedId.toString(),
        code: doc.code,
        max_uses: doc.max_uses,
        use_count: doc.use_count,
        expires_at: doc.expires_at,
        revoked_at: doc.revoked_at,
        created_at: doc.created_at,
        uses_remaining: safeMax,
      };
    } catch (e) {
      if (e && e.code === 11000) continue;
      throw e;
    }
  }
  throw new Error('Could not generate unique teacher invite code');
}

export async function listTeacherInviteCodes(db) {
  const rows = await db
    .collection(TEACHER_INVITE_CODE_COLLECTION)
    .find({})
    .sort({ created_at: -1 })
    .limit(200)
    .toArray();

  return rows.map((r) => ({
    id: r._id.toString(),
    code: r.code,
    max_uses: r.max_uses,
    use_count: r.use_count,
    expires_at: r.expires_at,
    revoked_at: r.revoked_at,
    created_at: r.created_at,
    uses_remaining: Math.max(0, r.max_uses - r.use_count),
  }));
}

export async function revokeTeacherInviteCode(db, idHex) {
  let oid;
  try {
    oid = ObjectId.createFromHexString(idHex);
  } catch {
    return null;
  }
  const updated = await db.collection(TEACHER_INVITE_CODE_COLLECTION).findOneAndUpdate(
    { _id: oid, revoked_at: null },
    { $set: { revoked_at: new Date() } },
    { returnDocument: 'after' }
  );
  return updated ?? null;
}

/**
 * Tiêu thụ đúng một lượt nếu mã còn hiệu lực (atomic).
 * @returns {import('mongodb').Document | null}
 */
export async function consumeTeacherInviteCodeIfValid(db, normalizedCode) {
  const now = new Date();
  const updated = await db.collection(TEACHER_INVITE_CODE_COLLECTION).findOneAndUpdate(
    {
      code: normalizedCode,
      revoked_at: null,
      expires_at: { $gt: now },
      $expr: { $lt: ['$use_count', '$max_uses'] },
    },
    { $inc: { use_count: 1 } },
    { returnDocument: 'after' }
  );
  /* MongoDB driver ≥6: mặc định trả về document (hoặc null), không phải { value }. */
  return updated ?? null;
}

/** Hoàn tác một lần tiêu thụ (khi tạo user thất bại sau khi đã inc). */
export async function rollbackTeacherInviteConsumption(db, normalizedCode) {
  await db.collection(TEACHER_INVITE_CODE_COLLECTION).updateOne(
    { code: normalizedCode, use_count: { $gt: 0 } },
    { $inc: { use_count: -1 } }
  );
}
