import { Link } from 'react-router-dom';
import { encodeClassNameForPath } from '../../api/teacherWorkspace';

/**
 * @param {{ className: string, active: 'assignments' | 'students' | 'activity' }} props
 */
export default function TeacherClassSubNav({ className, active }) {
  const enc = encodeClassNameForPath(className);
  const base = `/teacher/classes/${enc}`;

  const tabClass = (isActive) =>
    `rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
      isActive
        ? 'bg-sky-600 text-white shadow-md shadow-sky-500/30 dark:bg-cyan-600'
        : 'border border-sky-200/80 bg-white/90 text-sky-900 hover:bg-sky-50 dark:border-cyan-500/30 dark:bg-slate-900/70 dark:text-cyan-100 dark:hover:bg-slate-800'
    }`;

  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-2 border-b border-sky-200/60 pb-4 dark:border-cyan-500/25"
      aria-label="Theo lớp"
    >
      <Link
        to={`${base}/assignments`}
        className={tabClass(active === 'assignments')}
      >
        Bài tập lớp
      </Link>
      <Link
        to={`${base}/activity`}
        className={tabClass(active === 'activity')}
      >
        Tổng quan
      </Link>
      <Link to={`${base}/students`} className={tabClass(active === 'students')}>
        Học sinh
      </Link>
      <Link
        to="/teacher/classes"
        className="ml-auto rounded-xl border border-slate-200/80 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        ← Tất cả lớp
      </Link>
    </nav>
  );
}
