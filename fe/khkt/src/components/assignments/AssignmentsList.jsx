import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAssignments, fetchAssignmentsByDate, fetchAssignmentsByMonth, deleteAssignment, deleteAssignments, assignAssignmentsToClasses, getAssignmentClasses } from '../../api/assignments';
import { fetchMySubmissions } from '../../api/submissions';
import { useAuth } from '../../contexts/AuthContext';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import {
  formatVNDateFromYMD,
  isAssignmentReleasedClient,
  deadlineReminderClient,
} from '../../utils/assignmentRelease';
import './AssignmentsList.css';

/** Local calendar date for filtering (missing created_at → coi như hôm nay để vẫn hiện bài cũ). */
function getAssignmentLocalDate(assignment) {
  if (assignment?.created_at) return new Date(assignment.created_at);
  return new Date();
}

/** Hiển thị môn dạng #hashtag, màu gradient nổi bật */
function SubjectHashtag({ subject }) {
  const raw =
    String(subject || 'math')
      .replace(/^#/, '')
      .trim()
      .toLowerCase() || 'math';
  return (
    <span className="inline-flex items-center rounded-full border border-violet-300/45 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold tracking-wide text-white shadow-lg shadow-violet-950/45 ring-1 ring-white/15">
      #{raw}
    </span>
  );
}

function AssignmentsList() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isTeacher, isStudent, user, logout } = useAuth();
  const [allAssignments, setAllAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  /** Danh sách id bài tập đang mở trong modal gán lớp (một hoặc nhiều bài). */
  const [assignModalAssignmentIds, setAssignModalAssignmentIds] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  /** Học sinh: id bài đã có bài nộp của tôi */
  const [submittedAssignmentIds, setSubmittedAssignmentIds] = useState(
    () => new Set()
  );
  /** Học sinh: chỉ hiện bài chưa nộp */
  const [studentOnlyUnsubmitted, setStudentOnlyUnsubmitted] = useState(false);

  // For teachers: filter by date
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  });

  // For students: filter by month
  const [selectedYear, setSelectedYear] = useState(() => {
    const today = new Date();
    return today.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return today.getMonth() + 1; // 1-12
  });

  useEffect(() => {
    loadAllAssignments();
  }, []);

  useEffect(() => {
    const threshold = 320;
    const onScroll = () => {
      const y = window.scrollY ?? document.documentElement.scrollTop ?? 0;
      setShowBackToTop(y > threshold);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-select latest date/month when assignments are loaded (only once)
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  
  useEffect(() => {
    if (allAssignments.length === 0 || hasAutoSelected) return;

    if (isTeacher || isAdmin) {
      // Find the latest date with assignments
      const dates = new Set();
      allAssignments.forEach((assignment) => {
        if (assignment.created_at) {
          const date = new Date(assignment.created_at);
          dates.add(date.toISOString().split('T')[0]);
        }
      });
      
      if (dates.size > 0) {
        const latestDate = Array.from(dates).sort((a, b) => b.localeCompare(a))[0];
        setSelectedDate(latestDate);
        setHasAutoSelected(true);
      }
    }
    // Học sinh: tháng/năm được đồng bộ trong loadAllAssignments sau mỗi lần tải API
  }, [allAssignments, isTeacher, isAdmin, hasAutoSelected]);

  const loadAllAssignments = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading assignments...');
      const data = await fetchAssignments();
      console.log('Assignments loaded:', data);
      console.log('Number of assignments:', data.length);
      setAllAssignments(data);

      if (isStudent) {
        try {
          const subs = await fetchMySubmissions();
          setSubmittedAssignmentIds(
            new Set(subs.map((s) => s.assignment_id))
          );
        } catch {
          setSubmittedAssignmentIds(new Set());
        }
      } else {
        setSubmittedAssignmentIds(new Set());
      }

      // Học sinh: nhảy tới tháng của bài mới nhất sau mỗi lần tải (tránh kẹt bộ lọc tháng cũ khi có bài mới)
      if (!isTeacher && !isAdmin && Array.isArray(data) && data.length > 0) {
        const dated = data.filter((a) => a?.created_at);
        if (dated.length > 0) {
          const latest = dated.reduce((best, a) =>
            new Date(a.created_at) > new Date(best.created_at) ? a : best
          );
          const d = new Date(latest.created_at);
          setSelectedYear(d.getFullYear());
          setSelectedMonth(d.getMonth() + 1);
        } else {
          const now = new Date();
          setSelectedYear(now.getFullYear());
          setSelectedMonth(now.getMonth() + 1);
        }
        setHasAutoSelected(true);
      }
    } catch (err) {
      setError(err.message || 'Failed to load assignments');
      console.error('Error loading assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAssignments = () => {
    // Filtering is done in useMemo hooks below
    // This effect just triggers re-render when filters change
  };

  // Filter and group assignments by date for teachers
  const filteredAndGroupedByDate = useMemo(() => {
    if (!isTeacher && !isAdmin) return {};
    
    // Filter by selected date
    const filtered = allAssignments.filter((assignment) => {
      if (!assignment.created_at) return false;
      const date = new Date(assignment.created_at);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      return dateKey === selectedDate;
    });

    // Group by date (should be only one date after filtering)
    const groups = {};
    filtered.forEach((assignment) => {
      if (!assignment.created_at) return;
      const date = new Date(assignment.created_at);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(assignment);
    });

    // Sort dates (newest first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const sortedGroups = {};
    sortedDates.forEach((date) => {
      sortedGroups[date] = groups[date];
    });

    return sortedGroups;
  }, [allAssignments, isTeacher, isAdmin, selectedDate]);

  // Filter and group assignments by date within month for students
  const filteredAndGroupedByDateInMonth = useMemo(() => {
    if (isTeacher || isAdmin) return {};
    
    // Filter by selected month
    let filtered = allAssignments.filter((assignment) => {
      const date = getAssignmentLocalDate(assignment);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return year === selectedYear && month === selectedMonth;
    });

    if (studentOnlyUnsubmitted) {
      filtered = filtered.filter(
        (assignment) => !submittedAssignmentIds.has(assignment.id)
      );
    }

    // Group by date
    const groups = {};
    filtered.forEach((assignment) => {
      const date = getAssignmentLocalDate(assignment);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(assignment);
    });

    // Sort dates (newest first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const sortedGroups = {};
    sortedDates.forEach((date) => {
      sortedGroups[date] = groups[date];
    });

    return sortedGroups;
  }, [
    allAssignments,
    isTeacher,
    isAdmin,
    selectedYear,
    selectedMonth,
    studentOnlyUnsubmitted,
    submittedAssignmentIds,
  ]);

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài tập này?')) {
      return;
    }

    try {
      await deleteAssignment(id);
      
      // Remove from state immediately for better UX
      setAllAssignments((prev) => prev.filter((a) => a.id !== id));
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      
      // Also reload to ensure consistency
      await loadAllAssignments();
    } catch (err) {
      alert('Không thể xóa bài tập: ' + (err.message || 'Lỗi không xác định'));
      console.error('Error deleting assignment:', err);
    }
  };

  const handleSelect = (id) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleAssign = (assignmentId) => {
    setAssignModalAssignmentIds([assignmentId]);
    setShowAssignModal(true);
  };

  const handleBulkAssignFromSelection = () => {
    if (selectedIds.size === 0) return;
    setAssignModalAssignmentIds(Array.from(selectedIds));
    setShowAssignModal(true);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa ${ids.length} bài tập đã chọn? Hành động này không thể hoàn tác.`
      )
    ) {
      return;
    }
    try {
      setBulkDeleting(true);
      await deleteAssignments(ids);
      setSelectedIds(new Set());
      await loadAllAssignments();
    } catch (err) {
      alert(
        'Không thể xóa bài tập: ' + (err.message || 'Lỗi không xác định')
      );
      console.error('Error bulk deleting assignments:', err);
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setAssignModalAssignmentIds(null);
    loadAllAssignments();
  };

  const handleAssignModalSuccess = () => {
    setShowAssignModal(false);
    setAssignModalAssignmentIds(null);
    setSelectedIds(new Set());
    loadAllAssignments();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateHeader = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatMonthYear = (year, month) => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
    });
  };

  // Get available dates for teacher date selector (from all assignments)
  const availableDates = useMemo(() => {
    if (!isTeacher && !isAdmin) return [];
    
    const dates = new Set();
    allAssignments.forEach((assignment) => {
      if (assignment.created_at) {
        const date = new Date(assignment.created_at);
        dates.add(date.toISOString().split('T')[0]);
      }
    });
    
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [allAssignments, isTeacher, isAdmin]);

  // Get current filtered assignments count
  const filteredAssignments = useMemo(() => {
    if (isTeacher || isAdmin) {
      return Object.values(filteredAndGroupedByDate).flat();
    } else {
      return Object.values(filteredAndGroupedByDateInMonth).flat();
    }
  }, [filteredAndGroupedByDate, filteredAndGroupedByDateInMonth, isTeacher, isAdmin]);

  // Get available months for student month selector
  const availableMonths = useMemo(() => {
    if (isTeacher || isAdmin) return [];
    
    const monthSet = new Set();
    allAssignments.forEach((assignment) => {
      const date = getAssignmentLocalDate(assignment);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      monthSet.add(`${year}-${month}`);
    });
    
    return Array.from(monthSet)
      .map((ym) => {
        const [y, m] = ym.split('-').map(Number);
        return { year: y, month: m };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
  }, [allAssignments, isTeacher, isAdmin]);

  if (loading) {
    return <OceanPageLoading message="Đang tải danh sách bài tập" />;
  }

  if (error) {
    return (
      <OceanPageError
        message={error}
        onRetry={loadAllAssignments}
        retryLabel="Thử tải lại"
      />
    );
  }

  return (
    <OceanShell>
        {/* Header */}
        <header className="mb-10 flex flex-col gap-6 rounded-[28px] border border-cyan-300/15 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/20 via-sky-400/10 to-blue-500/20 p-1 shadow-lg shadow-cyan-950/40">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-900/80 text-xl font-bold text-cyan-200">
                {user?.name?.[0] || user?.username?.[0] || 'ST'}
              </div>
              <div className="absolute inset-x-1 top-1 h-4 rounded-full bg-cyan-300/20 blur-md" />
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-cyan-200/80">
                Cuộc thi khoa học kỹ thuật
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Danh sách bài tập &amp; thử thách
              </h1>
            </div>
          </div>

          <div className="flex flex-col items-start gap-3 lg:items-end">
            {isAuthenticated ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 backdrop-blur">
                  {user?.name || user?.username}{' '}
                  <span className="text-cyan-200">
                    (
                    {user?.role === 'admin'
                      ? 'Quản trị viên'
                      : user?.role === 'teacher'
                      ? 'Giáo viên'
                      : 'Học sinh'}
                    )
                  </span>
                </div>
                <div className="flex gap-3">
                  {isAdmin && (
                    <button
                      onClick={() => navigate('/admin')}
                      className="group relative overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-amber-500/40 px-5 py-3 text-sm font-medium text-amber-50 shadow-lg shadow-amber-950/40 transition hover:-translate-y-0.5"
                    >
                      <span className="relative z-10">⚙️ Trang quản trị</span>
                    </button>
                  )}
                  <button
                    onClick={logout}
                    className="group relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-r from-sky-500/20 via-cyan-400/20 to-blue-500/20 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:shadow-cyan-900/50"
                  >
                    <span className="relative z-10">Đăng xuất</span>
                    <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] translate-x-[-120%] group-hover:translate-x-[120%] transition duration-1000" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="rounded-2xl border border-cyan-300/40 bg-slate-900/70 px-5 py-3 text-sm font-medium text-cyan-100 shadow-lg shadow-cyan-950/40 hover:-translate-y-0.5 transition"
                >
                  Đăng nhập
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="rounded-2xl border border-fuchsia-300/40 bg-gradient-to-r from-fuchsia-500/70 to-violet-600/80 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-fuchsia-950/40 hover:-translate-y-0.5 transition"
                >
                  Đăng ký
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Filters + quick actions */}
        <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[28px] border border-cyan-300/15 bg-white/5 p-5 backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Bộ lọc thời gian</h2>
              <div className="h-px flex-1 mx-4 bg-gradient-to-r from-cyan-300/30 to-transparent" />
              <span className="text-xs uppercase tracking-[0.28em] text-cyan-200/70">
                Ocean UI
              </span>
            </div>

            {isTeacher || isAdmin ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="group rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">
                    Ngày
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-900 to-sky-950/60 px-4 py-3 text-slate-100 outline-none ring-0 focus:border-cyan-300/60"
                  />
                </div>

                <div className="group rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">
                    Ngày có bài tập
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-900 to-sky-950/60 px-4 py-3 text-slate-100 outline-none ring-0"
                  >
                    {availableDates.length === 0 ? (
                      <option value={selectedDate}>{formatDateHeader(selectedDate)}</option>
                    ) : (
                      availableDates.map((date) => (
                        <option key={date} value={date}>
                          {formatDateHeader(date)}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="group rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">
                    Thống kê
                  </label>
                  <div className="rounded-xl border border-cyan-400/10 bg-gradient-to-r from-slate-900 to-sky-950/60 px-4 py-3 text-sm text-slate-100">
                    {filteredAssignments.length} bài tập vào ngày{' '}
                    {formatDateHeader(selectedDate)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="group rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">
                    Năm
                  </label>
                  <input
                    type="number"
                    value={selectedYear}
                    onChange={(e) =>
                      setSelectedYear(parseInt(e.target.value, 10) || selectedYear)
                    }
                    min="2020"
                    max="2100"
                    className="w-full rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-900 to-sky-950/60 px-4 py-3 text-slate-100 outline-none ring-0"
                  />
                </div>
                <div className="group rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">
                    Tháng
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-900 to-sky-950/60 px-4 py-3 text-slate-100 outline-none ring-0"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                      <option key={month} value={month}>
                        Tháng {month}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-400">
                    Tháng có bài tập
                  </label>
                  <select
                    value={`${selectedYear}-${selectedMonth}`}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-').map(Number);
                      setSelectedYear(year);
                      setSelectedMonth(month);
                    }}
                    className="w-full rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-900 to-sky-950/60 px-4 py-3 text-slate-100 outline-none ring-0"
                  >
                    {availableMonths.length === 0 ? (
                      <option value={`${selectedYear}-${selectedMonth}`}>
                        {formatMonthYear(selectedYear, selectedMonth)}
                      </option>
                    ) : (
                      availableMonths.map(({ year, month }) => (
                        <option key={`${year}-${month}`} value={`${year}-${month}`}>
                          {formatMonthYear(year, month)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-cyan-300/15 bg-gradient-to-br from-cyan-400/10 via-sky-400/5 to-blue-500/10 p-5 backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-cyan-300/10 flex items-center justify-center text-cyan-200">
                ✦
              </div>
              <div>
                <h3 className="font-semibold text-white">Thống kê nhanh</h3>
                <p className="text-sm text-slate-300">
                  {filteredAssignments.length} bài tập trong{' '}
                  {isTeacher || isAdmin
                    ? formatDateHeader(selectedDate)
                    : formatMonthYear(selectedYear, selectedMonth)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {isStudent && (
                <button
                  onClick={() => navigate('/my-submissions')}
                  className="w-full rounded-2xl border border-fuchsia-300/20 bg-gradient-to-r from-fuchsia-500/80 to-violet-600/80 px-4 py-3 font-medium text-white shadow-lg shadow-fuchsia-950/30 transition hover:-translate-y-0.5"
                >
                  📝 Bài đã nộp
                </button>
              )}
              {isStudent && (
                <button
                  type="button"
                  onClick={() => setStudentOnlyUnsubmitted((v) => !v)}
                  aria-pressed={studentOnlyUnsubmitted}
                  className={`flex w-full items-center justify-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 ${
                    studentOnlyUnsubmitted
                      ? 'border-amber-200/70 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-amber-950/50 ring-2 ring-amber-300/40'
                      : 'border-orange-400/45 bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 text-white shadow-orange-950/45 hover:from-orange-400 hover:via-orange-500 hover:to-amber-400'
                  }`}
                >
                  {studentOnlyUnsubmitted ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-5 w-5 shrink-0"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013H9.75a2.25 2.25 0 01-2.248-2.052v-1.524a2.25 2.25 0 00-.659-1.591L2.659 8.23A2.25 2.25 0 012 6.638V5.582c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z"
                        />
                      </svg>
                      <span>Đang lọc: bài tôi chưa nộp</span>
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="h-5 w-5 shrink-0"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Chỉ hiện bài tôi chưa nộp</span>
                    </>
                  )}
                </button>
              )}
              {isTeacher && (
                <button
                  onClick={() => navigate('/assignments/create')}
                  className="w-full rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-500/80 to-cyan-500/80 px-4 py-3 font-medium text-white shadow-lg shadow-emerald-950/30 transition hover:-translate-y-0.5"
                >
                  ➕ Tạo bài tập mới
                </button>
              )}
              {isTeacher && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkAssignFromSelection}
                  className="w-full rounded-2xl border border-cyan-300/35 bg-gradient-to-r from-cyan-500/50 to-sky-600/60 px-4 py-3 font-medium text-white shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5"
                >
                  📋 Gán các bài đã chọn ({selectedIds.size})
                </button>
              )}
              <button
                onClick={loadAllAssignments}
                className="w-full rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-cyan-500/70 to-blue-600/80 px-4 py-3 font-medium text-white shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5"
              >
                ↻ Làm mới dữ liệu
              </button>
              {isTeacher && selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="w-full rounded-2xl border border-rose-300/30 bg-rose-500/20 px-4 py-3 text-sm font-medium text-rose-50 shadow-lg shadow-rose-950/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {bulkDeleting
                    ? 'Đang xóa...'
                    : `🗑️ Xóa đã chọn (${selectedIds.size})`}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Timeline banner */}
        <section className="mb-6">
          <div className="relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-gradient-to-r from-blue-500/70 via-sky-500/65 to-violet-600/60 px-6 py-5 shadow-2xl shadow-sky-950/30">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_20%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.14),transparent_18%)]" />
            <div className="relative">
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-50/75">
                Mốc thời gian
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                {isTeacher || isAdmin
                  ? formatDateHeader(selectedDate)
                  : `Tháng ${selectedMonth}, ${selectedYear}`}
              </h2>
            </div>
          </div>
        </section>

        {/* Empty states */}
        {allAssignments.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-10 text-center text-slate-200">
            {isTeacher || isAdmin
              ? 'Chưa có bài tập nào. Hãy tạo bài tập mới cho học sinh nhé!'
              : 'Chưa có bài tập nào được gán cho lớp của bạn.'}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-10 text-center text-slate-200">
            {isTeacher || isAdmin
              ? `Chưa có bài tập nào vào ngày ${formatDateHeader(
                  selectedDate
                )}. Tổng số bài tập: ${allAssignments.length}`
              : studentOnlyUnsubmitted
                ? `Không còn bài nào bạn chưa nộp trong tháng ${formatMonthYear(
                    selectedYear,
                    selectedMonth
                  )}.`
                : `Chưa có bài tập nào trong tháng ${formatMonthYear(
                    selectedYear,
                    selectedMonth
                  )}. Tổng số bài tập: ${allAssignments.length}`}
          </div>
        ) : (
          <>
            {/* Stats line */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-200">
              <span>
                Tổng số: {filteredAssignments.length} bài tập
                {isTeacher || isAdmin
                  ? ` vào ngày ${formatDateHeader(selectedDate)}`
                  : ` trong tháng ${formatMonthYear(selectedYear, selectedMonth)}`}
                {isStudent && studentOnlyUnsubmitted && (
                  <span className="text-cyan-200/90"> · lọc: tôi chưa nộp</span>
                )}
              </span>
              {isTeacher && selectedIds.size > 0 && (
                <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                  Đã chọn: {selectedIds.size}
                </span>
              )}
            </div>

            {/* Cards */}
            {(isTeacher || isAdmin) && Object.keys(filteredAndGroupedByDate).length > 0 && (
              <div className="space-y-6">
                {Object.entries(filteredAndGroupedByDate).map(([date, assignments]) => (
                  <div key={date} className="space-y-4">
                    <h2 className="text-base font-semibold text-slate-100">
                      {formatDateHeader(date)}
                    </h2>
                    <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 [&>*]:h-full [&>*]:min-h-0">
                      {assignments.map((assignment, idx) => (
                        <AssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          index={idx}
                          isTeacher={true}
                          selectedIds={selectedIds}
                          onSelect={handleSelect}
                          onDelete={handleDelete}
                          onEdit={(id) => navigate(`/assignments/${id}/edit`)}
                          onView={(id) => navigate(`/assignments/${id}`)}
                          onAssign={handleAssign}
                          formatDate={formatDate}
                        />
                      ))}
                    </section>
                  </div>
                ))}
              </div>
            )}

            {!isTeacher &&
              !isAdmin &&
              Object.keys(filteredAndGroupedByDateInMonth).length > 0 && (
                <div className="space-y-6">
                  {Object.entries(filteredAndGroupedByDateInMonth).map(
                    ([date, assignments]) => (
                      <div key={date} className="space-y-4">
                        <h2 className="text-base font-semibold text-slate-100">
                          {formatDateHeader(date)}
                        </h2>
                        <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 [&>*]:h-full [&>*]:min-h-0">
                          {assignments.map((assignment, idx) => (
                            <AssignmentCard
                              key={assignment.id}
                              assignment={assignment}
                              index={idx}
                              isTeacher={false}
                              selectedIds={selectedIds}
                              onSelect={handleSelect}
                              onDelete={handleDelete}
                              onEdit={(id) => navigate(`/assignments/${id}/edit`)}
                              onView={(id) => navigate(`/assignments/${id}`)}
                              onAssign={handleAssign}
                              formatDate={formatDate}
                            />
                          ))}
                        </section>
                      </div>
                    )
                  )}
                </div>
              )}
          </>
        )}

        {showAssignModal && assignModalAssignmentIds?.length > 0 && (
          <AssignAssignmentModal
            assignmentIds={assignModalAssignmentIds}
            onClose={handleCloseAssignModal}
            onSuccess={handleAssignModalSuccess}
          />
        )}

        {showBackToTop && (
          <button
            type="button"
            onClick={() =>
              window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
            }
            className="fixed bottom-24 right-5 z-[600] flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/35 bg-gradient-to-br from-cyan-500/50 to-sky-700/55 text-lg text-white shadow-lg shadow-cyan-950/40 backdrop-blur-md transition hover:-translate-y-0.5 hover:border-cyan-200/40 hover:shadow-cyan-900/50 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 sm:bottom-10 sm:right-8"
            aria-label="Lên đầu trang"
            title="Lên đầu trang"
          >
            <span className="sr-only">Lên đầu trang</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-6 w-6"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 15.75l7.5-7.5 7.5 7.5"
              />
            </svg>
          </button>
        )}
    </OceanShell>
  );
}

// Assignment Card Component
function AssignmentCard({
  assignment,
  isTeacher,
  index,
  selectedIds,
  onSelect,
  onDelete,
  onEdit,
  onView,
  onAssign,
  formatDate,
}) {
  return (
    <article
      className={`group relative flex h-full min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-white/6 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-300/30 hover:shadow-cyan-950/40 cursor-pointer ${
        selectedIds.has(assignment.id) ? 'ring-2 ring-cyan-300/70 ring-offset-2 ring-offset-slate-900' : ''
      }`}
      onClick={() => onView(assignment.id)}
    >
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.16),transparent_28%)]" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-3xl font-semibold tracking-tight text-white line-clamp-1">
              {assignment.title || `Bài ${index + 1}`}
            </h3>
            <p className="mt-2 text-base text-slate-300 line-clamp-2">
              {assignment.description || assignment.subtitle || 'Bài tập tự luận'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
              {String(index + 1).padStart(2, '0')}
            </div>
            {isTeacher && (
              <div className="flex gap-1 text-xs">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAssign(assignment.id);
                  }}
                  className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-100 hover:bg-cyan-500/20"
                  title="Gán bài tập cho lớp"
                >
                  📋
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(assignment.id);
                  }}
                  className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-100 hover:bg-amber-500/20"
                  title="Sửa bài tập"
                >
                  ✏️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(assignment.id);
                  }}
                  className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-rose-100 hover:bg-rose-500/20"
                  title="Xóa bài tập"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          {isTeacher && (
            <label
              className="flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-slate-900/50 px-3 py-2 text-xs text-slate-200"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(assignment.id)}
                onChange={() => onSelect(assignment.id)}
                className="h-4 w-4 rounded border-cyan-300/40 bg-slate-900 text-cyan-400"
              />
              Chọn bài này
            </label>
          )}
          <SubjectHashtag subject={assignment.subject} />
          {isTeacher &&
            assignment.available_from_date &&
            !isAssignmentReleasedClient(assignment.available_from_date) && (
              <span className="rounded-xl border border-amber-400/40 bg-amber-500/20 px-3 py-2 text-xs font-medium text-amber-100">
                Chưa mở HS — từ{' '}
                {formatVNDateFromYMD(assignment.available_from_date)}
              </span>
            )}
          {isTeacher && assignment.due_date && (
            <span className="rounded-xl border border-slate-400/30 bg-slate-800/70 px-3 py-2 text-xs text-slate-200">
              Hạn nộp: {formatVNDateFromYMD(assignment.due_date)}
            </span>
          )}
          {!isTeacher && assignment.due_date && (() => {
            const r = deadlineReminderClient(assignment.due_date);
            if (!r) return null;
            const cls =
              r.tone === 'overdue'
                ? 'border-rose-400/45 bg-rose-600/25 text-rose-100'
                : r.tone === 'today'
                  ? 'border-orange-400/50 bg-orange-500/30 text-orange-50'
                  : 'border-emerald-400/40 bg-emerald-600/20 text-emerald-100';
            return (
              <span
                className={`rounded-xl border px-3 py-2 text-xs font-medium ${cls}`}
              >
                {r.label}
              </span>
            );
          })()}
          {assignment.grade_level && (
            <span className="rounded-xl border border-fuchsia-300/10 bg-fuchsia-300/10 px-3 py-2 text-fuchsia-100">
              Lớp {assignment.grade_level}
            </span>
          )}
          <span className="rounded-xl border border-sky-300/15 bg-sky-300/10 px-3 py-2 text-sky-100">
            {formatDate(assignment.created_at)}
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-white/95 to-cyan-50 p-6 text-slate-900 shadow-inner">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border-[18px] border-cyan-300/40" />
          <div className="absolute -left-10 bottom-0 h-16 w-28 rounded-t-full border-t-[10px] border-cyan-400/30" />

          {assignment.question_image_url ? (
            <div className="flex flex-col items-center gap-3">
              <img
                src={assignment.question_image_url}
                alt="Câu hỏi"
                className="max-h-40 w-auto rounded-2xl object-contain shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(assignment.id);
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="text-xs text-slate-500">
                Bấm để xem chi tiết bài và nộp bài.
              </p>
            </div>
          ) : (
            <div className="text-center text-xl md:text-2xl font-serif tracking-tight">
              {assignment.model_solution ||
                assignment.title ||
                'Mở bài tập để xem nội dung chi tiết'}
            </div>
          )}
          </div>
        </div>

        <div className="mt-5 flex shrink-0 gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(assignment.id);
            }}
            className="flex-1 rounded-2xl border border-cyan-300/25 bg-gradient-to-r from-cyan-500/80 to-blue-600/80 px-4 py-3 font-medium text-white shadow-lg shadow-cyan-950/30 transition hover:-translate-y-0.5"
          >
            Xem chi tiết
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView(assignment.id);
            }}
            className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-slate-200 transition hover:bg-white/12"
          >
            ⋯
          </button>
        </div>
      </div>
    </article>
  );
}

// Assign Assignment Modal Component
function AssignAssignmentModal({ assignmentIds, onClose, onSuccess }) {
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [assignedClasses, setAssignedClasses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // Organize classes by grade level
  const CLASSES_BY_GRADE = {
    'Khối 6': ['6A1', '6A2', '6A3', '6A4', '6A5'],
    'Khối 7': ['7A1', '7A2', '7A3', '7A4', '7A5'],
    'Khối 8': ['8A1', '8A2', '8A3', '8A4', '8A5'],
    'Khối 9': ['9A1', '9A2', '9A3', '9A4', '9A5'],
  };

  const assignmentCount = assignmentIds?.length ?? 0;

  useEffect(() => {
    const loadAssignedClasses = async () => {
      if (!assignmentIds?.length) return;
      try {
        setLoadingClasses(true);
        const lists = await Promise.all(
          assignmentIds.map((id) => getAssignmentClasses(id))
        );
        const union = new Set();
        lists.forEach((list) => {
          list.forEach((c) => union.add(c.class_name));
        });
        const classNames = Array.from(union);
        setAssignedClasses(classNames);
        setSelectedClasses(classNames);
      } catch (err) {
        console.error('Error loading assigned classes:', err);
      } finally {
        setLoadingClasses(false);
      }
    };
    loadAssignedClasses();
  }, [assignmentIds]);

  const handleClassToggle = (className) => {
    setSelectedClasses((prev) => {
      if (prev.includes(className)) {
        return prev.filter((c) => c !== className);
      } else {
        return [...prev, className];
      }
    });
  };

  const handleSelectGrade = (gradeClasses) => {
    const allSelected = gradeClasses.every((className) => selectedClasses.includes(className));
    
    setSelectedClasses((prev) => {
      if (allSelected) {
        // Bỏ chọn tất cả lớp trong khối
        return prev.filter((className) => !gradeClasses.includes(className));
      } else {
        // Chọn tất cả lớp trong khối
        const newClasses = gradeClasses.filter((className) => !prev.includes(className));
        return [...prev, ...newClasses];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedClasses.length === 0) {
      setError('Vui lòng chọn ít nhất một lớp');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await assignAssignmentsToClasses(assignmentIds, selectedClasses);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Không thể gán bài tập. Vui lòng thử lại.');
      console.error('Error assigning assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-cyan-300/20 bg-slate-900/95 p-6 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
      >
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 id="assign-modal-title" className="text-lg font-semibold text-white">
              {assignmentCount > 1
                ? `Gán ${assignmentCount} bài tập cho lớp`
                : 'Gán bài tập cho lớp'}
            </h2>
            {assignmentCount > 1 && (
              <p className="mt-1 text-sm text-slate-400">
                Các lớp bạn chọn sẽ được gán cho tất cả bài đã chọn.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-slate-300 transition hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
              Chọn lớp
            </label>
            {loadingClasses ? (
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-6 text-center text-slate-300">
                Đang tải...
              </div>
            ) : (
              <div className="flex max-h-[min(50vh,420px)] flex-col gap-4 overflow-y-auto pr-1">
                {Object.entries(CLASSES_BY_GRADE).map(([gradeName, gradeClasses]) => {
                  const allSelected = gradeClasses.every((className) =>
                    selectedClasses.includes(className)
                  );
                  const someSelected = gradeClasses.some((className) =>
                    selectedClasses.includes(className)
                  );

                  return (
                    <div
                      key={gradeName}
                      className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                        <h3 className="m-0 text-base font-semibold text-slate-100">{gradeName}</h3>
                        <button
                          type="button"
                          onClick={() => handleSelectGrade(gradeClasses)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                            allSelected
                              ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
                              : someSelected
                                ? 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                                : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20'
                          }`}
                          disabled={loading}
                        >
                          {allSelected ? '☑️ Bỏ chọn cả khối' : '☐ Chọn cả khối'}
                        </button>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
                        {gradeClasses.map((className) => {
                          const isAssigned = assignedClasses.includes(className);
                          const isSelected = selectedClasses.includes(className);
                          return (
                            <label
                              key={className}
                              className={`relative flex cursor-pointer flex-col items-center rounded-xl border px-2 py-3 text-center text-sm transition ${
                                isSelected
                                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-50'
                                  : isAssigned
                                    ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-100'
                                    : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-cyan-400/30'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mb-1 h-4 w-4 rounded border-cyan-400/40 bg-slate-900 text-cyan-400"
                                checked={isSelected}
                                onChange={() => handleClassToggle(className)}
                                disabled={loading}
                              />
                              <span className="font-medium">{className}</span>
                              {isAssigned && (
                                <span className="mt-1 rounded-full bg-emerald-500/30 px-2 py-0.5 text-[0.65rem] text-emerald-100">
                                  {assignmentCount > 1 ? 'Đã gán (≥1 bài)' : 'Đã gán'}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/15 bg-slate-800/80 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700/80"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-2xl border border-cyan-400/30 bg-gradient-to-r from-cyan-500/80 to-blue-600/80 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-cyan-950/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || selectedClasses.length === 0}
            >
              {loading
                ? 'Đang gán...'
                : assignmentCount > 1
                  ? `Gán ${assignmentCount} bài`
                  : 'Gán bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AssignmentsList;
