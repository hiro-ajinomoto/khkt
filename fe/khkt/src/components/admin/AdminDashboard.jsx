import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUsers, updateUserRole, updateUserClass, deleteUser, fetchStats } from '../../api/admin';
import {
  fetchSchoolClasses,
  createSchoolClass,
  deleteSchoolClass,
  renameSchoolClass,
  groupClassesByGrade,
} from '../../api/classes';
import OceanShell, { OceanPageLoading } from '../layout/OceanShell';
import './AdminDashboard.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  /** Một dòng đang sửa quyền + lớp cùng lúc */
  const [editingUserId, setEditingUserId] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [newClass, setNewClass] = useState('');
  const [schoolClasses, setSchoolClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [classBusy, setClassBusy] = useState(false);
  /** Đang đổi tên một lớp: { from, draft } */
  const [classRename, setClassRename] = useState(null);
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, statsData, classesList] = await Promise.all([
        fetchUsers(),
        fetchStats(),
        fetchSchoolClasses(),
      ]);
      setUsers(usersData);
      setStats(statsData);
      setSchoolClasses(classesList);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    setNewRole(u.role);
    setNewClass(u.class_name || '');
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setNewRole('');
    setNewClass('');
  };

  const saveEditUser = async () => {
    if (!editingUserId) return;
    const u = users.find((x) => x.id === editingUserId);
    if (!u) return;

    const finalClass =
      newClass && newClass.trim() !== '' ? newClass.trim() : null;

    try {
      if (newRole !== u.role) {
        await updateUserRole(editingUserId, newRole);
      }
      if (newRole === 'student') {
        await updateUserClass(editingUserId, finalClass);
      }
      await loadData();
      cancelEditUser();
    } catch (err) {
      alert(
        err.message ||
          'Không thể cập nhật. Kiểm tra quyền và lớp (lớp chỉ áp dụng cho học sinh).'
      );
      console.error('Error saving user edit:', err);
    }
  };

  const handleAddSchoolClass = async (e) => {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) {
      alert('Nhập tên lớp (ví dụ: 8A6).');
      return;
    }
    try {
      setClassBusy(true);
      const list = await createSchoolClass(name);
      setSchoolClasses(list);
      setNewClassName('');
    } catch (err) {
      alert(err.message || 'Không thể thêm lớp');
    } finally {
      setClassBusy(false);
    }
  };

  const startRenameClass = (name) => {
    setClassRename({ from: name, draft: name });
  };

  const cancelRenameClass = () => {
    setClassRename(null);
  };

  const saveRenameClass = async () => {
    if (!classRename) return;
    const next = classRename.draft.trim();
    if (!next) {
      alert('Tên lớp không được để trống.');
      return;
    }
    if (next === classRename.from) {
      setClassRename(null);
      return;
    }
    try {
      setClassBusy(true);
      const list = await renameSchoolClass(classRename.from, next);
      setSchoolClasses(list);
      setClassRename(null);
      const [usersData, statsData] = await Promise.all([fetchUsers(), fetchStats()]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      alert(err.message || 'Không thể đổi tên lớp');
    } finally {
      setClassBusy(false);
    }
  };

  const handleDeleteSchoolClass = async (classLabel) => {
    if (
      !window.confirm(
        `Xóa lớp "${classLabel}"? Học sinh thuộc lớp sẽ mất gán lớp; gán bài cho lớp này cũng bị gỡ.`
      )
    ) {
      return;
    }
    try {
      setClassBusy(true);
      const list = await deleteSchoolClass(classLabel);
      setSchoolClasses(list);
      const [usersData, statsData] = await Promise.all([fetchUsers(), fetchStats()]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      alert(err.message || 'Không thể xóa lớp');
    } finally {
      setClassBusy(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}"?`)) {
      return;
    }

    try {
      await deleteUser(userId);
      await loadData(); // Reload data
    } catch (err) {
      alert('Không thể xóa người dùng: ' + (err.message || 'Lỗi không xác định'));
      console.error('Error deleting user:', err);
    }
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Quản trị viên',
      teacher: 'Giáo viên',
      student: 'Học sinh',
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      admin: '#f87171',
      teacher: '#38bdf8',
      student: '#4ade80',
    };
    return colors[role] || '#94a3b8';
  };

  const UNASSIGNED_CLASS_LABEL = 'Chưa phân lớp';

  const filteredUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const blob = [
        u.username,
        u.name || '',
        u.class_name || '',
        u.role === 'admin' ? 'quản trị' : '',
        u.role === 'teacher' ? 'giáo viên' : '',
        u.role === 'student' ? 'học sinh' : '',
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [users, userFilter]);

  const admins = useMemo(
    () =>
      [...filteredUsers.filter((u) => u.role === 'admin')].sort((a, b) =>
        a.username.localeCompare(b.username, 'vi')
      ),
    [filteredUsers]
  );

  const teachers = useMemo(
    () =>
      [...filteredUsers.filter((u) => u.role === 'teacher')].sort((a, b) =>
        a.username.localeCompare(b.username, 'vi')
      ),
    [filteredUsers]
  );

  const schoolClassesByGrade = useMemo(
    () => groupClassesByGrade(schoolClasses),
    [schoolClasses]
  );

  const studentGroups = useMemo(() => {
    const students = filteredUsers.filter((u) => u.role === 'student');
    const byClass = new Map();
    for (const s of students) {
      const label = s.class_name?.trim() ? s.class_name.trim() : UNASSIGNED_CLASS_LABEL;
      if (!byClass.has(label)) byClass.set(label, []);
      byClass.get(label).push(s);
    }
    for (const list of byClass.values()) {
      list.sort((a, b) => a.username.localeCompare(b.username, 'vi'));
    }
    const keys = Array.from(byClass.keys());
    keys.sort((a, b) => {
      if (a === UNASSIGNED_CLASS_LABEL) return 1;
      if (b === UNASSIGNED_CLASS_LABEL) return -1;
      const ia = schoolClasses.indexOf(a);
      const ib = schoolClasses.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b, 'vi', { numeric: true });
    });
    return keys.map((label) => ({
      label,
      users: byClass.get(label),
    }));
  }, [filteredUsers, schoolClasses]);

  const renderUserRow = (u) => (
    <tr key={u.id}>
      <td>{u.username}</td>
      <td>{u.name || u.username}</td>
      <td>
        {editingUserId === u.id ? (
          <div className="role-edit">
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="role-select"
              aria-label="Chọn quyền"
            >
              <option value="student">Học sinh</option>
              <option value="teacher">Giáo viên</option>
              <option value="admin">Quản trị viên</option>
            </select>
            {newRole === 'teacher' || newRole === 'admin' ? (
              <span className="role-edit-hint">(Giáo viên / quản trị không cần lớp)</span>
            ) : null}
          </div>
        ) : (
          <span
            className="role-badge"
            style={{ backgroundColor: getRoleColor(u.role) }}
          >
            {getRoleLabel(u.role)}
          </span>
        )}
      </td>
      <td>
        {editingUserId === u.id ? (
          newRole === 'student' ? (
            <div className="class-edit">
              <select
                value={newClass}
                onChange={(e) => setNewClass(e.target.value)}
                className="class-select"
                aria-label="Chọn lớp"
              >
                <option value="">Chưa có lớp</option>
                {schoolClassesByGrade.map(([gradeTitle, classesInGrade]) => (
                  <optgroup key={gradeTitle} label={gradeTitle}>
                    {classesInGrade.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          ) : (
            <span className="class-na">—</span>
          )
        ) : u.role === 'student' ? (
          <span className="class-badge">{u.class_name || 'Chưa có lớp'}</span>
        ) : (
          <span className="class-na">-</span>
        )}
      </td>
      <td>
        {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'N/A'}
      </td>
      <td>
        <div className="action-buttons">
          {editingUserId === u.id ? (
            <>
              <button
                type="button"
                onClick={saveEditUser}
                className="save-button"
                title="Lưu quyền và lớp"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={cancelEditUser}
                className="cancel-button"
                title="Hủy"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => startEditUser(u)}
                className="edit-button"
                title="Sửa quyền và lớp"
              >
                ✏️
              </button>
              {u.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  className="delete-button"
                  title="Xóa người dùng"
                >
                  🗑️
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );

  const userTableHead = (
    <thead>
      <tr>
        <th>Tên đăng nhập</th>
        <th>Họ và tên</th>
        <th>Quyền</th>
        <th>Lớp</th>
        <th>Ngày tạo</th>
        <th>Thao tác</th>
      </tr>
    </thead>
  );

  if (loading) {
    return <OceanPageLoading message="Đang tải bảng quản trị..." />;
  }

  return (
    <OceanShell>
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-header-left">
          <img src="/logo.png" alt="Logo trường" className="logo-admin" />
          <div>
            <p className="ocean-page-eyebrow">Cuộc thi khoa học kỹ thuật</p>
            <h1>Quản trị hệ thống</h1>
            <p>Xin chào, {user?.name || user?.username}</p>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" onClick={() => navigate('/assignments')} className="nav-button">
            📚 Bài tập
          </button>
          <button onClick={logout} className="logout-button">
            <span className="logout-icon">🚪</span>
            <span className="logout-text">Đăng xuất</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={loadData} className="retry-button">
            Thử lại
          </button>
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Tổng người dùng</h3>
            <p className="stat-number">{stats.users.total}</p>
          </div>
          <div className="stat-card">
            <h3>Giáo viên</h3>
            <p className="stat-number">{stats.users.teachers}</p>
          </div>
          <div className="stat-card">
            <h3>Học sinh</h3>
            <p className="stat-number">{stats.users.students}</p>
          </div>
          <div className="stat-card">
            <h3>Bài tập</h3>
            <p className="stat-number">{stats.assignments}</p>
          </div>
          <div className="stat-card">
            <h3>Bài nộp</h3>
            <p className="stat-number">{stats.submissions}</p>
          </div>
        </div>
      )}

      <div className="users-section">
        <div className="section-header">
          <h2>Quản lý lớp</h2>
        </div>
        <form className="admin-class-form" onSubmit={handleAddSchoolClass}>
          <p className="admin-class-hint">
            Đặt tên lớp tùy ý (ví dụ <strong>8A1</strong>, <strong>Lớp chọn Toán</strong>), tối đa 80 ký tự, có ít nhất một chữ hoặc số.
            Có thể <strong>sửa tên</strong> lớp (học sinh và gán bài sẽ theo tên mới), <strong>xóa</strong> khi không còn dùng.
          </p>
          <div className="admin-class-row">
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="Ví dụ: 8A6"
              disabled={classBusy || classRename != null}
              className="admin-class-input"
              autoComplete="off"
            />
            <button
              type="submit"
              className="refresh-button"
              disabled={classBusy || classRename != null}
            >
              ➕ Thêm lớp
            </button>
          </div>
        </form>
        {schoolClasses.length === 0 ? (
          <p className="admin-class-empty">Chưa có lớp nào.</p>
        ) : (
          <div className="admin-class-by-grade">
            {schoolClassesByGrade.map(([gradeTitle, classesInGrade]) => (
              <div key={gradeTitle} className="admin-class-grade-block">
                <h4 className="admin-class-grade-title">{gradeTitle}</h4>
                <ul className="admin-class-list">
                  {classesInGrade.map((c) => (
                    <li
                      key={c}
                      className={`admin-class-item${classRename?.from === c ? ' admin-class-item--editing' : ''}`}
                    >
                      {classRename?.from === c ? (
                        <>
                          <input
                            type="text"
                            className="admin-class-input admin-class-input--inline"
                            value={classRename.draft}
                            onChange={(e) =>
                              setClassRename((prev) =>
                                prev ? { ...prev, draft: e.target.value } : prev
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                saveRenameClass();
                              } else if (e.key === 'Escape') {
                                cancelRenameClass();
                              }
                            }}
                            disabled={classBusy}
                            autoComplete="off"
                            aria-label="Tên lớp mới"
                          />
                          <button
                            type="button"
                            className="save-button"
                            title="Lưu tên lớp"
                            disabled={classBusy}
                            onClick={saveRenameClass}
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            className="cancel-button"
                            title="Hủy"
                            disabled={classBusy}
                            onClick={cancelRenameClass}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="class-badge">{c}</span>
                          <button
                            type="button"
                            className="edit-button"
                            title="Sửa tên lớp"
                            disabled={classBusy || classRename != null}
                            onClick={() => startRenameClass(c)}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="delete-button"
                            title="Xóa lớp"
                            disabled={classBusy || classRename != null}
                            onClick={() => handleDeleteSchoolClass(c)}
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="users-section">
        <div className="section-header">
          <h2>Quản lý người dùng</h2>
          <button type="button" onClick={loadData} className="refresh-button">
            🔄 Làm mới
          </button>
        </div>

        <div className="user-filter-bar">
          <label htmlFor="admin-user-search" className="user-filter-label">
            Tìm nhanh
          </label>
          <input
            id="admin-user-search"
            type="search"
            className="user-filter-input"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Tên đăng nhập, họ tên, lớp, vai trò…"
            autoComplete="off"
          />
        </div>

        {users.length === 0 ? (
          <p className="user-group-empty">Chưa có người dùng nào.</p>
        ) : filteredUsers.length === 0 ? (
          <p className="user-group-empty">Không có người dùng khớp bộ lọc.</p>
        ) : (
          <>
            <div className="user-group-block">
              <h3 className="user-group-title">
                <span className="user-group-title-icon">🛡️</span>
                Quản trị viên
                <span className="user-group-count">({admins.length})</span>
              </h3>
              {admins.length === 0 ? (
                <p className="user-group-empty muted">Không có quản trị viên trong kết quả lọc.</p>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    {userTableHead}
                    <tbody>{admins.map(renderUserRow)}</tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="user-group-block">
              <h3 className="user-group-title">
                <span className="user-group-title-icon">👩‍🏫</span>
                Giáo viên
                <span className="user-group-count">({teachers.length})</span>
              </h3>
              {teachers.length === 0 ? (
                <p className="user-group-empty muted">Không có giáo viên trong kết quả lọc.</p>
              ) : (
                <div className="users-table-container">
                  <table className="users-table">
                    {userTableHead}
                    <tbody>{teachers.map(renderUserRow)}</tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="user-group-block user-group-block--students-wrap">
              <h3 className="user-group-title user-group-title--major">
                <span className="user-group-title-icon">🎒</span>
                Học sinh theo lớp
                <span className="user-group-count">
                  ({studentGroups.reduce((n, g) => n + g.users.length, 0)})
                </span>
              </h3>
              {studentGroups.length === 0 ? (
                <p className="user-group-empty muted">Không có học sinh trong kết quả lọc.</p>
              ) : (
                studentGroups.map(({ label, users: groupUsers }) => (
                  <div key={label} className="user-subgroup">
                    <h4 className="user-subgroup-title">
                      {label === UNASSIGNED_CLASS_LABEL ? (
                        <>Chưa phân lớp</>
                      ) : (
                        <>
                          Lớp <strong>{label}</strong>
                        </>
                      )}
                      <span className="user-group-count">({groupUsers.length})</span>
                    </h4>
                    <div className="users-table-container">
                      <table className="users-table">
                        {userTableHead}
                        <tbody>{groupUsers.map(renderUserRow)}</tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </OceanShell>
  );
}

export default AdminDashboard;
