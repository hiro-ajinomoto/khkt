/**
 * API: không gian làm việc theo lớp (giáo viên / admin).
 */

import { getAuthHeader } from '../utils/auth';
import {
  describeApiFailure,
  getNetworkErrorMessage,
  isLikelyNetworkError,
} from '../utils/fetchErrors';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function rethrowNetwork(error) {
  if (isLikelyNetworkError(error)) throw new Error(getNetworkErrorMessage());
  throw error;
}

/** Segment URL an toàn cho tên lớp (có thể chứa /, khoảng, v.v.) */
export function encodeClassNameForPath(className) {
  return encodeURIComponent(className);
}

/** Đối chiếu với `useParams().className` sau khi route giải mã một phần. */
export function decodeClassRouteParam(param) {
  if (param == null || param === '') return '';
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

/**
 * @returns {Promise<{ classes: Array<{ class_name: string, student_count: number, assignment_count: number }> }>}
 */
export async function fetchTeacherClassesOverview() {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Cần đăng nhập.');
    const response = await fetch(`${API_BASE_URL}/teacher/classes`, {
      headers: { Authorization: authHeader },
      cache: 'no-store',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được danh sách lớp.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('fetchTeacherClassesOverview:', error);
    rethrowNetwork(error);
  }
}

/**
 * @returns {Promise<{ class_name: string, students: Array<{ id: string, username: string, name: string, created_at: string|null }> }>}
 */
export async function fetchTeacherClassStudents(className) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Cần đăng nhập.');
    const response = await fetch(
      `${API_BASE_URL}/teacher/classes/${encodeURIComponent(className)}/students`,
      {
        headers: { Authorization: authHeader },
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được học sinh.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('fetchTeacherClassStudents:', error);
    rethrowNetwork(error);
  }
}

/**
 * Gỡ học sinh khỏi lớp (tài khoản vẫn tồn tại, class_name = null).
 * @returns {Promise<{ ok: boolean, message?: string, student_id?: string }>}
 */
export async function removeStudentFromTeacherClass(className, studentId) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Cần đăng nhập.');
    const response = await fetch(
      `${API_BASE_URL}/teacher/classes/${encodeURIComponent(className)}/students/${encodeURIComponent(studentId)}`,
      {
        method: 'DELETE',
        headers: { Authorization: authHeader },
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không gỡ được học sinh khỏi lớp.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('removeStudentFromTeacherClass:', error);
    rethrowNetwork(error);
  }
}

/**
 * @returns {Promise<{ class_name: string, assignments: Array<{ id: string, title: string, created_at: string|null, updated_at: string|null, available_from_date: string|null, due_date: string|null, grade_level: string|null }> }>}
 */
export async function fetchTeacherClassAssignments(className) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Cần đăng nhập.');
    const response = await fetch(
      `${API_BASE_URL}/teacher/classes/${encodeURIComponent(className)}/assignments`,
      {
        headers: { Authorization: authHeader },
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được bài tập lớp.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('fetchTeacherClassAssignments:', error);
    rethrowNetwork(error);
  }
}

/**
 * Tổng quan nộp bài của lớp theo ngày (VN). Bỏ `from`/`to` để lấy mặc định 14 ngày gần nhất.
 * @returns {Promise<{
 *   class_name: string,
 *   from: string,
 *   to: string,
 *   days: Array<{ date: string, submission_count: number, graded_submission_count: number,
 *     unique_students: number, avg_score: number|null,
 *     students: Array<{ student_id: string, student_name: string, submission_count: number }>,
 *   }>,
 *   totals: { submission_count: number, graded_submission_count: number, unique_students: number, avg_score: number|null },
 *   label?: { submission_unit?: string, score_note?: string },
 * }>}
 */
export async function fetchTeacherClassSubmissionActivity(className, range) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Cần đăng nhập.');
    const q = new URLSearchParams();
    const from =
      typeof range?.from === 'string' ? range.from.trim() : '';
    const to = typeof range?.to === 'string' ? range.to.trim() : '';
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const qs = q.toString() ? `?${q}` : '';
    const response = await fetch(
      `${API_BASE_URL}/teacher/classes/${encodeURIComponent(className)}/submission-activity${qs}`,
      {
        headers: { Authorization: authHeader },
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được hoạt động lớp.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('fetchTeacherClassSubmissionActivity:', error);
    rethrowNetwork(error);
  }
}

/**
 * Chi tiết một ngày: học sinh, điểm, lượt nộp, bài trong ngày / tổng bài lớp.
 */
export async function fetchTeacherClassSubmissionActivityDay(className, dayYmd) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Cần đăng nhập.');
    const y = encodeURIComponent(dayYmd);
    const response = await fetch(
      `${API_BASE_URL}/teacher/classes/${encodeURIComponent(className)}/submission-activity/day/${y}`,
      {
        headers: { Authorization: authHeader },
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được chi tiết ngày.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('fetchTeacherClassSubmissionActivityDay:', error);
    rethrowNetwork(error);
  }
}
