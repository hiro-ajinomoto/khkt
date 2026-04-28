import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAssignment } from '../../api/assignments';
import { fetchSchoolClasses, groupClassesByGrade } from '../../api/classes';
import OceanShell from '../layout/OceanShell';
import './CreateAssignmentForm.css';
import {
  defaultDueDateForNewAssignment,
} from '../../utils/assignmentRelease';

const GRADE_LEVELS = [
  'Lớp 6',
  'Lớp 7',
  'Lớp 8',
  'Lớp 9',
  'Lớp 10',
  'Lớp 11',
  'Lớp 12',
];

const emptyFormData = () => ({
  title: '',
  description: '',
  grade_level: '',
  /** YYYY-MM-DD — để trống = hiển thị cho HS ngay */
  available_from_date: '',
  /** YYYY-MM-DD — để trống = không giới hạn; mặc định: cuối cùng ngày (VN) */
  due_date: defaultDueDateForNewAssignment(),
  /** 2 | 3 | 5 | 10 | 0 (không giới hạn); mặc định 2 */
  max_submissions_per_student: '2',
  question_image: null,
  /** Tối đa 3 ảnh — cùng field multer model_solution_image */
  model_solution_images: [],
  question_image_url: '',
  model_solution_image_url: '',
});

function CreateAssignmentForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(emptyFormData);

  const [previewUrls, setPreviewUrls] = useState({
    question: null,
    /** Blob URLs của tối đa 3 ảnh bài mẫu */
    solutions: [],
  });

  /** Tăng sau mỗi lần tạo xong để reset input file (trình duyệt không bind lại tên file cũ). */
  const [fileInputKey, setFileInputKey] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const [availableClasses, setAvailableClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [selectedClasses, setSelectedClasses] = useState([]);

  const classesByGrade = useMemo(
    () => groupClassesByGrade(availableClasses),
    [availableClasses],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingClasses(true);
        const list = await fetchSchoolClasses();
        if (!cancelled) setAvailableClasses(list);
      } catch (err) {
        console.error('Error loading school classes:', err);
        if (!cancelled) setAvailableClasses([]);
      } finally {
        if (!cancelled) setLoadingClasses(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Đảm bảo hạn nộp không sớm hơn ngày mở bài (nếu mở bài sau hôm nay thì kéo due theo). */
  useEffect(() => {
    const a = formData.available_from_date;
    if (!a) return;
    setFormData((prev) => {
      const d = prev.due_date;
      if (!d || a <= d) return prev;
      return { ...prev, due_date: a };
    });
  }, [formData.available_from_date]);

  const handleClassToggle = (className) => {
    setSelectedClasses((prev) =>
      prev.includes(className)
        ? prev.filter((c) => c !== className)
        : [...prev, className],
    );
    setError(null);
    setSuccessMessage(null);
  };

  const handleSelectGrade = (gradeClasses) => {
    const allSelected = gradeClasses.every((cn) => selectedClasses.includes(cn));
    setSelectedClasses((prev) => {
      if (allSelected) {
        return prev.filter((cn) => !gradeClasses.includes(cn));
      }
      const add = gradeClasses.filter((cn) => !prev.includes(cn));
      return [...prev, ...add];
    });
    setError(null);
    setSuccessMessage(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    setSuccessMessage(null);
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
      setSuccessMessage(null);
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
      setError(null);
      return;
    }

    const file = files?.[0];

    if (file) {
      setSuccessMessage(null);
      setFormData((prev) => ({
        ...prev,
        [name]: file,
        [`${name}_url`]: '', // Clear URL if file is selected
      }));

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      if (name === 'question_image') {
        setPreviewUrls((prev) => ({ ...prev, question: previewUrl }));
      }
    }
  };

  const handleUrlChange = (e) => {
    const { name, value } = e.target;
    setSuccessMessage(null);
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
    setSuccessMessage(null);

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
      if (formData.available_from_date) {
        formDataToSend.append(
          'available_from_date',
          formData.available_from_date
        );
      }
      if (formData.due_date) {
        formDataToSend.append('due_date', formData.due_date);
      }
      formDataToSend.append(
        'max_submissions_per_student',
        formData.max_submissions_per_student ?? '2'
      );

      if (selectedClasses.length > 0) {
        formDataToSend.append('class_names', JSON.stringify(selectedClasses));
      }

      if (formData.question_image) {
        formDataToSend.append('question_image', formData.question_image);
      } else if (formData.question_image_url) {
        formDataToSend.append('question_image_url', formData.question_image_url);
      }

      if (formData.model_solution_images && formData.model_solution_images.length > 0) {
        formData.model_solution_images.forEach((file) =>
          formDataToSend.append('model_solution_image', file),
        );
      } else if (formData.model_solution_image_url?.trim()) {
        formDataToSend.append(
          'model_solution_image_url',
          formData.model_solution_image_url,
        );
      }

      await createAssignment(formDataToSend);

      if (previewUrls.question) URL.revokeObjectURL(previewUrls.question);
      revokeSolutionPreviews();

      setFormData(emptyFormData());
      setSelectedClasses([]);
      setPreviewUrls({ question: null, solutions: [] });
      setFileInputKey((k) => k + 1);
      setSuccessMessage(
        'Đã tạo bài tập thành công. Bạn có thể nhập bài tiếp theo bên dưới.'
      );
    } catch (err) {
      setError(err.message || 'Không thể tạo bài tập. Vui lòng thử lại.');
      console.error('Error creating assignment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (previewUrls.question) URL.revokeObjectURL(previewUrls.question);
    revokeSolutionPreviews();

    navigate('/assignments', { replace: true });
  };

  return (
    <OceanShell>
    <div className="create-assignment-form-container">
      <div className="form-header">
        <div>
          <p className="ocean-page-eyebrow">Cuộc thi khoa học kỹ thuật</p>
          <h2>Tạo bài tập mới</h2>
        </div>
        <button onClick={handleCancel} className="cancel-button">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="assignment-form">
        {successMessage ? (
          <div className="success-message" role="status">
            {successMessage}
          </div>
        ) : null}
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

        {/* Nhãn cấp đề (metadata) — khác với gán lớp nhận bài bên dưới */}
        <div className="form-group">
          <label htmlFor="grade_level">Nhãn cấp đề (hiển thị)</label>
          <select
            id="grade_level"
            name="grade_level"
            value={formData.grade_level}
            onChange={handleInputChange}
            disabled={isSubmitting}
          >
            <option value="">Không chọn</option>
            {GRADE_LEVELS.map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
          <p className="form-hint">
            Gợi ý mức đề (ví dụ Lớp 8). Để giao bài cho học sinh, dùng mục &quot;Gán
            cho lớp&quot; bên dưới.
          </p>
        </div>

        <div className="form-group create-form-assign-classes">
          <label>Gán cho lớp (tùy chọn)</label>
          <p className="form-hint">
            Chọn từng lớp hoặc dùng &quot;Chọn cả khối&quot; để gán toàn bộ lớp
            trong khối (theo tên lớp bắt đầu bằng số: 8A1 → Khối 8). Để trống:
            tạo bài trước, gán lớp sau trong danh sách bài tập.
          </p>
          {loadingClasses ? (
            <div className="create-form-class-loading">Đang tải danh sách lớp…</div>
          ) : classesByGrade.length === 0 ? (
            <div className="create-form-class-empty">
              Chưa có lớp trong hệ thống. Nhờ quản trị viên thêm lớp ở trang Quản
              trị, hoặc tạo bài và gán lớp sau.
            </div>
          ) : (
            <div className="create-form-class-scroll">
              {classesByGrade.map(([gradeName, gradeClasses]) => {
                const allSelected = gradeClasses.every((cn) =>
                  selectedClasses.includes(cn),
                );
                const someSelected = gradeClasses.some((cn) =>
                  selectedClasses.includes(cn),
                );
                return (
                  <div key={gradeName} className="create-form-grade-block">
                    <div className="create-form-grade-head">
                      <h3 className="create-form-grade-title">{gradeName}</h3>
                      <button
                        type="button"
                        className={`create-form-grade-toggle ${
                          allSelected
                            ? 'create-form-grade-toggle--all'
                            : someSelected
                              ? 'create-form-grade-toggle--some'
                              : ''
                        }`}
                        onClick={() => handleSelectGrade(gradeClasses)}
                        disabled={isSubmitting}
                      >
                        {allSelected ? 'Bỏ chọn cả khối' : 'Chọn cả khối'}
                      </button>
                    </div>
                    <div className="create-form-class-chips">
                      {gradeClasses.map((className) => {
                        const isSelected = selectedClasses.includes(className);
                        return (
                          <button
                            key={className}
                            type="button"
                            className={`create-form-class-chip ${
                              isSelected ? 'create-form-class-chip--on' : ''
                            }`}
                            onClick={() => handleClassToggle(className)}
                            disabled={isSubmitting}
                          >
                            {className}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {selectedClasses.length > 0 && (
            <p className="create-form-selected-count" aria-live="polite">
              Đã chọn {selectedClasses.length} lớp
            </p>
          )}
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
            Để trống: học sinh thấy bài ngay sau khi gán lớp. Chọn ngày: chỉ từ
            0h ngày đó (giờ Việt Nam) học sinh mới thấy và nộp bài.
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
            Mặc định là hôm nay: học sinh nộp đến hết ngày đó (23:59, giờ Việt
            Nam). Để trống: không giới hạn ngày nộp. Phải sau hoặc cùng ngày mở
            bài (nếu có).
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
            <option value="2">2 lần (mặc định, giảm tải server)</option>
            <option value="3">3 lần</option>
            <option value="5">5 lần</option>
            <option value="10">10 lần</option>
            <option value="0">Không giới hạn</option>
          </select>
          <p className="form-hint">
            Giới hạn số lần nộp giúp giảm tải xử lý (chấm AI, lưu ảnh). Học sinh
            vẫn xem đề sau khi hết lượt.
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
                    : 'Chọn file hình ảnh'}
                </span>
                <input
                  key={`question-${fileInputKey}`}
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

        {/* Solution images — tối đa 3 */}
        <div className="form-group">
          <label htmlFor="solution_image_file">
            Hình ảnh bài giải mẫu <span className="required">*</span>
          </label>
          <p className="form-hint">
            Có thể chọn <strong>2 hoặc 3 ảnh</strong> (ví dụ từng bước hoặc trang
            tiếp theo). Tối đa 3 ảnh.
          </p>
          <div className="image-input-section">
            <div className="file-upload-section">
              <label
                htmlFor="solution_image_file"
                className="file-upload-label"
              >
                <span className="file-upload-text">
                  {formData.model_solution_images?.length
                    ? `${formData.model_solution_images.length} ảnh đã chọn`
                    : 'Chọn một hoặc nhiều ảnh'}
                </span>
                <input
                  key={`solution-${fileInputKey}`}
                  id="solution_image_file"
                  type="file"
                  name="model_solution_image"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  disabled={isSubmitting || !!formData.model_solution_image_url?.trim()}
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
              placeholder="Hoặc một URL ảnh đáp án mẫu"
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
                  alt={`Bài mẫu ${idx + 1}`}
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
            {isSubmitting ? 'Đang tạo...' : 'Tạo bài tập'}
          </button>
        </div>
      </form>
    </div>
    </OceanShell>
  );
}

export default CreateAssignmentForm;
