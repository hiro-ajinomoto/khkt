import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { authenticate, requireTeacher } from '../middleware/auth.js';
import { listClassNamesForTeacher } from '../classTeacherAssignments.js';
import { listClassNames, validateClassNameFormat } from '../schoolClasses.js';

const router = express.Router();

router.use(authenticate, requireTeacher);

async function classNamesForViewer(db, user) {
  if (user.role === 'admin') {
    return await listClassNames(db);
  }
  return await listClassNamesForTeacher(db, user.id);
}

async function assertClassInScope(db, user, rawClassName) {
  const v = validateClassNameFormat(rawClassName);
  if (!v.ok) {
    const err = new Error(v.error);
    err.status = 400;
    throw err;
  }
  const allowed = await classNamesForViewer(db, user);
  if (!allowed.includes(v.name)) {
    const err = new Error('Bạn không được phép xem lớp này.');
    err.status = 403;
    throw err;
  }
  return v.name;
}

/**
 * GET /teacher/classes
 * Danh sách lớp GV được phân (hoặc mọi lớp nếu admin) kèm số HS / số bài đã gán.
 */
router.get('/classes', async (req, res) => {
  try {
    const db = getDB();
    const names = await classNamesForViewer(db, req.user);
    const rows = await Promise.all(
      names.map(async (class_name) => {
        const [student_count, assignment_count] = await Promise.all([
          db.collection('users').countDocuments({
            role: 'student',
            class_name,
          }),
          db.collection('assignment_classes').countDocuments({ class_name }),
        ]);
        return { class_name, student_count, assignment_count };
      }),
    );
    rows.sort((a, b) =>
      a.class_name.localeCompare(b.class_name, 'vi', { numeric: true }),
    );
    res.json({ classes: rows });
  } catch (error) {
    console.error('GET /teacher/classes:', error);
    res.status(500).json({ detail: 'Không tải được danh sách lớp.' });
  }
});

/**
 * GET /teacher/classes/:className/students
 * Tên lớp có thể chứa ký tự đặc biệt — client truyền encodeURIComponent từng segment.
 */
router.get('/classes/:className/students', async (req, res) => {
  try {
    const db = getDB();
    const className = await assertClassInScope(db, req.user, req.params.className);
    const students = await db
      .collection('users')
      .find({ role: 'student', class_name: className })
      .project({ username: 1, name: 1, created_at: 1 })
      .sort({ username: 1 })
      .toArray();
    res.json({
      class_name: className,
      students: students.map((u) => ({
        id: u._id.toString(),
        username: u.username,
        name: (u.name && String(u.name).trim()) || u.username,
        created_at: u.created_at || null,
      })),
    });
  } catch (error) {
    if (error.status === 400 || error.status === 403) {
      return res.status(error.status).json({ detail: error.message });
    }
    console.error('GET /teacher/classes/.../students:', error);
    res.status(500).json({ detail: 'Không tải được danh sách học sinh.' });
  }
});

/**
 * DELETE /teacher/classes/:className/students/:studentId
 * Gỡ học sinh khỏi lớp (đặt class_name = null). Không xóa tài khoản.
 */
router.delete('/classes/:className/students/:studentId', async (req, res) => {
  try {
    const db = getDB();
    const className = await assertClassInScope(db, req.user, req.params.className);

    let studentOid;
    try {
      studentOid = ObjectId.createFromHexString(req.params.studentId);
    } catch {
      return res.status(400).json({ detail: 'Mã học sinh không hợp lệ.' });
    }

    const student = await db.collection('users').findOne({ _id: studentOid });
    if (!student) {
      return res.status(404).json({ detail: 'Không tìm thấy học sinh.' });
    }
    if (student.role !== 'student') {
      return res.status(400).json({ detail: 'Chỉ có thể gỡ học sinh khỏi lớp.' });
    }
    if ((student.class_name || '') !== className) {
      return res.status(400).json({
        detail: 'Học sinh không thuộc lớp này.',
      });
    }

    await db.collection('users').updateOne(
      { _id: studentOid },
      { $set: { class_name: null } },
    );

    res.json({
      ok: true,
      message: 'Đã gỡ học sinh khỏi lớp.',
      student_id: studentOid.toString(),
    });
  } catch (error) {
    if (error.status === 400 || error.status === 403) {
      return res.status(error.status).json({ detail: error.message });
    }
    console.error('DELETE /teacher/classes/.../students/...:', error);
    res.status(500).json({ detail: 'Không thực hiện được thao tác.' });
  }
});

/**
 * GET /teacher/classes/:className/assignments
 * Bài tập đã gán cho lớp (metadata gọn — chi tiết mở /assignments/:id).
 */
router.get('/classes/:className/assignments', async (req, res) => {
  try {
    const db = getDB();
    const className = await assertClassInScope(db, req.user, req.params.className);
    const links = await db
      .collection('assignment_classes')
      .find({ class_name: className })
      .project({ assignment_id: 1 })
      .toArray();
    const oids = [];
    for (const row of links) {
      const id = row.assignment_id;
      if (!id) continue;
      try {
        oids.push(
          id instanceof ObjectId ? id : ObjectId.createFromHexString(String(id)),
        );
      } catch {
        /* bỏ qua id không hợp lệ */
      }
    }
    if (oids.length === 0) {
      return res.json({ class_name: className, assignments: [] });
    }
    const assignments = await db
      .collection('assignments')
      .find({ _id: { $in: oids } })
      .toArray();
    function activityMs(doc) {
      const c = doc.created_at ? new Date(doc.created_at).getTime() : 0;
      const u = doc.updated_at ? new Date(doc.updated_at).getTime() : 0;
      return Math.max(c, u);
    }
    assignments.sort((a, b) => activityMs(b) - activityMs(a));
    res.json({
      class_name: className,
      assignments: assignments.map((a) => ({
        id: a._id.toString(),
        title: a.title,
        created_at: a.created_at || null,
        updated_at: a.updated_at || null,
        available_from_date: a.available_from_date ?? null,
        due_date: a.due_date ?? null,
        grade_level: a.grade_level || null,
      })),
    });
  } catch (error) {
    if (error.status === 400 || error.status === 403) {
      return res.status(error.status).json({ detail: error.message });
    }
    console.error('GET /teacher/classes/.../assignments:', error);
    res.status(500).json({ detail: 'Không tải được bài tập của lớp.' });
  }
});

export default router;
