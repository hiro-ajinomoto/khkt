/**
 * Ngày hiện tại theo lịch Việt Nam (YYYY-MM-DD) — dùng so sánh với available_from_date.
 */
export function todayStrHoChiMinh() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

/**
 * Chuỗi YYYY-MM-DD (lịch VN) của ngày mở cho HS, hoặc null nếu bài không chặn theo ngày mở.
 */
export function assignmentAvailableFromYmd(assignment) {
  const d = assignment?.available_from_date;
  if (d === undefined || d === null || d === "") return null;
  if (typeof d === "string") return d;
  if (d instanceof Date && !Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  }
  return null;
}

/**
 * Bài đã đến ngày mở cho HS (hoặc không cấu hình ngày mở) — so với hôm nay (VN).
 */
export function isAssignmentReleased(assignment) {
  const key = assignmentAvailableFromYmd(assignment);
  if (key === null) return true;
  const t = todayStrHoChiMinh();
  return t >= key;
}

/**
 * Bài đã mở cho HS vào ngày `ymd` (YYYY-MM-DD, lịch VN) hoặc trước đó.
 */
export function isAssignmentReleasedOnYmd(assignment, ymd) {
  const key = assignmentAvailableFromYmd(assignment);
  if (key === null) return true;
  return ymd >= key;
}

/**
 * Còn trong hạn nộp (đến hết ngày due_date tính theo giờ VN), hoặc không đặt hạn.
 */
export function isBeforeOrOnDeadline(assignment) {
  const d = assignment?.due_date;
  if (d === undefined || d === null || d === "") return true;
  if (typeof d !== "string") return true;
  return todayStrHoChiMinh() <= d;
}
