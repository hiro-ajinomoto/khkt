import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchTeacherClassSubmissionActivityDay,
  decodeClassRouteParam,
  encodeClassNameForPath,
} from '../../api/teacherWorkspace';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import BackToTopButton from '../layout/BackToTopButton';

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatYmdVi(ymd) {
  const d = new Date(`${ymd}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function scoreFmt(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return String(n);
}

export default function TeacherClassActivityDayPage() {
  const { className: classNameParam, dayYmd: dayRaw } = useParams();
  const className = decodeClassRouteParam(classNameParam);
  const dayYmd = dayRaw ? decodeURIComponent(dayRaw) : '';
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!className || !dayYmd || !YMD_RE.test(dayYmd)) {
      setError(className ? 'Ngày không hợp lệ.' : 'Thiếu tên lớp.');
      setLoading(false);
      return;
    }
    let c = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const d = await fetchTeacherClassSubmissionActivityDay(className, dayYmd);
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
  }, [className, dayYmd]);

  const backToActivity = `/teacher/classes/${encodeClassNameForPath(className)}/activity`;

  if (!className || !dayYmd || !YMD_RE.test(dayYmd)) {
    return (
      <OceanPageError
        title="Lỗi"
        message={!className ? 'Đường dẫn lớp không hợp lệ.' : 'Ngày phải là YYYY-MM-DD.'}
        onRetry={() => navigate('/teacher/classes')}
      />
    );
  }

  if (loading) {
    return <OceanPageLoading message="Đang tải chi tiết ngày…" />;
  }

  if (error || !data) {
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
        <OceanPageError title="Không tải được" message={error || '—'} onRetry={() => navigate(0)} />
      </OceanShell>
    );
  }

  const students = Array.isArray(data.students) ? data.students : [];
  const label = data.label || {};

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
        <p className="mb-4 text-sm">
          <Link
            to={backToActivity}
            className="font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            ← Bảng theo ngày
          </Link>
        </p>
        <h2 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">
          Chi tiết ngày · {data.class_name}
        </h2>
        <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">
          {formatYmdVi(data.date)}{' '}
          <span className="font-mono text-xs text-slate-500">{data.date}</span>
        </p>
        {label.assignments_note ? (
          <p className="mb-6 text-xs text-slate-500 dark:text-slate-400">{label.assignments_note}</p>
        ) : null}

        {students.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">
            Không có học sinh nào nộp bài vào ngày này (trong các bài tập đã gán cho lớp).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-sky-200/60 bg-white/85 dark:border-cyan-500/20 dark:bg-slate-900/60">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-sky-100 bg-sky-50/80 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-cyan-950 dark:bg-cyan-950/40 dark:text-cyan-200/90">
                  <th className="px-4 py-3">Học sinh</th>
                  <th className="px-4 py-3 tabular-nums">ĐTB (trong ngày)</th>
                  <th className="px-4 py-3 tabular-nums">Lượt nộp</th>
                  <th className="px-4 py-3 tabular-nums text-center">
                    Bài trong ngày / Tổng bài
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => (
                  <tr
                    key={s.student_id}
                    className="border-b border-sky-50 align-top odd:bg-white/70 even:bg-sky-50/40 dark:border-cyan-950/50 dark:odd:bg-slate-900/45 dark:even:bg-slate-900/25"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      <span className="tabular-nums text-xs text-slate-400">{idx + 1}. </span>
                      {s.student_name}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-100">
                      {scoreFmt(s.avg_score)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-800 dark:text-slate-100">
                      {s.submission_count}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums font-medium text-slate-900 dark:text-white">
                      {s.assignments_done} / {s.assignments_total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <BackToTopButton />
    </OceanShell>
  );
}
