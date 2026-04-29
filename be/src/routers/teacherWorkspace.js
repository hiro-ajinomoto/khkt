import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { authenticate, requireTeacher } from '../middleware/auth.js';
import { listClassNamesForTeacher } from '../classTeacherAssignments.js';
import { listClassNames, validateClassNameFormat } from '../schoolClasses.js';
import {
  buildClassSubmissionActivityByDay,
  buildClassSubmissionActivityDayDetail,
  defaultVnRangeYmd,
  resolveClassAssignmentIdsForTeacherView,
} from '../utils/teacherSubmissionActivity.js';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

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
        const [student_count, assignmentIds] = await Promise.all([
          db.collection('users').countDocuments({
            role: 'student',
            class_name,
          }),
          resolveClassAssignmentIdsForTeacherView(db, class_name, req.user),
        ]);
        const assignment_count = assignmentIds.length;
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
    const oids = await resolveClassAssignmentIdsForTeacherView(db, className, req.user);
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

/**
 * GET /teacher/classes/:className/submission-activity?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Tổng quan nộp bài của lớp theo ngày (giờ VN): số lượt nộp, HS có nộp, điểm TB (ưu tiên điểm GV nếu có).
 * Mặc định: 14 ngày gần nhất (bao gồm hôm nay).
 */
router.get('/classes/:className/submission-activity', async (req, res) => {
  try {
    const db = getDB();
    const className = await assertClassInScope(db, req.user, req.params.className);

    let fromYmd = typeof req.query.from === 'string' ? req.query.from.trim() : '';
    let toYmd = typeof req.query.to === 'string' ? req.query.to.trim() : '';
    if (!fromYmd || !toYmd) {
      const d = defaultVnRangeYmd(14);
      fromYmd = d.fromYmd;
      toYmd = d.toYmd;
    }
    if (!YMD_RE.test(fromYmd) || !YMD_RE.test(toYmd)) {
      return res.status(400).json({ detail: 'Tham số from/to phải là YYYY-MM-DD.' });
    }
    if (fromYmd > toYmd) {
      return res.status(400).json({ detail: 'from không được sau to.' });
    }

    const daySpan =
      Math.round(
        (new Date(`${toYmd}T12:00:00+07:00`) - new Date(`${fromYmd}T12:00:00+07:00`)) /
          (24 * 60 * 60 * 1000),
      ) + 1;
    if (daySpan > 120) {
      return res.status(400).json({ detail: 'Khoảng thời gian tối đa 120 ngày.' });
    }

    const payload = await buildClassSubmissionActivityByDay(
      db,
      className,
      fromYmd,
      toYmd,
      req.user,
    );

    /** Gợi ý hiển thị: mỗi lượt nộp = một lần "làm bài" (bài tập có thể nhiều câu trên một ảnh). */
    payload.label = {
      submission_unit:
        'Mỗi lượt nộp tính 1 (có thể gồm nhiều ảnh/câu trong cùng bài tập).',
      score_note: 'Điểm TB chỉ trên các lượt đã có điểm (ưu tiên điểm giáo viên nếu có).',
    };

    res.json(payload);
  } catch (error) {
    if (error.status === 400 || error.status === 403) {
      return res.status(error.status).json({ detail: error.message });
    }
    console.error('GET /teacher/classes/.../submission-activity:', error);
    res.status(500).json({ detail: 'Không tải được tổng quan hoạt động.' });
  }
});

/**
 * GET /teacher/classes/:className/submission-activity/day/:dayYmd (YYYY-MM-DD)
 * Chi tiết một ngày: từng học sinh có nộp — điểm TB trong ngày, lượt nộp, bài có nộp / tổng bài lớp.
 */
router.get('/classes/:className/submission-activity/day/:dayYmd', async (req, res) => {
  try {
    const db = getDB();
    const className = await assertClassInScope(db, req.user, req.params.className);
    const dayYmd =
      typeof req.params.dayYmd === 'string' ? req.params.dayYmd.trim() : '';
    if (!YMD_RE.test(dayYmd)) {
      return res.status(400).json({ detail: 'Đường dẫn ngày phải là YYYY-MM-DD.' });
    }
    const payload = await buildClassSubmissionActivityDayDetail(db, className, dayYmd, req.user);
    res.json(payload);
  } catch (error) {
    if (error.status === 400 || error.status === 403) {
      return res.status(error.status).json({ detail: error.message });
    }
    console.error('GET /teacher/classes/.../submission-activity/day/...:', error);
    res.status(500).json({ detail: 'Không tải được chi tiết ngày.' });
  }
});

export default router;
