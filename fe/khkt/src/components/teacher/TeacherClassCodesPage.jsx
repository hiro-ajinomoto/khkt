import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchClassEnrollmentItems,
  rotateClassEnrollmentCode,
} from '../../api/classEnrollment';
import OceanShell, { OceanPageLoading } from '../layout/OceanShell';
import OceanListPageHeader from '../layout/OceanListPageHeader';
import BackToTopButton from '../layout/BackToTopButton';
import { groupClassesByGrade } from '../../api/classes';

export default function TeacherClassCodesPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyClass, setBusyClass] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    const list = await fetchClassEnrollmentItems();
    setItems(list);
  }, []);

  useEffect(() => {
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
  }, [load]);

  const byGrade = groupClassesByGrade(items.map((i) => i.class_name));

  async function handleRotate(className) {
    if (
      !window.confirm(
        'Đổi mã lớp? Học sinh đã trong lớp không bị ảnh hưởng; chỉ người đăng ký mới cần mã mới.'
      )
    ) {
      return;
    }
    try {
      setBusyClass(className);
      setError(null);
      const r = await rotateClassEnrollmentCode(className);
      setItems((prev) =>
        prev.map((row) =>
          row.class_name === r.class_name
            ? { ...row, enrollment_code: r.enrollment_code }
            : row
        )
      );
    } catch (e) {
      setError(e.message || 'Đổi mã thất bại');
    } finally {
      setBusyClass(null);
    }
  }

  if (loading) {
    return <OceanPageLoading message="Đang tải mã lớp…" />;
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
        <h2 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">
          Mã đăng ký lớp
        </h2>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-300">
          Học sinh nhập mã 4 số khi đăng ký để vào đúng lớp. Đổi mã khi cần chặn người lạ hoặc lớp
          bị lộ mã — học sinh hiện tại vẫn ở lớp cũ.
        </p>
        <p className="mb-6">
          <Link
            to="/teacher/classes"
            className="text-sm font-medium text-violet-700 underline decoration-violet-400/60 underline-offset-2 hover:text-violet-900 dark:text-violet-300 dark:hover:text-violet-100"
          >
            → Xem bài tập và học sinh theo từng lớp
          </Link>
        </p>
        {error ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {items.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">
            Bạn chưa được gán lớp nào. Liên hệ quản trị viên để được phân công lớp.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {byGrade.map(([gradeTitle, namesInGrade]) => (
              <section key={gradeTitle}>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">
                  {gradeTitle}
                </h3>
                <ul className="flex flex-col gap-3">
                  {namesInGrade.map((className) => {
                    const row = items.find((i) => i.class_name === className);
                    const code = row?.enrollment_code ?? '—';
                    const busy = busyClass === className;
                    return (
                      <li
                        key={className}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200/60 bg-white/80 px-4 py-3 shadow-sm dark:border-cyan-500/20 dark:bg-slate-900/60"
                      >
                        <div>
                          <span className="font-medium text-slate-900 dark:text-white">
                            {className}
                          </span>
                          <div className="mt-1 font-mono text-lg tracking-widest text-sky-800 dark:text-cyan-200">
                            {code}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleRotate(className)}
                          className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/60"
                        >
                          {busy ? '…' : 'Đổi mã'}
                        </button>
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
