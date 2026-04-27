import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchSubmissionById,
  upsertSubmissionReview,
  deleteSubmissionReview,
} from '../../api/submissions';
import { useAuth } from '../../contexts/AuthContext';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import SubmissionResult from './SubmissionResult';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TeacherSubmissionReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [comment, setComment] = useState('');
  const [scoreOverride, setScoreOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSubmissionById(id);
        if (cancelled) return;
        setSubmission(data);
        setComment(data?.teacher_review?.comment || '');
        setScoreOverride(
          data?.teacher_review?.score_override != null
            ? String(data.teacher_review.score_override)
            : '',
        );
      } catch (err) {
        if (!cancelled) setError(err.message || 'Không tải được bài nộp.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave(e) {
    e?.preventDefault?.();
    setSaveError(null);
    setSaveSuccess(false);

    const trimmed = comment.trim();
    if (!trimmed) {
      setSaveError('Nhận xét không được để trống.');
      return;
    }

    let scoreValue = null;
    if (scoreOverride !== '' && scoreOverride !== null) {
      const n = Number(scoreOverride);
      if (!Number.isFinite(n) || n < 0 || n > 10) {
        setSaveError('Điểm chấm tay phải nằm trong khoảng 0-10.');
        return;
      }
      scoreValue = Math.round(n * 10) / 10;
    }

    setSaving(true);
    try {
      const result = await upsertSubmissionReview(id, {
        comment: trimmed,
        score_override: scoreValue,
      });
      setSubmission((prev) =>
        prev ? { ...prev, teacher_review: result.teacher_review } : prev,
      );
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err.message || 'Không lưu được nhận xét.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!submission?.teacher_review) return;
    if (
      !window.confirm(
        'Xóa nhận xét đã ghi cho bài này? Hành động này không thể hoàn tác.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await deleteSubmissionReview(id);
      setSubmission((prev) => (prev ? { ...prev, teacher_review: null } : prev));
      setComment('');
      setScoreOverride('');
    } catch (err) {
      setSaveError(err.message || 'Không xóa được nhận xét.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <OceanPageLoading message="Đang tải bài nộp..." />;
  }

  if (error) {
    return (
      <OceanPageError
        title="Lỗi tải bài nộp"
        message={error}
        onRetry={() => navigate(0)}
      />
    );
  }

  if (!submission) return null;

  const review = submission.teacher_review;
  const aiScore =
    submission.ai_result && typeof submission.ai_result.score === 'number'
      ? submission.ai_result.score
      : null;

  return (
    <OceanShell>
      <OceanListPageHeader
        user={user}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        navigate={navigate}
        logout={logout}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/teacher/submissions')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/80 bg-white/90 px-3.5 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-cyan-100"
        >
          ← Quay lại danh sách
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nộp lúc {formatDate(submission.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: bài nộp & AI result */}
        <div className="rounded-3xl border border-sky-200/60 bg-white/85 p-4 shadow-sm backdrop-blur-xl dark:border-cyan-300/15 dark:bg-white/5 md:p-6">
          <SubmissionResult submission={submission} />
        </div>

        {/* Right: form nhận xét */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <form
            onSubmit={handleSave}
            className="flex flex-col gap-4 rounded-3xl border border-emerald-200/60 bg-white/90 p-4 shadow-sm backdrop-blur-xl dark:border-emerald-300/20 dark:bg-white/5 md:p-6"
          >
            <header>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300/80">
                Nhận xét thủ công
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {review ? 'Cập nhật nhận xét' : 'Thêm nhận xét'}
              </h2>
              {review ? (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Cập nhật gần nhất: {formatDate(review.updated_at)} bởi{' '}
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {review.reviewer_full_name || review.reviewer_username || 'Giáo viên'}
                  </span>
                </p>
              ) : null}
            </header>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Nội dung nhận xét <span className="text-rose-500">*</span>
              </span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={8}
                maxLength={4000}
                placeholder="Ví dụ: Em làm đúng phương pháp nhưng còn nhầm dấu khi quy đồng. Lần sau viết rõ điều kiện..."
                className="rounded-xl border border-sky-200/80 bg-white/95 px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-inner focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-cyan-300/30 dark:bg-slate-900/60 dark:text-slate-100"
                required
              />
              <span className="self-end text-xs text-slate-400">
                {comment.length}/4000
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Điểm chấm tay (tuỳ chọn)
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={scoreOverride}
                  onChange={(e) => setScoreOverride(e.target.value)}
                  placeholder={
                    aiScore != null ? `Điểm AI: ${aiScore}` : 'VD: 8.5'
                  }
                  className="w-32 rounded-xl border border-sky-200/80 bg-white/95 px-3 py-2 text-sm tabular-nums text-slate-800 shadow-inner focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-cyan-300/30 dark:bg-slate-900/60 dark:text-slate-100"
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">/ 10</span>
                {scoreOverride !== '' ? (
                  <button
                    type="button"
                    onClick={() => setScoreOverride('')}
                    className="text-xs text-slate-500 underline hover:text-slate-700 dark:text-slate-400"
                  >
                    Xoá điểm
                  </button>
                ) : null}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Để trống nếu chỉ muốn nhận xét bằng văn bản. Khi nhập, điểm này
                sẽ thay thế điểm AI khi học sinh xem bài.
              </span>
            </label>

            {saveError ? (
              <p className="rounded-xl border border-rose-300/40 bg-rose-50/80 px-3 py-2 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/40 dark:text-rose-200">
                {saveError}
              </p>
            ) : null}
            {saveSuccess ? (
              <p className="rounded-xl border border-emerald-300/40 bg-emerald-50/80 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-200">
                Đã lưu nhận xét.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || deleting}
                className="inline-flex items-center justify-center rounded-xl border border-emerald-300/70 bg-[linear-gradient(135deg,#86efac,#10b981)] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Đang lưu...' : review ? 'Cập nhật nhận xét' : 'Lưu nhận xét'}
              </button>
              {review ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving || deleting}
                  className="inline-flex items-center justify-center rounded-xl border border-rose-200/70 bg-white/90 px-4 py-2 text-sm font-medium text-rose-700 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-300/30 dark:bg-slate-900/70 dark:text-rose-200"
                >
                  {deleting ? 'Đang xoá...' : 'Xoá nhận xét'}
                </button>
              ) : null}
            </div>
          </form>
        </aside>
      </div>
    </OceanShell>
  );
}
