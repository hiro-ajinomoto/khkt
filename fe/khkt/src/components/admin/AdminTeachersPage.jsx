import { useAdminWorkspace } from './AdminWorkspaceContext';
import { AdminUserTableHead, AdminUserTableRow } from './AdminUserTable';

export default function AdminTeachersPage() {
  const { users, filteredUsers, teachers, userFilter, setUserFilter, loadData } = useAdminWorkspace();

  return (
    <div className="users-section">
      <div className="section-header">
        <h2>Quản lý giáo viên</h2>
        <button type="button" onClick={loadData} className="refresh-button">
          🔄 Làm mới
        </button>
      </div>

      <div className="user-filter-bar">
        <label htmlFor="admin-user-filter-teachers" className="user-filter-label">
          Tìm nhanh
        </label>
        <input
          id="admin-user-filter-teachers"
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
      ) : teachers.length === 0 ? (
        <p className="user-group-empty muted">Không có giáo viên trong kết quả lọc.</p>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <AdminUserTableHead />
            <tbody>
              {teachers.map((u) => (
                <AdminUserTableRow key={u.id} rowUser={u} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
