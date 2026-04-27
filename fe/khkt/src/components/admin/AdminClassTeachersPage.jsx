import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchClassTeacherMappings, putClassTeachers } from '../../api/admin';
import { useAdminWorkspace } from './AdminWorkspaceContext';

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) {
    if (!b.has(x)) return false;
  }
  return true;
}

function summarizeClasses(classNamesSorted) {
  if (!classNamesSorted || classNamesSorted.length === 0) {
    return { text: 'Chưa gán lớp', count: 0 };
  }
  const count = classNamesSorted.length;
  const shown = classNamesSorted.slice(0, 2);
  const rest = count - shown.length;
  const text =
    rest > 0 ? `${shown.join(', ')} và ${rest} lớp khác` : shown.join(', ');
  return { text, count };
}

function classesForTeacher(teacherId, draft, allClassNames) {
  const out = [];
  for (const cn of allClassNames) {
    if ((draft.get(cn) || new Set()).has(teacherId)) out.push(cn);
  }
  return out.sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));
}

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

/**
 * Dialog: chọn lớp cho một giáo viên (nhóm khối + tìm kiếm).
 */
function AssignClassesDialog({
  teacherLabel,
  teacherUsername,
  schoolClassesByGrade,
  initialClassNames,
  busy,
  onDismiss,
  onConfirm,
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(() => new Set(initialClassNames));

  useEffect(() => {
    setSelected(new Set(initialClassNames));
    setSearch('');
  }, [teacherLabel, initialClassNames]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onDismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const q = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    if (!q) return schoolClassesByGrade;
    return schoolClassesByGrade
      .map(([grade, names]) => {
        const hit = names.filter((c) => c.toLowerCase().includes(q));
        return hit.length ? [grade, hit] : null;
      })
      .filter(Boolean);
  }, [schoolClassesByGrade, q]);

  const visibleClassNames = useMemo(
    () => filteredGroups.flatMap(([, names]) => names),
    [filteredGroups],
  );

  const classesByGradeFull = useMemo(() => {
    const m = new Map();
    for (const [g, names] of schoolClassesByGrade) {
      m.set(g, names);
    }
    return m;
  }, [schoolClassesByGrade]);

  const toggleGradeAll = (gradeTitle) => {
    const names = classesByGradeFull.get(gradeTitle);
    if (!names?.length) return;
    setSelected((prev) => {
      const allOn = names.every((c) => prev.has(c));
      const next = new Set(prev);
      if (allOn) {
        for (const c of names) next.delete(c);
      } else {
        for (const c of names) next.add(c);
      }
      return next;
    });
  };

  const toggle = (className) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleClassNames) next.add(c);
      return next;
    });
  };

  const clearVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of visibleClassNames) next.delete(c);
      return next;
    });
  };

  const totalClasses = schoolClassesByGrade.reduce((n, [, arr]) => n + arr.length, 0);

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
        aria-labelledby="admin-ct-cl-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin-ct-modal-head">
          <h3 id="admin-ct-cl-modal-title" className="admin-ct-modal-title">
            Gán lớp — <span className="admin-ct-modal-class">{teacherLabel}</span>
            {teacherUsername ? (
              <span className="admin-ct-modal-user"> ({teacherUsername})</span>
            ) : null}
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
            placeholder="Tìm tên lớp…"
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
          Đang chọn <strong>{selected.size}</strong> / {totalClasses} lớp
          {q ? (
            <>
              {' '}
              · Hiển thị <strong>{visibleClassNames.length}</strong> lớp
            </>
          ) : null}
        </p>
        <div className="admin-ct-modal-list admin-ct-modal-list--scroll" aria-label="Danh sách lớp">
          {filteredGroups.length === 0 ? (
            <p className="admin-ct-modal-empty">Không có lớp khớp tìm kiếm.</p>
          ) : (
            filteredGroups.map(([gradeTitle, namesInGrade]) => {
              const fullInGrade = classesByGradeFull.get(gradeTitle) || namesInGrade;
              const gradeAllSelected =
                fullInGrade.length > 0 && fullInGrade.every((c) => selected.has(c));
              return (
              <div key={gradeTitle} className="admin-ct-class-group">
                <div className="admin-ct-class-group-head">
                  <h4 className="admin-ct-class-group-title">{gradeTitle}</h4>
                  {fullInGrade.length > 0 ? (
                    <div className="admin-ct-class-group-grade-actions">
                      <input
                        type="checkbox"
                        className="admin-ct-grade-toggle-square"
                        checked={gradeAllSelected}
                        disabled={busy}
                        onChange={() => toggleGradeAll(gradeTitle)}
                        aria-label={`Chọn hoặc bỏ toàn bộ lớp ${gradeTitle}`}
                        ref={(el) => {
                          if (!el) return;
                          const some = fullInGrade.some((c) => selected.has(c));
                          el.indeterminate = some && !gradeAllSelected;
                        }}
                      />
                    </div>
                  ) : null}
                </div>
                <ul className="admin-ct-modal-list-inner">
                  {namesInGrade.map((className) => {
                    const checked = selected.has(className);
                    return (
                      <li key={className} className="admin-ct-modal-row">
                        <label className="admin-ct-modal-label">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={() => toggle(className)}
                          />
                          <span className="admin-ct-modal-name">{className}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
            })
          )}
        </div>
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
  const [mode, setMode] = useState('by-class');
  const [dialogTeacher, setDialogTeacher] = useState(null);
  const [savingTeacherId, setSavingTeacherId] = useState(null);

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

  const allClassNames = useMemo(
    () => schoolClassesByGrade.flatMap(([, names]) => names),
    [schoolClassesByGrade],
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

  const dialogTeacherInitialClasses = useMemo(() => {
    if (!dialogTeacher) return [];
    return classesForTeacher(dialogTeacher.id, draft, allClassNames);
  }, [dialogTeacher, draft, allClassNames]);

  const saveTeacherClasses = useCallback(
    async (teacherId, desiredClassNames) => {
      const desired = new Set(desiredClassNames);
      try {
        setSavingTeacherId(teacherId);
        setError(null);
        for (const className of allClassNames) {
          const prev = new Set(draft.get(className) || []);
          const next = new Set(prev);
          if (desired.has(className)) next.add(teacherId);
          else next.delete(teacherId);
          if (setsEqual(prev, next)) continue;
          await putClassTeachers(className, [...next]);
        }
        await refreshMappings();
        await loadData();
        setDialogTeacher(null);
      } catch (e) {
        setError(e.message || 'Không lưu được');
        await refreshMappings();
      } finally {
        setSavingTeacherId(null);
      }
    },
    [allClassNames, draft, refreshMappings, loadData]
  );

  if (loading) {
    return <p className="user-group-empty">Đang tải gán giáo viên…</p>;
  }

  return (
    <div className="users-section">
      <div className="section-header">
        <h2>Gán giáo viên ↔ lớp</h2>
        <button
          type="button"
          className="refresh-button"
          onClick={() => refreshMappings().catch((e) => setError(e.message))}
        >
          🔄 Làm mới
        </button>
      </div>
      <div className="admin-ct-view-toggle" role="tablist" aria-label="Chế độ gán">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'by-class'}
          className={`admin-ct-view-tab ${mode === 'by-class' ? 'admin-ct-view-tab--active' : ''}`}
          onClick={() => {
            setMode('by-class');
            setDialogTeacher(null);
          }}
        >
          Theo lớp
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'by-teacher'}
          className={`admin-ct-view-tab ${mode === 'by-teacher' ? 'admin-ct-view-tab--active' : ''}`}
          onClick={() => {
            setMode('by-teacher');
            setDialogClass(null);
          }}
        >
          Theo giáo viên
        </button>
      </div>
      <p className="admin-class-hint">
        {mode === 'by-class' ? (
          <>
            <strong>Theo lớp:</strong> chọn lớp rồi gán nhiều giáo viên — thuận khi soạn phân công
            theo từng lớp chủ nhiệm / dạy.
          </>
        ) : (
          <>
            <strong>Theo giáo viên:</strong> chọn giáo viên rồi gán nhiều lớp — thuận khi cập nhật
            toàn bộ lớp của một người. Hai chế độ cùng một dữ liệu, chỉ khác góc thao tác.
          </>
        )}{' '}
        Giáo viên chỉ thấy bài tập, bài nộp và thông báo thuộc các lớp được gán.
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

      {dialogTeacher ? (
        <AssignClassesDialog
          key={dialogTeacher.id}
          teacherLabel={dialogTeacher.name || dialogTeacher.username}
          teacherUsername={dialogTeacher.username}
          schoolClassesByGrade={schoolClassesByGrade}
          initialClassNames={dialogTeacherInitialClasses}
          busy={savingTeacherId === dialogTeacher.id}
          onDismiss={() => !savingTeacherId && setDialogTeacher(null)}
          onConfirm={(names) => saveTeacherClasses(dialogTeacher.id, names)}
        />
      ) : null}

      {mode === 'by-class'
        ? schoolClassesByGrade.map(([gradeTitle, classesInGrade]) => (
            <div key={gradeTitle} className="admin-class-grade-block admin-class-teachers-grade">
              <h4 className="admin-class-grade-title">{gradeTitle}</h4>
              <ul className="admin-class-teachers-list">
                {classesInGrade.map((className) => {
                  const selected = draft.get(className) || new Set();
                  const { text, count } = summarizeTeachers(selected, teacherList);
                  const openDisabled =
                    teacherList.length === 0 || savingClass != null || savingTeacherId != null;
                  return (
                    <li
                      key={className}
                      className="admin-class-teachers-item admin-class-teachers-item--compact"
                    >
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
          ))
        : null}

      {mode === 'by-teacher' ? (
        <div className="admin-class-grade-block admin-class-teachers-grade">
          <h4 className="admin-class-grade-title">Danh sách giáo viên</h4>
          <ul className="admin-class-teachers-list">
            {teacherList.map((t) => {
              const assigned = classesForTeacher(t.id, draft, allClassNames);
              const { text, count } = summarizeClasses(assigned);
              const openDisabled =
                allClassNames.length === 0 || savingTeacherId != null || savingClass != null;
              return (
                <li
                  key={t.id}
                  className="admin-class-teachers-item admin-class-teachers-item--compact"
                >
                  <div className="admin-class-teachers-row">
                    <div className="admin-class-teachers-main">
                      <span className="class-badge admin-ct-teacher-badge">
                        {t.name || t.username}
                      </span>
                      <span className="admin-ct-teacher-user muted">@{t.username}</span>
                      <div className="admin-class-teachers-summary">
                        <span className="admin-class-teachers-count" title={text}>
                          {count === 0 ? '0 lớp' : `${count} lớp`}
                        </span>
                        <span className="admin-class-teachers-names">{text}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="refresh-button admin-class-teachers-assign-btn"
                      disabled={openDisabled}
                      onClick={() =>
                        setDialogTeacher({
                          id: t.id,
                          name: t.name,
                          username: t.username,
                        })
                      }
                    >
                      Gán lớp
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
