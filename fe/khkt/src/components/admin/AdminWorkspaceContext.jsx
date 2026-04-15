import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchUsers, updateUserRole, updateUserClass, deleteUser, fetchStats } from '../../api/admin';
import {
  fetchSchoolClasses,
  createSchoolClass,
  deleteSchoolClass,
  renameSchoolClass,
  groupClassesByGrade,
} from '../../api/classes';

export const UNASSIGNED_CLASS_LABEL = 'Chưa phân lớp';

const AdminWorkspaceContext = createContext(null);

export function useAdminWorkspace() {
  const ctx = useContext(AdminWorkspaceContext);
  if (!ctx) {
    throw new Error('useAdminWorkspace must be used within AdminWorkspaceProvider');
  }
  return ctx;
}

export function AdminWorkspaceProvider({ children }) {
  const { user, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [newRole, setNewRole] = useState('');
  const [newClass, setNewClass] = useState('');
  const [schoolClasses, setSchoolClasses] = useState([]);
  const [newClassName, setNewClassName] = useState('');
  const [classBusy, setClassBusy] = useState(false);
  const [classRename, setClassRename] = useState(null);
  const [userFilter, setUserFilter] = useState('');

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startEditUser = useCallback((u) => {
    setEditingUserId(u.id);
    setNewRole(u.role);
    setNewClass(u.class_name || '');
  }, []);

  const cancelEditUser = useCallback(() => {
    setEditingUserId(null);
    setNewRole('');
    setNewClass('');
  }, []);

  const saveEditUser = useCallback(async () => {
    if (!editingUserId) return;
    const u = users.find((x) => x.id === editingUserId);
    if (!u) return;

    const finalClass = newClass && newClass.trim() !== '' ? newClass.trim() : null;

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
  }, [editingUserId, users, newRole, newClass, loadData, cancelEditUser]);

  const handleAddSchoolClass = useCallback(
    async (e) => {
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
    },
    [newClassName]
  );

  const startRenameClass = useCallback((name) => {
    setClassRename({ from: name, draft: name });
  }, []);

  const cancelRenameClass = useCallback(() => {
    setClassRename(null);
  }, []);

  const saveRenameClass = useCallback(async () => {
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
  }, [classRename]);

  const handleDeleteSchoolClass = useCallback(async (classLabel) => {
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
  }, []);

  const handleDeleteUser = useCallback(
    async (userId, username) => {
      if (!window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}"?`)) {
        return;
      }

      try {
        await deleteUser(userId);
        await loadData();
      } catch (err) {
        alert('Không thể xóa người dùng: ' + (err.message || 'Lỗi không xác định'));
        console.error('Error deleting user:', err);
      }
    },
    [loadData]
  );

  const getRoleLabel = useCallback((role) => {
    const labels = {
      admin: 'Quản trị viên',
      teacher: 'Giáo viên',
      student: 'Học sinh',
    };
    return labels[role] || role;
  }, []);

  const getRoleColor = useCallback((role) => {
    const colors = {
      admin: '#f87171',
      teacher: '#38bdf8',
      student: '#4ade80',
    };
    return colors[role] || '#94a3b8';
  }, []);

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

  const value = useMemo(
    () => ({
      user,
      logout,
      users,
      stats,
      loading,
      error,
      loadData,
      editingUserId,
      newRole,
      newClass,
      setNewRole,
      setNewClass,
      schoolClasses,
      newClassName,
      setNewClassName,
      classBusy,
      classRename,
      setClassRename,
      userFilter,
      setUserFilter,
      startEditUser,
      cancelEditUser,
      saveEditUser,
      handleAddSchoolClass,
      startRenameClass,
      cancelRenameClass,
      saveRenameClass,
      handleDeleteSchoolClass,
      handleDeleteUser,
      getRoleLabel,
      getRoleColor,
      filteredUsers,
      admins,
      teachers,
      studentGroups,
      schoolClassesByGrade,
    }),
    [
      user,
      logout,
      users,
      stats,
      loading,
      error,
      loadData,
      editingUserId,
      newRole,
      newClass,
      schoolClasses,
      newClassName,
      classBusy,
      classRename,
      userFilter,
      startEditUser,
      cancelEditUser,
      saveEditUser,
      handleAddSchoolClass,
      startRenameClass,
      cancelRenameClass,
      saveRenameClass,
      handleDeleteSchoolClass,
      handleDeleteUser,
      getRoleLabel,
      getRoleColor,
      filteredUsers,
      admins,
      teachers,
      studentGroups,
      schoolClassesByGrade,
    ]
  );

  return (
    <AdminWorkspaceContext.Provider value={value}>{children}</AdminWorkspaceContext.Provider>
  );
}
