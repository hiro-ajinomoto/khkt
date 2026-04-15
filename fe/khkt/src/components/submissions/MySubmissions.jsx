import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMySubmissions, fetchMyStickers } from '../../api/submissions';
import SubmissionResult from './SubmissionResult';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import './MySubmissions.css';

function MySubmissions() {
  const navigate = useNavigate();
  const { isAuthenticated, isStudent } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [stickerStats, setStickerStats] = useState(null);
  const [stickersError, setStickersError] = useState(null);
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
      setStickersError(null);
      const data = await fetchMySubmissions();
      setSubmissions(data);
      try {
        const stickers = await fetchMyStickers();
        setStickerStats(stickers);
      } catch (err) {
        setStickersError(err.message || 'Không tải được huy hiệu');
        setStickerStats(null);
      }
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
    if (score >= 8) return '#10b981';
    if (score >= 6) return '#d97706';
    return '#dc2626';
  };

  if (loading) {
    return <OceanPageLoading message="Đang tải danh sách bài nộp..." />;
  }

  if (error) {
    return (
      <OceanPageError message={error} onRetry={loadSubmissions} retryLabel="Thử lại" />
    );
  }

  return (
    <OceanShell>
    <div className="my-submissions-container">
      <div className="my-submissions-header">
        <div className="header-top">
          <button type="button" onClick={() => navigate('/assignments')} className="back-button">
            ← Quay lại
          </button>
        </div>
        <p className="ocean-page-eyebrow">Cuộc thi khoa học kỹ thuật</p>
        <h1>Bài tập đã nộp</h1>
        <p>Xem lại các bài tập bạn đã nộp và kết quả chấm điểm</p>
      </div>

      {stickerStats && (
        <section className="sticker-summary-card" aria-label="Huy hiệu sticker">
          <div className="sticker-summary-head">
            <h2 className="sticker-summary-title">Huy hiệu của bạn</h2>
            {stickerStats.assignments_with_grade > 0 ? (
              <p className="sticker-summary-total">
                Tổng:{' '}
                <strong>{stickerStats.total_sticker_count}</strong> sticker
                <span className="sticker-summary-sub">
                  ({stickerStats.completion_stickers} hoàn thành +{' '}
                  {stickerStats.tier_stickers_total} mức điểm lần đầu chấm)
                </span>
              </p>
            ) : (
              <p className="sticker-summary-empty">
                Chưa có huy hiệu. Nộp bài và được chấm xong để nhận sticker hoàn thành và
                theo mức điểm.
              </p>
            )}
          </div>
          {stickerStats.assignments_with_grade > 0 && (
            <>
              <ul className="sticker-tier-list">
                <li className="sticker-tier-item sticker-tier-item--completion">
                  <span className="sticker-tier-emoji" aria-hidden>
                    {stickerStats.completion_emoji || '\uD83C\uDF38'}
                  </span>
                  <span className="sticker-tier-label">Hoàn thành bài</span>
                  <span className="sticker-tier-count">{stickerStats.completion_stickers}</span>
                </li>
                {Object.values(stickerStats.by_tier_detail || {}).map((row) => (
                  <li key={row.code} className="sticker-tier-item">
                    <span className="sticker-tier-emoji" aria-hidden>
                      {row.emoji}
                    </span>
                    <span className="sticker-tier-label">{row.label}</span>
                    <span className="sticker-tier-count">{row.count}</span>
                  </li>
                ))}
              </ul>
              {stickerStats.explanation && (
                <p className="sticker-summary-hint">{stickerStats.explanation}</p>
              )}
            </>
          )}
        </section>
      )}

      {stickersError && (
        <p className="sticker-load-hint" role="status">
          {stickersError}
        </p>
      )}

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
    </OceanShell>
  );
}

export default MySubmissions;
