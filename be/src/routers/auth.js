import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /auth/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required' });
    }

    const db = getDB();
    const user = await db.collection('users').findOne({ username });

    if (!user) {
      return res.status(401).json({ detail: 'Invalid username or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ detail: 'Invalid username or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        name: user.name || user.username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Login failed' });
  }
});

/**
 * POST /auth/register
 * Register a new user (for initial setup, can be restricted later)
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, role, name } = req.body;

    if (!username || !password) {
      return res.status(400).json({ detail: 'Username and password are required' });
    }

    // Validate role - new registrations can only be students
    const validRoles = ['teacher', 'student', 'admin'];
    // Only allow student role for new registrations (admin/teacher must be assigned)
    const userRole = 'student';

    const db = getDB();

    // Check if username already exists
    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = {
      username,
      password: hashedPassword,
      role: userRole,
      name: name || username,
      class_name: req.body.class_name || null, // For students: 8A1, 8A2, etc.
      created_at: new Date(),
    };

    const result = await db.collection('users').insertOne(newUser);

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
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ detail: 'Registration failed' });
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

    res.json({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name || user.username,
      class_name: user.class_name || null, // For students
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
    const defaultUsername = req.body.username || 'admin';
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
