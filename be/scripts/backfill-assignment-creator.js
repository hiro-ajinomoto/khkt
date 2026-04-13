/**
 * Gán created_by cho bài tập chưa có người tạo (một lần).
 * Usage: node be/scripts/backfill-assignment-creator.js
 * Hoặc: cd be && node scripts/backfill-assignment-creator.js
 */

import { ObjectId } from 'mongodb';
import { connectDB, closeDB, getDB } from '../src/db.js';

const TARGET_NAME_HINTS = [/phan\s*hoàng\s*đạt/i, /phạt\s*hoàng\s*đạt/i];

async function findTeacher() {
  const db = getDB();
  const users = await db
    .collection('users')
    .find({ role: 'teacher' })
    .toArray();

  for (const u of users) {
    const name = (u.name || '').trim();
    const username = (u.username || '').trim();
    for (const re of TARGET_NAME_HINTS) {
      if (re.test(name) || re.test(username)) {
        return u;
      }
    }
  }

  // Khớp lỏng: có "đạt" và ("phan" hoặc "hoàng")
  for (const u of users) {
    const n = `${u.name || ''} ${u.username || ''}`.toLowerCase();
    if (n.includes('đạt') && (n.includes('phan') || n.includes('hoàng'))) {
      return u;
    }
  }

  return null;
}

async function main() {
  await connectDB();
  const db = getDB();

  const teacher = await findTeacher();
  if (!teacher) {
    console.error(
      'Không tìm thấy giáo viên khớp "Phan Hoàng Đạt". Danh sách giáo viên:'
    );
    const all = await db
      .collection('users')
      .find({ role: 'teacher' })
      .project({ username: 1, name: 1 })
      .toArray();
    for (const u of all) {
      console.log(`  - ${u._id} | ${u.username} | ${u.name || ''}`);
    }
    process.exitCode = 1;
    await closeDB();
    return;
  }

  const tid = teacher._id;
  console.log(
    `Chọn giáo viên: ${teacher.name || teacher.username} (${tid.toString()})`
  );

  const filter = {
    $or: [{ created_by: { $exists: false } }, { created_by: null }],
  };

  const before = await db.collection('assignments').countDocuments(filter);
  console.log(`Bài tập chưa có created_by: ${before}`);

  const result = await db.collection('assignments').updateMany(filter, {
    $set: { created_by: tid },
  });

  console.log(`Đã cập nhật: ${result.modifiedCount} bài.`);

  await closeDB();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
