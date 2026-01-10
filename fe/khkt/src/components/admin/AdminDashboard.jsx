import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUsers, updateUserRole, updateUserClass, deleteUser, fetchStats } from '../../api/admin';
import './AdminDashboard.css';

function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [editingClass, setEditingClass] = useState(null);
  const [newClass, setNewClass] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersData, statsData] = await Promise.all([
        fetchUsers(),
        fetchStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      setError(err.message || 'Không thể tải dữ liệu');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, currentRole) => {
    setEditingRole(userId);
    setNewRole(currentRole);
  };

  const handleRoleSave = async (userId) => {
    try {
      await updateUserRole(userId, newRole);
      await loadData(); // Reload data
      setEditingRole(null);
      setNewRole('');
    } catch (err) {
      alert('Không thể cập nhật quyền: ' + (err.message || 'Lỗi không xác định'));
      console.error('Error updating role:', err);
    }
  };

  const handleRoleCancel = () => {
    setEditingRole(null);
    setNewRole('');
  };

  const handleClassChange = async (userId, currentClass) => {
    setEditingClass(userId);
    setNewClass(currentClass || '');
  };

  const handleClassSave = async (userId) => {
    try {
      const finalClass = newClass && newClass.trim() !== '' ? newClass.trim() : null;
      await updateUserClass(userId, finalClass);
      await loadData(); // Reload data
      setEditingClass(null);
      setNewClass('');
    } catch (err) {
      alert('Không thể cập nhật lớp: ' + (err.message || 'Lỗi không xác định'));
      console.error('Error updating class:', err);
    }
  };

  const handleClassCancel = () => {
    setEditingClass(null);
    setNewClass('');
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
      admin: '#f44336',
      teacher: '#2196f3',
      student: '#4caf50',
    };
    return colors[role] || '#999';
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div>
          <h1>Quản trị hệ thống</h1>
          <p>Xin chào, {user?.name || user?.username}</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/')} className="nav-button">
            📚 Bài tập
          </button>
          <button onClick={logout} className="logout-button">
            Đăng xuất
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
          <h2>Quản lý người dùng</h2>
          <button onClick={loadData} className="refresh-button">
            🔄 Làm mới
          </button>
        </div>

        <div className="users-table-container">
          <table className="users-table">
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
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Chưa có người dùng nào
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.username}</td>
                    <td>{u.name || u.username}</td>
                    <td>
                      {editingRole === u.id ? (
                        <div className="role-edit">
                          <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="role-select"
                          >
                            <option value="student">Học sinh</option>
                            <option value="teacher">Giáo viên</option>
                            <option value="admin">Quản trị viên</option>
                          </select>
                          <button
                            onClick={() => handleRoleSave(u.id)}
                            className="save-button"
                          >
                            ✓
                          </button>
                          <button
                            onClick={handleRoleCancel}
                            className="cancel-button"
                          >
                            ✕
                          </button>
                          {newRole === 'teacher' || newRole === 'admin' ? (
                            <span style={{ fontSize: '0.75rem', color: '#999', fontStyle: 'italic', marginLeft: '0.5rem' }}>
                              (Không cần lớp)
                            </span>
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
                      {u.role === 'student' ? (
                        editingClass === u.id ? (
                          <div className="class-edit">
                            <select
                              value={newClass}
                              onChange={(e) => setNewClass(e.target.value)}
                              className="class-select"
                            >
                              <option value="">Chưa có lớp</option>
                              <option value="8A1">8A1</option>
                              <option value="8A2">8A2</option>
                              <option value="8A3">8A3</option>
                              <option value="8A4">8A4</option>
                              <option value="8A5">8A5</option>
                            </select>
                            <button
                              onClick={() => handleClassSave(u.id)}
                              className="save-button"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleClassCancel}
                              className="cancel-button"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="class-display">
                            <span className="class-badge">
                              {u.class_name || 'Chưa có lớp'}
                            </span>
                            <button
                              onClick={() => handleClassChange(u.id, u.class_name)}
                              className="edit-class-button"
                              title="Sửa lớp"
                            >
                              ✏️
                            </button>
                          </div>
                        )
                      ) : (
                        <span className="class-na">-</span>
                      )}
                    </td>
                    <td>
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString('vi-VN')
                        : 'N/A'}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {editingRole !== u.id && (
                          <button
                            onClick={() => handleRoleChange(u.id, u.role)}
                            className="edit-button"
                            title="Sửa quyền"
                          >
                            ✏️
                          </button>
                        )}
                        {u.id !== user?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="delete-button"
                            title="Xóa người dùng"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
