import { useAdminWorkspace, UNASSIGNED_CLASS_LABEL } from './AdminWorkspaceContext';
import { AdminUserTableHead, AdminUserTableRow } from './AdminUserTable';

export default function AdminStudentsPage() {
  const { users, filteredUsers, studentGroups, userFilter, setUserFilter, loadData } = useAdminWorkspace();

  return (
    <div className="users-section">
      <div className="section-header">
        <h2>Quản lý học sinh</h2>
        <button type="button" onClick={loadData} className="refresh-button">
          🔄 Làm mới
        </button>
      </div>

      <div className="user-filter-bar">
          <label htmlFor="admin-user-filter-students" className="user-filter-label">
            Tìm nhanh
          </label>
          <input
            id="admin-user-filter-students"
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
      ) : studentGroups.length === 0 ? (
        <p className="user-group-empty muted">Không có học sinh trong kết quả lọc.</p>
      ) : (
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
                        <AdminUserTableHead />
                        <tbody>
                    {groupUsers.map((u) => (
                      <AdminUserTableRow key={u.id} rowUser={u} />
                    ))}
                  </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
      )}
    </div>
  );
}
