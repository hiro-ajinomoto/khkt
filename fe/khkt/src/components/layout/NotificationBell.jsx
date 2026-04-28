import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications';
import { useAuth } from '../../contexts/AuthContext';
import './NotificationBell.css';

const POLL_INTERVAL_MS = 15_000;

function formatRelativeTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000));
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function dockUnreadOnly(variant, open, listMode) {
  return variant === 'dock' && open && listMode === 'unread';
}

/** Matches Tailwind `w-[min(24rem,calc(100vw-1.5rem))]` — used to clamp dock popover horizontally. */
function getDockPanelWidthPx() {
  const margin = 24;
  const maxArtboard = Math.min(24 * 16, Math.max(0, window.innerWidth - margin));
  return maxArtboard;
}

function clampDockPanelLeft(centerX, panelWidthPx) {
  const edge = 12;
  const innerW = window.innerWidth;
  if (panelWidthPx >= innerW - 2 * edge) {
    return edge;
  }
  const ideal = centerX - panelWidthPx / 2;
  return Math.round(Math.max(edge, Math.min(ideal, innerW - panelWidthPx - edge)));
}

export default function NotificationBell({
  className = '',
  compact = false,
  variant = 'header',
}) {
  const { isAuthenticated, isTeacher, isAdmin, isStudent, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [listMode, setListMode] = useState('unread');
  const [panelPosition, setPanelPosition] = useState({
    kind: 'header',
    top: 80,
    right: 16,
  });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const variantRef = useRef(variant);
  const openRef = useRef(open);
  const listModeRef = useRef(listMode);

  useEffect(() => {
    variantRef.current = variant;
  }, [variant]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    listModeRef.current = listMode;
  }, [listMode]);

  const canViewNotifications =
    isAuthenticated && (isTeacher || isAdmin || isStudent);

  const loadNotifications = useCallback(
    async ({ showLoading = false, unreadOnlyOverride } = {}) => {
      if (!canViewNotifications) return;
      if (showLoading) setLoading(true);
      setError(null);
      const unreadOnly =
        unreadOnlyOverride !== undefined
          ? unreadOnlyOverride
          : dockUnreadOnly(
              variantRef.current,
              openRef.current,
              listModeRef.current,
            );
      try {
        const data = await fetchNotifications({ limit: 20, unreadOnly });
        setItems(Array.isArray(data?.items) ? data.items : []);
        setUnreadCount(
          Number.isFinite(data?.unread_count) ? data.unread_count : 0,
        );
      } catch (err) {
        setError(err.message || 'Không tải được thông báo.');
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [canViewNotifications],
  );

  useEffect(() => {
    if (!canViewNotifications) return undefined;

    loadNotifications({ showLoading: true });
    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, POLL_INTERVAL_MS);

    function handleFocus() {
      loadNotifications();
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') loadNotifications();
    }
    function handleAuthChange() {
      loadNotifications({ showLoading: true });
    }

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('khkt-auth-changed', handleAuthChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('khkt-auth-changed', handleAuthChange);
    };
  }, [canViewNotifications, user?.id, user?.role, loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    function updatePosition() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (variant === 'dock') {
        const bellCenter = rect.left + rect.width / 2;
        const panelW = getDockPanelWidthPx();
        setPanelPosition({
          kind: 'dock',
          left: clampDockPanelLeft(bellCenter, panelW),
          bottom: window.innerHeight - rect.top + 12,
        });
      } else {
        setPanelPosition({
          kind: 'header',
          top: Math.round(rect.bottom + 10),
          right: Math.max(12, Math.round(window.innerWidth - rect.right)),
        });
      }
    }

    function handlePointerDown(event) {
      if (
        buttonRef.current?.contains(event.target) ||
        panelRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    }

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open, variant]);

  if (!canViewNotifications) return null;

  async function handleToggle() {
    const nextOpen = !open;
    if (nextOpen && variant === 'dock') {
      setListMode('unread');
    }
    setOpen(nextOpen);
    if (nextOpen) {
      if (variant === 'dock') {
        await loadNotifications({
          showLoading: true,
          unreadOnlyOverride: true,
        });
      } else {
        await loadNotifications({ showLoading: items.length === 0 });
      }
    }
  }

  async function handleDockFilterChange(mode) {
    if (mode === listMode) return;
    setListMode(mode);
    await loadNotifications({
      showLoading: true,
      unreadOnlyOverride: mode === 'unread',
    });
  }

  async function handleActivateNotification(notification) {
    if (!notification) return;
    const wasUnread = !notification.read;
    if (wasUnread) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await markNotificationRead(notification.id);
      } catch (_err) {
        loadNotifications();
        return;
      }
    }
    if (isStudent && notification.submission_id) {
      const q = new URLSearchParams({
        open: notification.submission_id,
        highlight: 'teacher_review',
      });
      navigate(`/my-submissions?${q.toString()}`);
      setOpen(false);
    }
  }

  async function handleMarkAll() {
    if (unreadCount === 0) return;
    setItems((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch (_err) {
      loadNotifications();
    }
  }

  const buttonClass =
    variant === 'dock'
      ? 'relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/80 bg-white/95 text-lg shadow-md shadow-amber-200/25 ring-2 ring-white/40 transition hover:-translate-y-0.5 dark:border-cyan-300/35 dark:bg-slate-900/85 dark:shadow-cyan-950/35'
      : compact
        ? 'relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/80 bg-white/90 text-lg shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/30 dark:bg-slate-900/70'
        : 'relative overflow-visible rounded-2xl border border-amber-200/80 bg-white/90 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-cyan-100 dark:hover:bg-slate-800';

  const listEmptyHints =
    variant === 'dock' && listMode === 'unread' && unreadCount === 0
      ? 'Không còn thông báo chưa đọc.'
      : 'Chưa có thông báo nào.';

  const panelZ =
    variant === 'dock'
      ? 'z-[960]'
      : 'z-[200]';

  const panelStyle =
    panelPosition.kind === 'dock'
      ? {
          left: panelPosition.left,
          bottom: panelPosition.bottom,
        }
      : {
          top: panelPosition.top,
          right: panelPosition.right,
        };

  const panel = open ? (
    <div
      ref={panelRef}
      className={`fixed ${panelZ} w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-sky-200/70 bg-white/95 text-slate-800 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-cyan-300/20 dark:bg-slate-950/95 dark:text-slate-100`}
      style={panelStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-100/80 px-4 py-3 dark:border-cyan-300/10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Thông báo</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {variant === 'dock' && listMode === 'unread'
              ? 'Chưa đọc — chạm vào để xem chi tiết'
              : unreadCount > 0
                ? `${unreadCount} thông báo chưa đọc`
                : 'Không có thông báo mới'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {variant === 'dock' ? (
            <div className="flex rounded-xl border border-sky-200/80 p-0.5 dark:border-cyan-300/20">
              <button
                type="button"
                onClick={() => handleDockFilterChange('unread')}
                className={`rounded-[10px] px-2.5 py-1 text-xs font-medium transition ${
                  listMode === 'unread'
                    ? 'bg-sky-100 text-sky-900 dark:bg-slate-800 dark:text-cyan-100'
                    : 'text-slate-600 hover:bg-sky-50/80 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                Chưa đọc
              </button>
              <button
                type="button"
                onClick={() => handleDockFilterChange('all')}
                className={`rounded-[10px] px-2.5 py-1 text-xs font-medium transition ${
                  listMode === 'all'
                    ? 'bg-sky-100 text-sky-900 dark:bg-slate-800 dark:text-cyan-100'
                    : 'text-slate-600 hover:bg-sky-50/80 dark:text-slate-400 dark:hover:bg-slate-900'
                }`}
              >
                Tất cả
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            className="rounded-xl px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-cyan-200 dark:hover:bg-slate-800"
          >
            Đánh dấu đã đọc
          </button>
        </div>
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        {loading ? (
          <p className="px-4 py-5 text-center text-sm text-slate-500 dark:text-slate-400">
            Đang tải thông báo...
          </p>
        ) : error ? (
          <div className="px-4 py-5 text-center">
            <p className="mb-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
            <button
              type="button"
              onClick={() =>
                loadNotifications({
                  showLoading: true,
                  unreadOnlyOverride: dockUnreadOnly(variant, true, listMode),
                })
              }
              className="rounded-xl border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-cyan-300/30 dark:text-cyan-200"
            >
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>{listEmptyHints}</p>
          </div>
        ) : (
          <ul className="divide-y divide-sky-100/80 dark:divide-cyan-300/10">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleActivateNotification(item)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-sky-50/80 dark:hover:bg-slate-900 ${
                    item.read
                      ? 'opacity-75'
                      : 'bg-amber-50/70 dark:bg-cyan-500/10'
                  }`}
                >
                  <span
                    className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${
                      item.read
                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        : 'bg-[linear-gradient(135deg,#fcd34d,#f97316)] text-white shadow-md shadow-amber-200/50 dark:from-cyan-400 dark:to-blue-500 dark:shadow-cyan-950/40'
                    }`}
                    aria-hidden
                  >
                    👤
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {item.title}
                      </span>
                      {!item.read ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      {item.message}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${variant === 'dock' ? 'pointer-events-auto' : ''} ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={buttonClass}
        aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ''}`}
        aria-expanded={open}
        title="Thông báo"
      >
        <span
          className={`relative z-10 ${unreadCount > 0 ? 'notification-bell__glyph--shake' : ''}`}
          aria-hidden
        >
          🔔
        </span>
        {!compact && variant !== 'dock' ? (
          <span className="relative z-10 ml-2">Thông báo</span>
        ) : null}
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 z-20 flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[0.65rem] font-bold leading-none text-white shadow-md dark:border-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
