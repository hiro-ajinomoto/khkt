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
