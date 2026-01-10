/**
 * API service for admin operations
 */

import { getAuthHeader } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
 * Get system statistics (admin only)
 * @returns {Promise<Object>} Statistics object
 */
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
