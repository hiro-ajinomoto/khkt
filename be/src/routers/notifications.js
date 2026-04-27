import express from 'express';
import { ObjectId } from 'mongodb';
import { getDB } from '../db.js';
import { authenticate, requireTeacher } from '../middleware/auth.js';

const router = express.Router();

function serializeNotification(notification, userId) {
  const readBy = Array.isArray(notification.read_by) ? notification.read_by : [];
  const isRead = readBy.some((id) => id?.toString() === userId);

  return {
    id: notification._id.toString(),
    type: notification.type,
    title: notification.title || 'Thông báo',
    message: notification.message || '',
    actor_user_id: notification.actor_user_id
      ? notification.actor_user_id.toString()
      : null,
    actor_username: notification.actor_username || null,
    actor_name: notification.actor_name || null,
    class_name: notification.class_name || null,
    created_at: notification.created_at || null,
    read: isRead,
  };
}

function notificationVisibilityFilter(role) {
  return {
    target_roles: role,
  };
}

/**
 * Thông báo "chưa đọc" = userId chưa nằm trong mảng read_by.
 * Không dùng { read_by: { $ne: userId } } vì với read_by là mảng ObjectId, $ne
 * không có nghĩa "mảng không chứa", dễ đếm/lọc sai.
 */
function notReadByUserFilter(userId) {
  return {
    $expr: {
      $not: {
        $in: [userId, { $ifNull: ['$read_by', []] }],
      },
    },
  };
}

/**
 * GET /notifications
 * List notifications for teacher/admin users.
 */
router.get('/', authenticate, requireTeacher, async (req, res) => {
  try {
    const db = getDB();
    const userId = ObjectId.createFromHexString(req.user.id);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100
    );
    const unreadOnly = String(req.query.unread_only || '') === 'true';

    const base = notificationVisibilityFilter(req.user.role);
    const filter = unreadOnly
      ? { ...base, ...notReadByUserFilter(userId) }
      : base;

    const notifications = await db
      .collection('notifications')
      .find(filter)
      .sort({ created_at: -1 })
      .limit(limit)
      .toArray();

    const unread_count = await db.collection('notifications').countDocuments({
      ...base,
      ...notReadByUserFilter(userId),
    });

    res.json({
      items: notifications.map((n) => serializeNotification(n, req.user.id)),
      unread_count,
    });
  } catch (error) {
    console.error('Error listing notifications:', error);
    res.status(500).json({ detail: 'Không tải được thông báo.' });
  }
});

/**
 * POST /notifications/:id/read
 * Mark one notification as read for current teacher/admin.
 */
router.post('/:id/read', authenticate, requireTeacher, async (req, res) => {
  try {
    let notificationId;
    try {
      notificationId = ObjectId.createFromHexString(req.params.id);
    } catch (_error) {
      return res.status(400).json({ detail: 'Invalid notification id' });
    }

    const db = getDB();
    const userId = ObjectId.createFromHexString(req.user.id);
    const result = await db.collection('notifications').updateOne(
      {
        _id: notificationId,
        ...notificationVisibilityFilter(req.user.role),
      },
      { $addToSet: { read_by: userId } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ detail: 'Notification not found' });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ detail: 'Không cập nhật được thông báo.' });
  }
});

/**
 * POST /notifications/read-all
 * Mark every visible notification as read for current teacher/admin.
 */
router.post('/read-all', authenticate, requireTeacher, async (req, res) => {
  try {
    const db = getDB();
    const userId = ObjectId.createFromHexString(req.user.id);
    await db.collection('notifications').updateMany(
      notificationVisibilityFilter(req.user.role),
      { $addToSet: { read_by: userId } }
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ detail: 'Không cập nhật được thông báo.' });
  }
});

export default router;
