/**
 * API service for submissions
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

/**
 * Create a new submission
 * @param {string} assignmentId - Assignment ID
 * @param {File[]} files - Array of image files
 * @returns {Promise<Object>} Submission object
 */
export async function createSubmission(assignmentId, files) {
  try {
    const authHeader = getAuthHeader();
    
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('assignment_id', assignmentId);
    
    // Append all files
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        // Don't set Content-Type header - browser will set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không nộp được bài.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating submission:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch submission by ID
 * @param {string} id - Submission ID
 * @returns {Promise<Object>} Submission object
 */
export async function fetchSubmissionById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/submissions/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được bài nộp.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching submission:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch all submissions of the authenticated student
 * @returns {Promise<Array>} Array of submission objects
 */
export async function fetchMySubmissions() {
  try {
    const authHeader = getAuthHeader();
    
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/submissions/my-submissions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được danh sách bài nộp.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching my submissions:', error);
    rethrowNetwork(error);
  }
}

/**
 * Bản rút gọn của fetchMySubmissions dùng cho màn danh sách bài tập.
 * Chỉ trả về số lần nộp theo từng assignment, không kéo ai_result nặng về.
 * @returns {Promise<Array<{assignment_id: string, count: number}>>}
 */
export async function fetchMySubmissionCounts() {
  try {
    const authHeader = getAuthHeader();

    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(
      `${API_BASE_URL}/submissions/my-submission-counts`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(
          response,
          errorData,
          'Không đếm được số lần nộp của bạn.',
        ),
      );
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching submission counts:', error);
    rethrowNetwork(error);
  }
}

/**
 * Lấy danh sách bài nộp cho GV/Admin chấm tay.
 * @param {Object} [params]
 * @param {string} [params.assignmentId]
 * @param {string} [params.className]
 * @param {'true'|'false'} [params.hasReview]
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 * @returns {Promise<{items: Array, total: number, limit: number, offset: number}>}
 */
export async function fetchTeacherSubmissions(params = {}) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Authentication required');

    const qs = new URLSearchParams();
    if (params.assignmentId) qs.set('assignment_id', params.assignmentId);
    if (params.className) qs.set('class_name', params.className);
    if (params.hasReview) qs.set('has_review', params.hasReview);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));

    const url = `${API_BASE_URL}/submissions/teacher${
      qs.toString() ? `?${qs.toString()}` : ''
    }`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(
          response,
          errorData,
          'Không tải được danh sách bài nộp.',
        ),
      );
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching teacher submissions:', error);
    rethrowNetwork(error);
  }
}

/**
 * Tạo/cập nhật nhận xét thủ công cho 1 bài nộp.
 * @param {string} submissionId
 * @param {{comment: string, score_override?: number|null}} payload
 * @returns {Promise<{teacher_review: Object}>}
 */
export async function upsertSubmissionReview(submissionId, payload) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Authentication required');

    const response = await fetch(
      `${API_BASE_URL}/submissions/${submissionId}/review`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không lưu được nhận xét.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('Error upserting submission review:', error);
    rethrowNetwork(error);
  }
}

/**
 * Xóa nhận xét thủ công.
 * @param {string} submissionId
 * @returns {Promise<{ok: boolean}>}
 */
export async function deleteSubmissionReview(submissionId) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Authentication required');

    const response = await fetch(
      `${API_BASE_URL}/submissions/${submissionId}/review`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không xóa được nhận xét.'),
      );
    }
    return response.json();
  } catch (error) {
    console.error('Error deleting submission review:', error);
    rethrowNetwork(error);
  }
}

/**
 * Sticker totals for the authenticated student (latest grade per assignment).
 * @returns {Promise<Object>}
 */
export async function fetchMyStickers() {
  try {
    const authHeader = getAuthHeader();

    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/submissions/my-stickers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được huy hiệu.')
      );
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching my stickers:', error);
    rethrowNetwork(error);
  }
}
