import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchStudentClassRanking } from '../../api/submissions';

/**
 * Modal xếp hạng lớp (học sinh). Mở khi bấm avatar trên header.
 */
export default function ClassRankingModal({ open, onClose, myStudentId }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!open) return;
    let c = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const d = await fetchStudentClassRanking();
        if (!c) setData(d);
      } catch (e) {
        if (!c) setError(e.message || 'Không tải được');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const entries = Array.isArray(data?.entries) ? data.entries : [];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-ranking-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[min(92vh,640px)] w-full max-w-lg flex-col rounded-t-3xl border border-sky-200/70 bg-white shadow-2xl dark:border-cyan-500/25 dark:bg-slate-900 sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-sky-100 px-5 py-4 dark:border-cyan-950/60">
          <div className="min-w-0">
            <h2
              id="class-ranking-title"
              className="text-lg font-semibold text-slate-900 dark:text-white"
            >
              Xếp hạng lớp
            </h2>
            {data?.class_name ? (
              <p className="mt-0.5 truncate text-sm text-sky-700 dark:text-cyan-300">
                {data.class_name}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl border border-slate-200/90 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Đóng
          </button>
        </div>

        {data?.metric_label ? (
          <p className="shrink-0 px-5 pb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {data.metric_label}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5 sm:px-5">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Đang tải…
            </p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-red-600 dark:text-red-300">{error}</p>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Chưa có học sinh trong lớp.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-sky-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-cyan-950/60 dark:text-cyan-200/80">
                  <th className="px-2 py-2 tabular-nums">Hạng</th>
                  <th className="px-2 py-2">Học sinh</th>
                  <th className="px-2 py-2 text-right tabular-nums">ĐTB</th>
                  <th className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">Bài</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const me = myStudentId && row.student_id === myStudentId;
                  return (
                    <tr
                      key={row.student_id}
                      className={`border-b border-sky-50 align-middle dark:border-cyan-950/40 ${
                        me
                          ? 'bg-sky-100/90 font-medium dark:bg-cyan-950/50'
                          : 'odd:bg-white/80 even:bg-sky-50/40 dark:odd:bg-slate-900/40 dark:even:bg-slate-900/20'
                      }`}
                    >
                      <td className="px-2 py-2.5 tabular-nums text-slate-800 dark:text-slate-100">
                        {row.rank}
                      </td>
                      <td className="max-w-[12rem] truncate px-2 py-2.5 text-slate-900 dark:text-white">
                        {row.display_name}
                        {me ? (
                          <span className="ml-1 text-xs font-normal text-sky-600 dark:text-cyan-300">
                            (bạn)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                        {row.avg_score != null ? row.avg_score : '—'}
                      </td>
                      <td className="hidden px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300 sm:table-cell">
                        {row.assignments_graded ?? 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
