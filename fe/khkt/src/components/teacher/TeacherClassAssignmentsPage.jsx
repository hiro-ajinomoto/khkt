import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchTeacherClassAssignments,
  decodeClassRouteParam,
} from '../../api/teacherWorkspace';
import { deleteAssignment } from '../../api/assignments';
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

/** Ngày giờ để phân biệt bài trùng tên — ưu tiên hiển thị mốc “cập nhật”. */
function formatDateTimeVi(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TeacherClassAssignmentsPage() {
  const { className: classNameParam } = useParams();
  const className = decodeClassRouteParam(classNameParam);
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isTeacher, logout } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
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
        const data = await fetchTeacherClassAssignments(className);
        if (!c) setAssignments(Array.isArray(data?.assignments) ? data.assignments : []);
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
    return <OceanPageLoading message="Đang tải bài tập…" />;
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
          Bài tập · {className}
        </h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          Sắp xếp theo hoạt động mới nhất (tạo hoặc cập nhật). Dùng <strong>Chi tiết</strong> để
          xem đề, <strong>Sửa</strong> để cập nhật nội dung, <strong>Xóa</strong> để gỡ bài khỏi hệ
          thống (kể cả mọi lớp đã gán).
        </p>
        <TeacherClassSubNav className={className} active="assignments" />

        {actionError ? (
          <div
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
            role="alert"
          >
            {actionError}
          </div>
        ) : null}

        {assignments.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">
            Chưa có bài tập nào được gán cho lớp. Gán lớp khi tạo bài hoặc từ{' '}
            <Link to="/assignments" className="font-medium text-sky-700 underline dark:text-cyan-300">
              danh sách bài tập
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {assignments.map((a, idx) => (
              <li
                key={a.id}
                className="rounded-2xl border border-sky-200/60 bg-white/85 px-4 py-4 dark:border-cyan-500/20 dark:bg-slate-900/60"
              >
                <div className="flex gap-3">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-base font-bold tabular-nums text-sky-800 dark:bg-cyan-950/80 dark:text-cyan-200"
                    aria-hidden
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 dark:text-white">{a.title}</div>
                    <div className="mt-1 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {a.grade_level ? (
                        <div>
                          <span className="text-slate-500 dark:text-slate-500">Khối: </span>
                          {a.grade_level}
                        </div>
                      ) : null}
                      <div>
                        <span className="text-slate-500 dark:text-slate-500">Tạo: </span>
                        {formatDateTimeVi(a.created_at)}
                      </div>
                      {a.updated_at ? (
                        <div className="font-medium text-amber-800 dark:text-amber-200/90">
                          <span className="font-normal text-slate-500 dark:text-slate-500">
                            Cập nhật:{' '}
                          </span>
                          {formatDateTimeVi(a.updated_at)}
                        </div>
                      ) : null}
                      {a.available_from_date ? (
                        <div>
                          <span className="text-slate-500 dark:text-slate-500">Mở cho HS: </span>
                          {formatShortDate(a.available_from_date)}
                        </div>
                      ) : null}
                      {a.due_date ? (
                        <div>
                          <span className="text-slate-500 dark:text-slate-500">Hạn nộp: </span>
                          {formatShortDate(a.due_date)}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/assignments/${a.id}`)}
                        className="rounded-xl border border-sky-300/80 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-900 transition hover:bg-sky-100 dark:border-cyan-500/40 dark:bg-cyan-950/50 dark:text-cyan-100 dark:hover:bg-cyan-900/40"
                      >
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/assignments/${a.id}/edit`)}
                        className="rounded-xl border border-emerald-300/80 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
                      >
                        Sửa / cập nhật
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === a.id}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Xóa bài "${a.title}"?\n\nBài sẽ bị gỡ khỏi mọi lớp và không thể hoàn tác.`,
                            )
                          ) {
                            return;
                          }
                          setActionError(null);
                          setDeletingId(a.id);
                          try {
                            await deleteAssignment(a.id);
                            setAssignments((prev) => prev.filter((x) => x.id !== a.id));
                          } catch (e) {
                            setActionError(e.message || 'Không xóa được bài tập.');
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                        className="rounded-xl border border-rose-300/80 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100 dark:hover:bg-rose-900/50"
                      >
                        {deletingId === a.id ? 'Đang xóa…' : 'Xóa bài'}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BackToTopButton />
    </OceanShell>
  );
}
