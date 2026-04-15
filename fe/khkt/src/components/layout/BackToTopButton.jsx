import { useState, useEffect } from 'react';

const BASE_CLASS =
  'fixed right-5 z-[600] flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,#7dd3fc_0%,#38bdf8_50%,#ffd36a_100%)] text-lg text-white shadow-[0_10px_28px_rgba(86,132,214,0.2)] backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-orange-200/60 focus:outline-none focus:ring-2 focus:ring-sky-400/50 dark:border-cyan-300/35 dark:bg-gradient-to-br dark:from-cyan-500/50 dark:to-sky-700/55 dark:shadow-cyan-950/40 dark:hover:border-cyan-200/40 dark:hover:shadow-cyan-900/50 dark:focus:ring-cyan-400/50 sm:right-8';

/**
 * Nút “lên đầu trang” — cùng giao diện Ocean với danh sách bài tập.
 * @param {object} props
 * @param {string} [props.positionClass] — lớp Tailwind cho khoảng cách đáy (vd. khi có thanh bulk).
 */
export default function BackToTopButton({ positionClass = 'bottom-24 sm:bottom-10' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const threshold = 320;
    const onScroll = () => {
      const y = window.scrollY ?? document.documentElement.scrollTop ?? 0;
      setVisible(y > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })}
      className={`${BASE_CLASS} ${positionClass}`}
      aria-label="Lên đầu trang"
      title="Lên đầu trang"
    >
      <span className="sr-only">Lên đầu trang</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="h-6 w-6"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.5 15.75l7.5-7.5 7.5 7.5"
        />
      </svg>
    </button>
  );
}
