/** Ngày theo lịch Việt Nam (YYYY-MM-DD) */
export function todayStrHoChiMinh() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

/** Bài đã đến ngày mở cho học sinh (client, đồng bộ logic backend) */
export function isAssignmentReleasedClient(availableFromDate) {
  if (
    availableFromDate === undefined ||
    availableFromDate === null ||
    availableFromDate === ''
  ) {
    return true;
  }
  return todayStrHoChiMinh() >= String(availableFromDate);
}

export function formatVNDateFromYMD(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd))) return '';
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

/** Đã quá hạn nộp (sau ngày due_date) */
export function isPastDueClient(dueDate) {
  if (!dueDate) return false;
  return todayStrHoChiMinh() > String(dueDate);
}

/**
 * Nhắc hạn nộp cho HS: { tone, label }
 * tone: 'upcoming' | 'today' | 'overdue'
 */
export function deadlineReminderClient(dueDate) {
  if (!dueDate) return null;
  const today = todayStrHoChiMinh();
  const d = String(dueDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  if (today > d) return { tone: 'overdue', label: 'Quá hạn nộp' };
  if (today === d) return { tone: 'today', label: 'Hết hạn hôm nay' };
  const [y1, m1, day1] = today.split('-').map(Number);
  const [y2, m2, day2] = d.split('-').map(Number);
  const t0 = new Date(y1, m1 - 1, day1);
  const t1 = new Date(y2, m2 - 1, day2);
  const diff = Math.round((t1 - t0) / 86400000);
  return { tone: 'upcoming', days: diff, label: `Còn ${diff} ngày` };
}
