import { useCallback, useEffect, useState } from 'react';
import {
  createTeacherInviteCode,
  fetchTeacherInviteCodes,
  revokeTeacherInviteCode,
} from '../../api/admin';
import { useAdminWorkspace } from './AdminWorkspaceContext';
import { AdminUserTableHead, AdminUserTableRow } from './AdminUserTable';

function formatViDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

function inviteStatus(row) {
  const now = Date.now();
  if (row.revoked_at) return { label: 'Đã thu hồi', className: 'teacher-invite-status--revoked' };
  if (row.expires_at && new Date(row.expires_at).getTime() <= now) {
    return { label: 'Hết hạn', className: 'teacher-invite-status--expired' };
  }
  if (row.uses_remaining <= 0) {
    return { label: 'Hết lượt', className: 'teacher-invite-status--depleted' };
  }
  return { label: 'Đang dùng được', className: 'teacher-invite-status--ok' };
}

export default function AdminTeachersPage() {
  const { users, filteredUsers, teachers, userFilter, setUserFilter, loadData } = useAdminWorkspace();
  const [inviteCodes, setInviteCodes] = useState([]);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  const loadInvites = useCallback(async () => {
    setInviteError(null);
    setInviteLoading(true);
    try {
      const list = await fetchTeacherInviteCodes();
      setInviteCodes(list);
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Không tải được mã.');
    } finally {
      setInviteLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleCreateInvite = async () => {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await createTeacherInviteCode({ max_uses: 1, expires_in_days: 90 });
      await loadInvites();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Không tạo được mã.');
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!window.confirm('Thu hồi mã này? Các lượt chưa dùng sẽ không còn hiệu lực.')) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      await revokeTeacherInviteCode(id);
      await loadInvites();
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : 'Không thu hồi được.');
    } finally {
      setInviteBusy(false);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      window.prompt('Sao chép mã:', code);
    }
  };

  return (
    <>
      <div className="users-section teacher-invite-section">
        <div className="section-header">
          <h2>Mã đăng ký giáo viên</h2>
          <div className="teacher-invite-header-actions">
            <button
              type="button"
              onClick={loadInvites}
              className="refresh-button"
              disabled={inviteLoading || inviteBusy}
            >
              🔄 Làm mới
            </button>
            <button
              type="button"
              onClick={handleCreateInvite}
              className="refresh-button teacher-invite-create"
              disabled={inviteLoading || inviteBusy}
            >
              ➕ Tạo mã mới
            </button>
          </div>
        </div>
        <p className="teacher-invite-intro muted">
          Mỗi mã mặc định 1 lượt, hiệu lực 90 ngày. Gửi mã cho giáo viên để họ tự đăng ký; gán lớp vẫn thực hiện ở mục
          &quot;GV — lớp&quot;.
        </p>
        {inviteError ? (
          <p className="teacher-invite-error" role="alert">
            {inviteError}
          </p>
        ) : null}
        {inviteLoading ? (
          <p className="user-group-empty muted">Đang tải mã…</p>
        ) : inviteCodes.length === 0 ? (
          <p className="user-group-empty muted">Chưa có mã nào. Bấm &quot;Tạo mã mới&quot;.</p>
        ) : (
          <div className="users-table-container">
            <table className="users-table teacher-invite-table">
              <thead>
                <tr>
                  <th>Mã</th>
                  <th className="admin-users-col--mobile-hidden">Đã dùng / Tối đa</th>
                  <th className="admin-users-col--mobile-hidden">Hết hạn</th>
                  <th>Trạng thái</th>
                  <th className="admin-users-col--actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {inviteCodes.map((row) => {
                  const st = inviteStatus(row);
                  return (
                    <tr key={row.id}>
                      <td>
                        <code className="teacher-invite-code">{row.code}</code>
                      </td>
                      <td className="admin-users-col--mobile-hidden">
                        {row.use_count} / {row.max_uses}
                      </td>
                      <td className="admin-users-col--mobile-hidden">{formatViDate(row.expires_at)}</td>
                      <td>
                        <span className={`teacher-invite-status ${st.className}`}>{st.label}</span>
                      </td>
                      <td className="admin-users-col--actions">
                        <div className="action-buttons teacher-invite-actions">
                          <button
                            type="button"
                            className="edit-button"
                            title="Sao chép mã"
                            aria-label="Sao chép mã"
                            onClick={() => copyCode(row.code)}
                            disabled={inviteBusy}
                          >
                            📋
                          </button>
                          {!row.revoked_at ? (
                            <button
                              type="button"
                              className="delete-button"
                              title="Thu hồi"
                              aria-label="Thu hồi mã"
                              onClick={() => handleRevoke(row.id)}
                              disabled={inviteBusy}
                            >
                              🚫
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </>
  );
}
