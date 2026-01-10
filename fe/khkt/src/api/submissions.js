/**
 * API service for submissions
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Create a new submission
 * @param {string} assignmentId - Assignment ID
 * @param {File[]} files - Array of image files
 * @returns {Promise<Object>} Submission object
 */
export async function createSubmission(assignmentId, files) {
  try {
    const formData = new FormData();
    formData.append('assignment_id', assignmentId);
    
    // Append all files
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/submissions`, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `Failed to create submission: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating submission:', error);
    throw error;
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
      throw new Error(`Failed to fetch submission: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching submission:', error);
    throw error;
  }
}
