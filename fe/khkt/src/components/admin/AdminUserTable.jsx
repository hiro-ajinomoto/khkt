import { useAdminWorkspace } from './AdminWorkspaceContext';

export function AdminUserTableHead() {
  const { editingUserId } = useAdminWorkspace();
  return (
    <thead>
      <tr>
        <th className="admin-users-col--username admin-users-col--mobile-hidden">Tên đăng nhập</th>
        <th className="admin-users-col--name">Họ và tên</th>
        <th
          className={`admin-users-col--role ${!editingUserId ? 'admin-users-col--mobile-hidden' : ''}`.trim()}
        >
          Quyền
        </th>
        <th
          className={`admin-users-col--class ${!editingUserId ? 'admin-users-col--mobile-hidden' : ''}`.trim()}
        >
          Lớp
        </th>
        <th className="admin-users-col--created admin-users-col--mobile-hidden">Ngày tạo</th>
        <th className="admin-users-col--actions">Thao tác</th>
      </tr>
    </thead>
  );
}

export function AdminUserTableRow({ rowUser }) {
  const {
    user,
    editingUserId,
    newRole,
    newClass,
    setNewRole,
    setNewClass,
    schoolClassesByGrade,
    startEditUser,
    cancelEditUser,
    saveEditUser,
    handleDeleteUser,
    getRoleLabel,
    getRoleColor,
  } = useAdminWorkspace();

  const u = rowUser;

  return (
    <tr>
      <td className="admin-users-col--username admin-users-col--mobile-hidden">{u.username}</td>
      <td className="admin-users-col--name">{u.name || u.username}</td>
      <td
        className={`admin-users-col--role ${!editingUserId ? 'admin-users-col--mobile-hidden' : ''}`.trim()}
      >
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
          <span className="role-badge" style={{ backgroundColor: getRoleColor(u.role) }}>
            {getRoleLabel(u.role)}
          </span>
        )}
      </td>
      <td
        className={`admin-users-col--class ${!editingUserId ? 'admin-users-col--mobile-hidden' : ''}`.trim()}
      >
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
        ) : u.role === 'teacher' ? (
          <span className="class-badge" title="Các lớp được quản trị gán">
            {u.assigned_class_names?.length
              ? u.assigned_class_names.join(', ')
              : 'Chưa gán lớp'}
          </span>
        ) : (
          <span className="class-na">-</span>
        )}
      </td>
      <td className="admin-users-col--created admin-users-col--mobile-hidden">
        {u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'N/A'}
      </td>
      <td className="admin-users-col--actions">
        <div className="action-buttons">
          {editingUserId === u.id ? (
            <>
              <button
                type="button"
                onClick={saveEditUser}
                className="save-button"
                title="Lưu quyền và lớp"
              >
                {'\u2713'}
              </button>
              <button
                type="button"
                onClick={cancelEditUser}
                className="cancel-button"
                title="Hủy"
              >
                {'\u2715'}
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
                {'\u270F\uFE0F'}
              </button>
              {u.id !== user?.id && (
                <button
                  type="button"
                  onClick={() => handleDeleteUser(u.id, u.username)}
                  className="delete-button"
                  title="Xóa người dùng"
                >
                  {'\u{1F5D1}\uFE0F'}
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
