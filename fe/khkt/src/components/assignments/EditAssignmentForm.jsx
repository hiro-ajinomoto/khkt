import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchAssignmentById, updateAssignment } from '../../api/assignments';
import OceanShell, { OceanPageLoading } from '../layout/OceanShell';
import './CreateAssignmentForm.css';

const GRADE_LEVELS = [
  'Lớp 6',
  'Lớp 7',
  'Lớp 8',
  'Lớp 9',
  'Lớp 10',
  'Lớp 11',
  'Lớp 12',
];

function EditAssignmentForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    grade_level: '',
    available_from_date: '',
    due_date: '',
    max_submissions_per_student: '2',
    question_image: null,
    model_solution_images: [],
    question_image_url: '',
    model_solution_image_url: '',
  });

  const initialModelSolutionUrlRef = useRef(null);

  const [previewUrls, setPreviewUrls] = useState({
    question: null,
    solutions: [],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load assignment data
  useEffect(() => {
    const loadAssignment = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const assignment = await fetchAssignmentById(id);
        
        const solList =
          Array.isArray(assignment.model_solution_image_urls) &&
          assignment.model_solution_image_urls.length > 0
            ? assignment.model_solution_image_urls
            : assignment.model_solution_image_url
              ? [assignment.model_solution_image_url]
              : [];

        setFormData({
          title: assignment.title || '',
          description: assignment.description || '',
          grade_level: assignment.grade_level || '',
          available_from_date: assignment.available_from_date || '',
          due_date: assignment.due_date || '',
          max_submissions_per_student: String(
            assignment.max_submissions_per_student ?? 2
          ),
          question_image: null,
          model_solution_images: [],
          question_image_url: assignment.question_image_url || '',
          model_solution_image_url: assignment.model_solution_image_url || '',
        });

        initialModelSolutionUrlRef.current =
          assignment.model_solution_image_url || '';

        if (assignment.question_image_url) {
          setPreviewUrls((prev) => ({
            ...prev,
            question: assignment.question_image_url,
          }));
        }
        setPreviewUrls((prev) => ({
          ...prev,
          solutions: solList,
        }));
      } catch (err) {
        setError(err.message || 'Không thể tải thông tin bài tập');
        console.error('Error loading assignment:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadAssignment();
    }
  }, [id]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const revokeSolutionPreviews = () => {
    (previewUrls.solutions || []).forEach((u) => {
      if (u && u.startsWith?.('blob:')) URL.revokeObjectURL(u);
    });
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;

    if (name === 'model_solution_image') {
      const picked = Array.from(files || [])
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, 3);
      if (!picked.length) return;
      setFormData((prev) => ({
        ...prev,
        model_solution_images: picked,
        model_solution_image_url: '',
      }));
      setPreviewUrls((prev) => {
        (prev.solutions || []).forEach((u) => {
          if (u && u.startsWith?.('blob:')) URL.revokeObjectURL(u);
        });
        return {
          ...prev,
          solutions: picked.map((f) => URL.createObjectURL(f)),
        };
      });
      return;
    }

    const file = files?.[0];

    if (file) {
      setFormData((prev) => ({
        ...prev,
        [name]: file,
        [`${name}_url`]: '',
      }));

      const previewUrl = URL.createObjectURL(file);
      if (name === 'question_image') {
        setPreviewUrls((prev) => ({ ...prev, question: previewUrl }));
      }
    }
  };

  const handleUrlChange = (e) => {
    const { name, value } = e.target;
    if (name === 'model_solution_image_url') {
      revokeSolutionPreviews();
      setPreviewUrls((prev) => ({ ...prev, solutions: [] }));
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === 'question_image_url' ? { question_image: null } : {}),
      ...(name === 'model_solution_image_url' ? { model_solution_images: [] } : {}),
    }));

    if (name === 'question_image_url') {
      setPreviewUrls((prev) => ({ ...prev, question: value || null }));
    }
    if (name === 'model_solution_image_url') {
      const v = String(value || '').trim();
      setPreviewUrls((prev) => ({
        ...prev,
        solutions: v ? [v] : [],
      }));
    }

    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.title.trim()) {
      setError('Vui lòng nhập tiêu đề bài tập');
      return;
    }

    const hasQuestionImage =
      formData.question_image || formData.question_image_url;
    const hasSolutionImage =
      (formData.model_solution_images && formData.model_solution_images.length > 0) ||
      !!formData.model_solution_image_url?.trim();

    if (!hasQuestionImage) {
      setError('Vui lòng chọn hình ảnh câu hỏi hoặc nhập URL');
      return;
    }

    if (!hasSolutionImage) {
      setError('Vui lòng có ít nhất một ảnh bài giải mẫu hoặc URL');
      return;
    }

    try {
      setIsSubmitting(true);

      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      if (formData.description) {
        formDataToSend.append('description', formData.description);
      }
      if (formData.grade_level) {
        formDataToSend.append('grade_level', formData.grade_level);
      }
      formDataToSend.append(
        'available_from_date',
        formData.available_from_date || ''
      );
      formDataToSend.append('due_date', formData.due_date || '');
      formDataToSend.append(
        'max_submissions_per_student',
        formData.max_submissions_per_student ?? '2'
      );

      if (formData.question_image) {
        formDataToSend.append('question_image', formData.question_image);
      } else if (formData.question_image_url) {
        formDataToSend.append('question_image_url', formData.question_image_url);
      }

      const newModelFiles =
        formData.model_solution_images && formData.model_solution_images.length > 0;
      const urlNow =
        formData.model_solution_image_url?.trim() || '';

      if (newModelFiles) {
        formData.model_solution_images.forEach((file) =>
          formDataToSend.append('model_solution_image', file),
        );
      } else if (
        urlNow !== (initialModelSolutionUrlRef.current || '')
      ) {
        formDataToSend.append('model_solution_image_url', urlNow);
      }

      await updateAssignment(id, formDataToSend);

      // Cleanup blob previews
      if (previewUrls.question && previewUrls.question.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrls.question);
      }
      revokeSolutionPreviews();

      // Navigate back to assignment detail
      navigate(`/assignments/${id}`);
    } catch (err) {
      setError(err.message || 'Không thể cập nhật bài tập. Vui lòng thử lại.');
      console.error('Error updating assignment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (previewUrls.question && previewUrls.question.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrls.question);
    }
    revokeSolutionPreviews();

    // Navigate back to assignment detail
    navigate(`/assignments/${id}`);
  };

  if (isLoading) {
    return <OceanPageLoading message="Đang tải thông tin bài tập..." />;
  }

  return (
    <OceanShell>
    <div className="create-assignment-form-container">
      <div className="form-header">
        <div>
          <p className="ocean-page-eyebrow">Cuộc thi khoa học kỹ thuật</p>
          <h2>Sửa bài tập</h2>
        </div>
        <button onClick={handleCancel} className="cancel-button">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="assignment-form">
        {/* Title */}
        <div className="form-group">
          <label htmlFor="title">
            Tiêu đề <span className="required">*</span>
          </label>
          <input
            id="title"
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="Nhập tiêu đề bài tập"
            required
            disabled={isSubmitting}
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Mô tả</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Nhập mô tả bài tập (tùy chọn)"
            rows="3"
            disabled={isSubmitting}
          />
        </div>

        {/* Grade Level */}
        <div className="form-group">
          <label htmlFor="grade_level">Khối lớp</label>
          <select
            id="grade_level"
            name="grade_level"
            value={formData.grade_level}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="">Chọn khối lớp (tùy chọn)</option>
            {GRADE_LEVELS.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="available_from_date">
            Ngày mở bài cho học sinh
          </label>
          <input
            id="available_from_date"
            type="date"
            name="available_from_date"
            value={formData.available_from_date}
            onChange={handleInputChange}
            disabled={isSubmitting}
          />
          <p className="form-hint">
            Để trống: hiển thị ngay. Chọn ngày: học sinh chỉ thấy từ 0h ngày đó
            (giờ Việt Nam).
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="due_date">Hạn nộp bài (cho học sinh)</label>
          <input
            id="due_date"
            type="date"
            name="due_date"
            value={formData.due_date}
            onChange={handleInputChange}
            disabled={isSubmitting}
            min={formData.available_from_date || undefined}
          />
          <p className="form-hint">
            Để trống: không giới hạn. Hạn nộp không được trước ngày mở bài.
          </p>
        </div>

        <div className="form-group">
          <label htmlFor="max_submissions_per_student">
            Số lần nộp tối đa (mỗi học sinh)
          </label>
          <select
            id="max_submissions_per_student"
            name="max_submissions_per_student"
            value={formData.max_submissions_per_student}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="2">2 lần (mặc định)</option>
            <option value="3">3 lần</option>
            <option value="5">5 lần</option>
            <option value="10">10 lần</option>
            <option value="0">Không giới hạn</option>
          </select>
          <p className="form-hint">
            Giới hạn giúp giảm tải server. Học sinh đã nộp vượt lượt mới chỉnh
            vẫn giữ bài đã nộp.
          </p>
        </div>

        {/* Question Image */}
        <div className="form-group">
          <label htmlFor="question_image">
            Hình ảnh câu hỏi <span className="required">*</span>
          </label>
          <div className="image-input-section">
            <div className="file-upload-section">
              <label htmlFor="question_image_file" className="file-upload-label">
                <span className="file-upload-text">
                  {formData.question_image
                    ? formData.question_image.name
                    : 'Chọn file hình ảnh mới (hoặc giữ nguyên hình hiện tại)'}
                </span>
                <input
                  id="question_image_file"
                  type="file"
                  name="question_image"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="file-input"
                />
              </label>
            </div>
            <div className="or-divider">HOẶC</div>
            <input
              type="text"
              name="question_image_url"
              value={formData.question_image_url}
              onChange={handleUrlChange}
              placeholder="Nhập URL hình ảnh câu hỏi"
              disabled={isSubmitting || !!formData.question_image}
              className="url-input"
            />
          </div>
          {previewUrls.question && (
            <div className="image-preview">
              <img
                src={previewUrls.question}
                alt="Preview question"
                className="preview-image"
              />
            </div>
          )}
        </div>

        {/* Solution images — có thể tải đến 3 ảnh mới để thay thế */}
        <div className="form-group">
          <label htmlFor="solution_image_file_edit">
            Hình ảnh bài giải mẫu <span className="required">*</span>
          </label>
          <p className="form-hint">
            Để thay đáp án: chọn tối đa 3 ảnh mới (ghi đè cả bộ đang có). Hoặc sửa ô
            URL dưới đây. Để nguyên: giữ nguyên các ảnh hiện tại và chỉ sửa mục
            khác.
          </p>
          <div className="image-input-section">
            <div className="file-upload-section">
              <label
                htmlFor="solution_image_file_edit"
                className="file-upload-label"
              >
                <span className="file-upload-text">
                  {formData.model_solution_images?.length
                    ? `${formData.model_solution_images.length} ảnh mới`
                    : 'Chọn ảnh mới (tuỳ chọn — thay cả bộ)'}
                </span>
                <input
                  id="solution_image_file_edit"
                  type="file"
                  name="model_solution_image"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={
                    isSubmitting || !!formData.model_solution_image_url?.trim()
                  }
                  className="file-input"
                />
              </label>
            </div>
            <div className="or-divider">HOẶC</div>
            <input
              type="text"
              name="model_solution_image_url"
              value={formData.model_solution_image_url}
              onChange={handleUrlChange}
              placeholder="Một URL ảnh đáp án"
              disabled={
                isSubmitting ||
                !!(formData.model_solution_images && formData.model_solution_images.length)
              }
              className="url-input"
            />
          </div>
          {previewUrls.solutions && previewUrls.solutions.length > 0 && (
            <div className="image-preview image-preview--multi">
              {previewUrls.solutions.map((src, idx) => (
                <img
                  key={`${src}-${idx}`}
                  src={src}
                  alt={`Đáp án ${idx + 1}`}
                  className="preview-image preview-image--small"
                />
              ))}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button
            type="button"
            onClick={handleCancel}
            className="cancel-form-button"
            disabled={isSubmitting}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="submit-form-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang cập nhật...' : 'Cập nhật bài tập'}
          </button>
        </div>
      </form>
    </div>
    </OceanShell>
  );
}

export default EditAssignmentForm;
