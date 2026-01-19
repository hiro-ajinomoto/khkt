import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMySubmissions } from '../../api/submissions';
import SubmissionResult from './SubmissionResult';
import './MySubmissions.css';

function MySubmissions() {
  const navigate = useNavigate();
  const { isAuthenticated, isStudent, user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !isStudent) {
      navigate('/');
      return;
    }
    loadSubmissions();
  }, [isAuthenticated, isStudent, navigate]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMySubmissions();
      setSubmissions(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách bài nộp');
      console.error('Error loading submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getScoreColor = (score) => {
    if (score >= 8) return '#4caf50'; // Green
    if (score >= 6) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  if (loading) {
    return (
      <div className="my-submissions-container">
        <div className="loading">Đang tải danh sách bài nộp...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-submissions-container">
        <div className="error-message">
          {error}
          <button onClick={loadSubmissions} className="retry-button">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-submissions-container">
      <div className="my-submissions-header">
        <div className="header-top">
          <button onClick={() => navigate('/assignments')} className="back-button">
            ← Quay lại
          </button>
        </div>
        <h1>Bài tập đã nộp</h1>
        <p>Xem lại các bài tập bạn đã nộp và kết quả chấm điểm</p>
      </div>

      {submissions.length === 0 ? (
        <div className="empty-state">
          <p>Bạn chưa nộp bài tập nào.</p>
          <button onClick={() => navigate('/assignments')} className="go-to-assignments-button">
            Xem bài tập
          </button>
        </div>
      ) : (
        <>
          <div className="submissions-stats">
            <div className="stat-item">
              <span className="stat-label">Tổng số bài nộp:</span>
              <span className="stat-value">{submissions.length}</span>
            </div>
            {submissions.some((s) => s.ai_result?.score !== undefined) && (
              <div className="stat-item">
                <span className="stat-label">Điểm trung bình:</span>
                <span className="stat-value">
                  {(
                    submissions
                      .filter((s) => s.ai_result?.score !== undefined)
                      .reduce((sum, s) => sum + (s.ai_result?.score || 0), 0) /
                    submissions.filter((s) => s.ai_result?.score !== undefined).length
                  ).toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="submissions-list">
            {submissions.map((submission) => (
              <div key={submission.id} className="submission-card">
                <div className="submission-card-header">
                  <div className="submission-info">
                    <h3>{submission.assignment_title || 'Bài tập không xác định'}</h3>
                    <p className="submission-date">{formatDate(submission.created_at)}</p>
                  </div>
                  {submission.ai_result?.score !== undefined && (
                    <div
                      className="submission-score"
                      style={{ color: getScoreColor(submission.ai_result.score) }}
                    >
                      {submission.ai_result.score}/10
                    </div>
                  )}
                </div>

                <div className="submission-card-actions">
                  <button
                    onClick={() =>
                      setSelectedSubmission(
                        selectedSubmission?.id === submission.id ? null : submission
                      )
                    }
                    className="view-details-button"
                  >
                    {selectedSubmission?.id === submission.id
                      ? 'Ẩn chi tiết'
                      : 'Xem chi tiết'}
                  </button>
                  <button
                    onClick={() => navigate(`/assignments/${submission.assignment_id}`)}
                    className="view-assignment-button"
                  >
                    Xem bài tập
                  </button>
                </div>

                {selectedSubmission?.id === submission.id && (
                  <div className="submission-details">
                    <SubmissionResult submission={submission} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default MySubmissions;
