/**
 * Gán bài–lớp: mặc định HS thấy và nộp được. `class_active: false` = GV tạm ẩn với lớp này (không xóa bài).
 * @param {{ class_active?: boolean } | null | undefined} linkRow
 */
export function isClassAssignmentActiveForStudent(linkRow) {
  return linkRow != null && linkRow.class_active !== false;
}
