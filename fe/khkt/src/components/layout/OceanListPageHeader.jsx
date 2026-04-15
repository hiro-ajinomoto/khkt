import { useTheme } from '../../contexts/ThemeContext';
import { getAssignmentsNavIcon } from './assignmentsNavIcon';
import ThemeToggle from './ThemeToggle';

/**
 * Header dùng chung trang bài tập và màn chính quản trị (/admin).
 * variant "adminHome": CTA tới /assignments thay vì Trang quản trị.
 */
export default function OceanListPageHeader({
  user,
  isAuthenticated,
  isAdmin = false,
  variant,
  navigate,
  logout,
}) {
  const adminHome = variant === 'adminHome';
  const { theme } = useTheme();
  const assignmentsIcon = getAssignmentsNavIcon(theme);

  return (
    <header className="relative mb-8 flex flex-col gap-4 overflow-hidden rounded-[28px] border border-sky-200/60 bg-white/70 p-4 shadow-[0_12px_40px_rgba(86,132,214,0.12)] backdrop-blur-xl dark:border-cyan-300/15 dark:bg-white/5 dark:shadow-2xl dark:shadow-cyan-950/30 md:mb-10 md:gap-6 md:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(191,217,255,0.18),rgba(255,211,106,0.08),rgba(255,122,89,0.05))] dark:bg-transparent" />
      <div className="relative flex min-w-0 flex-1 items-center justify-between gap-3 lg:justify-start">
        <div className="flex min-w-0 items-center gap-3 md:gap-4">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,#dbeafe_0%,#fff7ed_50%,#ffedd5_100%)] p-1 shadow-lg shadow-orange-200/30 dark:border-cyan-300/30 dark:bg-gradient-to-br dark:from-cyan-300/20 dark:via-sky-400/10 dark:to-blue-500/20 dark:shadow-cyan-950/40 md:h-16 md:w-16">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white/95 text-lg font-bold text-sky-700 dark:bg-slate-900/80 dark:text-cyan-200 md:text-xl">
              {user?.name?.[0] || user?.username?.[0] || 'ST'}
            </div>
            <div className="absolute inset-x-1 top-1 h-4 rounded-full bg-orange-200/50 blur-md dark:bg-cyan-300/20" />
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-sky-600/90 dark:text-cyan-200/80">
              Cuộc thi khoa học kỹ thuật
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">
              Danh sách{' '}
              <span className="bg-[linear-gradient(135deg,#2563eb,#ea580c,#c2410c)] bg-clip-text text-transparent">
                bài tập
              </span>{' '}
              &amp; thử thách
            </h1>
          </div>
        </div>
        {isAuthenticated ? (
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            {!adminHome && isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_100%)] text-lg shadow-md shadow-amber-200/40 transition hover:-translate-y-0.5 dark:border-amber-300/40 dark:bg-gradient-to-r dark:from-amber-500/40 dark:via-amber-400/30 dark:to-amber-500/40 dark:text-amber-50 dark:shadow-amber-950/40"
                aria-label="Trang quản trị"
              >
                <span aria-hidden>⚙️</span>
              </button>
            )}
            {adminHome && (
              <button
                type="button"
                onClick={() => navigate('/assignments')}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,#e0f2fe_0%,#fff7ed_100%)] text-lg shadow-md shadow-sky-200/35 transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-gradient-to-r dark:from-cyan-500/35 dark:to-sky-600/35 dark:text-cyan-50 dark:shadow-cyan-950/40"
                aria-label="Danh sách bài tập"
              >
                <span aria-hidden>{assignmentsIcon}</span>
              </button>
            )}
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-orange-200/80 bg-white/90 text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a59_100%)] hover:text-white dark:border-cyan-400/45 dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg dark:shadow-black/30 dark:hover:border-cyan-300/55 dark:hover:bg-slate-700 dark:hover:text-white"
              aria-label="Đăng xuất"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative z-10 h-5 w-5"
                aria-hidden
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span className="absolute inset-0 hidden translate-x-[-120%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] transition duration-1000 group-hover:translate-x-[120%] dark:block" />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-2xl border border-sky-200/80 bg-white px-3 py-2 text-xs font-medium text-sky-800 shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-slate-900/70 dark:text-cyan-100"
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="rounded-2xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#fb923c_100%)] px-3 py-2 text-xs font-medium text-white shadow-md transition hover:-translate-y-0.5 dark:border-fuchsia-300/40 dark:bg-gradient-to-r dark:from-fuchsia-500/70 dark:to-violet-600/80 dark:shadow-fuchsia-950/40"
            >
              Đăng ký
            </button>
          </div>
        )}
      </div>

      {isAuthenticated ? (
        <div className="relative hidden shrink-0 flex-wrap items-center gap-3 md:flex md:w-auto md:justify-end">
          <ThemeToggle />
          {adminHome ? (
            <button
              type="button"
              onClick={() => navigate('/assignments')}
              className="group relative overflow-hidden rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,#e0f2fe_0%,#fff7ed_55%,#ffedd5_100%)] px-5 py-3 text-sm font-medium text-sky-900 shadow-md shadow-sky-200/35 transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-gradient-to-r dark:from-cyan-500/35 dark:via-sky-500/30 dark:to-blue-600/35 dark:text-cyan-50 dark:shadow-cyan-950/40"
            >
              <span className="relative z-10">{assignmentsIcon} Danh sách bài tập</span>
            </button>
          ) : (
            isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="group relative overflow-hidden rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_100%)] px-5 py-3 text-sm font-medium text-amber-900 shadow-md shadow-amber-200/40 transition hover:-translate-y-0.5 dark:border-amber-300/40 dark:bg-gradient-to-r dark:from-amber-500/40 dark:via-amber-400/30 dark:to-amber-500/40 dark:text-amber-50 dark:shadow-amber-950/40"
              >
                <span className="relative z-10">⚙️ Trang quản trị</span>
              </button>
            )
          )}
          <button
            type="button"
            onClick={logout}
            className="group relative overflow-hidden rounded-2xl border border-orange-200/80 bg-white/90 px-5 py-3 text-sm font-medium text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a59_100%)] hover:text-white dark:border-cyan-400/45 dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg dark:shadow-black/30 dark:hover:border-cyan-300/55 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <span className="relative z-10">Đăng xuất</span>
            <span className="absolute inset-0 hidden translate-x-[-120%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] transition duration-1000 group-hover:translate-x-[120%] dark:block" />
          </button>
        </div>
      ) : (
        <div className="relative hidden shrink-0 flex-wrap items-center gap-3 md:flex md:w-auto md:justify-end">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-2xl border border-sky-200/80 bg-white px-5 py-3 text-sm font-medium text-sky-800 shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-slate-900/70 dark:text-cyan-100 dark:shadow-lg dark:shadow-cyan-950/40"
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="rounded-2xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#fb923c_100%)] px-5 py-3 text-sm font-medium text-white shadow-md shadow-orange-200/40 transition hover:-translate-y-0.5 dark:border-fuchsia-300/40 dark:bg-gradient-to-r dark:from-fuchsia-500/70 dark:to-violet-600/80 dark:shadow-fuchsia-950/40"
          >
            Đăng ký
          </button>
        </div>
      )}
    </header>
  );
}
