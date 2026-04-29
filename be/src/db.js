import { MongoClient } from 'mongodb'
import { config } from './config.js'
import { ensureClassTeacherIndexes } from './classTeacherAssignments.js'
import { ensureTeacherInviteCodeIndexes } from './utils/teacherInviteCodes.js'

let client = null
let db = null

export async function connectDB() {
  if (client) {
    return db
  }

  try {
    client = new MongoClient(config.mongodb.uri)
    await client.connect()
    db = client.db(config.mongodb.dbName)
    console.log('✅ Connected to MongoDB')
    await ensureIndexes(db)
    return db
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

/**
 * Đảm bảo các index cần thiết cho hiệu năng tồn tại trên các collection nóng.
 * `createIndex` trong MongoDB là idempotent — tạo lại cùng key spec sẽ không
 * gây lỗi, nên an toàn để gọi mỗi lần server khởi động.
 */
async function ensureIndexes(database) {
  const jobs = [
    // Students liệt kê bài nộp theo student_id (dùng ở /my-submissions,
    // /my-submission-counts, /my-stickers); teachers/admin đôi khi filter
    // theo assignment_id. Index đơn trên mỗi trường là đủ; compound thêm
    // {student_id, assignment_id} giúp aggregate group theo assignment nhanh.
    database
      .collection('submissions')
      .createIndex({ student_id: 1, created_at: -1 }, { name: 'student_created_idx' }),
    database
      .collection('submissions')
      .createIndex({ assignment_id: 1 }, { name: 'assignment_idx' }),
    database
      .collection('submissions')
      .createIndex({ student_id: 1, assignment_id: 1 }, { name: 'student_assignment_idx' }),

    // AssignmentList học sinh filter qua assignment_classes theo class_name
    // rồi $in assignment_id vào assignments. Index class_name + assignment_id
    // giúp cả hai hướng truy vấn đều nhanh.
    database
      .collection('assignment_classes')
      .createIndex({ class_name: 1 }, { name: 'class_name_idx' }),
    database
      .collection('assignment_classes')
      .createIndex({ assignment_id: 1 }, { name: 'assignment_id_idx' }),

    // Sort bài tập theo created_at DESC ở list; teachers/admins có thể query
    // by-date / by-month trên cùng field.
    database
      .collection('assignments')
      .createIndex({ created_at: -1 }, { name: 'created_at_desc_idx' }),

    // Chuông thông báo cho GV/Admin: list mới nhất + đếm unread theo role.
    database
      .collection('notifications')
      .createIndex({ target_roles: 1, created_at: -1 }, { name: 'notification_role_created_idx' }),
    database
      .collection('notifications')
      .createIndex({ read_by: 1 }, { name: 'notification_read_by_idx' }),
    database
      .collection('notifications')
      .createIndex(
        { recipient_user_id: 1, created_at: -1 },
        { name: 'notification_student_recipient_idx' },
      ),

    ensureClassTeacherIndexes(database),
    ensureTeacherInviteCodeIndexes(database),
  ]

  const results = await Promise.allSettled(jobs)
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    for (const r of failed) {
      console.warn('⚠️  ensureIndexes warning:', r.reason?.message || r.reason)
    }
  } else {
    console.log(`✅ Ensured ${results.length} MongoDB indexes`)
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.')
  }
  return db
}

export async function closeDB() {
  if (client) {
    await client.close()
    client = null
    db = null
    console.log('✅ MongoDB connection closed')
  }
}
