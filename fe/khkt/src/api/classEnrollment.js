/**
 * Mã đăng ký lớp (Google Classroom–style): xem / đổi mã.
 */

import { getAuthHeader } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchClassEnrollmentItems() {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}/class-enrollment`, {
    headers: { Authorization: authHeader },
    cache: 'no-store',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Không tải được mã lớp');
  }
  const data = await response.json();
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * @param {string} class_name
 * @returns {Promise<{ class_name: string, enrollment_code: string }>}
 */
export async function rotateClassEnrollmentCode(class_name) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}/class-enrollment/rotate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ class_name }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Không đổi được mã');
  }
  return response.json();
}
