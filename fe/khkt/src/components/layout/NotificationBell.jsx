import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications';
import { useAuth } from '../../contexts/AuthContext';

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

export default function NotificationBell({ className = '', compact = false }) {
  const { isAuthenticated, isTeacher, isAdmin, user } = useAuth();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [panelPosition, setPanelPosition] = useState({ top: 80, right: 16 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const canViewNotifications = isAuthenticated && (isTeacher || isAdmin);

  const loadNotifications = useCallback(
    async ({ showLoading = false } = {}) => {
      if (!canViewNotifications) return;
      if (showLoading) setLoading(true);
      setError(null);
      try {
        const data = await fetchNotifications({ limit: 20 });
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
      setPanelPosition({
        top: Math.round(rect.bottom + 10),
        right: Math.max(12, Math.round(window.innerWidth - rect.right)),
      });
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
  }, [open]);

  if (!canViewNotifications) return null;

  async function handleToggle() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await loadNotifications({ showLoading: items.length === 0 });
    }
  }

  async function handleMarkOne(notification) {
    if (!notification || notification.read) return;
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

  const buttonClass = compact
    ? 'relative flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/80 bg-white/90 text-lg shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/30 dark:bg-slate-900/70'
    : 'relative overflow-visible rounded-2xl border border-amber-200/80 bg-white/90 px-4 py-3 text-sm font-medium text-amber-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-50 dark:border-cyan-300/30 dark:bg-slate-900/70 dark:text-cyan-100 dark:hover:bg-slate-800';

  const panel = open ? (
    <div
      ref={panelRef}
      className="fixed z-[200] w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-3xl border border-sky-200/70 bg-white/95 text-slate-800 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur-xl dark:border-cyan-300/20 dark:bg-slate-950/95 dark:text-slate-100"
      style={{
        top: panelPosition.top,
        right: panelPosition.right,
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-sky-100/80 px-4 py-3 dark:border-cyan-300/10">
        <div>
          <p className="text-sm font-semibold">Thông báo</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : 'Không có thông báo mới'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={unreadCount === 0}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-cyan-200 dark:hover:bg-slate-800"
        >
          Đánh dấu đã đọc
        </button>
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
              onClick={() => loadNotifications({ showLoading: true })}
              className="rounded-xl border border-sky-200 px-3 py-1.5 text-xs font-medium text-sky-700 dark:border-cyan-300/30 dark:text-cyan-200"
            >
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Chưa có thông báo nào.
          </p>
        ) : (
          <ul className="divide-y divide-sky-100/80 dark:divide-cyan-300/10">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleMarkOne(item)}
                  className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-sky-50/80 dark:hover:bg-slate-900 ${
                    item.read ? 'opacity-75' : 'bg-amber-50/70 dark:bg-cyan-500/10'
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
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={buttonClass}
        aria-label={`Thông báo${unreadCount > 0 ? `, ${unreadCount} chưa đọc` : ''}`}
        aria-expanded={open}
        title="Thông báo"
      >
        <span className="relative z-10" aria-hidden>
          🔔
        </span>
        {!compact ? <span className="relative z-10 ml-2">Thông báo</span> : null}
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
