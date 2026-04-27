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

export async function fetchNotifications({ limit = 20, unreadOnly = false } = {}) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Authentication required');

    const qs = new URLSearchParams({ limit: String(limit) });
    if (unreadOnly) qs.set('unread_only', 'true');

    const response = await fetch(`${API_BASE_URL}/notifications?${qs}`, {
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
        describeApiFailure(response, errorData, 'Không tải được thông báo.'),
      );
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching notifications:', error);
    rethrowNetwork(error);
  }
}

export async function markNotificationRead(id) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không cập nhật được thông báo.'),
      );
    }

    return response.json();
  } catch (error) {
    console.error('Error marking notification read:', error);
    rethrowNetwork(error);
  }
}

export async function markAllNotificationsRead() {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) throw new Error('Authentication required');

    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không cập nhật được thông báo.'),
      );
    }

    return response.json();
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    rethrowNetwork(error);
  }
}
