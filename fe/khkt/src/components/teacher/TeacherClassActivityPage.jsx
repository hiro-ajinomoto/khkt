import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchTeacherClassSubmissionActivity,
  decodeClassRouteParam,
  encodeClassNameForPath,
} from '../../api/teacherWorkspace';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import BackToTopButton from '../layout/BackToTopButton';
import TeacherClassSubNav from './TeacherClassSubNav';

/** Hiển thị YYYY-MM-DD theo dd/mm/yyyy (giữ đúng lịch VN của chuỗi ngày). */
function formatYmdVi(ymd) {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function scoreFmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return String(n);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dịch YYYY-MM-DD theo lịch Việt Nam (giống backend). */
function shiftVietnamYmd(ymd, deltaDays) {
  const ms = new Date(`${ymd}T12:00:00+07:00`).getTime() + deltaDays * DAY_MS;
  return new Date(ms).toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function vietnamTodayYmd() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function TeacherClassActivityPage() {
  const { className: classNameParam } = useParams();
  const className = decodeClassRouteParam(classNameParam);
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [applying, setApplying] = useState(false);

  const load = useCallback(
    async (opts) => {
      if (!className) return;
      setError(null);
      const d = await fetchTeacherClassSubmissionActivity(className, opts);
      setData(d);
      if (d?.from && d?.to) {
        setFromInput(d.from);
        setToInput(d.to);
      }
    },
    [className],
  );

  useEffect(() => {
    if (!className) {
      setError('Thiếu tên lớp.');
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      try {
        setLoading(true);
        await load();
      } catch (e) {
        if (!c) setError(e.message || 'Không tải được');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [className, load]);

  const handleApply = async () => {
    if (!fromInput || !toInput) return;
    setApplying(true);
    setError(null);
    try {
      await load({ from: fromInput, to: toInput });
    } catch (e) {
      setError(e.message || 'Không tải được');
    } finally {
      setApplying(false);
    }
  };

  /** Giữ độ dài khoảng; lùi / tiến cả hai mốc 1 ngày (timezone VN). */
  const handleShiftRangeByOneDay = async (direction) => {
    if (!fromInput || !toInput) return;
    const nf = shiftVietnamYmd(fromInput, direction);
    const nt = shiftVietnamYmd(toInput, direction);
    setApplying(true);
    setError(null);
    try {
      await load({ from: nf, to: nt });
    } catch (e) {
      setError(e.message || 'Không tải được');
    } finally {
      setApplying(false);
    }
  };

  /** API trả các ngày tăng dần; hiển thị mới nhất trước. */
  const daysNewestFirst = useMemo(() => {
    const list = Array.isArray(data?.days) ? data.days : [];
    return [...list].reverse();
  }, [data?.days]);

  const todayVn = vietnamTodayYmd();
  const canShiftToNextDay =
    Boolean(fromInput && toInput) && shiftVietnamYmd(toInput, 1) <= todayVn;

  if (!className) {
    return (
      <OceanPageError
        title="Lỗi"
        message="Đường dẫn lớp không hợp lệ."
        onRetry={() => navigate('/teacher/classes')}
      />
    );
  }

  if (loading) {
    return <OceanPageLoading message="Đang tải hoạt động…" />;
  }

  if (error && !data) {
    return (
      <OceanShell>
        <OceanListPageHeader
          user={user}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          variant="assignments"
          navigate={navigate}
          logout={logout}
          teacherToolbar={isTeacher}
        />
        <OceanPageError title="Không tải được" message={error} onRetry={() => navigate(0)} />
      </OceanShell>
    );
  }

  const totals = data?.totals || {};
  const label = data?.label || {};

  return (
    <OceanShell>
      <OceanListPageHeader
        user={user}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        variant="assignments"
        navigate={navigate}
        logout={logout}
        teacherToolbar={isTeacher}
      />
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <h2 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">
          Tổng quan · {className}
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Theo ngày theo giờ Việt Nam: ai đã nộp (lượt nộp), số lượt đã có điểm, điểm trung bình trong
          ngày. {label.submission_unit ? <span>{label.submission_unit}</span> : null}
        </p>
        <TeacherClassSubNav className={className} active="activity" />

        {error ? (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-sky-200/60 bg-white/85 p-4 dark:border-cyan-500/20 dark:bg-slate-900/60">
          <div>
            <label htmlFor="activity-from" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Từ ngày
            </label>
            <input
              id="activity-from"
              type="date"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="rounded-xl border border-sky-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-cyan-500/30 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label htmlFor="activity-to" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Đến ngày
            </label>
            <input
              id="activity-to"
              type="date"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="rounded-xl border border-sky-200/80 bg-white px-3 py-2 text-sm text-slate-900 dark:border-cyan-500/30 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            disabled={applying || !fromInput || !toInput}
            onClick={handleApply}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-500/25 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-600 dark:hover:bg-cyan-500"
          >
            {applying ? 'Đang tải…' : 'Áp dụng'}
          </button>
          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <button
              type="button"
              disabled={applying || !fromInput || !toInput}
              onClick={() => handleShiftRangeByOneDay(-1)}
              title="Lùi cả khoảng đang xem một ngày (về quá khứ)"
              className="rounded-xl border border-sky-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/35 dark:bg-slate-900 dark:text-cyan-100 dark:hover:bg-slate-800"
            >
              ← Ngày trước
            </button>
            <button
              type="button"
              disabled={applying || !fromInput || !toInput || !canShiftToNextDay}
              onClick={() => handleShiftRangeByOneDay(1)}
              title={
                canShiftToNextDay
                  ? 'Tiến cả khoảng đang xem một ngày (về hiện tại)'
                  : 'Đã tới hôm nay — không thể tiến thêm'
              }
              className="rounded-xl border border-sky-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-cyan-500/35 dark:bg-slate-900 dark:text-cyan-100 dark:hover:bg-slate-800"
            >
              Ngày sau →
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-sky-200/60 bg-white/90 px-4 py-3 dark:border-cyan-500/20 dark:bg-slate-900/60">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng lượt nộp</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {totals.submission_count ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200/60 bg-white/90 px-4 py-3 dark:border-cyan-500/20 dark:bg-slate-900/60">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Lượt đã có điểm</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {totals.graded_submission_count ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200/60 bg-white/90 px-4 py-3 dark:border-cyan-500/20 dark:bg-slate-900/60">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Học sinh có nộp (cả khoảng)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {totals.unique_students ?? 0}
            </div>
          </div>
          <div className="rounded-2xl border border-sky-200/60 bg-white/90 px-4 py-3 dark:border-cyan-500/20 dark:bg-slate-900/60">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Điểm TB (cả khoảng)</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {scoreFmt(totals.avg_score)}
            </div>
            {label.score_note ? (
              <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                {label.score_note}
              </p>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-sky-200/60 bg-white/85 dark:border-cyan-500/20 dark:bg-slate-900/60">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-sky-100 bg-sky-50/80 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-200/90">
                <th className="px-4 py-3">Ngày</th>
                <th className="px-4 py-3 tabular-nums">Lượt nộp</th>
                <th className="px-4 py-3 tabular-nums">Có điểm</th>
                <th className="px-4 py-3 tabular-nums">HS nộp</th>
                <th className="px-4 py-3 tabular-nums">ĐTB ngày</th>
              </tr>
            </thead>
            <tbody>
              {daysNewestFirst.map((row) => (
                <tr key={row.date} className="border-b border-sky-50 align-top odd:bg-white/70 even:bg-sky-50/40 dark:border-cyan-950/50 dark:odd:bg-slate-900/45 dark:even:bg-slate-900/25">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    <div>{formatYmdVi(row.date)}</div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.date}</div>
                    {row.unique_students > 0 ? (
                      <Link
                        to={`/teacher/classes/${encodeClassNameForPath(className)}/activity/day/${row.date}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-sky-700 underline underline-offset-2 dark:text-cyan-300"
                      >
                        Ai đã nộp
                        <span aria-hidden className="text-xs opacity-80">
                          ↗
                        </span>
                      </Link>
                    ) : null}
                  </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-100">
                      {row.submission_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-100">
                      {row.graded_submission_count}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-100">
                      {row.unique_students}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900 dark:text-white">
                      {scoreFmt(row.avg_score)}
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <BackToTopButton />
    </OceanShell>
  );
}
