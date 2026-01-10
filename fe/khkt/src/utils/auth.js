/**
 * Utility functions for authentication
 */

const TOKEN_KEY = 'khkt_auth_token';

/**
 * Get auth token from localStorage
 * @returns {string|null} JWT token or null
 */
export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Get authorization header value
 * @returns {string|null} Authorization header value or null
 */
export function getAuthHeader() {
  const token = getAuthToken();
  return token ? `Bearer ${token}` : null;
}
