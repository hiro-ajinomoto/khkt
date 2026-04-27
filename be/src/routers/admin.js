import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  addClassDocument,
  classNameExists,
  listClassNames,
  removeClassDocument,
  renameClassDocument,
} from '../schoolClasses.js';
import {
  getStickerRedeemOverviewForAllStudents,
  getStudentRedeemedTotal,
  getStudentStickerEarnedTotal,
  isValidRedemptionCost,
} from '../utils/stickerRedemptions.js';
import {
  listAllClassTeacherMappings,
  setTeachersForClass,
  removeAllForTeacher,
} from '../classTeacherAssignments.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

/**
 * GET /admin/users
 * Get all users (admin only)
 */
router.get('/users', async (req, res) => {
  try {
    const db = getDB();
    const users = await db.collection('users').find({}).toArray();

    // Remove password from response
    const teacherIds = users
      .filter((u) => u.role === 'teacher')
      .map((u) => u._id);
    const assignRows =
      teacherIds.length === 0
        ? []
        : await db
            .collection('class_teacher_assignments')
            .find({ teacher_id: { $in: teacherIds } })
            .project({ teacher_id: 1, class_name: 1 })
            .toArray();
    const classesByTeacher = new Map();
    for (const r of assignRows) {
      const tid = r.teacher_id.toString();
      if (!classesByTeacher.has(tid)) classesByTeacher.set(tid, []);
      classesByTeacher.get(tid).push(r.class_name);
    }
    for (const [, arr] of classesByTeacher) {
      arr.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
    }

    const result = users.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name || user.username,
      class_name: user.class_name || null, // For students
      assigned_class_names:
        user.role === 'teacher'
          ? classesByTeacher.get(user._id.toString()) || []
          : undefined,
      created_at: user.created_at || null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ detail: 'Failed to fetch users' });
  }
});

/**
 * PATCH /admin/users/:id/role
 * Update user role (admin only)
 * Body: { role: 'teacher' | 'student' | 'admin' }
 */
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = ['teacher', 'student', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        detail: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }

    // Validate ID
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: 'Invalid user id' });
    }

    const db = getDB();

    // Check if user exists
    const user = await db.collection('users').findOne({ _id: objectId });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Prevent admin from removing their own admin role
    if (user._id.toString() === req.user.id && role !== 'admin') {
      return res.status(400).json({
        detail: 'Cannot remove admin role from yourself',
      });
    }

    // Update user role
    await db.collection('users').updateOne(
      { _id: objectId },
      { $set: { role } }
    );

    if (role !== 'teacher') {
      await removeAllForTeacher(db, id);
    }

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user._id.toString(),
        username: user.username,
        role,
        name: user.name || user.username,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ detail: 'Failed to update user role' });
  }
});

/**
 * PATCH /admin/users/:id/class
 * Update user class_name (admin only, for students)
 * Body: { class_name: string | null }
 */
router.patch('/users/:id/class', async (req, res) => {
  try {
    const { id } = req.params;
    const { class_name } = req.body;

    // Validate ID
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: 'Invalid user id' });
    }

    const db = getDB();

    // Check if user exists
    const user = await db.collection('users').findOne({ _id: objectId });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Only allow updating class_name for students
    if (user.role !== 'student') {
      return res.status(400).json({
        detail: 'Only students can have a class_name assigned',
      });
    }

    const finalClass =
      class_name && class_name.trim() !== '' ? class_name.trim() : null;

    if (finalClass) {
      const exists = await classNameExists(db, finalClass);
      if (!exists) {
        return res.status(400).json({
          detail:
            'Lớp phải thuộc danh sách lớp đã khai báo, hoặc để trống.',
        });
      }
    }

    // Update user class_name
    await db.collection('users').updateOne(
      { _id: objectId },
      { $set: { class_name: finalClass } }
    );

    // Get updated user
    const updatedUser = await db.collection('users').findOne({ _id: objectId });

    res.json({
      message: 'User class updated successfully',
      user: {
        id: updatedUser._id.toString(),
        username: updatedUser.username,
        role: updatedUser.role,
        name: updatedUser.name || updatedUser.username,
        class_name: updatedUser.class_name || null,
      },
    });
  } catch (error) {
    console.error('Error updating user class:', error);
    res.status(500).json({ detail: 'Failed to update user class' });
  }
});

/**
 * GET /admin/class-teachers
 * Mỗi lớp và danh sách giáo viên được gán.
 */
router.get('/class-teachers', async (req, res) => {
  try {
    const db = getDB();
    const classes = await listAllClassTeacherMappings(db);
    res.json({ classes });
  } catch (error) {
    console.error('Error listing class-teachers:', error);
    res.status(500).json({ detail: 'Failed to load class teacher assignments' });
  }
});

/**
 * PUT /admin/class-teachers
 * Body: { class_name: string, teacher_ids: string[] } — thay toàn bộ GV của lớp.
 */
router.put('/class-teachers', async (req, res) => {
  try {
    const { class_name, teacher_ids } = req.body;
    if (class_name == null || typeof class_name !== 'string') {
      return res.status(400).json({ detail: 'class_name is required' });
    }
    if (!Array.isArray(teacher_ids)) {
      return res.status(400).json({ detail: 'teacher_ids must be an array' });
    }
    const db = getDB();
    const teachers = await setTeachersForClass(db, class_name, teacher_ids);
    res.json({
      class_name: String(class_name).trim(),
      teachers: teachers.map((t) => ({
        id: t.teacher_id,
        username: t.username,
        name: t.name,
      })),
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ detail: error.message });
    }
    console.error('Error updating class-teachers:', error);
    res.status(500).json({ detail: 'Failed to update class teacher assignments' });
  }
});

/**
 * GET /admin/classes
 * Danh sách lớp (admin)
 */
router.get('/classes', async (req, res) => {
  try {
    const db = getDB();
    const classes = await listClassNames(db);
    res.json({ classes });
  } catch (error) {
    console.error('Error listing classes:', error);
    res.status(500).json({ detail: 'Failed to fetch classes' });
  }
});

/**
 * POST /admin/classes
 * Thêm lớp — body: { name: string }
 */
router.post('/classes', async (req, res) => {
  try {
    const { name } = req.body;
    const db = getDB();
    await addClassDocument(db, name);
    const classes = await listClassNames(db);
    res.status(201).json({
      message: 'Class added successfully',
      classes,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ detail: error.message });
    }
    console.error('Error adding class:', error);
    res.status(500).json({ detail: 'Failed to add class' });
  }
});

/**
 * PATCH /admin/classes
 * Đổi tên lớp — body: { from: string, to: string }
 */
router.patch('/classes', async (req, res) => {
  try {
    const { from, to } = req.body;
    if (from == null || to == null) {
      return res.status(400).json({ detail: 'Thiếu from hoặc to' });
    }
    const db = getDB();
    await renameClassDocument(db, from, to);
    const classes = await listClassNames(db);
    res.json({
      message: 'Class renamed successfully',
      classes,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ detail: error.message });
    }
    console.error('Error renaming class:', error);
    res.status(500).json({ detail: 'Failed to rename class' });
  }
});

/**
 * DELETE /admin/classes?name=8A1
 * Xóa lớp — gỡ học sinh khỏi lớp và gán bài liên quan
 */
router.delete('/classes', async (req, res) => {
  try {
    const name = req.query.name;
    if (!name || String(name).trim() === '') {
      return res.status(400).json({ detail: 'Query parameter "name" is required' });
    }
    const db = getDB();
    await removeClassDocument(db, name);
    const classes = await listClassNames(db);
    res.json({
      message: 'Class deleted successfully',
      classes,
    });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 400 && status < 500) {
      return res.status(status).json({ detail: error.message });
    }
    console.error('Error deleting class:', error);
    res.status(500).json({ detail: 'Failed to delete class' });
  }
});

/**
 * DELETE /admin/users/:id
 * Delete a user (admin only)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    let objectId;
    try {
      objectId = ObjectId.createFromHexString(id);
    } catch (error) {
      return res.status(400).json({ detail: 'Invalid user id' });
    }

    const db = getDB();

    // Check if user exists
    const user = await db.collection('users').findOne({ _id: objectId });
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({
        detail: 'Cannot delete your own account',
      });
    }

    await removeAllForTeacher(db, id);

    // Delete user
    await db.collection('users').deleteOne({ _id: objectId });

    res.json({
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ detail: 'Failed to delete user' });
  }
});

/**
 * GET /admin/sticker-redeem/overview
 * All students with earned / redeemed / available sticker counts.
 */
router.get('/sticker-redeem/overview', async (req, res) => {
  try {
    const db = getDB();
    const rows = await getStickerRedeemOverviewForAllStudents(db);
    res.json({ students: rows });
  } catch (error) {
    console.error('Error sticker-redeem overview:', error);
    res.status(500).json({ detail: 'Failed to load sticker redeem overview' });
  }
});

/**
 * GET /admin/sticker-redeem/history/:studentId
 */
router.get('/sticker-redeem/history/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    let studentOid;
    try {
      studentOid = ObjectId.createFromHexString(studentId);
    } catch {
      return res.status(400).json({ detail: 'Invalid student id' });
    }

    const db = getDB();
    const student = await db.collection('users').findOne({
      _id: studentOid,
      role: 'student',
    });
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    const list = await db
      .collection('sticker_redemptions')
      .find({ student_id: studentOid })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();

    const adminIds = [...new Set(list.map((r) => r.created_by.toString()))];
    const adminOids = adminIds.map((id) => ObjectId.createFromHexString(id));
    const admins = await db
      .collection('users')
      .find({ _id: { $in: adminOids } })
      .project({ username: 1, name: 1 })
      .toArray();
    const adminMap = new Map(
      admins.map((a) => [
        a._id.toString(),
        a.name || a.username,
      ])
    );

    res.json({
      student: {
        id: student._id.toString(),
        username: student.username,
        name: student.name || student.username,
        class_name: student.class_name || null,
      },
      redemptions: list.map((r) => ({
        id: r._id.toString(),
        sticker_cost: r.sticker_cost,
        gift_summary: r.gift_summary,
        created_at: r.created_at,
        created_by_name: adminMap.get(r.created_by.toString()) || '—',
      })),
    });
  } catch (error) {
    console.error('Error sticker-redeem history:', error);
    res.status(500).json({ detail: 'Failed to load redemption history' });
  }
});

/**
 * POST /admin/sticker-redeem
 * Body: { student_id, sticker_cost: 30|180|220, gift_summary: string }
 */
router.post('/sticker-redeem', async (req, res) => {
  try {
    const { student_id, sticker_cost, gift_summary } = req.body;

    if (!student_id || typeof student_id !== 'string') {
      return res.status(400).json({ detail: 'student_id is required' });
    }

    if (!isValidRedemptionCost(sticker_cost)) {
      return res.status(400).json({
        detail: 'sticker_cost must be 30, 180, or 220',
      });
    }

    const cost = Number(sticker_cost);
    const summary =
      typeof gift_summary === 'string' ? gift_summary.trim() : '';
    if (summary.length < 1 || summary.length > 500) {
      return res.status(400).json({
        detail: 'gift_summary must be 1–500 characters',
      });
    }

    let studentOid;
    try {
      studentOid = ObjectId.createFromHexString(student_id);
    } catch {
      return res.status(400).json({ detail: 'Invalid student id' });
    }

    const db = getDB();
    const student = await db.collection('users').findOne({
      _id: studentOid,
      role: 'student',
    });
    if (!student) {
      return res.status(404).json({ detail: 'Student not found' });
    }

    const earned = await getStudentStickerEarnedTotal(db, studentOid);
    const redeemed = await getStudentRedeemedTotal(db, studentOid);
    const available = Math.max(0, earned - redeemed);

    if (available < cost) {
      return res.status(400).json({
        detail: `Kh\u00f4ng \u0111\u1ee7 sticker: c\u00f2n ${available}, c\u1ea7n ${cost}.`,
      });
    }

    let adminOid;
    try {
      adminOid = ObjectId.createFromHexString(req.user.id);
    } catch {
      return res.status(500).json({ detail: 'Invalid admin session' });
    }

    const doc = {
      student_id: studentOid,
      sticker_cost: cost,
      gift_summary: summary,
      created_by: adminOid,
      created_at: new Date(),
    };

    const ins = await db.collection('sticker_redemptions').insertOne(doc);

    const newRedeemed = redeemed + cost;
    const newAvailable = Math.max(0, earned - newRedeemed);

    res.status(201).json({
      redemption: {
        id: ins.insertedId.toString(),
        sticker_cost: cost,
        gift_summary: summary,
        created_at: doc.created_at,
      },
      student: {
        id: student._id.toString(),
        username: student.username,
        stickers_earned: earned,
        stickers_redeemed: newRedeemed,
        stickers_available: newAvailable,
      },
    });
  } catch (error) {
    console.error('Error creating sticker redemption:', error);
    res.status(500).json({ detail: 'Failed to record redemption' });
  }
});

/**
 * GET /admin/stats
 * Get system statistics (admin only)
 */
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();

    const [userCount, teacherCount, studentCount, assignmentCount, submissionCount] =
      await Promise.all([
        db.collection('users').countDocuments(),
        db.collection('users').countDocuments({ role: 'teacher' }),
        db.collection('users').countDocuments({ role: 'student' }),
        db.collection('assignments').countDocuments(),
        db.collection('submissions').countDocuments(),
      ]);

    res.json({
      users: {
        total: userCount,
        teachers: teacherCount,
        students: studentCount,
        admins: userCount - teacherCount - studentCount,
      },
      assignments: assignmentCount,
      submissions: submissionCount,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ detail: 'Failed to fetch statistics' });
  }
});

export default router;
