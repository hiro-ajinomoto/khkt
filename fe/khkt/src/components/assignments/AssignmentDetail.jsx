import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchAssignmentById } from '../../api/assignments';
import { createSubmission } from '../../api/submissions';
import { refreshStudentStickers } from '../submissions/studentStickersEvents';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatVNDateFromYMD,
  isPastDueClient,
  deadlineReminderClient,
} from '../../utils/assignmentRelease';
import {
  formatSubmissionQuota,
  isAtSubmissionLimit,
  resolveMaxSubmissionsClient,
} from '../../utils/submissionLimits';
import SubmissionResult from '../submissions/SubmissionResult';
import OceanShell, { OceanPageLoading } from '../layout/OceanShell';
import ImageLightbox from '../ui/ImageLightbox';
import ImageCropModal from '../ui/ImageCropModal';
import './AssignmentDetail.css';

function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isStudent, isTeacher, refreshUser } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignmentError, setAssignmentError] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [error, setError] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [imageLightbox, setImageLightbox] = useState(null);
  /** Hàng chờ crop sau khi HS chọn file: { queue, results } — mỗi ảnh qua modal một lượt. */
  const [cropSession, setCropSession] = useState(null);

  const closeImageLightbox = () => setImageLightbox(null);

  const loadAssignment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setAssignmentError(null);
      const data = await fetchAssignmentById(id);
      setAssignment(data);
    } catch (err) {
      setAssignmentError(err.message || 'Không thể tải bài tập');
      console.error('Error loading assignment:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAssignment();
  }, [loadAssignment]);

  // Cleanup preview URLs when component unmounts or files change
  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [previewUrls]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith('image/'),
    );
    e.target.value = '';
    if (files.length === 0) {
      setError('Vui lòng chỉ chọn file ảnh.');
      return;
    }
    setError(null);
    previewUrls.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    setSelectedFiles([]);
    setPreviewUrls([]);
    setCropSession({ queue: files, results: [] });
  };

  const flushCroppedSelection = (finalFiles) => {
    setCropSession(null);
    setSelectedFiles(finalFiles);
    setPreviewUrls(finalFiles.map((f) => URL.createObjectURL(f)));
  };

  const handleCropConfirm = (croppedFile) => {
    setCropSession((prev) => {
      if (!prev) return null;
      const [, ...rest] = prev.queue;
      const results = [...prev.results, croppedFile];
      if (rest.length === 0) {
        queueMicrotask(() => flushCroppedSelection(results));
        return null;
      }
      return { queue: rest, results };
    });
  };

  const handleCropUseOriginal = () => {
    setCropSession((prev) => {
      if (!prev) return null;
      const [first, ...rest] = prev.queue;
      const results = [...prev.results, first];
      if (rest.length === 0) {
        queueMicrotask(() => flushCroppedSelection(results));
        return null;
      }
      return { queue: rest, results };
    });
  };

  const handleCropAbort = () => {
    setCropSession(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (submissionBlocked) {
      if (
        isStudent &&
        assignment?.due_date &&
        isPastDueClient(assignment.due_date)
      ) {
        setError('Đã quá hạn nộp bài.');
      } else if (isStudent && isAtSubmissionLimit(assignment)) {
        setError('Bạn đã nộp đủ số lần cho phép với bài này.');
      }
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Vui lòng chọn ít nhất một hình ảnh bài làm');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const result = await createSubmission(assignment.id, selectedFiles);
      setSubmission(result);
      setShowResult(true);
      refreshStudentStickers();
      if (isStudent && refreshUser) {
        await refreshUser();
      }

      await loadAssignment();

      // Cleanup preview URLs
      previewUrls.forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });

      // Clear selected files and preview URLs after successful submission
      setSelectedFiles([]);
      setPreviewUrls([]);
    } catch (err) {
      setError(err.message || 'Không thể nộp bài. Vui lòng thử lại.');
      console.error('Error submitting:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pastDueBlocked =
    isStudent &&
    assignment?.due_date &&
    isPastDueClient(assignment.due_date);
  const limitBlocked = isStudent && isAtSubmissionLimit(assignment);
  const submissionBlocked = pastDueBlocked || limitBlocked;

  const deadlineHint =
    assignment?.due_date && deadlineReminderClient(assignment.due_date);

  /** HS chỉ được xem đáp án mẫu sau khi đã nộp (đối chiếu bài làm); GV/Admin xem luôn. */
  const studentCanSeeModelSolution =
    !isStudent || (assignment?.my_submission_count ?? 0) > 0;

  const modelSolutionUrls =
    assignment?.model_solution_image_urls?.length > 0
      ? assignment.model_solution_image_urls
      : assignment?.model_solution_image_url
        ? [assignment.model_solution_image_url]
        : [];

  const assignmentModelForSubmissionResult =
    assignment &&
    ({
      question_image_url: assignment.question_image_url,
      ...(studentCanSeeModelSolution || !isStudent
        ? {
            model_solution: assignment.model_solution,
            model_solution_image_url: assignment.model_solution_image_url,
            ...(modelSolutionUrls.length > 0
              ? { model_solution_image_urls: modelSolutionUrls }
              : {}),
          }
        : {}),
    });

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

  if (loading) {
    return <OceanPageLoading message="Đang tải bài tập..." />;
  }

  if (assignmentError || !assignment) {
    return (
      <OceanShell>
        <div className="assignment-detail">
          <button type="button" onClick={() => navigate('/assignments')} className="back-button">
            ← Quay lại danh sách
          </button>
          <div className="error-message">{assignmentError || 'Không tìm thấy bài tập'}</div>
        </div>
      </OceanShell>
    );
  }

  return (
    <OceanShell>
      <div className="assignment-detail">
      <button type="button" onClick={() => navigate('/assignments')} className="back-button">
        ← Quay lại danh sách
      </button>

      <div className="detail-header">
        <p className="ocean-page-eyebrow">Cuộc thi khoa học kỹ thuật</p>
        <h1>{assignment.title}</h1>
        {assignment.description && (
          <p className="assignment-description">{assignment.description}</p>
        )}
        <div className="assignment-meta">
          <span className="meta-badge subject">
            #
            {String(assignment.subject || 'math')
              .replace(/^#/, '')
              .trim()
              .toLowerCase()}
          </span>
          {assignment.grade_level && (
            <span className="meta-badge grade">#{assignment.grade_level}</span>
          )}
          <span className="meta-badge date">
            {formatDate(assignment.created_at)}
          </span>
          {assignment.due_date && (
            <span className="meta-badge due">
              Hạn nộp: {formatVNDateFromYMD(assignment.due_date)}
            </span>
          )}
          {isStudent && deadlineHint && (
            <span
              className={`meta-badge deadline-reminder deadline-reminder--${deadlineHint.tone}`}
            >
              {deadlineHint.label}
            </span>
          )}
          {isStudent && formatSubmissionQuota(assignment) && (
            <span className="meta-badge quota" title="Số lần nộp của bạn với bài này">
              {formatSubmissionQuota(assignment)}
            </span>
          )}
          {isTeacher && (
            <span className="meta-badge quota">
              {Number.isFinite(resolveMaxSubmissionsClient(assignment))
                ? `Tối đa ${resolveMaxSubmissionsClient(assignment)} lần nộp/HS`
                : 'Không giới hạn số lần nộp'}
            </span>
          )}
        </div>
      </div>

      {/* Assignment Images */}
      <div className="assignment-images-section">
        {assignment.question_image_url && (
          <div className="image-container">
            <label>Hình ảnh câu hỏi:</label>
            <button
              type="button"
              className="assignment-image-enlarge"
              onClick={() =>
                setImageLightbox({
                  src: assignment.question_image_url,
                  title: 'Hình ảnh câu hỏi',
                })
              }
              aria-label="Xem phóng to hình ảnh câu hỏi (xoay, zoom)"
            >
              <img
                src={assignment.question_image_url}
                alt="Câu hỏi"
                className="assignment-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const errorDiv = e.target.nextSibling;
                  if (errorDiv) {
                    errorDiv.style.display = 'block';
                  }
                }}
              />
              <div className="image-error" style={{ display: 'none' }}>
                Không thể tải hình ảnh
              </div>
            </button>
            <p className="assignment-image-hint">Bấm vào ảnh để xoay / phóng to.</p>
          </div>
        )}

        {isStudent && !studentCanSeeModelSolution &&
          (modelSolutionUrls.length > 0 || assignment.model_solution) && (
          <div className="model-solution-text model-solution-text--locked" role="note">
            <label>Đáp án mẫu</label>
            <p>
              Sau khi bạn nộp bài, bạn xem bài giải mẫu (kể cả hình ảnh, nếu có) trong phần kết quả
              chấm để đối chiếu. Nếu có lời giải dạng chữ, bạn cũng có thể xem thêm khi quay lại trang
              bài tập này.
            </p>
          </div>
        )}

        {assignment.model_solution && studentCanSeeModelSolution && (
          <div className="model-solution-text">
            <label>Bài giải mẫu:</label>
            <p>{assignment.model_solution}</p>
          </div>
        )}

        {modelSolutionUrls.length > 0 && studentCanSeeModelSolution && (
          <div className="image-container">
            <label>Hình ảnh bài giải mẫu ({modelSolutionUrls.length} ảnh)</label>
            <div className="assignment-model-images-row">
              {modelSolutionUrls.map((imgUrl, idx) => (
                <div key={`model-sol-${idx}`} className="assignment-model-image-item">
                  <button
                    type="button"
                    className="assignment-image-enlarge"
                    onClick={() =>
                      setImageLightbox({
                        src: imgUrl,
                        title: `Bài giải mẫu — ảnh ${idx + 1}`,
                      })
                    }
                    aria-label="Xem phóng to"
                  >
                    <img
                      src={imgUrl}
                      alt=""
                      className="assignment-image"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        const errorDiv = e.target.nextSibling;
                        if (errorDiv) errorDiv.style.display = 'block';
                      }}
                    />
                    <div className="image-error" style={{ display: 'none' }}>
                      Không thể tải hình ảnh
                    </div>
                  </button>
                  <p className="assignment-image-hint">Ảnh {idx + 1} — bấm để xoay / phóng to.</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Submission Form */}
      <div className="submission-section">
        <h2>Nộp bài làm</h2>
        {isStudent && pastDueBlocked && (
          <div className="deadline-passed-banner" role="alert">
            Đã quá hạn nộp bài (hạn{' '}
            {formatVNDateFromYMD(assignment.due_date)}). Bạn vẫn xem được đề
            nhưng không thể nộp thêm trên hệ thống.
          </div>
        )}
        {isStudent && limitBlocked && !pastDueBlocked && (
          <div className="deadline-passed-banner submission-limit-banner" role="alert">
            Bạn đã nộp đủ số lần cho phép với bài này. Không thể nộp thêm để
            giảm tải hệ thống; nếu cần hỗ trợ, hãy báo giáo viên.
          </div>
        )}
        <form onSubmit={handleSubmit} className="submission-form">
          <div className="file-upload-area">
            <label htmlFor="file-input" className="file-label">
              <span className="file-label-text">
                {cropSession
                  ? `Đang cắt ảnh… (${cropSession.results.length + 1}/${cropSession.results.length + cropSession.queue.length})`
                  : selectedFiles.length > 0
                    ? `${selectedFiles.length} ảnh đã chọn (sau khi cắt)`
                    : 'Chọn hình ảnh bài làm — sẽ cắt từng ảnh trước khi nộp'}
              </span>
              <input
                id="file-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                disabled={
                  isSubmitting || submissionBlocked || !!cropSession
                }
                className="file-input"
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="selected-files-section">
                <h3 className="preview-title">
                  Hình ảnh đã chọn ({selectedFiles.length})
                </h3>
                <div className="preview-images">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="preview-item">
                      <div className="preview-image-wrapper">
                        <img
                          src={previewUrls[index]}
                          alt={`Preview ${index + 1}`}
                          className="preview-image preview-image--zoomable"
                          role="presentation"
                          onClick={() =>
                            setImageLightbox({
                              src: previewUrls[index],
                              title: `Ảnh xem trước ${index + 1}`,
                            })
                          }
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const errorDiv = e.target.nextSibling;
                            if (errorDiv) {
                              errorDiv.style.display = 'flex';
                            }
                          }}
                        />
                        <div className="preview-error" style={{ display: 'none' }}>
                          Không thể hiển thị hình ảnh
                        </div>
                      </div>
                      <div className="preview-info">
                        <span className="file-name" title={file.name}>
                          {file.name}
                        </span>
                        <span className="file-size">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            disabled={
              isSubmitting ||
              selectedFiles.length === 0 ||
              submissionBlocked ||
              !!cropSession
            }
            className="submit-button"
          >
            {isSubmitting ? (
              <>
                <span className="spinner"></span>
                Đang chấm bài...
              </>
            ) : (
              'Nộp bài'
            )}
          </button>
        </form>
      </div>

      {/* Submission Result */}
      {submission && (
        <div className="submission-result-section">
          <div className="result-header">
            <h2>Kết quả chấm bài</h2>
            <button
              onClick={() => setShowResult(!showResult)}
              className="toggle-result-button"
            >
              {showResult ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            </button>
          </div>

          {submission.stickers && (
            <div className="submission-sticker-earned" role="status">
              <p className="submission-sticker-earned-title">
                Huy hiệu (theo lần nộp đầu đã chấm)
              </p>
              <div className="submission-sticker-earned-row">
                <span className="submission-sticker-chip submission-sticker-chip--done">
                  <span aria-hidden>{'\uD83C\uDF38'}</span> Hoàn thành
                </span>
                <span className="submission-sticker-chip">
                  <span aria-hidden>{submission.stickers.tier?.emoji}</span>{' '}
                  {submission.stickers.tier?.label}
                </span>
                {submission.stickers.attempt_number > 1 && (
                  <span className="submission-sticker-attempt">
                    Lần nộp thứ {submission.stickers.attempt_number}
                  </span>
                )}
              </div>
              {submission.stickers.note && (
                <p className="submission-sticker-note">{submission.stickers.note}</p>
              )}
            </div>
          )}

          {showResult && (
            <SubmissionResult
              submission={submission}
              assignmentModel={assignmentModelForSubmissionResult || null}
            />
          )}
        </div>
      )}
      </div>

      <ImageLightbox
        open={Boolean(imageLightbox?.src)}
        onClose={closeImageLightbox}
        src={imageLightbox?.src}
        title={imageLightbox?.title}
      />
      {cropSession?.queue?.length ? (
        <ImageCropModal
          file={cropSession.queue[0]}
          indexOneBased={cropSession.results.length + 1}
          total={cropSession.results.length + cropSession.queue.length}
          onConfirm={handleCropConfirm}
          onUseOriginal={handleCropUseOriginal}
          onAbort={handleCropAbort}
        />
      ) : null}
    </OceanShell>
  );
}

export default AssignmentDetail;
