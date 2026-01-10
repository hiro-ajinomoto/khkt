/**
 * API service for authentication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
      throw new Error(errorData.detail || `Login failed: ${response.statusText}`);
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
 * @param {string} class_name - Class name for students (optional, e.g., '8A1', '8A2')
 * @returns {Promise<Object>} { token, user }
 */
export async function register(username, password, role = 'student', name = null, class_name = null) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, role, name, class_name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Registration failed: ${response.statusText}`);
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
      throw new Error(errorData.detail || `Failed to get user: ${response.statusText}`);
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
      throw new Error(errorData.detail || `Init failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error initializing admin:', error);
    throw error;
  }
}
