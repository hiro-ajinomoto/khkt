import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchTeacherClassesOverview,
  encodeClassNameForPath,
} from '../../api/teacherWorkspace';
import { groupClassesByGrade } from '../../api/classes';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import BackToTopButton from '../layout/BackToTopButton';

export default function TeacherClassesHomePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchTeacherClassesOverview();
        if (!c) setClasses(Array.isArray(data?.classes) ? data.classes : []);
      } catch (e) {
        if (!c) setError(e.message || 'Không tải được');
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  if (loading) {
    return <OceanPageLoading message="Đang tải danh sách lớp…" />;
  }

  if (error) {
    return (
      <OceanPageError
        title="Không tải được"
        message={error}
        onRetry={() => navigate(0)}
      />
    );
  }

  const byGrade = groupClassesByGrade(classes.map((row) => row.class_name));

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
          Lớp của tôi
        </h2>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Chọn lớp để xem bài tập đã gán, tổng quan nộp bài theo ngày và danh sách học sinh.
        </p>

        {classes.length === 0 ? (
          <div className="rounded-2xl border border-amber-300/60 bg-amber-50/90 px-4 py-4 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            Bạn chưa được phân lớp nào. Liên hệ quản trị (mục <strong>GV — lớp</strong>) để
            được gán lớp, hoặc dùng{' '}
            <Link to="/assignments" className="font-semibold underline">
              danh sách bài tập
            </Link>{' '}
            chung.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {byGrade.map(([gradeTitle, namesInGrade]) => (
              <section key={gradeTitle}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-sky-700 dark:text-cyan-300">
                  {gradeTitle}
                </h3>
                <ul className="flex flex-col gap-3">
                  {namesInGrade.map((className) => {
                    const row = classes.find((r) => r.class_name === className);
                    const enc = encodeClassNameForPath(className);
                    return (
                      <li
                        key={className}
                        className="rounded-2xl border border-sky-200/60 bg-white/85 px-4 py-4 shadow-sm dark:border-cyan-500/20 dark:bg-slate-900/60"
                      >
                        <div className="mb-3 font-medium text-slate-900 dark:text-white">
                          {className}
                        </div>
                        <div className="mb-3 flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-300">
                          <span>
                            <strong className="tabular-nums text-slate-900 dark:text-white">
                              {row?.student_count ?? 0}
                            </strong>{' '}
                            học sinh
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span>
                            <strong className="tabular-nums text-slate-900 dark:text-white">
                              {row?.assignment_count ?? 0}
                            </strong>{' '}
                            bài đã gán
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/teacher/classes/${enc}/assignments`}
                            className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 dark:bg-cyan-600 dark:hover:bg-cyan-500"
                          >
                            Bài tập
                          </Link>
                          <Link
                            to={`/teacher/classes/${enc}/activity`}
                            className="rounded-xl border border-sky-200/80 bg-white px-4 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-50 dark:border-cyan-500/35 dark:bg-slate-800 dark:text-cyan-100 dark:hover:bg-slate-700"
                          >
                            Tổng quan
                          </Link>
                          <Link
                            to={`/teacher/classes/${enc}/students`}
                            className="rounded-xl border border-sky-200/80 bg-white px-4 py-2 text-sm font-medium text-sky-900 transition hover:bg-sky-50 dark:border-cyan-500/35 dark:bg-slate-800 dark:text-cyan-100 dark:hover:bg-slate-700"
                          >
                            Học sinh
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
      <BackToTopButton />
    </OceanShell>
  );
}
