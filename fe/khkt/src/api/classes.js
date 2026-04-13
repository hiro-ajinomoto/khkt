/**
 * Danh sách lớp (đăng ký, gán bài, v.v.)
 */

import { getAuthHeader } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Nhóm tên lớp theo khối (6A1 → Khối 6) để hiển thị trong modal gán bài.
 * @param {string[]} classNames
 * @returns {Array<[string, string[]]>}
 */
export function groupClassesByGrade(classNames) {
  const sorted = [...classNames].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );
  const map = new Map();
  for (const c of sorted) {
    const m = c.match(/^(\d+)/);
    const label = m ? `Khối ${m[1]}` : 'Khác';
    if (!map.has(label)) map.set(label, []);
    map.get(label).push(c);
  }
  return Array.from(map.entries());
}

/** Công khai — không cần đăng nhập */
export async function fetchSchoolClasses() {
  const response = await fetch(`${API_BASE_URL}/auth/classes`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Không thể tải danh sách lớp`);
  }
  const data = await response.json();
  return Array.isArray(data.classes) ? data.classes : [];
}

/** Admin — thêm lớp */
export async function createSchoolClass(name) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}/admin/classes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể thêm lớp');
  }
  const data = await response.json();
  return Array.isArray(data.classes) ? data.classes : [];
}

/** Admin — xóa lớp */
export async function deleteSchoolClass(name) {
  const authHeader = getAuthHeader();
  if (!authHeader) throw new Error('Authentication required');
  const q = new URLSearchParams({ name });
  const response = await fetch(`${API_BASE_URL}/admin/classes?${q}`, {
    method: 'DELETE',
    headers: {
      Authorization: authHeader,
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể xóa lớp');
  }
  const data = await response.json();
  return Array.isArray(data.classes) ? data.classes : [];
}
