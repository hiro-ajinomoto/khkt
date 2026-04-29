import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { listClassNames, resolveClassNameFromEnrollmentCode } from '../schoolClasses.js';
import { listClassNamesForTeacher } from '../classTeacherAssignments.js';
import { validateNewLoginUsername } from '../utils/loginUsername.js';
import { normalizeStreakForCalendar } from '../utils/studentStreak.js';

/** Trường streak trên users (chỉ HS). */
function streakFieldsForApiStudent(user) {
  if (user.role !== 'student') return {};
  return {
    streak_current: Number.isFinite(user.streak_current) ? user.streak_current : 0,
    streak_longest: Number.isFinite(user.streak_longest) ? user.streak_longest : 0,
    streak_last_activity_ymd: user.streak_last_activity_ymd || null,
  };
}

const router = express.Router();

/**
 * POST /auth/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body?.username ?? '').trim();
    const password =
      req.body?.password != null ? String(req.body.password) : '';

    if (!username || !password) {
      return res.status(400).json({
        detail: 'Vui lòng nhập tên đăng nhập và mật khẩu.',
      });
    }

    const db = getDB();
    const user = await db.collection('users').findOne({ username });

    if (!user) {
      return res.status(401).json({
        detail: 'Sai tên đăng nhập hoặc mật khẩu.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        detail: 'Sai tên đăng nhập hoặc mật khẩu.',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    let assigned_class_names = [];
    if (user.role === 'teacher') {
      assigned_class_names = await listClassNamesForTeacher(db, user._id.toString());
    }

    if (user.role === 'student') {
      const patch = await normalizeStreakForCalendar(db, user._id);
      if (patch) user.streak_current = 0;
    }

    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name || user.username,
        ...(user.role === 'teacher' ? { assigned_class_names } : {}),
        ...(user.role === 'student'
          ? { class_name: user.class_name || null, ...streakFieldsForApiStudent(user) }
          : {}),
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Đăng nhập thất bại. Vui lòng thử lại.' });
  }
});

/**
 * POST /auth/register
 * Register a new user (for initial setup, can be restricted later)
 */
router.post('/register', async (req, res) => {
  try {
    const password =
      req.body?.password != null ? String(req.body.password) : '';
    const { name } = req.body;

    const usernameCheck = validateNewLoginUsername(req.body?.username);
    if (!usernameCheck.ok) {
      return res.status(400).json({ detail: usernameCheck.detail });
    }
    const username = usernameCheck.username;

    if (!password) {
      return res.status(400).json({
        detail: 'Vui lòng nhập mật khẩu.',
      });
    }

    // Only allow student role for new registrations (admin/teacher must be assigned)
    const userRole = 'student';

    const db = getDB();

    // Check if username already exists
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.status(400).json({ detail: 'Tên đăng nhập đã được sử dụng.' });
    }

    const rawCode = req.body.class_code ?? req.body.classCode;
    if (rawCode == null || String(rawCode).trim() === '') {
      return res.status(400).json({
        detail: 'Vui lòng nhập mã lớp 4 chữ số do giáo viên cung cấp.',
      });
    }
    const resolved = await resolveClassNameFromEnrollmentCode(db, rawCode);
    if (!resolved.ok) {
      return res.status(400).json({
        detail:
          'Mã lớp không đúng hoặc đã được đổi. Hỏi giáo viên để nhận mã mới.',
      });
    }
    const class_name = resolved.class_name;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      username,
      password: hashedPassword,
      role: userRole,
      name: name || username,
      class_name,
      created_at: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);

    if (class_name) {
      try {
        await db.collection('notifications').insertOne({
          type: 'student_registered',
          title: 'Học sinh mới đăng ký',
          message: `${newUser.name} vừa đăng ký vào lớp ${class_name}.`,
          target_roles: ['teacher', 'admin'],
          actor_user_id: result.insertedId,
          actor_username: username,
          actor_name: newUser.name,
          class_name,
          read_by: [],
          created_at: new Date(),
        });
      } catch (notifyErr) {
        console.error('Failed to create student registration notification:', notifyErr);
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: result.insertedId.toString(), username, role: userRole },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertedId.toString(),
        username,
        role: userRole,
        name: newUser.name,
        class_name: class_name || null,
        streak_current: 0,
        streak_longest: 0,
        streak_last_activity_ymd: null,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ detail: 'Đăng ký thất bại. Vui lòng thử lại.' });
  }
});

/**
 * GET /auth/classes
 * Danh sách lớp (công khai — dùng cho form đăng ký)
 */
router.get('/classes', async (req, res) => {
  try {
    const db = getDB();
    const classes = await listClassNames(db);
    res.json({ classes });
  } catch (error) {
    console.error('Error listing classes:', error);
    res.status(500).json({ detail: 'Không thể tải danh sách lớp' });
  }
});

/**
 * GET /auth/me
 * Get current user info (requires authentication)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const db = getDB();
    const user = await db.collection('users').findOne({
      _id: ObjectId.createFromHexString(req.user.id),
    });

    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    if (user.role === 'student') {
      const patch = await normalizeStreakForCalendar(db, user._id);
      if (patch) user.streak_current = 0;
    }

    let assigned_class_names = [];
    if (user.role === 'teacher') {
      assigned_class_names = await listClassNamesForTeacher(db, user._id.toString());
    }

    res.json({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name || user.username,
      class_name: user.class_name || null, // For students
      ...(user.role === 'teacher' ? { assigned_class_names } : {}),
      ...(user.role === 'student' ? streakFieldsForApiStudent(user) : {}),
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Failed to get user info' });
  }
});

/**
 * POST /auth/init
 * Initialize default admin/teacher account (for first-time setup)
 * This endpoint should be disabled in production after initial setup
 */
router.post('/init', async (req, res) => {
  try {
    const db = getDB();

    // Check if any users exist
    const userCount = await db.collection('users').countDocuments();
    if (userCount > 0) {
      return res.status(400).json({ detail: 'System already initialized' });
    }

    // Create default admin account
    const requestedUsername = req.body.username
      ? String(req.body.username).trim()
      : 'admin';
    const usernameCheck = validateNewLoginUsername(requestedUsername);
    if (!usernameCheck.ok) {
      return res.status(400).json({ detail: usernameCheck.detail });
    }
    const defaultUsername = usernameCheck.username;
    const defaultPassword = req.body.password || 'admin123';

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const defaultAdmin = {
      username: defaultUsername,
      password: hashedPassword,
      role: 'admin',
      name: 'Administrator',
      created_at: new Date(),
    };

    const result = await db.collection('users').insertOne(defaultAdmin);

    res.status(201).json({
      message: 'Default admin account created',
      username: defaultUsername,
      password: defaultPassword,
      note: 'Please change the password after first login',
    });
  } catch (error) {
    console.error('Init error:', error);
    res.status(500).json({ detail: 'Initialization failed' });
  }
});

export default router;
