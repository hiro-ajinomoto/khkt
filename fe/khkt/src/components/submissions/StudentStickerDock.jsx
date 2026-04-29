import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyStickers } from '../../api/submissions';
import { STUDENT_STICKERS_REFRESH_EVENT } from './studentStickersEvents';
import NotificationBell from '../layout/NotificationBell';
import './StudentStickerDock.css';

const PHONE_IDLE_MS = 2200;
const MQ_PHONE = '(max-width: 767px)';

const BEAR_SRC = `${import.meta.env.BASE_URL}sticker-bear-mascot.jpg`;

/**
 * Student: bear mascot holding a sign; sticker count is drawn on the white board.
 * On narrow screens, show when idle (hide while touching/scrolling).
 */
export default function StudentStickerDock() {
  const { isAuthenticated, isStudent, loading, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isPhone, setIsPhone] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(true);
  const [justIncreased, setJustIncreased] = useState(false);
  const idleTimerRef = useRef(null);
  const prevTotalRef = useRef(null);
  const bumpTimerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !isStudent || loading) return;

    let cancelled = false;
    const reload = () => {
      fetchMyStickers()
        .then((data) => {
          if (cancelled) return;
          setStats(data);
          const next = data?.total_sticker_count ?? 0;
          const prev = prevTotalRef.current;
          if (prev != null && next > prev) {
            setJustIncreased(true);
            if (bumpTimerRef.current) clearTimeout(bumpTimerRef.current);
            bumpTimerRef.current = window.setTimeout(() => {
              setJustIncreased(false);
              bumpTimerRef.current = null;
            }, 1500);
          }
          prevTotalRef.current = next;
        })
        .catch(() => {
          if (!cancelled) setStats(null);
        });
    };

    reload();
    window.addEventListener(STUDENT_STICKERS_REFRESH_EVENT, reload);
    return () => {
      cancelled = true;
      window.removeEventListener(STUDENT_STICKERS_REFRESH_EVENT, reload);
      if (bumpTimerRef.current) {
        clearTimeout(bumpTimerRef.current);
        bumpTimerRef.current = null;
      }
    };
  }, [isAuthenticated, isStudent, loading]);

  useEffect(() => {
    const mq = window.matchMedia(MQ_PHONE);
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isStudent || loading || !isPhone) return;

    const scheduleShow = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        setPhoneVisible(true);
        idleTimerRef.current = null;
      }, PHONE_IDLE_MS);
    };

    const onBusy = () => {
      setPhoneVisible(false);
      scheduleShow();
    };

    const opts = { passive: true };
    window.addEventListener('touchstart', onBusy, opts);
    window.addEventListener('touchmove', onBusy, opts);
    window.addEventListener('scroll', onBusy, opts);

    scheduleShow();

    return () => {
      window.removeEventListener('touchstart', onBusy);
      window.removeEventListener('touchmove', onBusy);
      window.removeEventListener('scroll', onBusy);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isAuthenticated, isStudent, loading, isPhone]);

  if (!isAuthenticated || !isStudent || loading) {
    return null;
  }

  const total = stats?.total_sticker_count ?? 0;
  const showBloom = !isPhone || phoneVisible;
  const streak = user?.streak_current ?? 0;

  return (
    <div
      className={`student-sticker-bloom ${showBloom ? 'student-sticker-bloom--visible' : 'student-sticker-bloom--hidden-touch'}`}
      aria-live="polite"
      aria-label={`Streak ${streak} ngày, sticker ${total}`}
    >
      <div className="student-sticker-bloom__inner">
        <div className="student-sticker-bloom__stack">
          <div
            className="student-sticker-bloom__streak"
            title={`Streak ${streak} ngày (kỷ lục ${user?.streak_longest ?? 0}) — mỗi ngày VN có nộp bài là +1; bỏ một ngày thì streak về 0.`}
          >
            <span className="student-sticker-bloom__streak-flame" aria-hidden>
              🔥
            </span>
            <span className="student-sticker-bloom__streak-num tabular-nums">{streak}</span>
          </div>
          <NotificationBell variant="dock" />
          <div className="student-sticker-bloom__bear-motion">
            <Link
              to="/sticker-rewards"
              className="student-sticker-bloom__hit"
              aria-label={'\u0110\u1ebfn trang \u0111\u1ed5i qu\u00e0 sticker'}
            >
              <div
                className={`student-sticker-bloom__figure ${justIncreased ? 'student-sticker-bloom__figure--bump' : ''}`}
              >
                <img
                  className="student-sticker-bloom__img"
                  src={BEAR_SRC}
                  alt=""
                  width={682}
                  height={1024}
                  decoding="async"
                />
                <span
                  className={`student-sticker-bloom__count-on-sign ${justIncreased ? 'student-sticker-bloom__count-on-sign--pulse' : ''}`}
                >
                  {total}
                </span>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
