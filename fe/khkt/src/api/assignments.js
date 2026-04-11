/**
 * API service for assignments
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
 * Fetch all assignments
 * @returns {Promise<Array>} List of assignments
 */
export async function fetchAssignments() {
  try {
    const authHeader = getAuthHeader();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/assignments`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được danh sách bài tập.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching assignments:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch assignment by ID
 * @param {string} id - Assignment ID
 * @returns {Promise<Object>} Assignment object
 */
export async function fetchAssignmentById(id) {
  try {
    const authHeader = getAuthHeader();
    const headers = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được bài tập.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching assignment:', error);
    rethrowNetwork(error);
  }
}

/**
 * Delete assignment by ID
 * @param {string} id - Assignment ID
 * @returns {Promise<Object>} Delete result
 */
export async function deleteAssignment(id) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    const authHeader = getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không xóa được bài tập.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting assignment:', error);
    rethrowNetwork(error);
  }
}

/**
 * Delete multiple assignments
 * @param {Array<string>} ids - Array of assignment IDs
 * @returns {Promise<Object>} Delete result
 */
export async function deleteAssignments(ids) {
  try {
    const headers = {
      'Content-Type': 'application/json',
    };
    const authHeader = getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/assignments`, {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không xóa được các bài tập.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error deleting assignments:', error);
    rethrowNetwork(error);
  }
}

/**
 * Create a new assignment
 * @param {FormData} formData - Form data containing assignment details
 * @returns {Promise<Object>} Created assignment object
 */
export async function createAssignment(formData) {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
    const headers = {};
    const authHeader = getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/assignments`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tạo được bài tập.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating assignment:', error);
    rethrowNetwork(error);
  }
}

/**
 * Update an existing assignment
 * @param {string} id - Assignment ID
 * @param {FormData} formData - Form data containing assignment details to update
 * @returns {Promise<Object>} Updated assignment object
 */
export async function updateAssignment(id, formData) {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
    const headers = {};
    const authHeader = getAuthHeader();
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${API_BASE_URL}/assignments/${id}`, {
      method: 'PATCH',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không cập nhật được bài tập.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating assignment:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch assignments by date
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Array>} List of assignments
 */
export async function fetchAssignmentsByDate(date) {
  try {
    const response = await fetch(`${API_BASE_URL}/assignments/by-date?date=${date}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được bài theo ngày.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching assignments by date:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch assignments by month
 * @param {number} year - Year (YYYY)
 * @param {number} month - Month (1-12)
 * @returns {Promise<Array>} List of assignments
 */
/**
 * Assign assignment to classes
 * @param {string} assignmentId - Assignment ID
 * @param {Array<string>} classNames - Array of class names (e.g., ["8A1", "8A2"])
 * @returns {Promise<Object>} Assignment result
 */
export async function assignAssignmentToClasses(assignmentId, classNames) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ class_names: classNames }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không gán được bài cho lớp.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error assigning assignment to classes:', error);
    rethrowNetwork(error);
  }
}

/**
 * Gán cùng một danh sách lớp cho nhiều bài tập (gọi API tuần tự).
 * @param {string[]} assignmentIds
 * @param {string[]} classNames
 */
export async function assignAssignmentsToClasses(assignmentIds, classNames) {
  for (const assignmentId of assignmentIds) {
    await assignAssignmentToClasses(assignmentId, classNames);
  }
}

/**
 * Get list of classes that an assignment is assigned to
 * @param {string} assignmentId - Assignment ID
 * @returns {Promise<Array>} List of classes
 */
export async function getAssignmentClasses(assignmentId) {
  try {
    const authHeader = getAuthHeader();
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/assignments/${assignmentId}/classes`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được danh sách lớp.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching assignment classes:', error);
    rethrowNetwork(error);
  }
}

export async function fetchAssignmentsByMonth(year, month) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/assignments/by-month?year=${year}&month=${month}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được bài theo tháng.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching assignments by month:', error);
    rethrowNetwork(error);
  }
}
