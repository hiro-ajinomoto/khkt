import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchClassTeacherMappings, putClassTeachers } from '../../api/admin';
import { useAdminWorkspace } from './AdminWorkspaceContext';

function summarizeTeachers(selectedIds, teacherList) {
  if (!selectedIds || selectedIds.size === 0) {
    return { text: 'Chưa gán giáo viên', count: 0 };
  }
  const picked = teacherList
    .filter((t) => selectedIds.has(t.id))
    .map((t) => ({ label: (t.name && t.name.trim()) || t.username, username: t.username }))
    .sort((a, b) => a.label.localeCompare(b.label, 'vi'));
  const count = picked.length;
  if (count === 0) {
    return { text: 'Chưa gán giáo viên', count: 0 };
  }
  const shown = picked.slice(0, 2).map((p) => p.label);
  const rest = count - shown.length;
  const text =
    rest > 0 ? `${shown.join(', ')} và ${rest} giáo viên khác` : shown.join(', ');
  return { text, count };
}

/**
 * Dialog: tìm kiếm + danh sách cuộn — phù hợp khi có nhiều giáo viên.
 */
function AssignTeachersDialog({
  classLabel,
  teachersSorted,
  initialIdList,
  busy,
  onDismiss,
  onConfirm,
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(initialIdList));

  useEffect(() => {
    setSelected(new Set(initialIdList));
    setSearch('');
  }, [classLabel, initialIdList]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return teachersSorted;
    return teachersSorted.filter((t) => {
      const name = (t.name && String(t.name).toLowerCase()) || '';
      const user = (t.username && t.username.toLowerCase()) || '';
      return name.includes(q) || user.includes(q);
    });
  }, [teachersSorted, q]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of filtered) next.add(t.id);
      return next;
    });
  };

  const clearVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const t of filtered) next.delete(t.id);
      return next;
    });
  };

  return (
    <div
      className="admin-ct-modal-backdrop"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        className="admin-ct-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-ct-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-ct-modal-head">
          <h3 id="admin-ct-modal-title" className="admin-ct-modal-title">
            Gán giáo viên — <span className="admin-ct-modal-class">{classLabel}</span>
          </h3>
          <button
            type="button"
            className="admin-ct-modal-close"
            aria-label="Đóng"
            onClick={onDismiss}
          >
            ×
          </button>
        </header>
        <div className="admin-ct-modal-search-row">
          <input
            type="search"
            className="admin-ct-modal-search"
            placeholder="Tìm theo tên hoặc tên đăng nhập…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          <div className="admin-ct-modal-bulk">
            <button type="button" className="admin-ct-modal-linkbtn" onClick={selectAllVisible}>
              Chọn hiển thị
            </button>
            <button type="button" className="admin-ct-modal-linkbtn" onClick={clearVisible}>
              Bỏ chọn hiển thị
            </button>
          </div>
        </div>
        <p className="admin-ct-modal-meta">
          Đang chọn <strong>{selected.size}</strong> / {teachersSorted.length} giáo viên
          {q ? (
            <>
              {' '}
              · Hiển thị <strong>{filtered.length}</strong> kết quả
            </>
          ) : null}
        </p>
        <ul className="admin-ct-modal-list" aria-label="Danh sách giáo viên">
          {filtered.length === 0 ? (
            <li className="admin-ct-modal-empty">Không có giáo viên khớp tìm kiếm.</li>
          ) : (
            filtered.map((t) => {
              const id = t.id;
              const checked = selected.has(id);
              return (
                <li key={id} className="admin-ct-modal-row">
                  <label className="admin-ct-modal-label">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={() => toggle(id)}
                    />
                    <span className="admin-ct-modal-name">{t.name || t.username}</span>
                    <span className="admin-ct-modal-user">({t.username})</span>
                  </label>
                </li>
              );
            })
          )}
        </ul>
        <footer className="admin-ct-modal-foot">
          <button
            type="button"
            className="cancel-button admin-ct-modal-foot-btn"
            disabled={busy}
            onClick={onDismiss}
          >
            Hủy
          </button>
          <button
            type="button"
            className="refresh-button admin-ct-modal-foot-btn"
            disabled={busy}
            onClick={() => onConfirm([...selected])}
          >
            {busy ? 'Đang lưu…' : 'Lưu gán lớp'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export default function AdminClassTeachersPage() {
  const { teachers, schoolClassesByGrade, loadData } = useAdminWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(() => new Map());
  const [savingClass, setSavingClass] = useState(null);
  const [dialogClass, setDialogClass] = useState(null);

  const refreshMappings = useCallback(async () => {
    setError(null);
    const list = await fetchClassTeacherMappings();
    const next = new Map();
    for (const row of list) {
      next.set(row.class_name, new Set(row.teachers.map((t) => t.id)));
    }
    setDraft(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await refreshMappings();
      } catch (e) {
        if (!cancelled) setError(e.message || 'Không tải được dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMappings]);

  const teacherList = useMemo(
    () => [...teachers].sort((a, b) => a.username.localeCompare(b.username, 'vi')),
    [teachers]
  );

  const dialogInitialIds = useMemo(() => {
    if (!dialogClass) return [];
    return [...(draft.get(dialogClass) || [])].sort();
  }, [dialogClass, draft]);

  const saveClassIds = useCallback(
    async (className, ids) => {
      try {
        setSavingClass(className);
        setError(null);
        await putClassTeachers(className, ids);
        await refreshMappings();
        await loadData();
        setDialogClass(null);
      } catch (e) {
        setError(e.message || 'Không lưu được');
      } finally {
        setSavingClass(null);
      }
    },
    [refreshMappings, loadData]
  );

  if (loading) {
    return <p className="user-group-empty">Đang tải gán giáo viên…</p>;
  }

  return (
    <div className="users-section">
      <div className="section-header">
        <h2>Gán giáo viên theo lớp</h2>
        <button
          type="button"
          className="refresh-button"
          onClick={() => refreshMappings().catch((e) => setError(e.message))}
        >
          🔄 Làm mới
        </button>
      </div>
      <p className="admin-class-hint">
        Giáo viên chỉ xem và thao tác bài tập, bài nộp, thông báo liên quan đến các lớp được gán
        ở đây. Mỗi lớp: bấm <strong>Gán giáo viên</strong> để mở danh sách có tìm kiếm (thích hợp
        khi có nhiều giáo viên).
      </p>
      {error && <div className="error-message">{error}</div>}
      {teacherList.length === 0 ? (
        <p className="user-group-empty muted">
          Chưa có tài khoản giáo viên. Tạo giáo viên ở mục &quot;Giáo viên&quot; trước.
        </p>
      ) : null}

      {dialogClass ? (
        <AssignTeachersDialog
          key={dialogClass}
          classLabel={dialogClass}
          teachersSorted={teacherList}
          initialIdList={dialogInitialIds}
          busy={savingClass === dialogClass}
          onDismiss={() => !savingClass && setDialogClass(null)}
          onConfirm={(ids) => saveClassIds(dialogClass, ids)}
        />
      ) : null}

      {schoolClassesByGrade.map(([gradeTitle, classesInGrade]) => (
        <div key={gradeTitle} className="admin-class-grade-block admin-class-teachers-grade">
          <h4 className="admin-class-grade-title">{gradeTitle}</h4>
          <ul className="admin-class-teachers-list">
            {classesInGrade.map((className) => {
              const selected = draft.get(className) || new Set();
              const { text, count } = summarizeTeachers(selected, teacherList);
              const openDisabled = teacherList.length === 0 || savingClass != null;
              return (
                <li key={className} className="admin-class-teachers-item admin-class-teachers-item--compact">
                  <div className="admin-class-teachers-row">
                    <div className="admin-class-teachers-main">
                      <span className="class-badge">{className}</span>
                      <div className="admin-class-teachers-summary">
                        <span className="admin-class-teachers-count" title={text}>
                          {count === 0 ? '0 GV' : `${count} GV`}
                        </span>
                        <span className="admin-class-teachers-names">{text}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="refresh-button admin-class-teachers-assign-btn"
                      disabled={openDisabled}
                      onClick={() => setDialogClass(className)}
                    >
                      Gán giáo viên
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
