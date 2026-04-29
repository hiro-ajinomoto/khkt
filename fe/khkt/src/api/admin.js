/**
 * API service for admin operations
 */

import { getAuthHeader } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Get all users (admin only)
 * @returns {Promise<Array>} List of users
 */
export async function fetchUsers() {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/admin/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to fetch users: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

/**
 * Update user role (admin only)
 * @param {string} userId - User ID
 * @param {string} role - New role ('teacher', 'student', or 'admin')
 * @returns {Promise<Object>} Updated user object
 */
export async function updateUserRole(userId, role) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update user role: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
}

/**
 * Update user class_name (admin only, for students)
 * @param {string} userId - User ID
 * @param {string|null} class_name - New class name (e.g., '8A1', '8A2', etc.) or null
 * @returns {Promise<Object>} Updated user object
 */
export async function updateUserClass(userId, class_name) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/class`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ class_name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to update user class: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating user class:', error);
    throw error;
  }
}

/**
 * Delete a user (admin only)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteUser(userId) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to delete user: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
}

/**
 * Sticker redeem overview (admin): all students with balances.
 * @returns {Promise<{ students: Array }>}
 */
export async function fetchStickerRedeemOverview() {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/admin/sticker-redeem/overview`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không tải được danh sách.');
  }

  return response.json();
}

/**
 * @param {string} studentId
 */
export async function fetchStickerRedeemHistory(studentId) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(
    `${API_BASE_URL}/admin/sticker-redeem/history/${encodeURIComponent(studentId)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không tải được lịch sử.');
  }

  return response.json();
}

/**
 * @param {{ student_id: string, sticker_cost: number, gift_summary: string }} body
 */
export async function createStickerRedemption(body) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/admin/sticker-redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không ghi nhận được.');
  }

  return response.json();
}

/**
 * @returns {Promise<Array<{ class_name: string, teachers: Array<{ id: string, username: string, name: string }> }>>}
 */
export async function fetchClassTeacherMappings() {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/admin/class-teachers`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không tải được gán giáo viên.');
  }

  const data = await response.json();
  return data.classes;
}

/**
 * @param {string} class_name
 * @param {string[]} teacher_ids
 */
export async function putClassTeachers(class_name, teacher_ids) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/admin/class-teachers`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ class_name, teacher_ids }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không lưu được gán giáo viên.');
  }

  return response.json();
}

export async function fetchStats() {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/admin/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Failed to fetch stats: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}

/** @returns {Promise<Array>} */
export async function fetchTeacherInviteCodes() {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/admin/teacher-invite-codes`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không tải được mã đăng ký giáo viên.');
  }

  const data = await response.json();
  return data.codes || [];
}

/**
 * @param {{ max_uses?: number, expires_in_days?: number }} [opts]
 */
export async function createTeacherInviteCode(opts = {}) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(`${API_BASE_URL}/admin/teacher-invite-codes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({
      max_uses: opts.max_uses,
      expires_in_days: opts.expires_in_days,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không tạo được mã.');
  }

  return response.json();
}

export async function revokeTeacherInviteCode(id) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');

  const response = await fetch(
    `${API_BASE_URL}/admin/teacher-invite-codes/${encodeURIComponent(id)}/revoke`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thu hồi được mã.');
  }

  return response.json();
}
