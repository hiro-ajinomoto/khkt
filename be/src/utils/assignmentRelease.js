/**
 * Ngày hiện tại theo lịch Việt Nam (YYYY-MM-DD) — dùng so sánh với available_from_date.
 */
export function todayStrHoChiMinh() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

/**
 * Bài đã đến ngày mở cho HS (hoặc không cấu hình ngày mở).
 */
export function isAssignmentReleased(assignment) {
  const d = assignment?.available_from_date;
  if (d === undefined || d === null || d === "") return true;
  if (typeof d !== "string") return true;
  const t = todayStrHoChiMinh();
  return t >= d;
}
