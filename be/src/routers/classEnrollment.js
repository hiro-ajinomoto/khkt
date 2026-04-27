import express from 'express';
import { authenticate, requireTeacher } from '../middleware/auth.js';
import { getDB } from '../db.js';
import { listClassNamesForTeacher } from '../classTeacherAssignments.js';
import {
  validateClassNameFormat,
  rotateEnrollmentCodeForClass,
  listClassesEnrollmentMetadata,
  listClassesEnrollmentMetadataForNames,
} from '../schoolClasses.js';

const router = express.Router();

router.use(authenticate);
router.use(requireTeacher);

/**
 * GET /class-enrollment
 * Admin: mọi lớp + mã. Giáo viên: chỉ lớp được gán.
 */
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    if (req.user.role === 'admin') {
      const items = await listClassesEnrollmentMetadata(db);
      return res.json({ items });
    }
    const scoped = await listClassNamesForTeacher(db, req.user.id);
    const items = await listClassesEnrollmentMetadataForNames(db, scoped);
    res.json({ items });
  } catch (error) {
    console.error('class-enrollment list:', error);
    res.status(500).json({ detail: 'Không tải được mã lớp.' });
  }
});

/**
 * POST /class-enrollment/rotate
 * Body: { class_name: string } — tạo mã 4 số mới; HS hiện có không đổi lớp.
 */
router.post('/rotate', async (req, res) => {
  try {
    const raw = req.body?.class_name;
    if (raw == null || String(raw).trim() === '') {
      return res.status(400).json({ detail: 'Thiếu class_name.' });
    }
    const v = validateClassNameFormat(raw);
    if (!v.ok) {
      return res.status(400).json({ detail: v.error });
    }
    const db = getDB();
    if (req.user.role !== 'admin') {
      const scoped = await listClassNamesForTeacher(db, req.user.id);
      if (!scoped.includes(v.name)) {
        return res.status(403).json({
          detail: 'Bạn không quản lý lớp này.',
        });
      }
    }
    const result = await rotateEnrollmentCodeForClass(db, raw);
    res.json(result);
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ detail: error.message });
    }
    console.error('class-enrollment rotate:', error);
    res.status(500).json({ detail: 'Đổi mã thất bại.' });
  }
});

export default router;
