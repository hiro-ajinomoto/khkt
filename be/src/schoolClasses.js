const COLLECTION = 'school_classes';

const MIN_CLASS_LEN = 1;
const MAX_CLASS_LEN = 80;

/** Chuỗi 4 chữ số (0000–9999), chỉ lấy digit từ input. */
export function normalizeEnrollmentCode(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length !== 4) return null;
  return digits;
}

export async function generateUniqueEnrollmentCode(db) {
  const coll = db.collection(COLLECTION);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const dup = await coll.findOne({ enrollment_code: code }, { projection: { _id: 1 } });
    if (!dup) return code;
  }
  const err = new Error('Không tạo được mã lớp duy nhất');
  err.status = 500;
  throw err;
}

async function ensureEnrollmentIndex(coll) {
  await coll.createIndex(
    { enrollment_code: 1 },
    {
      unique: true,
      name: 'school_class_enrollment_code_idx',
      partialFilterExpression: {
        enrollment_code: { $exists: true, $type: 'string', $gt: '' },
      },
    },
  );
}

export async function ensureAllClassesHaveEnrollmentCodes(db) {
  const coll = db.collection(COLLECTION);
  const missing = await coll
    .find({
      $or: [
        { enrollment_code: { $exists: false } },
        { enrollment_code: null },
        { enrollment_code: '' },
      ],
    })
    .toArray();
  for (const doc of missing) {
    const code = await generateUniqueEnrollmentCode(db);
    await coll.updateOne({ _id: doc._id }, { $set: { enrollment_code: code } });
  }
}

/** Ký tự điều khiển, HTML/XML và dấu gạch chéo ngược — không cho phép trong tên lớp. */
const DISALLOWED_CHARS = /[\u0000-\u001F\u007F<>\\]/;

const DEFAULT_NAMES = ['8A1', '8A2', '8A3', '8A4', '8A5'];

function normalizeClassName(name) {
  if (name == null) return null;
  const t = String(name).trim();
  return t === '' ? null : t;
}

/**
 * Tên lớp tùy biến: chữ (kể cả tiếng Việt), số, khoảng trắng và một số dấu (. - _ / : , ( ) & ' + #).
 */
export function validateClassNameFormat(name) {
  const n = normalizeClassName(name);
  if (!n) {
    return { ok: false, error: 'Tên lớp không được để trống' };
  }
  if (n.length < MIN_CLASS_LEN || n.length > MAX_CLASS_LEN) {
    return {
      ok: false,
      error: `Tên lớp cần từ ${MIN_CLASS_LEN} đến ${MAX_CLASS_LEN} ký tự.`,
    };
  }
  if (DISALLOWED_CHARS.test(n)) {
    return {
      ok: false,
      error:
        'Tên lớp không được chứa ký tự điều khiển hoặc các ký tự < > \\',
    };
  }
  if (!/[\p{L}\p{N}]/u.test(n)) {
    return {
      ok: false,
      error: 'Tên lớp cần có ít nhất một chữ cái hoặc chữ số.',
    };
  }
  return { ok: true, name: n };
}

export async function ensureDefaultClasses(db) {
  const coll = db.collection(COLLECTION);
  await coll.createIndex({ name: 1 }, { unique: true });
  await ensureEnrollmentIndex(coll);
  const count = await coll.countDocuments();
  if (count === 0) {
    for (const name of DEFAULT_NAMES) {
      const code = await generateUniqueEnrollmentCode(db);
      await coll.insertOne({
        name,
        created_at: new Date(),
        enrollment_code: code,
      });
    }
  }
  await ensureAllClassesHaveEnrollmentCodes(db);
}

export async function listClassNames(db) {
  await ensureDefaultClasses(db);
  const docs = await db.collection(COLLECTION).find({}).sort({ name: 1 }).toArray();
  return docs.map((d) => d.name);
}

export async function classNameExists(db, name) {
  const n = normalizeClassName(name);
  if (!n) return false;
  await ensureDefaultClasses(db);
  const doc = await db.collection(COLLECTION).findOne({ name: n });
  return !!doc;
}

export async function assertClassNamesRegistered(db, classNames) {
  await ensureDefaultClasses(db);
  const valid = new Set(await listClassNames(db));
  const normalized = classNames.map((c) => String(c).trim());
  const missing = normalized.filter((c) => !valid.has(c));
  if (missing.length > 0) {
    const err = new Error(
      `Các lớp chưa được khai báo: ${missing.join(', ')}`
    );
    err.status = 400;
    throw err;
  }
}

export async function addClassDocument(db, rawName) {
  const v = validateClassNameFormat(rawName);
  if (!v.ok) {
    const err = new Error(v.error);
    err.status = 400;
    throw err;
  }
  await ensureDefaultClasses(db);
  const code = await generateUniqueEnrollmentCode(db);
  try {
    await db.collection(COLLECTION).insertOne({
      name: v.name,
      created_at: new Date(),
      enrollment_code: code,
    });
  } catch (e) {
    if (e.code === 11000) {
      const err = new Error('Lớp đã tồn tại');
      err.status = 409;
      throw err;
    }
    throw e;
  }
  return v.name;
}

export async function removeClassDocument(db, rawName) {
  const v = validateClassNameFormat(rawName);
  if (!v.ok) {
    const err = new Error(v.error);
    err.status = 400;
    throw err;
  }
  await ensureDefaultClasses(db);
  const result = await db.collection(COLLECTION).deleteOne({ name: v.name });
  if (result.deletedCount === 0) {
    const err = new Error('Không tìm thấy lớp');
    err.status = 404;
    throw err;
  }
  await db.collection('users').updateMany(
    { class_name: v.name },
    { $set: { class_name: null } }
  );
  await db.collection('assignment_classes').deleteMany({ class_name: v.name });
  const { deleteAssignmentsForClassName } = await import('./classTeacherAssignments.js');
  await deleteAssignmentsForClassName(db, v.name);
  return v.name;
}

/**
 * Đổi tên lớp: cập nhật registry, học sinh và gán bài.
 */
export async function renameClassDocument(db, rawOldName, rawNewName) {
  const vOld = validateClassNameFormat(rawOldName);
  if (!vOld.ok) {
    const err = new Error(vOld.error);
    err.status = 400;
    throw err;
  }
  const vNew = validateClassNameFormat(rawNewName);
  if (!vNew.ok) {
    const err = new Error(vNew.error);
    err.status = 400;
    throw err;
  }
  if (vOld.name === vNew.name) {
    const err = new Error('Tên mới phải khác tên hiện tại');
    err.status = 400;
    throw err;
  }

  await ensureDefaultClasses(db);
  const coll = db.collection(COLLECTION);
  const docOld = await coll.findOne({ name: vOld.name });
  if (!docOld) {
    const err = new Error('Không tìm thấy lớp cần đổi tên');
    err.status = 404;
    throw err;
  }
  const docNewExists = await coll.findOne({ name: vNew.name });
  if (docNewExists) {
    const err = new Error('Tên lớp mới đã tồn tại');
    err.status = 409;
    throw err;
  }

  const upd = await coll.updateOne(
    { name: vOld.name },
    { $set: { name: vNew.name } }
  );
  if (upd.matchedCount === 0) {
    const err = new Error('Không tìm thấy lớp');
    err.status = 404;
    throw err;
  }

  await db.collection('users').updateMany(
    { class_name: vOld.name },
    { $set: { class_name: vNew.name } }
  );
  await db.collection('assignment_classes').updateMany(
    { class_name: vOld.name },
    { $set: { class_name: vNew.name } }
  );

  const { renameClassInTeacherAssignments } = await import('./classTeacherAssignments.js');
  await renameClassInTeacherAssignments(db, vOld.name, vNew.name);

  return { oldName: vOld.name, newName: vNew.name };
}

/**
 * Tra cứu lớp theo mã đăng ký (học sinh).
 * @returns {{ ok: true, class_name: string } | { ok: false }}
 */
export async function resolveClassNameFromEnrollmentCode(db, raw) {
  const code = normalizeEnrollmentCode(raw);
  if (!code) {
    return { ok: false };
  }
  await ensureDefaultClasses(db);
  const doc = await db.collection(COLLECTION).findOne({ enrollment_code: code });
  if (!doc) {
    return { ok: false };
  }
  return { ok: true, class_name: doc.name };
}

/**
 * Đổi mã đăng ký — học sinh cũ giữ nguyên lớp; chỉ ảnh hưởng đăng ký mới.
 */
export async function rotateEnrollmentCodeForClass(db, rawClassName) {
  const v = validateClassNameFormat(rawClassName);
  if (!v.ok) {
    const err = new Error(v.error);
    err.status = 400;
    throw err;
  }
  await ensureDefaultClasses(db);
  const coll = db.collection(COLLECTION);
  const doc = await coll.findOne({ name: v.name });
  if (!doc) {
    const err = new Error('Không tìm thấy lớp');
    err.status = 404;
    throw err;
  }
  const newCode = await generateUniqueEnrollmentCode(db);
  await coll.updateOne(
    { name: v.name },
    {
      $set: {
        enrollment_code: newCode,
        enrollment_code_rotated_at: new Date(),
      },
    },
  );
  return { class_name: v.name, enrollment_code: newCode };
}

/** Danh sách tất cả lớp + mã (admin). */
export async function listClassesEnrollmentMetadata(db) {
  await ensureDefaultClasses(db);
  const docs = await db
    .collection(COLLECTION)
    .find({})
    .sort({ name: 1 })
    .project({ name: 1, enrollment_code: 1 })
    .toArray();
  return docs.map((d) => ({
    class_name: d.name,
    enrollment_code: d.enrollment_code || null,
  }));
}

/** Chỉ các lớp trong danh sách tên (giáo viên được gán). */
export async function listClassesEnrollmentMetadataForNames(db, classNames) {
  if (!classNames || classNames.length === 0) return [];
  await ensureDefaultClasses(db);
  const docs = await db
    .collection(COLLECTION)
    .find({ name: { $in: classNames } })
    .sort({ name: 1 })
    .project({ name: 1, enrollment_code: 1 })
    .toArray();
  return docs.map((d) => ({
    class_name: d.name,
    enrollment_code: d.enrollment_code || null,
  }));
}
