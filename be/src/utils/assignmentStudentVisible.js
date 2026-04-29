/**
 * `student_visible === false`: khóa thao tác của học sinh trên hệ thống (nộp, báo lỗi đề…),
 * không ẩn bài khỏi danh sách. Thiếu field hoặc !== false → không khóa (tương thích dữ liệu cũ).
 */
export function isAssignmentVisibleToStudentsGlobally(doc) {
  return doc != null && doc.student_visible !== false;
}
