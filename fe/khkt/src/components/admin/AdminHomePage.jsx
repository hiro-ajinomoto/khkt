import { useAdminWorkspace } from './AdminWorkspaceContext';
import { AdminUserTableHead, AdminUserTableRow } from './AdminUserTable';

export default function AdminHomePage() {
  const {
    stats,
    schoolClasses,
    schoolClassesByGrade,
    newClassName,
    setNewClassName,
    classBusy,
    classRename,
    setClassRename,
    handleAddSchoolClass,
    startRenameClass,
    cancelRenameClass,
    saveRenameClass,
    handleDeleteSchoolClass,
    users,
    filteredUsers,
    admins,
    userFilter,
    setUserFilter,
    loadData,
  } = useAdminWorkspace();

  return (
    <>
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
          <h2>Quản trị viên</h2>
          <button type="button" onClick={loadData} className="refresh-button">
            🔄 Làm mới
          </button>
        </div>

        <div className="user-filter-bar">
          <label htmlFor="admin-user-filter-home" className="user-filter-label">
            Tìm nhanh
          </label>
          <input
            id="admin-user-filter-home"
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
                    <AdminUserTableHead />
                    <tbody>
                    {admins.map((u) => (
                      <AdminUserTableRow key={u.id} rowUser={u} />
                    ))}
                  </tbody>
                  </table>
                </div>
              )}
            </div>
        )}
      </div>
    </>
  );
}
