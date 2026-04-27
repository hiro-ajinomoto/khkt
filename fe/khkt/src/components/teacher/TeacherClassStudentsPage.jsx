import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchTeacherClassStudents,
  decodeClassRouteParam,
  removeStudentFromTeacherClass,
} from '../../api/teacherWorkspace';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import BackToTopButton from '../layout/BackToTopButton';
import TeacherClassSubNav from './TeacherClassSubNav';

function formatShortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN');
}

export default function TeacherClassStudentsPage() {
  const { className: classNameParam } = useParams();
  const className = decodeClassRouteParam(classNameParam);
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [actionError, setActionError] = useState(null);

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
        const data = await fetchTeacherClassStudents(className);
        if (!c) setStudents(Array.isArray(data?.students) ? data.students : []);
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
      <div className="mx-auto max-w-3xl px-4 pb-12">
        <h2 className="mb-1 text-xl font-semibold text-slate-900 dark:text-white">
          Học sinh · {className}
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Học sinh đã đăng ký với lớp này (theo dữ liệu tài khoản).{' '}
          <strong>Gỡ khỏi lớp</strong> chỉ xóa lớp trên tài khoản — học sinh có thể đăng ký lại bằng mã
          lớp mới.
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

        {students.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">
            Chưa có học sinh nào gắn lớp này. Học sinh đăng ký bằng{' '}
            <strong>mã lớp</strong> sẽ xuất hiện tại đây.
          </p>
        ) : (
          <ul className="divide-y divide-sky-100 overflow-hidden rounded-2xl border border-sky-200/60 bg-white/85 dark:divide-cyan-950 dark:border-cyan-500/20 dark:bg-slate-900/60">
            {students.map((s, idx) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">@{s.username}</span>
                  <div className="text-xs text-slate-400 tabular-nums dark:text-slate-500">
                    #{idx + 1} · tham gia {formatShortDate(s.created_at)}
                  </div>
                </div>
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
                  className="shrink-0 rounded-xl border border-rose-300/80 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-900/60"
                >
                  {removingId === s.id ? 'Đang gỡ…' : 'Gỡ khỏi lớp'}
                </button>
              </li>
            ))}
          </ul>
        )}

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
