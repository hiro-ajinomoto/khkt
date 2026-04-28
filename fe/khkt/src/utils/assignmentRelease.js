/** Ngày theo lịch Việt Nam (YYYY-MM-DD) */
export function todayStrHoChiMinh() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Cuối ngày hạn nộp (23:59:59.999) theo Asia/Ho_Chi_Minh — khớp hạn nộp “hết ngày” trên form. */
export function endOfDueDateHoChiMinh(ymd) {
  const d = String(ymd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T23:59:59.999+07:00`);
}

function hoursLeftUntilEndOfDueDate(ymd) {
  const end = endOfDueDateHoChiMinh(ymd);
  if (!end) return null;
  return Math.ceil((end.getTime() - Date.now()) / HOUR_MS);
}

/** Cộng/trừ số ngày trên lịch VN (timezone Asia/Ho_Chi_Minh). */
export function addCalendarDaysVN(fromYmd, deltaDays) {
  const ms =
    new Date(`${fromYmd}T12:00:00+07:00`).getTime() +
    deltaDays * DAY_MS;
  return new Date(ms).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** Hạn nộp mặc định khi tạo bài: cùng ngày (VN) — nộp đến hết ngày hôm nay (23:59). */
export function defaultDueDateForNewAssignment() {
  return todayStrHoChiMinh();
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

/** Đã quá hạn nộp (sau 23:59:59 ngày due_date, giờ Việt Nam). */
export function isPastDueClient(dueDate) {
  if (!dueDate) return false;
  const end = endOfDueDateHoChiMinh(dueDate);
  if (!end) return todayStrHoChiMinh() > String(dueDate);
  return Date.now() > end.getTime();
}

/**
 * Nhắc hạn nộp cho HS: { tone, label }
 * tone: 'upcoming' | 'today' | 'overdue'
 * Thời gian còn lại tính theo giờ đến hết ngày hạn (23:59:59, giờ VN).
 */
export function deadlineReminderClient(dueDate) {
  if (!dueDate) return null;
  const d = String(dueDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;

  const hoursLeft = hoursLeftUntilEndOfDueDate(d);
  if (hoursLeft === null) return null;
  if (hoursLeft <= 0) {
    return { tone: 'overdue', label: 'Quá hạn nộp' };
  }

  const today = todayStrHoChiMinh();
  const label = `Còn ${hoursLeft} giờ`;
  if (today === d) {
    return { tone: 'today', hours: hoursLeft, label };
  }
  return { tone: 'upcoming', hours: hoursLeft, label };
}
