import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyStickers } from '../../api/submissions';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import { STICKER_REWARD_TIERS } from './stickerRewardTiers';
import './StickerRedeem.css';

function StickerRedeem() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStickers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchMyStickers();
      setStats(data);
    } catch (err) {
      setError(err.message || 'Không tải được dữ liệu sticker');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStickers();
  }, [loadStickers]);

  if (authLoading) {
    return <OceanPageLoading message="Đang tải..." />;
  }

  if (error) {
    return (
      <OceanPageError
        message={error}
        retryLabel="Thử lại"
        onRetry={loadStickers}
      />
    );
  }

  if (loading) {
    return <OceanPageLoading message="Đang tải sticker của bạn..." />;
  }

  const total = stats?.total_sticker_count ?? 0;
  const maxTier = STICKER_REWARD_TIERS[STICKER_REWARD_TIERS.length - 1].threshold;
  const nextMilestone = STICKER_REWARD_TIERS.find((t) => total < t.threshold);
  const overallPct = Math.min(100, Math.round((total / maxTier) * 100));

  return (
    <OceanShell>
      <div className="sticker-redeem">
        <div className="sticker-redeem__header">
          <div className="sticker-redeem__header-top">
            <button type="button" className="sticker-redeem__back" onClick={() => navigate(-1)}>
              {'\u2190 Quay l\u1ea1i'}
            </button>
          </div>
          <p className="ocean-page-eyebrow">{'\u0110\u1ed5i qu\u00e0 cu\u1ed9c thi'}</p>
          <h1>{'\u0110\u1ed5i sticker l\u1ea5y qu\u00e0'}</h1>
          <p className="sticker-redeem__lede">
            {
              'T\u00edch sticker khi ho\u00e0n th\u00e0nh b\u00e0i v\u00e0 \u0111\u01b0\u1ee3c ch\u1ea5m. D\u01b0\u1edbi \u0111\u00e2y l\u00e0 c\u00e1c m\u1ed1c g\u1ee3i \u00fd qu\u00e0 t\u1eeb ban t\u1ed5 ch\u1ee9c \u2014 danh s\u00e1ch c\u00f3 th\u1ec3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt sau.'
            }
          </p>
        </div>

        <section
          className="sticker-redeem__balance"
          aria-label={'S\u1ed1 sticker hi\u1ec7n c\u00f3'}
        >
          <div className="sticker-redeem__balance-inner">
            <span className="sticker-redeem__balance-label">
              {'Sticker c\u1ee7a b\u1ea1n'}
            </span>
            <span className="sticker-redeem__balance-value">{total}</span>
            {nextMilestone ? (
              <p className="sticker-redeem__balance-hint">
                {'C\u00f2n '}
                <strong>{nextMilestone.threshold - total}</strong>
                {' sticker n\u1eefa \u0111\u1ec3 \u0111\u1ea1t m\u1ed1c '}
                <strong>{nextMilestone.threshold}</strong>
                {' \u2014 '}
                {nextMilestone.title.toLowerCase()}.
              </p>
            ) : (
              <p className="sticker-redeem__balance-hint sticker-redeem__balance-hint--done">
                {`B\u1ea1n \u0111\u00e3 v\u01b0\u1ee3t m\u1ed1c cao nh\u1ea5t (${maxTier} sticker). Li\u00ean h\u1ec7 BTC \u0111\u1ec3 ch\u1ecdn qu\u00e0 ph\u00f9 h\u1ee3p.`}
              </p>
            )}
            <div className="sticker-redeem__progress-track" role="presentation">
              <div
                className="sticker-redeem__progress-fill"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <p className="sticker-redeem__progress-caption">
              {`Ti\u1ebfn \u0111\u1ed9 t\u1edbi m\u1ed1c ${maxTier} sticker: `}
              <strong>{overallPct}%</strong>
            </p>
          </div>
        </section>

        <ul className="sticker-redeem__tier-list">
          {STICKER_REWARD_TIERS.map((tier) => {
            const reached = total >= tier.threshold;
            const pct = Math.min(100, Math.round((total / tier.threshold) * 100));
            return (
              <li
                key={tier.threshold}
                className={`sticker-redeem__tier ${reached ? 'sticker-redeem__tier--reached' : ''}`}
              >
                <div className="sticker-redeem__tier-head">
                  <div>
                    <h2 className="sticker-redeem__tier-title">{tier.title}</h2>
                    <p className="sticker-redeem__tier-sub">{tier.subtitle}</p>
                  </div>
                  <span
                    className={`sticker-redeem__tier-badge ${reached ? 'sticker-redeem__tier-badge--ok' : ''}`}
                  >
                    {reached
                      ? '\u0110\u00e3 \u0111\u1ea1t m\u1ed1c'
                      : `C\u00f2n ${Math.max(0, tier.threshold - total)} sticker`}
                  </span>
                </div>
                <div className="sticker-redeem__tier-progress" role="presentation">
                  <div className="sticker-redeem__tier-progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="sticker-redeem__tier-gifts-label">{'G\u1ee3i \u00fd qu\u00e0'}</p>
                <ul className="sticker-redeem__gifts">
                  {tier.gifts.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <section className="sticker-redeem__notice">
          <h2 className="sticker-redeem__notice-title">
            {'L\u01b0u \u00fd khi \u0111\u1ed5i qu\u00e0'}
          </h2>
          <p>
            {
              'Vi\u1ec7c x\u00e1c nh\u1eadn v\u00e0 trao qu\u00e0 th\u1ef1c t\u1ebf do '
            }
            <strong>{'ban t\u1ed5 ch\u1ee9c / nh\u00e0 tr\u01b0\u1eddng'}</strong>
            {
              ' quy\u1ebft \u0111\u1ecbnh. Khi \u0111\u1ea1t m\u1ed1c, h\u1ecdc sinh li\u00ean h\u1ec7 gi\u00e1o vi\u00ean ph\u1ee5 tr\u00e1ch ho\u1eb7c BTC \u0111\u1ec3 \u0111\u0103ng k\u00fd qu\u00e0 mong mu\u1ed1n (trong ph\u1ea1m vi g\u1ee3i \u00fd t\u1eebng m\u1ed1c).'
            }
          </p>
        </section>
      </div>
    </OceanShell>
  );
}

export default StickerRedeem;
