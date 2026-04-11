/**
 * API service for submissions
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
 * Create a new submission
 * @param {string} assignmentId - Assignment ID
 * @param {File[]} files - Array of image files
 * @returns {Promise<Object>} Submission object
 */
export async function createSubmission(assignmentId, files) {
  try {
    const authHeader = getAuthHeader();
    
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const formData = new FormData();
    formData.append('assignment_id', assignmentId);
    
    // Append all files
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/submissions`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        // Don't set Content-Type header - browser will set it with boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không nộp được bài.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating submission:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch submission by ID
 * @param {string} id - Submission ID
 * @returns {Promise<Object>} Submission object
 */
export async function fetchSubmissionById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/submissions/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được bài nộp.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching submission:', error);
    rethrowNetwork(error);
  }
}

/**
 * Fetch all submissions of the authenticated student
 * @returns {Promise<Array>} Array of submission objects
 */
export async function fetchMySubmissions() {
  try {
    const authHeader = getAuthHeader();
    
    if (!authHeader) {
      throw new Error('Authentication required');
    }

    const response = await fetch(`${API_BASE_URL}/submissions/my-submissions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        describeApiFailure(response, errorData, 'Không tải được danh sách bài nộp.')
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching my submissions:', error);
    rethrowNetwork(error);
  }
}
