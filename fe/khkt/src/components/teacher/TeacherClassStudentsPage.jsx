import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchTeacherClassStudents,
  fetchTeacherClassRanking,
  decodeClassRouteParam,
  removeStudentFromTeacherClass,
} from '../../api/teacherWorkspace';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import BackToTopButton from '../layout/BackToTopButton';
import TeacherClassSubNav from './TeacherClassSubNav';

const SCORE_PERIODS = [
  { id: 'overall', label: 'ĐTB tổng' },
  { id: 'day', label: 'Trong ngày' },
  { id: 'week', label: 'Trong tuần' },
  { id: 'month', label: 'Trong tháng' },
];

function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

/** YYYY-MM-DD → d/m/y */
function formatYmdVn(ymd) {
  if (!ymd || typeof ymd !== 'string') return '—';
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

function PodiumMark({ rank }) {
  if (rank === 1) {
    return (
      <span className="text-base leading-none" title="Hạng 1" aria-hidden>
        🏆
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="text-base leading-none" title="Hạng 2" aria-hidden>
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="text-base leading-none" title="Hạng 3" aria-hidden>
        🥉
      </span>
    );
  }
  return null;
}

export default function TeacherClassStudentsPage() {
  const { className: classNameParam } = useParams();
  const className = decodeClassRouteParam(classNameParam);
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [rankingNote, setRankingNote] = useState(null);
  const [scorePeriod, setScorePeriod] = useState('overall');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const studentsStreakOrdered = useMemo(() => {
    const list = students.map((s) => ({ ...s }));
    list.sort((a, b) => {
      if (b.streak_current !== a.streak_current) return b.streak_current - a.streak_current;
      if (b.streak_longest !== a.streak_longest) return b.streak_longest - a.streak_longest;
      return (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true });
    });
    let rank = 1;
    return list.map((s, i) => {
      if (i > 0 && s.streak_current !== list[i - 1].streak_current) {
        rank = i + 1;
      }
      return { ...s, streak_rank: rank };
    });
  }, [students]);

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
        setError(null);
        setRanking(null);
        setRankingNote(null);
        const [stuRes, rankRes] = await Promise.allSettled([
          fetchTeacherClassStudents(className),
          fetchTeacherClassRanking(className),
        ]);
        if (c) return;
        if (stuRes.status === 'rejected') {
          throw stuRes.reason;
        }
        const data = stuRes.value;
        setStudents(Array.isArray(data?.students) ? data.students : []);
        if (rankRes.status === 'fulfilled') {
          setRanking(rankRes.value);
        } else {
          setRankingNote(
            rankRes.reason?.message || 'Không tải được xếp hạng điểm.',
          );
        }
      } catch (e) {
        if (!c) setError(e.message || 'Không tải được');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [className]);

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
    return <OceanPageLoading message="Đang tải học sinh…" />;
  }

  if (error) {
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
        <OceanPageError
          title="Không tải được"
          message={error}
          onRetry={() => navigate(0)}
        />
      </OceanShell>
    );
  }

  const scoreSlice = ranking?.[scorePeriod];
  const scoreEntries = Array.isArray(scoreSlice?.entries) ? scoreSlice.entries : [];

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
      <div className="mx-auto max-w-4xl px-4 pb-12">
        <h2 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">
          Học sinh · {className}
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Streak: số ngày liên tiếp (giờ Việt Nam) học sinh có nộp bài; bỏ quá một ngày thì streak
          hiện tại về 0 (kỷ lục giữ nguyên). Xếp hạng điểm theo điểm bài đã chấm trong kỳ.
        </p>
        <TeacherClassSubNav className={className} active="students" />

        {actionError ? (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {actionError}
          </div>
        ) : null}
        {rankingNote ? (
          <div
            className="mb-4 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-100"
            role="status"
          >
            {rankingNote}
          </div>
        ) : null}

        <section
          className="mb-8 rounded-2xl border border-orange-200/70 bg-gradient-to-br from-orange-50/90 to-amber-50/50 p-4 shadow-sm dark:border-orange-500/25 dark:from-orange-950/40 dark:to-amber-950/30 sm:p-5"
          aria-labelledby="streak-heading"
        >
          <h3 id="streak-heading" className="mb-1 text-lg font-semibold text-slate-900 dark:text-white">
            🔥 Xếp hạng streak (ngày liên tiếp có nộp)
          </h3>
          {students.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-400">
              Chưa có học sinh nào gắn lớp này. Học sinh đăng ký bằng{' '}
              <strong>mã lớp</strong> sẽ xuất hiện tại đây.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/60 bg-white/80 dark:border-slate-600/40 dark:bg-slate-900/70">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-slate-400">
                    <th className="px-3 py-2.5 tabular-nums">Hạng</th>
                    <th className="px-3 py-2.5">Học sinh</th>
                    <th className="px-3 py-2.5 text-right tabular-nums">Streak</th>
                    <th className="px-3 py-2.5 text-right tabular-nums">Kỷ lục</th>
                    <th className="hidden px-3 py-2.5 sm:table-cell">Hoạt động cuối</th>
                    <th className="hidden px-3 py-2.5 md:table-cell">Tham gia</th>
                    <th className="px-3 py-2.5 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {studentsStreakOrdered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-100 align-middle odd:bg-white/90 even:bg-slate-50/70 dark:border-slate-700/60 dark:odd:bg-slate-900/30 dark:even:bg-slate-800/25"
                    >
                      <td className="px-3 py-2.5 tabular-nums text-slate-800 dark:text-slate-100">
                        <span className="inline-flex items-center gap-1">
                          <PodiumMark rank={s.streak_rank} />
                          {s.streak_rank}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">@{s.username}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-orange-800 dark:text-orange-200">
                        {s.streak_current ?? 0}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {s.streak_longest ?? 0}
                      </td>
                      <td className="hidden px-3 py-2.5 text-slate-600 tabular-nums sm:table-cell dark:text-slate-400">
                        {formatYmdVn(s.streak_last_activity_ymd)}
                      </td>
                      <td className="hidden px-3 py-2.5 text-slate-600 md:table-cell dark:text-slate-400">
                        {formatShortDate(s.created_at)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={removingId === s.id}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Gỡ ${s.name} (@${s.username}) khỏi lớp "${className}"?\n\nTài khoản vẫn tồn tại; học sinh có thể đăng ký lớp khác bằng mã.`,
                              )
                            ) {
                              return;
                            }
                            setActionError(null);
                            setRemovingId(s.id);
                            try {
                              await removeStudentFromTeacherClass(className, s.id);
                              setStudents((prev) => prev.filter((x) => x.id !== s.id));
                            } catch (e) {
                              setActionError(e.message || 'Không gỡ được học sinh.');
                            } finally {
                              setRemovingId(null);
                            }
                          }}
                          className="rounded-lg border border-rose-300/80 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-900/60"
                        >
                          {removingId === s.id ? '…' : 'Gỡ'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {ranking ? (
          <section
            className="rounded-2xl border border-sky-200/70 bg-white/85 p-4 shadow-sm dark:border-cyan-500/25 dark:bg-slate-900/60 sm:p-5"
            aria-labelledby="score-rank-heading"
          >
            <h3 id="score-rank-heading" className="mb-3 text-lg font-semibold text-slate-900 dark:text-white">
              📊 Xếp hạng điểm — ĐTB theo kỳ (ưu tiên tab &quot;ĐTB tổng&quot; để xếp hạng ổn định)
            </h3>
            <div
              className="mb-3 flex gap-1 rounded-xl bg-sky-50/90 p-1 dark:bg-slate-800/80"
              role="tablist"
              aria-label="Kỳ xếp hạng điểm"
            >
              {SCORE_PERIODS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={scorePeriod === id}
                  onClick={() => setScorePeriod(id)}
                  className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-center text-xs font-semibold transition sm:text-sm ${
                    scorePeriod === id
                      ? 'bg-white text-sky-900 shadow-sm dark:bg-cyan-950/90 dark:text-cyan-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {scoreSlice?.range_label ? (
              <p className="mb-1 text-center text-xs text-slate-500 dark:text-slate-400">
                {scoreSlice.range_label}
              </p>
            ) : null}
            {scoreSlice?.metric_label ? (
              <p className="mb-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {scoreSlice.metric_label}
              </p>
            ) : null}
            {scoreEntries.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Chưa có đủ dữ liệu chấm điểm trong kỳ này (hoặc chưa có bài đã gán có điểm).
              </p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-sky-100 dark:border-slate-600/50">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-sky-100 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-600 dark:text-cyan-200/80">
                      <th className="px-2 py-2 tabular-nums">Hạng</th>
                      <th className="px-2 py-2">Học sinh</th>
                      <th className="px-2 py-2 text-right tabular-nums">ĐTB</th>
                      <th className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">Bài</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreEntries.map((row) => (
                      <tr
                        key={row.student_id}
                        className="border-b border-sky-50 align-middle dark:border-slate-700/50 odd:bg-white/80 even:bg-sky-50/40 dark:odd:bg-slate-900/30 dark:even:bg-slate-800/20"
                      >
                        <td className="px-2 py-2.5 tabular-nums text-slate-800 dark:text-slate-100">
                          <span className="inline-flex items-center gap-1.5">
                            <PodiumMark rank={row.rank} />
                            {row.rank}
                          </span>
                        </td>
                        <td className="max-w-[14rem] truncate px-2 py-2.5 text-slate-900 dark:text-white">
                          {row.display_name}
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                          {row.avg_score != null ? row.avg_score : '—'}
                        </td>
                        <td className="hidden px-2 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300 sm:table-cell">
                          {row.assignments_graded ?? 0}
                        </td>
                      </tr>
                    ))}
                    </tbody>
                  </table>
                </div>
              )}
          </section>
        ) : null}

        {isAdmin ? (
          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Chỉnh sửa lớp học sinh:{' '}
            <Link to="/admin/users/students" className="underline">
              Quản trị → Học sinh
            </Link>
            .
          </p>
        ) : null}
      </div>
      <BackToTopButton />
    </OceanShell>
  );
}
