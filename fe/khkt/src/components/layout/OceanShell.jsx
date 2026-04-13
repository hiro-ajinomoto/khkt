/**
 * Shared "Ocean UI" shell: slate/cyan (dark) hoặc ocean + flame (light).
 */
import { useTheme } from '../../contexts/ThemeContext';

export function OceanBackgroundLayers() {
  const { theme } = useTheme();

  if (theme === 'light') {
    return (
      <>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(125,180,255,0.26),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,211,106,0.20),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(255,122,89,0.10),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#fff8f2_100%)]" />
        <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(79,143,232,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(79,143,232,0.07)_1px,transparent_1px)] [background-size:56px_56px]" />
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(59,130,246,0.20),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.18),transparent_32%),linear-gradient(135deg,#020617_0%,#0b1120_34%,#082f49_72%,#0f172a_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
    </>
  );
}

export function OceanWave() {
  const { theme } = useTheme();

  if (theme === 'light') {
    return (
      <div className="pointer-events-none absolute -top-20 left-0 right-0 h-72 opacity-50">
        <svg viewBox="0 0 1440 320" className="h-full w-full">
          <path
            fill="rgba(143,194,255,0.35)"
            d="M0,224L34.3,197.3C68.6,171,137,117,206,101.3C274.3,85,343,107,411,128C480,149,549,171,617,149.3C685.7,128,754,64,823,58.7C891.4,53,960,107,1029,144C1097.1,181,1166,203,1234,186.7C1302.9,171,1371,117,1406,90.7L1440,64L1440,0L0,0Z"
          />
          <path
            fill="rgba(255,200,120,0.18)"
            d="M0,256L26.7,261.3C53.3,267,107,277,160,261.3C213.3,245,267,203,320,170.7C373.3,139,427,117,480,133.3C533.3,149,587,203,640,208C693.3,213,747,171,800,154.7C853.3,139,907,149,960,144C1013.3,139,1067,117,1120,122.7C1173.3,128,1227,160,1280,154.7C1333.3,149,1387,107,1413,85.3L1440,64L1440,0L0,0Z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute -top-20 left-0 right-0 h-72 opacity-60">
      <svg viewBox="0 0 1440 320" className="h-full w-full">
        <path
          fill="rgba(96,165,250,0.18)"
          d="M0,224L34.3,197.3C68.6,171,137,117,206,101.3C274.3,85,343,107,411,128C480,149,549,171,617,149.3C685.7,128,754,64,823,58.7C891.4,53,960,107,1029,144C1097.1,181,1166,203,1234,186.7C1302.9,171,1371,117,1406,90.7L1440,64L1440,0L0,0Z"
        />
        <path
          fill="rgba(34,211,238,0.14)"
          d="M0,256L26.7,261.3C53.3,267,107,277,160,261.3C213.3,245,267,203,320,170.7C373.3,139,427,117,480,133.3C533.3,149,587,203,640,208C693.3,213,747,171,800,154.7C853.3,139,907,149,960,144C1013.3,139,1067,117,1120,122.7C1173.3,128,1227,160,1280,154.7C1333.3,149,1387,107,1413,85.3L1440,64L1440,0L0,0Z"
        />
      </svg>
    </div>
  );
}

/**
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.className]
 * @param {string} [props.contentClassName] — inner wrapper (max-width layout or centered auth)
 * @param {boolean} [props.centered] — vertically center content (auth pages)
 * @param {boolean} [props.showWave]
 */
export default function OceanShell({
  children,
  className = '',
  contentClassName = '',
  centered = false,
  showWave = true,
}) {
  const inner =
    centered
      ? `relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center px-6 py-10 sm:py-12 lg:px-10 ${contentClassName}`
      : `relative z-10 mx-auto w-full max-w-7xl px-6 py-10 lg:px-10 ${contentClassName}`;

  return (
    <div
      className={`relative flex min-h-[100dvh] min-h-screen flex-1 flex-col overflow-hidden bg-[#f8fbff] text-slate-800 dark:bg-slate-950 dark:text-slate-100 ${className}`}
    >
      <OceanBackgroundLayers />
      {showWave ? <OceanWave /> : null}
      <div className={inner}>{children}</div>
    </div>
  );
}

export function OceanPageLoading({ message = 'Đang tải...' }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8fbff] text-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <OceanBackgroundLayers />
      <OceanWave />
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border border-orange-300/50 border-t-transparent dark:border-cyan-300/40" />
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-cyan-200/80">{message}</p>
        </div>
      </div>
    </div>
  );
}

export function OceanPageError({ title = 'Có lỗi xảy ra', message, onRetry, retryLabel = 'Thử lại' }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8fbff] text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <OceanBackgroundLayers />
      <OceanWave />
      <div className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-orange-200/50 bg-white/85 px-8 py-6 text-center shadow-[0_20px_50px_rgba(86,132,214,0.12)] backdrop-blur-xl dark:border-rose-300/30 dark:bg-slate-900/80 dark:shadow-2xl dark:shadow-rose-950/40">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-rose-600/90 dark:text-rose-200/80">{title}</p>
          <p className="mb-5 text-slate-700 dark:text-slate-100">{message}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-2xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a2f_100%)] px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_28px_rgba(255,140,61,0.22)] transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-gradient-to-r dark:from-cyan-500/80 dark:to-blue-600/80 dark:shadow-lg dark:shadow-cyan-950/40"
            >
              {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
