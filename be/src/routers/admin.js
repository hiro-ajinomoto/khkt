import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

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
    const result = users.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      role: user.role,
      name: user.name || user.username,
      class_name: user.class_name || null, // For students
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

    // Validate class_name (optional, can be null or empty string)
    const validClasses = ['8A1', '8A2', '8A3', '8A4', '8A5'];
    const finalClass = class_name && class_name.trim() !== '' ? class_name.trim() : null;
    
    if (finalClass && !validClasses.includes(finalClass)) {
      return res.status(400).json({
        detail: `Invalid class_name. Must be one of: ${validClasses.join(', ')} or null`,
      });
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
