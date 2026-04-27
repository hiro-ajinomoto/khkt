import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTeacherSubmissions } from '../../api/submissions';
import { fetchAssignments } from '../../api/assignments';
import { fetchSchoolClasses, groupClassesByGrade } from '../../api/classes';
import { useAuth } from '../../contexts/AuthContext';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';

const PAGE_LIMIT = 50;

const REVIEW_TABS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'false', label: 'Chưa nhận xét' },
  { value: 'true', label: 'Đã nhận xét' },
];

/** YYYY-MM-DD theo lịch Việt Nam (UTC+7) */
function getVietnamYmdToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function addDaysVietnamYmd(ymd, deltaDays) {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  const next = new Date(d.getTime() + deltaDays * 86400000);
  return next.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Ví dụ: "Thứ Hai, 28 tháng 4 năm 2026" */
function formatVietnamWeekdayDateLine(ymd) {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const datePart = new Intl.DateTimeFormat('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
  return `${cap}, ${datePart}`;
}

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

function ScoreBadge({ value, label, accentClass }) {
  const display = typeof value === 'number' ? value : '—';
  return (
    <span
      className={`inline-flex min-w-[3.25rem] flex-col items-center rounded-xl border px-2 py-1 text-xs font-semibold tabular-nums ${accentClass}`}
      title={label}
    >
      <span className="text-[0.65rem] uppercase tracking-wider opacity-70">
        {label}
      </span>
      <span className="text-sm leading-tight">{display}</span>
    </span>
  );
}

export default function TeacherSubmissionsList() {
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const navigate = useNavigate();

  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({
    assignmentId: '',
    className: '',
    hasReview: 'all',
    submittedOn: getVietnamYmdToday(),
  });
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadFilterOptions() {
      if (!user) return;
      try {
        const aRes = await fetchAssignments();
        if (cancelled) return;
        setAssignments(Array.isArray(aRes) ? aRes : []);

        let classList = [];
        if (user.role === 'admin') {
          const cRes = await fetchSchoolClasses();
          classList = Array.isArray(cRes) ? cRes : [];
        } else if (user.role === 'teacher') {
          classList = Array.isArray(user.assigned_class_names)
            ? [...user.assigned_class_names].sort((a, b) =>
                a.localeCompare(b, 'vi', { numeric: true }),
              )
            : [];
        }
        if (cancelled) return;
        setClasses(classList);
        setFilters((prev) => {
          if (prev.className && classList.length > 0 && !classList.includes(prev.className)) {
            return { ...prev, className: '' };
          }
          return prev;
        });
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load filter options:', err);
        }
      }
    }
    loadFilterOptions();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = {
          limit: PAGE_LIMIT,
          offset,
        };
        if (filters.assignmentId) params.assignmentId = filters.assignmentId;
        if (filters.className) params.className = filters.className;
        if (filters.hasReview !== 'all') params.hasReview = filters.hasReview;
        if (filters.submittedOn) params.submittedOn = filters.submittedOn;

        const result = await fetchTeacherSubmissions(params);
        if (cancelled) return;
        setData(result || { items: [], total: 0 });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Không tải được danh sách bài nộp.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [filters, offset]);

  const groupedClasses = useMemo(() => groupClassesByGrade(classes), [classes]);

  function updateFilter(patch) {
    setOffset(0);
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  if (loading && data.items.length === 0) {
    return <OceanPageLoading message="Đang tải bài nộp..." />;
  }

  if (error && data.items.length === 0) {
    return (
      <OceanPageError
        title="Lỗi tải dữ liệu"
        message={error}
        onRetry={() => setFilters({ ...filters })}
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_LIMIT));
  const currentPage = Math.floor(offset / PAGE_LIMIT) + 1;

  return (
    <OceanShell>
      <OceanListPageHeader
        user={user}
        isAuthenticated={isAuthenticated}
        isAdmin={isAdmin}
        navigate={navigate}
        logout={logout}
        teacherToolbar={isTeacher}
      />

      <section className="mb-6 rounded-3xl border border-sky-200/60 bg-white/85 p-4 shadow-[0_12px_30px_rgba(86,132,214,0.10)] backdrop-blur-xl dark:border-cyan-300/15 dark:bg-white/5 md:p-6">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-sky-600/90 dark:text-cyan-200/80">
              Chấm tay bài nộp
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-2xl">
              Nhận xét thủ công của giáo viên
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Tổng số bài trong ngày đã chọn:{' '}
              <span className="font-semibold tabular-nums">{data.total}</span>
              {filters.hasReview === 'true' ? ' (đã có nhận xét)' : null}
              {filters.hasReview === 'false' ? ' (chưa nhận xét)' : null}
              <span className="mt-1 block text-xs font-normal text-slate-500 dark:text-slate-400">
                Lọc theo thời điểm nộp bài, múi giờ Việt Nam.
              </span>
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-white/80 px-4 py-3 dark:border-cyan-300/25 dark:from-slate-800/50 dark:to-slate-900/40 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-sky-600/90 dark:text-cyan-200/85">
              Ngày nộp bài
            </p>
            <p className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
              {formatVietnamWeekdayDateLine(filters.submittedOn)}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() =>
                updateFilter({ submittedOn: addDaysVietnamYmd(filters.submittedOn, -1) })
              }
              className="rounded-xl border border-sky-300/80 bg-white px-3 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 dark:border-cyan-400/35 dark:bg-slate-900/80 dark:text-cyan-50 dark:hover:bg-slate-800"
            >
              ← Hôm trước
            </button>
            <button
              type="button"
              onClick={() => updateFilter({ submittedOn: getVietnamYmdToday() })}
              disabled={filters.submittedOn === getVietnamYmdToday()}
              className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-950 shadow-sm transition enabled:hover:bg-amber-100/90 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-100 dark:enabled:hover:bg-amber-500/25"
            >
              Hôm nay
            </button>
            <button
              type="button"
              disabled={filters.submittedOn >= getVietnamYmdToday()}
              onClick={() =>
                updateFilter({ submittedOn: addDaysVietnamYmd(filters.submittedOn, 1) })
              }
              className="rounded-xl border border-sky-300/80 bg-white px-3 py-2 text-sm font-medium text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-cyan-400/35 dark:bg-slate-900/80 dark:text-cyan-50 dark:hover:bg-slate-800"
            >
              Hôm sau →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Bài tập</span>
            <select
              value={filters.assignmentId}
              onChange={(e) => updateFilter({ assignmentId: e.target.value })}
              className="rounded-xl border border-sky-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-slate-100"
            >
              <option value="">— Tất cả bài tập —</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title || `Bài #${a.id.slice(-6)}`}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Lớp</span>
            <select
              value={filters.className}
              onChange={(e) => updateFilter({ className: e.target.value })}
              className="rounded-xl border border-sky-200/80 bg-white/90 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-slate-100"
            >
              <option value="">
                {user?.role === 'admin' ? '— Tất cả lớp —' : '— Tất cả lớp được gán —'}
              </option>
              {groupedClasses.map(([grade, list]) => (
                <optgroup key={grade} label={grade}>
                  {list.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">Trạng thái nhận xét</span>
            <div className="inline-flex w-full overflow-hidden rounded-xl border border-sky-200/80 bg-white/90 dark:border-cyan-300/30 dark:bg-slate-900/70">
              {REVIEW_TABS.map((tab) => {
                const active = filters.hasReview === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => updateFilter({ hasReview: tab.value })}
                    className={`flex-1 px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-[linear-gradient(135deg,#ffd36a,#ff9b3d)] text-white shadow-inner dark:bg-gradient-to-r dark:from-cyan-500/70 dark:to-sky-600/70'
                        : 'text-slate-700 hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {error && data.items.length > 0 ? (
        <p className="mb-4 rounded-2xl border border-rose-300/40 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </p>
      ) : null}

      {data.items.length === 0 ? (
        <div className="rounded-3xl border border-sky-200/60 bg-white/85 p-10 text-center shadow-sm backdrop-blur-xl dark:border-cyan-300/15 dark:bg-white/5">
          <p className="text-base text-slate-600 dark:text-slate-300">
            Không có bài nộp nào trong ngày{' '}
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {formatVietnamWeekdayDateLine(filters.submittedOn)}
            </span>{' '}
            (giờ Việt Nam) khớp bộ lọc hiện tại.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => {
            const aiScore = item.ai_score;
            const teacherScore = item.teacher_review?.score_override;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/teacher/submissions/${item.id}`)}
                  className="group flex h-full w-full flex-col gap-3 rounded-2xl border border-sky-200/60 bg-white/90 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:border-cyan-300/20 dark:bg-slate-900/60 dark:hover:border-cyan-300/40"
                >
                  <div className="flex items-start gap-3">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt="Thumbnail bài nộp"
                        className="h-16 w-16 shrink-0 rounded-xl border border-sky-200/60 object-cover dark:border-cyan-300/20"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-sky-200/60 text-2xl text-slate-400 dark:border-cyan-300/20">
                        📄
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs uppercase tracking-wide text-sky-600/80 dark:text-cyan-200/70">
                        {item.assignment_title || 'Bài tập đã xóa'}
                      </p>
                      <p className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                        {item.student_full_name || item.student_username || 'Học sinh ẩn'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        Lớp: {item.student_class || '—'} · {formatDate(item.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex gap-2">
                      <ScoreBadge
                        value={aiScore}
                        label="AI"
                        accentClass="border-sky-200/80 bg-sky-50 text-sky-700 dark:border-cyan-300/30 dark:bg-cyan-500/10 dark:text-cyan-100"
                      />
                      <ScoreBadge
                        value={teacherScore}
                        label="GV"
                        accentClass={
                          teacherScore != null
                            ? 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-500/10 dark:text-emerald-200'
                            : 'border-slate-200/80 bg-slate-50 text-slate-500 dark:border-slate-500/30 dark:bg-slate-800/40 dark:text-slate-400'
                        }
                      />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider ${
                        item.has_review
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
                      }`}
                    >
                      {item.has_review ? 'Đã nhận xét' : 'Chưa nhận xét'}
                    </span>
                  </div>

                  <span className="mt-auto text-right text-xs font-medium text-sky-700 transition group-hover:translate-x-0.5 dark:text-cyan-200">
                    Mở để nhận xét →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data.total > PAGE_LIMIT ? (
        <div className="mt-6 flex items-center justify-between gap-3 text-sm">
          <button
            type="button"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
            className="rounded-xl border border-sky-200/80 bg-white px-4 py-2 font-medium text-sky-800 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:-translate-y-0.5 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-cyan-100"
          >
            ← Trang trước
          </button>
          <span className="text-slate-600 dark:text-slate-300">
            Trang <span className="font-semibold tabular-nums">{currentPage}</span> /{' '}
            <span className="tabular-nums">{totalPages}</span>
          </span>
          <button
            type="button"
            disabled={offset + PAGE_LIMIT >= data.total || loading}
            onClick={() => setOffset(offset + PAGE_LIMIT)}
            className="rounded-xl border border-sky-200/80 bg-white px-4 py-2 font-medium text-sky-800 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 enabled:hover:-translate-y-0.5 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-cyan-100"
          >
            Trang sau →
          </button>
        </div>
      ) : null}
    </OceanShell>
  );
}
