/**
 * Cross-component channel for notifying the student sticker bear mascot to refetch
 * its total. Using a lightweight window CustomEvent avoids adding a global store
 * just for this single side-effect.
 */

/** Tên event dùng chung để yêu cầu dock refetch số sticker ngay lập tức. */
export const STUDENT_STICKERS_REFRESH_EVENT = 'student-stickers:refresh';

/**
 * Phát sự kiện yêu cầu bear mascot cập nhật số sticker ngay lập tức.
 * Gọi sau khi nộp bài / đổi sticker / bất kỳ thao tác nào thay đổi tổng sticker.
 */
export function refreshStudentStickers() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(STUDENT_STICKERS_REFRESH_EVENT));
}
