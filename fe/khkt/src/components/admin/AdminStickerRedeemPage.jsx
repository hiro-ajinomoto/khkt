import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchStickerRedeemOverview,
  fetchStickerRedeemHistory,
  createStickerRedemption,
} from '../../api/admin';
import { STICKER_REWARD_TIERS } from '../submissions/stickerRewardTiers';
import './AdminStickerRedeem.css';

const COST_OPTIONS = STICKER_REWARD_TIERS.map((t) => ({
  value: t.threshold,
  label: `${t.threshold} \u2014 ${t.title}`,
}));

function formatDt(iso) {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '\u2014';
  }
}

export default function AdminStickerRedeemPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  const [modal, setModal] = useState(null);
  const [formCost, setFormCost] = useState(30);
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [historyFor, setHistoryFor] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyError, setHistoryError] = useState(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchStickerRedeemOverview();
      setStudents(data.students || []);
    } catch (e) {
      setError(e.message || 'Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => {
      const blob = [s.username, s.name, s.class_name || ''].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [students, filter]);

  const openModal = (row) => {
    setModal(row);
    setFormCost(30);
    setFormNote('');
    setFormError(null);
  };

  const closeModal = () => {
    if (submitting) return;
    setModal(null);
  };

  const submitRedeem = async () => {
    if (!modal) return;
    const note = formNote.trim();
    if (note.length < 1) {
      setFormError(
        'Vui l\u00f2ng m\u00f4 t\u1ea3 qu\u00e0 \u0111\u00e3 trao (v\u00ed d\u1ee5: t\u00fai tote xanh).'
      );
      return;
    }
    try {
      setSubmitting(true);
      setFormError(null);
      await createStickerRedemption({
        student_id: modal.id,
        sticker_cost: formCost,
        gift_summary: note,
      });
      await loadOverview();
      setModal(null);
    } catch (e) {
      setFormError(e.message || 'Ghi nh\u1eadn th\u1ea5t b\u1ea1i');
    } finally {
      setSubmitting(false);
    }
  };

  const openHistory = async (row) => {
    setHistoryFor(row);
    setHistoryData(null);
    setHistoryError(null);
    setHistoryLoading(true);
    try {
      const data = await fetchStickerRedeemHistory(row.id);
      setHistoryData(data);
    } catch (e) {
      setHistoryError(e.message || 'Kh\u00f4ng t\u1ea3i l\u1ecbch s\u1eed');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistory = () => {
    setHistoryFor(null);
    setHistoryData(null);
    setHistoryError(null);
  };

  if (loading) {
    return (
      <p className="admin-sticker-redeem__loading">
        {'\u0110ang t\u1ea3i danh s\u00e1ch h\u1ecdc sinh\u2026'}
      </p>
    );
  }

  return (
    <div className="admin-sticker-redeem users-section">
      <div className="section-header">
        <h2>{'\u0110\u1ed5i sticker l\u1ea5y qu\u00e0 (h\u1ecdc sinh)'}</h2>
        <button type="button" onClick={loadOverview} className="refresh-button">
          {'L\u00e0m m\u1edbi'}
        </button>
      </div>

      <p className="admin-sticker-redeem__hint">
        {
          'Ghi nh\u1eadn khi \u0111\u00e3 trao qu\u00e0 th\u1ef1c t\u1ebf. H\u1ec7 th\u1ed1ng tr\u1eeb \u0111\u00fang s\u1ed1 sticker theo m\u1ed1c (30 / 180 / 220). H\u1ecdc sinh ch\u1ec9 c\u00f2n th\u1ea5y sticker kh\u1ea3 d\u1ee5ng sau khi tr\u1eeb.'
        }
      </p>

      {error && (
        <div className="error-message admin-sticker-redeem__banner">
          {error}
          <button type="button" onClick={loadOverview} className="retry-button">
            {'Th\u1eed l\u1ea1i'}
          </button>
        </div>
      )}

      <div className="user-filter-bar">
        <label htmlFor="admin-sticker-filter" className="user-filter-label">
          {'T\u00ecm h\u1ecdc sinh'}
        </label>
        <input
          id="admin-sticker-filter"
          type="search"
          className="user-filter-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={
            'T\u00ean \u0111\u0103ng nh\u1eadp, h\u1ecd t\u00ean, l\u1edbp\u2026'
          }
          autoComplete="off"
        />
      </div>

      <div className="users-table-container admin-sticker-redeem__table-wrap">
        <table className="users-table admin-sticker-redeem__table">
          <thead>
            <tr>
              <th className="admin-sticker-redeem__col--desktop-only">{'L\u1edbp'}</th>
              <th>{'H\u1ecdc sinh'}</th>
              <th className="admin-sticker-redeem__col--desktop-only">
                {'T\u00edch \u0111\u01b0\u1ee3c'}
              </th>
              <th className="admin-sticker-redeem__col--desktop-only">
                {'\u0110\u00e3 \u0111\u1ed5i'}
              </th>
              <th className="admin-sticker-redeem__col--desktop-only">{'C\u00f2n l\u1ea1i'}</th>
              <th className="admin-sticker-redeem__col--actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-sticker-redeem__empty">
                  {'Kh\u00f4ng c\u00f3 h\u1ecdc sinh kh\u1edbp b\u1ed9 l\u1ecdc.'}
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr key={s.id}>
                  <td className="admin-sticker-redeem__col--desktop-only">
                    {s.class_name || '\u2014'}
                  </td>
                  <td>
                    <span className="admin-sticker-redeem__name">{s.name}</span>
                    <span className="admin-sticker-redeem__user muted">{s.username}</span>
                  </td>
                  <td className="admin-sticker-redeem__col--desktop-only">{s.stickers_earned}</td>
                  <td className="admin-sticker-redeem__col--desktop-only">{s.stickers_redeemed}</td>
                  <td className="admin-sticker-redeem__col--desktop-only">
                    <strong>{s.stickers_available}</strong>
                  </td>
                  <td className="admin-sticker-redeem__actions admin-sticker-redeem__col--actions">
                    <button
                      type="button"
                      className="admin-sticker-redeem__btn admin-sticker-redeem__btn--primary"
                      onClick={() => openModal(s)}
                      disabled={s.stickers_available < 30}
                    >
                      {'Ghi nh\u1eadn \u0111\u1ed5i qu\u00e0'}
                    </button>
                    <button
                      type="button"
                      className="admin-sticker-redeem__btn admin-sticker-redeem__btn--desktop-only"
                      onClick={() => openHistory(s)}
                    >
                      {'L\u1ecbch s\u1eed'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modal ? (
        <div className="admin-sticker-redeem__modal-backdrop" role="presentation" onClick={closeModal}>
          <div
            className="admin-sticker-redeem__modal"
            role="dialog"
            aria-labelledby="admin-redeem-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-redeem-title">{'Ghi nh\u1eadn \u0111\u1ed5i qu\u00e0'}</h3>
            <p className="admin-sticker-redeem__modal-meta">
              <strong>{modal.name}</strong> ({modal.username}){' '}
              {'\u2014 c\u00f2n '}
              <strong>{modal.stickers_available}</strong> sticker
            </p>
            <label className="admin-sticker-redeem__field">
              <span>{'M\u1ed1c / s\u1ed1 sticker tr\u1eeb'}</span>
              <select
                value={formCost}
                onChange={(e) => setFormCost(Number(e.target.value))}
                disabled={submitting}
              >
                {COST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} disabled={modal.stickers_available < o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-sticker-redeem__field">
              <span>{'M\u00f4 t\u1ea3 qu\u00e0 \u0111\u00e3 trao'}</span>
              <textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={
                  'V\u00ed d\u1ee5: B\u00ecnh n\u01b0\u1edbc in logo tr\u01b0\u1eddng'
                }
                disabled={submitting}
              />
            </label>
            {formError && <p className="admin-sticker-redeem__form-error">{formError}</p>}
            <div className="admin-sticker-redeem__modal-actions">
              <button type="button" className="admin-sticker-redeem__btn" onClick={closeModal}>
                {'H\u1ee7y'}
              </button>
              <button
                type="button"
                className="admin-sticker-redeem__btn admin-sticker-redeem__btn--primary"
                onClick={submitRedeem}
                disabled={submitting || modal.stickers_available < formCost}
              >
                {submitting ? '\u0110ang l\u01b0u\u2026' : 'X\u00e1c nh\u1eadn'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {historyFor ? (
        <div className="admin-sticker-redeem__modal-backdrop" role="presentation" onClick={closeHistory}>
          <div
            className="admin-sticker-redeem__modal admin-sticker-redeem__modal--wide"
            role="dialog"
            aria-labelledby="admin-history-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="admin-history-title">
              {'L\u1ecbch s\u1eed \u0111\u1ed5i qu\u00e0 \u2014 '}
              {historyFor.name}
            </h3>
            {historyLoading && <p>{'\u0110ang t\u1ea3i\u2026'}</p>}
            {historyError && <p className="admin-sticker-redeem__form-error">{historyError}</p>}
            {!historyLoading && historyData && (
              <ul className="admin-sticker-redeem__history-list">
                {historyData.redemptions.length === 0 ? (
                  <li className="muted">{'Ch\u01b0a c\u00f3 l\u1ea7n n\u00e0o.'}</li>
                ) : (
                  historyData.redemptions.map((r) => (
                    <li key={r.id}>
                      <span className="admin-sticker-redeem__history-cost">
                        {'\u2212'}
                        {r.sticker_cost}
                      </span>
                      <span className="admin-sticker-redeem__history-gift">{r.gift_summary}</span>
                      <span className="admin-sticker-redeem__history-meta muted">
                        {formatDt(r.created_at)}
                        {' \u00b7 '}
                        {r.created_by_name}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}
            <div className="admin-sticker-redeem__modal-actions">
              <button type="button" className="admin-sticker-redeem__btn" onClick={closeHistory}>
                {'\u0110\u00f3ng'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
