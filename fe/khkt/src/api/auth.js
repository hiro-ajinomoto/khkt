/**
 * API service for authentication
 */

import { parseApiErrorPayload, toVietnameseAuthMessage } from '../utils/authErrors';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function throwAuthHttpError(status, errorData, fallbackLabel) {
  let raw = parseApiErrorPayload(errorData, status, fallbackLabel);
  if (!String(raw).trim()) raw = `Lỗi ${status}`;
  throw new Error(toVietnameseAuthMessage(raw));
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!response.ok) {
    let errorData = {};
    if (text) {
      try {
        errorData = JSON.parse(text);
      } catch {
        const snippet = text.trim().slice(0, 600);
        errorData = { detail: snippet || undefined };
      }
    }
    throwAuthHttpError(response.status, errorData, response.statusText);
  }
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(toVietnameseAuthMessage('Phản hồi máy chủ không hợp lệ.'));
  }
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

    const data = await readJsonResponse(response);
    return data;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

/**
 * Register a new user (public).
 * @param {{ username: string, password: string, name?: string | null, class_code?: string | null, teacher_invite_code?: string | null }} body
 * @returns {Promise<Object>} { token, user }
 */
export async function register({ username, password, name = null, class_code = null, teacher_invite_code = null }) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        name,
        class_code,
        teacher_invite_code,
      }),
    });

    const data = await readJsonResponse(response);
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

    const data = await readJsonResponse(response);
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

    const data = await readJsonResponse(response);
    return data;
  } catch (error) {
    console.error('Error initializing admin:', error);
    throw error;
  }
}
