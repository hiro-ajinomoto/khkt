import { useEffect } from 'react';

/**
 * Xác nhận / kết quả báo lỗi đề bài (học sinh).
 * Style: class assignments-theme-dialog-* trong AssignmentsList.css (import từ AssignmentsList).
 *
 * @param {null | { mode: 'confirm', assignmentId: string } | { mode: 'result', tone: 'success'|'info'|'error', message: string }} dialog
 */
export default function ReportProblemDialog({
  dialog,
  onClose,
  onConfirmReport,
  submittingId,
}) {
  useEffect(() => {
    if (!dialog) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialog, onClose]);

  if (!dialog) return null;

  const isConfirm = dialog.mode === 'confirm';
  const isSubmitting =
    isConfirm &&
    submittingId != null &&
    submittingId === dialog.assignmentId;

  const toneRing = isConfirm
    ? 'border-amber-300/70 bg-amber-50/90 text-amber-700 dark:border-amber-400/45 dark:bg-amber-500/15 dark:text-amber-200'
    : dialog.tone === 'success'
      ? 'border-emerald-300/70 bg-emerald-50/90 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200'
      : dialog.tone === 'error'
        ? 'border-rose-300/70 bg-rose-50/90 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-200'
        : 'border-sky-300/70 bg-sky-50/90 text-sky-800 dark:border-cyan-400/35 dark:bg-cyan-500/10 dark:text-cyan-100';

  const resultTitle =
    dialog.mode === 'result'
      ? dialog.tone === 'success'
        ? 'Đã gửi'
        : dialog.tone === 'error'
          ? 'Không gửi được'
          : 'Thông báo'
      : '';

  const iconGlyph = isConfirm
    ? '\u26a0\ufe0f'
    : dialog.tone === 'success'
      ? '\u2713'
      : dialog.tone === 'error'
        ? '\u2717'
        : 'i';

  return (
    <div
      className="assignments-theme-dialog-backdrop fixed inset-0 z-[980] flex items-end justify-center bg-slate-900/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-md sm:items-center sm:pb-8 dark:bg-slate-950/70"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="assignments-theme-dialog-panel w-full max-w-md rounded-t-3xl border border-sky-200/85 bg-white/97 p-6 shadow-[0_-20px_50px_rgba(86,132,214,0.18)] sm:rounded-3xl sm:shadow-[0_24px_60px_rgba(86,132,214,0.15)] dark:border-cyan-300/25 dark:bg-slate-900/97 dark:shadow-2xl dark:shadow-cyan-950/50"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-problem-dialog-title"
      >
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-bold ${toneRing}`}
          aria-hidden
        >
          {iconGlyph}
        </div>
        <h2
          id="report-problem-dialog-title"
          className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white"
        >
          {isConfirm ? 'Báo lỗi đề bài' : resultTitle}
        </h2>
        {isConfirm ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Bạn muốn gửi thông báo cho giáo viên rằng{' '}
              <strong>đề bài này có vấn đề</strong>{' '}
              (thiếu nội dung, sai đề, không đọc được, …)?
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Mỗi bài bạn chỉ cần gửi <strong>một lần</strong>. Giáo viên sẽ xem
              lại sau.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => onConfirmReport(dialog.assignmentId)}
                disabled={isSubmitting}
                className="rounded-xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_50%,#ea580c_100%)] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-300/30 dark:bg-gradient-to-r dark:from-cyan-500 dark:to-blue-600 dark:shadow-cyan-950/40"
              >
                {isSubmitting ? 'Đang gửi…' : 'Gửi báo cáo'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {dialog.message}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-sky-200/80 bg-[linear-gradient(135deg,#7dd3fc_0%,#38bdf8_50%,#0ea5e9_100%)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 dark:border-cyan-300/30 dark:bg-gradient-to-r dark:from-cyan-500/80 dark:to-blue-600/80"
              >
                Đã hiểu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
