import { ObjectId } from 'mongodb';
import { listClassNamesForTeacher } from '../classTeacherAssignments.js';

/**
 * @param {import('mongodb').Db} db
 * @param {{ id: string, role: string } | null} user
 * @returns {Promise<Set<string>|null>} null = full access (admin); Set for teacher; empty set = no classes
 */
export async function getTeacherScopedClassSet(db, user) {
  if (!user) return new Set();
  if (user.role === 'admin') return null;
  if (user.role !== 'teacher') return new Set();
  const names = await listClassNamesForTeacher(db, user.id);
  return new Set(names);
}

export async function loadAssignmentClassNames(db, assignmentObjectId) {
  const rows = await db
    .collection('assignment_classes')
    .find({ assignment_id: assignmentObjectId })
    .project({ class_name: 1 })
    .toArray();
  return rows.map((r) => r.class_name);
}

/**
 * @param {Set<string>|null} scopedSet null = admin (all)
 */
export async function canTeacherManageAssignmentDb(db, user, assignmentObjectId, scopedSet) {
  if (scopedSet == null) return true;
  const assignment = await db.collection('assignments').findOne(
    { _id: assignmentObjectId },
    { projection: { created_by: 1 } },
  );
  if (!assignment) return false;
  const classNames = await loadAssignmentClassNames(db, assignmentObjectId);
  if (classNames.length === 0) {
    const cb = assignment.created_by;
    return !!(cb && cb.toString() === user.id);
  }
  return classNames.some((cn) => scopedSet.has(cn));
}

/**
 * Assignment IDs a teacher may see:
 * - mọi bài gắn với lớp họ được phân công, và
 * - mọi bài do chính họ tạo (kể cả đã gán lớp — tránh “mất” bài khi dữ liệu lớp/GV lệch hoặc created_by kiểu string cũ).
 * @param {Set<string>} scopedSet
 */
export async function listScopedAssignmentObjectIdsForTeacher(db, teacherUserIdHex, scopedSet) {
  const teacherOid = ObjectId.createFromHexString(teacherUserIdHex);
  const classArr = [...scopedSet];
  const fromClasses =
    classArr.length === 0
      ? []
      : await db.collection('assignment_classes').distinct('assignment_id', {
          class_name: { $in: classArr },
        });

  const myCreated = await db
    .collection('assignments')
    .find({
      $or: [{ created_by: teacherOid }, { created_by: teacherUserIdHex }],
    })
    .project({ _id: 1 })
    .toArray();

  const seen = new Set();
  const merged = [];
  for (const id of [...fromClasses, ...myCreated.map((a) => a._id)]) {
    const s = id.toString();
    if (!seen.has(s)) {
      seen.add(s);
      merged.push(id instanceof ObjectId ? id : ObjectId.createFromHexString(s));
    }
  }
  return merged;
}

/**
 * @param {Set<string>|null} scopedSet
 * @param {string[]} classNames
 */
export function assertTeacherClassesAllowed(scopedSet, classNames, res) {
  if (scopedSet == null) return true;
  for (const cn of classNames) {
    if (!scopedSet.has(cn)) {
      res.status(403).json({
        detail: 'Bạn không được phép thao tác với lớp này.',
      });
      return false;
    }
  }
  return true;
}

/**
 * @param {Set<string>|null} scopedSet
 */
export async function teacherCanAccessSubmission(db, user, submission, scopedSet) {
  if (scopedSet == null) return true;
  const allowedAids = await listScopedAssignmentObjectIdsForTeacher(
    db,
    user.id,
    scopedSet,
  );
  const set = new Set(allowedAids.map((x) => x.toString()));
  if (!set.has(submission.assignment_id.toString())) return false;
  const student = await db
    .collection('users')
    .findOne({ _id: submission.student_id }, { projection: { role: 1, class_name: 1 } });
  if (!student || student.role !== 'student') return false;
  return scopedSet.has(student.class_name || '');
}
