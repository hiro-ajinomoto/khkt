import { ObjectId } from 'mongodb';
import {
  classNameExists,
  listClassNames,
  validateClassNameFormat,
} from './schoolClasses.js';

const COLLECTION = 'class_teacher_assignments';

export async function ensureClassTeacherIndexes(db) {
  const c = db.collection(COLLECTION);
  await c.createIndex(
    { class_name: 1, teacher_id: 1 },
    { unique: true, name: 'class_teacher_unique_idx' },
  );
  await c.createIndex({ teacher_id: 1 }, { name: 'class_teacher_teacher_idx' });
}

/**
 * @param {import('mongodb').Db} db
 * @param {string} teacherIdHex
 * @returns {Promise<string[]>}
 */
export async function listClassNamesForTeacher(db, teacherIdHex) {
  let tid;
  try {
    tid = ObjectId.createFromHexString(teacherIdHex);
  } catch {
    return [];
  }
  const rows = await db
    .collection(COLLECTION)
    .find({ teacher_id: tid })
    .project({ class_name: 1 })
    .toArray();
  return [...new Set(rows.map((r) => r.class_name))].sort((a, b) =>
    a.localeCompare(b, 'vi', { numeric: true }),
  );
}

/**
 * @returns {Promise<Array<{ teacher_id: string, username: string, name: string }>>}
 */
export async function listTeachersForClass(db, className) {
  const rows = await db
    .collection(COLLECTION)
    .find({ class_name: className })
    .sort({ teacher_id: 1 })
    .toArray();
  if (rows.length === 0) return [];
  const oids = rows.map((r) => r.teacher_id);
  const users = await db
    .collection('users')
    .find({ _id: { $in: oids } })
    .project({ username: 1, name: 1, role: 1 })
    .toArray();
  const map = new Map(users.map((u) => [u._id.toString(), u]));
  return rows
    .map((r) => {
      const u = map.get(r.teacher_id.toString());
      if (!u || u.role !== 'teacher') return null;
      return {
        teacher_id: r.teacher_id.toString(),
        username: u.username,
        name: (u.name && String(u.name).trim()) || u.username,
      };
    })
    .filter(Boolean);
}

/**
 * Admin: full map class_name → teachers (only registered school classes).
 * @returns {Promise<Array<{ class_name: string, teachers: Array<{ id: string, username: string, name: string }> }>>}
 */
export async function listAllClassTeacherMappings(db) {
  const classNames = await listClassNames(db);
  const out = [];
  for (const cn of classNames) {
    const teachers = await listTeachersForClass(db, cn);
    out.push({
      class_name: cn,
      teachers: teachers.map((t) => ({
        id: t.teacher_id,
        username: t.username,
        name: t.name,
      })),
    });
  }
  return out;
}

/**
 * Replace teacher set for one class. Only users with role `teacher`.
 * @param {string[]} teacherIdHexList
 */
export async function setTeachersForClass(db, rawClassName, teacherIdHexList) {
  const v = validateClassNameFormat(rawClassName);
  if (!v.ok) {
    const err = new Error(v.error);
    err.status = 400;
    throw err;
  }
  const exists = await classNameExists(db, v.name);
  if (!exists) {
    const err = new Error('Lớp không tồn tại trong hệ thống.');
    err.status = 400;
    throw err;
  }

  const ids = [...new Set((teacherIdHexList || []).map((x) => String(x).trim()))].filter(
    Boolean,
  );
  const oids = [];
  for (const id of ids) {
    try {
      oids.push(ObjectId.createFromHexString(id));
    } catch {
      const err = new Error('teacher_id không hợp lệ');
      err.status = 400;
      throw err;
    }
  }

  if (oids.length > 0) {
    const users = await db
      .collection('users')
      .find({ _id: { $in: oids } })
      .project({ role: 1 })
      .toArray();
    if (users.length !== oids.length) {
      const err = new Error('Một hoặc nhiều giáo viên không tồn tại.');
      err.status = 400;
      throw err;
    }
    for (const u of users) {
      if (u.role !== 'teacher') {
        const err = new Error('Chỉ có thể gán tài khoản vai trò giáo viên.');
        err.status = 400;
        throw err;
      }
    }
  }

  await db.collection(COLLECTION).deleteMany({ class_name: v.name });
  if (oids.length > 0) {
    const now = new Date();
    await db.collection(COLLECTION).insertMany(
      oids.map((teacher_id) => ({
        class_name: v.name,
        teacher_id,
        assigned_at: now,
      })),
    );
  }
  return listTeachersForClass(db, v.name);
}

export async function removeAllForTeacher(db, teacherIdHex) {
  let tid;
  try {
    tid = ObjectId.createFromHexString(teacherIdHex);
  } catch {
    return;
  }
  await db.collection(COLLECTION).deleteMany({ teacher_id: tid });
}

export async function renameClassInTeacherAssignments(db, oldName, newName) {
  await db.collection(COLLECTION).updateMany(
    { class_name: oldName },
    { $set: { class_name: newName } },
  );
}

export async function deleteAssignmentsForClassName(db, className) {
  await db.collection(COLLECTION).deleteMany({ class_name: className });
}
