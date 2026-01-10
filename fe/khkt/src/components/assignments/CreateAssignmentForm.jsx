import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAssignment } from '../../api/assignments';
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

function CreateAssignmentForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    grade_level: '',
    question_image: null,
    model_solution_image: null,
    question_image_url: '',
    model_solution_image_url: '',
  });

  const [previewUrls, setPreviewUrls] = useState({
    question: null,
    solution: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    const file = files[0];

    if (file) {
      setFormData((prev) => ({
        ...prev,
        [name]: file,
        [`${name}_url`]: '', // Clear URL if file is selected
      }));

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      if (name === 'question_image') {
        setPreviewUrls((prev) => ({ ...prev, question: previewUrl }));
      } else if (name === 'model_solution_image') {
        setPreviewUrls((prev) => ({ ...prev, solution: previewUrl }));
      }
    }
  };

  const handleUrlChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      [name.replace('_url', '')]: null, // Clear file if URL is provided
    }));
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
      formData.model_solution_image || formData.model_solution_image_url;

    if (!hasQuestionImage) {
      setError('Vui lòng chọn hình ảnh câu hỏi hoặc nhập URL');
      return;
    }

    if (!hasSolutionImage) {
      setError('Vui lòng chọn hình ảnh bài giải mẫu hoặc nhập URL');
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

      if (formData.question_image) {
        formDataToSend.append('question_image', formData.question_image);
      } else if (formData.question_image_url) {
        formDataToSend.append('question_image_url', formData.question_image_url);
      }

      if (formData.model_solution_image) {
        formDataToSend.append(
          'model_solution_image',
          formData.model_solution_image
        );
      } else if (formData.model_solution_image_url) {
        formDataToSend.append(
          'model_solution_image_url',
          formData.model_solution_image_url
        );
      }

      await createAssignment(formDataToSend);

      // Cleanup preview URLs
      if (previewUrls.question) URL.revokeObjectURL(previewUrls.question);
      if (previewUrls.solution) URL.revokeObjectURL(previewUrls.solution);

      // Navigate back to assignments list
      navigate('/');
    } catch (err) {
      setError(err.message || 'Không thể tạo bài tập. Vui lòng thử lại.');
      console.error('Error creating assignment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Cleanup preview URLs
    if (previewUrls.question) URL.revokeObjectURL(previewUrls.question);
    if (previewUrls.solution) URL.revokeObjectURL(previewUrls.solution);

    // Navigate back to assignments list
    navigate('/');
  };

  return (
    <div className="create-assignment-form-container">
      <div className="form-header">
        <h2>Tạo bài tập mới</h2>
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
                    : 'Chọn file hình ảnh'}
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

        {/* Solution Image */}
        <div className="form-group">
          <label htmlFor="model_solution_image">
            Hình ảnh bài giải mẫu <span className="required">*</span>
          </label>
          <div className="image-input-section">
            <div className="file-upload-section">
              <label
                htmlFor="solution_image_file"
                className="file-upload-label"
              >
                <span className="file-upload-text">
                  {formData.model_solution_image
                    ? formData.model_solution_image.name
                    : 'Chọn file hình ảnh'}
                </span>
                <input
                  id="solution_image_file"
                  type="file"
                  name="model_solution_image"
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
              name="model_solution_image_url"
              value={formData.model_solution_image_url}
              onChange={handleUrlChange}
              placeholder="Nhập URL hình ảnh bài giải mẫu"
              disabled={isSubmitting || !!formData.model_solution_image}
              className="url-input"
            />
          </div>
          {previewUrls.solution && (
            <div className="image-preview">
              <img
                src={previewUrls.solution}
                alt="Preview solution"
                className="preview-image"
              />
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
            {isSubmitting ? 'Đang tạo...' : 'Tạo bài tập'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateAssignmentForm;
