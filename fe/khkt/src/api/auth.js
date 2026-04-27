/**
 * API service for authentication
 */

import { parseApiDetail, toVietnameseAuthMessage } from '../utils/authErrors';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function throwAuthHttpError(status, errorData, fallbackLabel) {
  const raw = parseApiDetail(errorData?.detail) || fallbackLabel || `Lỗi ${status}`;
  throw new Error(toVietnameseAuthMessage(raw));
}

/**
 * Login with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} { token, user }
 */
export async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throwAuthHttpError(response.status, errorData, response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

/**
 * Register a new user
 * @param {string} username - Username
 * @param {string} password - Password
 * @param {string} role - Role ('teacher' or 'student')
 * @param {string} name - Display name (optional)
 * @param {string} class_code - Mã lớp 4 chữ số (đăng ký học sinh)
 * @returns {Promise<Object>} { token, user }
 */
export async function register(username, password, role = 'student', name = null, class_code = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, role, name, class_code }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throwAuthHttpError(response.status, errorData, response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error registering:', error);
    throw error;
  }
}

/**
 * Get current user info (requires authentication)
 * @param {string} token - JWT token
 * @returns {Promise<Object>} User object
 */
export async function getCurrentUser(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throwAuthHttpError(response.status, errorData, response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting current user:', error);
    throw error;
  }
}

/**
 * Initialize default admin account (for first-time setup)
 * @param {string} username - Username (optional, defaults to 'admin')
 * @param {string} password - Password (optional, defaults to 'admin123')
 * @returns {Promise<Object>} Init result
 */
export async function initAdmin(username = 'admin', password = 'admin123') {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throwAuthHttpError(response.status, errorData, response.statusText);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error initializing admin:', error);
    throw error;
  }
}
