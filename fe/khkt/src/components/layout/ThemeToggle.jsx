import { useTheme } from '../../contexts/ThemeContext';

/**
 * Nút bật/tắt giao diện sáng · tối (Ocean Flame light / Ocean dark).
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent ${className} border-sky-200/80 bg-white/90 text-slate-700 shadow-[0_8px_24px_rgba(86,132,214,0.12)] hover:border-orange-200 hover:bg-[linear-gradient(135deg,#fffefb,#fff5e6)] dark:border-cyan-400/25 dark:bg-slate-900/60 dark:text-cyan-100 dark:shadow-cyan-950/30 dark:hover:border-cyan-300/45 dark:hover:bg-slate-800/80`}
      aria-pressed={isDark}
      title={isDark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
    >
      <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,#7fb7ff_0%,#ffd36a_55%,#ff8d4d_100%)] text-white shadow-[0_4px_12px_rgba(255,140,61,0.25)] dark:bg-gradient-to-br dark:from-slate-700 dark:via-slate-800 dark:to-slate-900 dark:shadow-none">
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M12 3a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0V4a1 1 0 0 0-1-1zm0 15a1 1 0 0 0-1 1v1a1 1 0 0 0 2 0v-1a1 1 0 0 0-1-1zm8-9h-1a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zM5 11H4a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm13.657-5.657a1 1 0 0 0-1.414 0l-.707.707a1 1 0 1 0 1.414 1.414l.707-.707a1 1 0 0 0 0-1.414zM7.05 16.95a1 1 0 0 0-1.414 0 1 1 0 0 0 0 1.414l.707.707a1 1 0 1 0 1.414-1.414l-.707-.707zm10.607 0a1 1 0 1 0-1.414 1.414l.707.707a1 1 0 0 0 1.414-1.414l-.707-.707zM7.05 7.05 6.343 6.343a1 1 0 0 0-1.414 1.414l.707.707A1 1 0 1 0 7.757 7.757L7.05 7.05zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
            <path d="M21 14.5A7.5 7.5 0 0 1 9.59 3.17 7.5 7.5 0 1 0 21 14.5z" />
          </svg>
        )}
      </span>
      <span className="hidden sm:inline">{isDark ? 'Giao diện tối' : 'Giao diện sáng'}</span>
    </button>
  );
}
