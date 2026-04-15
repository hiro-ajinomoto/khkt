import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAssignments, fetchAssignmentsByDate, fetchAssignmentsByMonth, deleteAssignment, deleteAssignments, assignAssignmentsToClasses, getAssignmentClasses, reportAssignmentProblem } from '../../api/assignments';
import { fetchSchoolClasses, groupClassesByGrade } from '../../api/classes';
import { fetchMySubmissions } from '../../api/submissions';
import { useAuth } from '../../contexts/AuthContext';
import OceanShell, { OceanPageLoading, OceanPageError } from '../layout/OceanShell';
import ThemeToggle from '../layout/ThemeToggle';
import {
  formatVNDateFromYMD,
  isAssignmentReleasedClient,
  deadlineReminderClient,
} from '../../utils/assignmentRelease';
import './AssignmentsList.css';
import ReportProblemDialog from './ReportProblemDialog';

/** Max assignment cards per day on the list grid. */
const ASSIGNMENTS_LIST_MAX_CARDS_PER_DAY = 3;

/** Local calendar date for filtering (missing created_at → coi như hôm nay để vẫn hiện bài cũ). */
function getAssignmentLocalDate(assignment) {
  if (assignment?.created_at) return new Date(assignment.created_at);
  return new Date();
}

function formatGradeLevelDisplay(gradeLevel) {
  const s = String(gradeLevel || '').trim();
  if (!s) return '';
  if (/^lớp\b/i.test(s)) return s;
  return `Lớp ${s}`;
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
  const [reportingAssignmentId, setReportingAssignmentId] = useState(null);
  /** Học sinh: modal báo lỗi đề — { mode:'confirm', assignmentId } | { mode:'result', tone, message } */
  const [reportDialog, setReportDialog] = useState(null);
  /** Học sinh: id bài đã có bài nộp của tôi */
  const [submittedAssignmentIds, setSubmittedAssignmentIds] = useState(
    () => new Set()
  );
  /** Học sinh: chỉ hiện bài chưa nộp */
  const [studentOnlyUnsubmitted, setStudentOnlyUnsubmitted] = useState(false);
  /** Admin: null = tất cả GV; '' = bài cũ không có người tạo; string = id giáo viên */
  const [adminTeacherFilterId, setAdminTeacherFilterId] = useState(null);

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

  const handleReportProblem = (assignmentId) => {
    setReportDialog({ mode: 'confirm', assignmentId });
  };

  const closeReportDialog = () => setReportDialog(null);

  const confirmReportProblem = async (assignmentId) => {
    setReportingAssignmentId(assignmentId);
    try {
      const res = await reportAssignmentProblem(assignmentId);
      setAllAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId ? { ...a, student_reported_problem: true } : a
        )
      );
      if (res.already_reported) {
        setReportDialog({
          mode: 'result',
          tone: 'info',
          message:
            'Bạn đã báo lỗi đề bài này trước đó. Mỗi bài chỉ cần gửi một lần.',
        });
      } else {
        setReportDialog({
          mode: 'result',
          tone: 'success',
          message:
            'Đã gửi báo cáo tới giáo viên. Cảm ơn bạn đã góp ý.',
        });
      }
    } catch (e) {
      setReportDialog({
        mode: 'result',
        tone: 'error',
        message:
          e.message || 'Không gửi được báo cáo. Vui lòng thử lại sau.',
      });
    } finally {
      setReportingAssignmentId(null);
    }
  };

  const filterAssignments = () => {
    // Filtering is done in useMemo hooks below
    // This effect just triggers re-render when filters change
  };

  const assignmentsForAdminView = useMemo(() => {
    if (!isAdmin || adminTeacherFilterId === null) return allAssignments;
    if (adminTeacherFilterId === '') {
      return allAssignments.filter((a) => !a.created_by);
    }
    return allAssignments.filter(
      (a) => (a.created_by || '') === adminTeacherFilterId
    );
  }, [allAssignments, isAdmin, adminTeacherFilterId]);

  const adminTeacherOptions = useMemo(() => {
    if (!isAdmin) return [];
    const map = new Map();
    for (const a of allAssignments) {
      const id = a.created_by || '';
      const key = id || '__legacy__';
      if (!map.has(key)) {
        map.set(key, {
          id,
          label:
            a.created_by_name ||
            (id ? 'Giáo viên' : 'Chưa ghi người tạo (bài cũ)'),
        });
      }
    }
    return Array.from(map.values()).sort((x, y) =>
      x.label.localeCompare(y.label, 'vi')
    );
  }, [allAssignments, isAdmin]);

  // Filter and group assignments by date for teachers
  const filteredAndGroupedByDate = useMemo(() => {
    if (!isTeacher && !isAdmin) return {};

    const source = isAdmin ? assignmentsForAdminView : allAssignments;

    // Filter by selected date
    const filtered = source.filter((assignment) => {
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
  }, [
    allAssignments,
    assignmentsForAdminView,
    isTeacher,
    isAdmin,
    selectedDate,
  ]);

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

  const formatMonthYear = (year, month) =>
    `tháng ${month} năm ${year}`;

  // Get available dates for teacher date selector (from all assignments)
  const availableDates = useMemo(() => {
    if (!isTeacher && !isAdmin) return [];

    const source = isAdmin ? assignmentsForAdminView : allAssignments;
    const dates = new Set();
    source.forEach((assignment) => {
      if (assignment.created_at) {
        const date = new Date(assignment.created_at);
        dates.add(date.toISOString().split('T')[0]);
      }
    });

    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [allAssignments, assignmentsForAdminView, isTeacher, isAdmin]);

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
        <header className="relative mb-8 flex flex-col gap-4 overflow-hidden rounded-[28px] border border-sky-200/60 bg-white/70 p-4 shadow-[0_12px_40px_rgba(86,132,214,0.12)] backdrop-blur-xl dark:border-cyan-300/15 dark:bg-white/5 dark:shadow-2xl dark:shadow-cyan-950/30 md:mb-10 md:gap-6 md:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(191,217,255,0.18),rgba(255,211,106,0.08),rgba(255,122,89,0.05))] dark:bg-transparent" />
          <div className="relative flex min-w-0 flex-1 items-center justify-between gap-3 lg:justify-start">
            <div className="flex min-w-0 items-center gap-3 md:gap-4">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,#dbeafe_0%,#fff7ed_50%,#ffedd5_100%)] p-1 shadow-lg shadow-orange-200/30 dark:border-cyan-300/30 dark:bg-gradient-to-br dark:from-cyan-300/20 dark:via-sky-400/10 dark:to-blue-500/20 dark:shadow-cyan-950/40 md:h-16 md:w-16">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-white/95 text-lg font-bold text-sky-700 dark:bg-slate-900/80 dark:text-cyan-200 md:text-xl">
                  {user?.name?.[0] || user?.username?.[0] || 'ST'}
                </div>
                <div className="absolute inset-x-1 top-1 h-4 rounded-full bg-orange-200/50 blur-md dark:bg-cyan-300/20" />
              </div>
              <div className="hidden min-w-0 md:block">
                <p className="mb-2 text-xs uppercase tracking-[0.35em] text-sky-600/90 dark:text-cyan-200/80">
                  Cuộc thi khoa học kỹ thuật
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl dark:text-white">
                  Danh sách{' '}
                  <span className="bg-[linear-gradient(135deg,#2563eb,#ea580c,#c2410c)] bg-clip-text text-transparent">
                    bài tập
                  </span>{' '}
                  &amp; thử thách
                </h1>
              </div>
            </div>
            {isAuthenticated ? (
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => navigate('/admin')}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_100%)] text-lg shadow-md shadow-amber-200/40 transition hover:-translate-y-0.5 dark:border-amber-300/40 dark:bg-gradient-to-r dark:from-amber-500/40 dark:via-amber-400/30 dark:to-amber-500/40 dark:text-amber-50 dark:shadow-amber-950/40"
                    aria-label="Trang quản trị"
                  >
                    <span aria-hidden>⚙️</span>
                  </button>
                )}
                <ThemeToggle />
                <button
                  type="button"
                  onClick={logout}
                  className="group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-orange-200/80 bg-white/90 text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a59_100%)] hover:text-white dark:border-cyan-400/45 dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg dark:shadow-black/30 dark:hover:border-cyan-300/55 dark:hover:bg-slate-700 dark:hover:text-white"
                  aria-label="Đăng xuất"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="relative z-10 h-5 w-5"
                    aria-hidden
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="absolute inset-0 hidden translate-x-[-120%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] transition duration-1000 group-hover:translate-x-[120%] dark:block" />
                </button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2 md:hidden">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-2xl border border-sky-200/80 bg-white px-3 py-2 text-xs font-medium text-sky-800 shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-slate-900/70 dark:text-cyan-100"
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="rounded-2xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#fb923c_100%)] px-3 py-2 text-xs font-medium text-white shadow-md transition hover:-translate-y-0.5 dark:border-fuchsia-300/40 dark:bg-gradient-to-r dark:from-fuchsia-500/70 dark:to-violet-600/80 dark:shadow-fuchsia-950/40"
                >
                  Đăng ký
                </button>
              </div>
            )}
          </div>

          {isAuthenticated ? (
            <div className="relative hidden shrink-0 flex-wrap items-center gap-3 md:flex md:w-auto md:justify-end">
              <ThemeToggle />
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="group relative overflow-hidden rounded-2xl border border-amber-200/80 bg-[linear-gradient(135deg,#fff7ed_0%,#ffedd5_100%)] px-5 py-3 text-sm font-medium text-amber-900 shadow-md shadow-amber-200/40 transition hover:-translate-y-0.5 dark:border-amber-300/40 dark:bg-gradient-to-r dark:from-amber-500/40 dark:via-amber-400/30 dark:to-amber-500/40 dark:text-amber-50 dark:shadow-amber-950/40"
                >
                  <span className="relative z-10">⚙️ Trang quản trị</span>
                </button>
              )}
              <button
                type="button"
                onClick={logout}
                className="group relative overflow-hidden rounded-2xl border border-orange-200/80 bg-white/90 px-5 py-3 text-sm font-medium text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a59_100%)] hover:text-white dark:border-cyan-400/45 dark:bg-slate-800 dark:text-slate-100 dark:shadow-lg dark:shadow-black/30 dark:hover:border-cyan-300/55 dark:hover:bg-slate-700 dark:hover:text-white"
              >
                <span className="relative z-10">Đăng xuất</span>
                <span className="absolute inset-0 hidden translate-x-[-120%] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] transition duration-1000 group-hover:translate-x-[120%] dark:block" />
              </button>
            </div>
          ) : (
            <div className="relative hidden shrink-0 flex-wrap items-center gap-3 md:flex md:w-auto md:justify-end">
              <ThemeToggle />
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-2xl border border-sky-200/80 bg-white px-5 py-3 text-sm font-medium text-sky-800 shadow-sm transition hover:-translate-y-0.5 dark:border-cyan-300/40 dark:bg-slate-900/70 dark:text-cyan-100 dark:shadow-lg dark:shadow-cyan-950/40"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="rounded-2xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#fb923c_100%)] px-5 py-3 text-sm font-medium text-white shadow-md shadow-orange-200/40 transition hover:-translate-y-0.5 dark:border-fuchsia-300/40 dark:bg-gradient-to-r dark:from-fuchsia-500/70 dark:to-violet-600/80 dark:shadow-fuchsia-950/40"
              >
                Đăng ký
              </button>
            </div>
          )}
        </header>
        {isAdmin && allAssignments.length > 0 && (
          <section
            className="mb-6 rounded-[28px] border border-amber-200/60 bg-[linear-gradient(135deg,#fffbeb_0%,#fff7ed_100%)] p-5 shadow-md shadow-amber-100/50 dark:border-amber-300/25 dark:bg-gradient-to-br dark:from-amber-950/50 dark:to-slate-950/60 dark:shadow-lg dark:shadow-amber-950/20"
            aria-label="Lọc bài tập theo giáo viên"
          >
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-amber-800 dark:text-amber-100/90">
              Theo giáo viên
            </h2>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
              Chọn tên để chỉ xem các bài do giáo viên đó tạo (kết hợp với bộ lọc ngày bên dưới).
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAdminTeacherFilterId(null)}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  adminTeacherFilterId === null
                    ? 'border-amber-400/80 bg-amber-100 text-amber-950 ring-1 ring-amber-300/60 dark:border-amber-300/70 dark:bg-amber-500/25 dark:text-amber-50 dark:ring-amber-400/40'
                    : 'border-slate-200/80 bg-white/90 text-slate-700 hover:border-amber-300/50 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-amber-400/30'
                }`}
              >
                Tất cả
              </button>
              {adminTeacherOptions.map((opt) => {
                const active =
                  opt.id === ''
                    ? adminTeacherFilterId === ''
                    : adminTeacherFilterId === opt.id;
                return (
                  <button
                    key={opt.id || '__legacy__'}
                    type="button"
                    onClick={() =>
                      setAdminTeacherFilterId(opt.id === '' ? '' : opt.id)
                    }
                    className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'border-amber-400/80 bg-amber-100 text-amber-950 ring-1 ring-amber-300/60 dark:border-amber-300/70 dark:bg-amber-500/25 dark:text-amber-50 dark:ring-amber-400/40'
                        : 'border-slate-200/80 bg-white/90 text-slate-700 hover:border-amber-300/50 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-amber-400/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Filters + quick actions */}
        <section className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="hidden rounded-[28px] border border-sky-200/70 bg-white/72 p-5 shadow-[0_12px_32px_rgba(86,132,214,0.08)] backdrop-blur-xl dark:border-cyan-300/15 dark:bg-white/5 dark:shadow-none md:block">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Bộ lọc thời gian</h2>
              <div className="mx-4 h-px flex-1 bg-[linear-gradient(90deg,#7fb7ff,#ffd36a,#ff8d4d)] opacity-80 dark:bg-gradient-to-r dark:from-cyan-300/30 dark:to-transparent" />
              <span className="text-xs uppercase tracking-[0.28em] text-sky-500 dark:text-cyan-200/70">
                Ocean Flame
              </span>
            </div>

            {isTeacher || isAdmin ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(245,249,255,0.95),rgba(255,248,242,0.98))] p-4 dark:border-slate-600/50 dark:bg-none dark:bg-slate-900">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-slate-200">
                    Ngày
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-sky-200/80 bg-white px-4 py-3 text-slate-800 outline-none ring-0 focus:border-sky-400 dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-slate-900 dark:to-sky-950/60 dark:text-slate-100 dark:focus:border-cyan-300/60"
                  />
                </div>

                <div className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(245,249,255,0.95),rgba(255,248,242,0.98))] p-4 dark:border-slate-600/50 dark:bg-none dark:bg-slate-900">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-slate-200">
                    Ngày có bài tập
                  </label>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-sky-200/80 bg-white px-4 py-3 text-slate-800 outline-none ring-0 dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-slate-900 dark:to-sky-950/60 dark:text-slate-100"
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

                <div className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(245,249,255,0.95),rgba(255,248,242,0.98))] p-4 dark:border-slate-600/50 dark:bg-none dark:bg-slate-900">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-slate-200">
                    Thống kê
                  </label>
                  <div className="rounded-xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-700 dark:border-cyan-400/10 dark:bg-gradient-to-r dark:from-slate-900 dark:to-sky-950/60 dark:text-slate-100">
                    {filteredAssignments.length} bài tập vào ngày{' '}
                    {formatDateHeader(selectedDate)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(245,249,255,0.95),rgba(255,248,242,0.98))] p-4 dark:border-slate-600/50 dark:bg-none dark:bg-slate-900">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-slate-200">
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
                    className="w-full rounded-xl border border-sky-200/80 bg-white px-4 py-3 text-slate-800 outline-none ring-0 dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-slate-900 dark:to-sky-950/60 dark:text-slate-100"
                  />
                </div>
                <div className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(245,249,255,0.95),rgba(255,248,242,0.98))] p-4 dark:border-slate-600/50 dark:bg-none dark:bg-slate-900">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-slate-200">
                    Tháng
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="w-full rounded-xl border border-sky-200/80 bg-white px-4 py-3 text-slate-800 outline-none ring-0 dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-slate-900 dark:to-sky-950/60 dark:text-slate-100"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                      <option key={month} value={month}>
                        Tháng {month}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(245,249,255,0.95),rgba(255,248,242,0.98))] p-4 dark:border-slate-600/50 dark:bg-none dark:bg-slate-900">
                  <label className="mb-2 block text-xs uppercase tracking-[0.25em] text-slate-600 dark:text-slate-200">
                    Tháng có bài tập
                  </label>
                  <select
                    value={`${selectedYear}-${selectedMonth}`}
                    onChange={(e) => {
                      const [year, month] = e.target.value.split('-').map(Number);
                      setSelectedYear(year);
                      setSelectedMonth(month);
                    }}
                    className="w-full rounded-xl border border-sky-200/80 bg-white px-4 py-3 text-slate-800 outline-none ring-0 dark:border-cyan-400/20 dark:bg-gradient-to-r dark:from-slate-900 dark:to-sky-950/60 dark:text-slate-100"
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

          <div className="rounded-[28px] border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(255,251,245,0.92))] p-5 shadow-[0_12px_32px_rgba(86,132,214,0.09)] backdrop-blur-xl dark:border-cyan-300/15 dark:bg-gradient-to-br dark:from-cyan-400/10 dark:via-sky-400/5 dark:to-blue-500/10 dark:shadow-none">
            <div className="space-y-3">
              {isStudent && (
                <button
                  onClick={() => navigate('/my-submissions')}
                  className="w-full rounded-2xl border border-fuchsia-200/60 bg-[linear-gradient(135deg,#e879f9_0%,#a855f7_55%,#6366f1_100%)] px-4 py-3 font-medium text-white shadow-lg shadow-fuchsia-200/40 transition hover:-translate-y-0.5 dark:border-fuchsia-300/20 dark:shadow-fuchsia-950/30"
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
                  className="w-full rounded-2xl border border-emerald-200/70 bg-[linear-gradient(135deg,#34d399_0%,#14b8a6_55%,#0ea5e9_100%)] px-4 py-3 font-medium text-white shadow-lg shadow-emerald-200/35 transition hover:-translate-y-0.5 dark:border-emerald-300/20 dark:shadow-emerald-950/30"
                >
                  ➕ Tạo bài tập mới
                </button>
              )}
              <button
                onClick={loadAllAssignments}
                className="w-full rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,#dbeafe_0%,#8fc2ff_35%,#ffd36a_100%)] px-4 py-3 font-medium text-slate-800 shadow-[0_10px_28px_rgba(86,132,214,0.14)] transition hover:-translate-y-0.5 dark:border-cyan-300/20 dark:bg-gradient-to-r dark:from-cyan-500/70 dark:to-blue-600/80 dark:text-white dark:shadow-cyan-950/30"
              >
                ↻ Làm mới dữ liệu
              </button>
            </div>
          </div>
        </section>

        {/* Timeline banner */}
        <section className="mb-4 md:mb-6">
          <div className="rounded-2xl bg-[linear-gradient(135deg,#8fc2ff_0%,#5aa3ff_22%,#ffd36a_58%,#ff8d4d_100%)] p-px shadow-[0_12px_28px_rgba(86,132,214,0.12)] dark:rounded-2xl dark:bg-none dark:p-0 dark:shadow-2xl dark:shadow-sky-950/30 md:rounded-[32px] md:shadow-[0_18px_42px_rgba(86,132,214,0.14)] md:dark:rounded-[28px]">
            <div className="relative overflow-hidden rounded-[calc(1rem-1px)] bg-[linear-gradient(135deg,rgba(255,255,255,0.55),rgba(255,255,255,0.35))] px-4 py-3 text-slate-900 shadow-inner backdrop-blur-xl dark:rounded-[calc(1rem-1px)] dark:border dark:border-cyan-300/20 dark:bg-gradient-to-r dark:from-blue-500/70 dark:via-sky-500/65 dark:to-violet-600/60 dark:text-white dark:shadow-none md:rounded-[31px] md:px-6 md:py-5 md:dark:rounded-[28px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.5),transparent_22%),radial-gradient(circle_at_80%_0%,rgba(255,211,106,0.2),transparent_20%)] dark:bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_20%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.14),transparent_18%)]" />
              <div className="relative">
                <p className="text-[10px] uppercase tracking-[0.2em] text-sky-800/80 dark:text-cyan-50/75 md:text-xs md:tracking-[0.3em]">
                  Mốc thời gian
                </p>
                <h2 className="mt-0.5 break-words text-base font-semibold leading-snug text-slate-900 dark:text-white sm:text-lg md:mt-1 md:text-2xl">
                  {isTeacher || isAdmin
                    ? formatDateHeader(selectedDate)
                    : `Tháng ${selectedMonth}, ${selectedYear}`}
                </h2>
              </div>
            </div>
          </div>
        </section>

        {/* Empty states */}
        {allAssignments.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-sky-200/70 bg-white/80 px-6 py-10 text-center text-slate-700 shadow-md shadow-sky-100/50 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
            {isTeacher || isAdmin
              ? 'Chưa có bài tập nào. Hãy tạo bài tập mới cho học sinh nhé!'
              : 'Chưa có bài tập nào được gán cho lớp của bạn.'}
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-sky-200/70 bg-white/80 px-6 py-10 text-center text-slate-700 shadow-md shadow-sky-100/50 dark:border-white/10 dark:bg-slate-900/70 dark:text-slate-200">
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
            {/* Stats line (md+) */}
            <div className="mb-6 hidden flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/60 bg-[linear-gradient(135deg,rgba(224,242,254,0.95),rgba(255,247,237,0.92))] px-4 py-3.5 shadow-[0_8px_24px_rgba(56,130,246,0.12)] dark:border-cyan-400/35 dark:bg-gradient-to-r dark:from-slate-900 dark:via-sky-950/80 dark:to-blue-950/70 dark:shadow-cyan-950/20 md:flex">
              <span className="text-base font-bold leading-snug text-sky-950 sm:text-lg dark:text-cyan-50">
                Tổng số:{' '}
                <span className="tabular-nums text-orange-600 dark:text-amber-300">
                  {filteredAssignments.length}
                </span>{' '}
                bài tập
                {isTeacher || isAdmin ? (
                  <>
                    {' '}
                    <span className="font-semibold text-sky-800 dark:text-cyan-100">
                      vào ngày {formatDateHeader(selectedDate)}
                    </span>
                  </>
                ) : (
                  <>
                    {' '}
                    <span className="font-semibold text-sky-800 dark:text-cyan-100">
                      trong {formatMonthYear(selectedYear, selectedMonth)}
                    </span>
                  </>
                )}
                {isStudent && studentOnlyUnsubmitted && (
                  <span className="font-semibold text-orange-700 dark:text-amber-200">
                    {' '}
                    · lọc: tôi chưa nộp
                  </span>
                )}
              </span>
              {isTeacher && selectedIds.size > 0 && (
                <span className="rounded-full border border-sky-200/80 bg-sky-50 px-3 py-1.5 text-sm font-semibold text-sky-900 dark:border-cyan-300/30 dark:bg-cyan-500/15 dark:text-cyan-100">
                  Đã chọn: {selectedIds.size}
                </span>
              )}
            </div>

            {/* Cards */}
            {(isTeacher || isAdmin) && Object.keys(filteredAndGroupedByDate).length > 0 && (
              <div className="space-y-6">
                {Object.entries(filteredAndGroupedByDate).map(([date, assignments]) => (
                  <div key={date} className="space-y-4">
                    <h2 className="border-b-2 border-sky-300/70 pb-2 text-lg font-bold tracking-tight text-slate-900 dark:border-cyan-500/40 dark:text-white sm:text-xl md:text-2xl">
                      {formatDateHeader(date)}
                    </h2>
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 [&>*]:h-full [&>*]:min-h-0">
                      {assignments
                        .slice(0, ASSIGNMENTS_LIST_MAX_CARDS_PER_DAY)
                        .map((assignment, idx) => (
                        <AssignmentCard
                          key={assignment.id}
                          assignment={assignment}
                          index={idx}
                          isTeacher={true}
                          isStudent={false}
                          selectedIds={selectedIds}
                          onSelect={handleSelect}
                          onDelete={handleDelete}
                          onEdit={(id) => navigate(`/assignments/${id}/edit`)}
                          onView={(id) => navigate(`/assignments/${id}`)}
                          onAssign={handleAssign}
                          onReportProblem={handleReportProblem}
                          reportingAssignmentId={reportingAssignmentId}
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
                        <h2 className="border-b-2 border-sky-300/70 pb-2 text-lg font-bold tracking-tight text-slate-900 dark:border-cyan-500/40 dark:text-white sm:text-xl md:text-2xl">
                          {formatDateHeader(date)}
                        </h2>
                        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 [&>*]:h-full [&>*]:min-h-0">
                          {assignments
                            .slice(0, ASSIGNMENTS_LIST_MAX_CARDS_PER_DAY)
                            .map((assignment, idx) => (
                            <AssignmentCard
                              key={assignment.id}
                              assignment={assignment}
                              index={idx}
                              isTeacher={false}
                              isStudent={isStudent}
                              selectedIds={selectedIds}
                              onSelect={handleSelect}
                              onDelete={handleDelete}
                              onEdit={(id) => navigate(`/assignments/${id}/edit`)}
                              onView={(id) => navigate(`/assignments/${id}`)}
                              onAssign={handleAssign}
                              onReportProblem={handleReportProblem}
                              reportingAssignmentId={reportingAssignmentId}
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

        {isTeacher && (
          <div
            className={`assignments-bulk-bar-spacer pointer-events-none w-full shrink-0 ${
              selectedIds.size > 0 ? 'assignments-bulk-bar-spacer--visible' : ''
            }`}
            aria-hidden="true"
          />
        )}

        {isTeacher && selectedIds.size > 0 && (
          <div
            role="region"
            aria-label="Thao tác trên bài đã chọn"
            className="assignments-bulk-bar fixed inset-x-0 bottom-0 z-[620] border-t border-sky-200/85 bg-white/93 px-3 py-3 shadow-[0_-10px_40px_rgba(86,132,214,0.16)] backdrop-blur-md dark:border-cyan-300/30 dark:bg-slate-900/96 dark:shadow-black/40"
            style={{
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="text-center text-sm text-slate-700 dark:text-slate-200 sm:text-left">
                <span className="font-semibold tabular-nums text-sky-800 dark:text-cyan-200">
                  {selectedIds.size}
                </span>{' '}
                bài được chọn
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  className="rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-500/50 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Bỏ chọn
                </button>
                <button
                  type="button"
                  onClick={handleBulkAssignFromSelection}
                  className="rounded-xl border border-sky-200/80 bg-[linear-gradient(135deg,#7dd3fc_0%,#38bdf8_50%,#0ea5e9_100%)] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-200/35 transition hover:-translate-y-0.5 dark:border-cyan-300/35 dark:from-cyan-500/50 dark:to-sky-600/60 dark:shadow-cyan-950/30"
                >📋 Gán ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="rounded-xl border border-rose-300/80 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-800 shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-100 dark:hover:bg-rose-500/25"
                >
                  {bulkDeleting ? 'Đang xóa...' : `🗑️ Xóa (${selectedIds.size})`}
                </button>
              </div>
            </div>
          </div>
        )}

        <ReportProblemDialog
          dialog={reportDialog}
          onClose={closeReportDialog}
          onConfirmReport={confirmReportProblem}
          submittingId={reportingAssignmentId}
        />

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
            className={`fixed right-5 z-[600] flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200/80 bg-[linear-gradient(135deg,#7dd3fc_0%,#38bdf8_50%,#ffd36a_100%)] text-lg text-white shadow-[0_10px_28px_rgba(86,132,214,0.2)] backdrop-blur-md transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:border-orange-200/60 focus:outline-none focus:ring-2 focus:ring-sky-400/50 dark:border-cyan-300/35 dark:bg-gradient-to-br dark:from-cyan-500/50 dark:to-sky-700/55 dark:shadow-cyan-950/40 dark:hover:border-cyan-200/40 dark:hover:shadow-cyan-900/50 dark:focus:ring-cyan-400/50 sm:right-8 ${
              isTeacher && selectedIds.size > 0
                ? 'bottom-28 sm:bottom-24'
                : 'bottom-24 sm:bottom-10'
            }`}
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
  isStudent,
  index,
  selectedIds,
  onSelect,
  onDelete,
  onEdit,
  onView,
  onAssign,
  onReportProblem,
  reportingAssignmentId,
}) {
  const problemFlagged = Boolean(assignment.problem_flagged);
  const strTrim = (v) => (typeof v === 'string' ? v.trim() : '');
  const requirementPreview =
    strTrim(assignment.description) ||
    strTrim(assignment.subtitle) ||
    strTrim(assignment.model_solution) ||
    assignment.title ||
    'Mở bài tập để xem nội dung chi tiết';
  return (
    <article
      className={`group relative flex h-full min-h-0 cursor-pointer flex-col overflow-hidden rounded-[30px] border border-sky-200/70 bg-white/85 p-5 shadow-[0_10px_28px_rgba(86,132,214,0.08)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_18px_38px_rgba(255,140,61,0.12)] dark:border-slate-600/70 dark:bg-slate-900 dark:shadow-2xl dark:shadow-black/50 dark:hover:border-cyan-400/55 dark:hover:shadow-cyan-950/55 ${
        selectedIds.has(assignment.id)
          ? 'ring-2 ring-orange-300/80 ring-offset-2 ring-offset-amber-50 dark:ring-cyan-300/70 dark:ring-offset-slate-900'
          : ''
      } ${
        isTeacher && problemFlagged
          ? 'ring-2 ring-rose-400/70 ring-offset-2 ring-offset-rose-50 dark:ring-rose-400/55 dark:ring-offset-slate-900'
          : ''
      }`}
      onClick={() => onView(assignment.id)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,211,106,0.12),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(143,194,255,0.14),transparent_28%)] opacity-0 transition group-hover:opacity-100 dark:bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(96,165,250,0.16),transparent_28%)]" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`flex items-start justify-between gap-3 ${isTeacher ? 'mb-2' : 'mb-4'}`}
        >
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
              {assignment.title || `Bài ${index + 1}`}
            </h3>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {isTeacher ? (
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 rounded-xl border border-sky-200/70 bg-sky-50 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-800 dark:border-cyan-400/50 dark:bg-slate-800 dark:text-cyan-200"
                  aria-hidden
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div
                  className="inline-flex items-center justify-center rounded-2xl border border-sky-200/70 bg-sky-50 px-3 py-2 dark:border-cyan-400/50 dark:bg-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(assignment.id)}
                    onChange={() => onSelect(assignment.id)}
                    aria-label="Chọn bài này"
                    title="Chọn bài này"
                    className="h-4 w-4 cursor-pointer rounded border border-sky-400 bg-white text-sky-700 accent-sky-600 transition hover:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:ring-offset-1 focus:ring-offset-sky-50 dark:border-cyan-400 dark:bg-slate-900 dark:text-cyan-300 dark:accent-cyan-400 dark:focus:ring-cyan-400/45 dark:focus:ring-offset-slate-800"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-sky-200/70 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800 dark:border-cyan-400/50 dark:bg-slate-800 dark:text-cyan-200">
                {String(index + 1).padStart(2, '0')}
              </div>
            )}
          </div>
        </div>

        {isTeacher && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {assignment.grade_level && (
                <span className="rounded-xl border border-fuchsia-300/10 bg-fuchsia-300/10 px-3 py-2 text-fuchsia-800 dark:border-fuchsia-400/45 dark:bg-fuchsia-950/85 dark:text-fuchsia-100">
                  {formatGradeLevelDisplay(assignment.grade_level)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 gap-1 text-xs">
              <button
              onClick={(e) => {
              e.stopPropagation();
              onAssign(assignment.id);
              }}
              className="rounded-xl border border-sky-200/80 bg-sky-50 px-2 py-1 text-sky-800 hover:bg-sky-100 dark:border-cyan-400/45 dark:bg-slate-800 dark:text-cyan-200 dark:hover:bg-slate-700"
              title="Gán bài tập cho lớp"
              >
              📋
              </button>
              <button
              onClick={(e) => {
              e.stopPropagation();
              onEdit(assignment.id);
              }}
              className="rounded-xl border border-amber-200/80 bg-amber-50 px-2 py-1 text-amber-900 hover:bg-amber-100 dark:border-amber-400/45 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700"
              title="Sửa bài tập"
              >
              ✏️
              </button>
              <button
              onClick={(e) => {
              e.stopPropagation();
              onDelete(assignment.id);
              }}
              className="rounded-xl border border-rose-200/80 bg-rose-50 px-2 py-1 text-rose-800 hover:bg-rose-100 dark:border-rose-400/45 dark:bg-slate-800 dark:text-rose-200 dark:hover:bg-slate-700"
              title="Xóa bài tập"
              >
              🗑️
              </button>
            </div>
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2 text-sm">
          {isTeacher && problemFlagged && (
            <span className="rounded-xl border border-rose-400/55 bg-rose-600/20 px-3 py-2 text-xs font-semibold text-rose-900 dark:border-rose-400/50 dark:bg-rose-950/75 dark:text-rose-100">
              Đề bị báo lỗi (≥ 5 HS)
            </span>
          )}
          {isTeacher &&
            assignment.available_from_date &&
            !isAssignmentReleasedClient(assignment.available_from_date) && (
              <span className="rounded-xl border border-amber-300/55 bg-amber-500/25 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-500/50 dark:bg-amber-950/75 dark:text-amber-100">
                Chưa mở HS — từ{' '}
                {formatVNDateFromYMD(assignment.available_from_date)}
              </span>
            )}
          {isTeacher && assignment.due_date && (
            <span className="rounded-xl border border-slate-400/30 bg-slate-800/70 px-3 py-2 text-xs text-slate-200 dark:border-slate-500/50 dark:bg-slate-950 dark:text-slate-200">
              Hạn nộp: {formatVNDateFromYMD(assignment.due_date)}
            </span>
          )}
          {!isTeacher && assignment.due_date && (() => {
            const r = deadlineReminderClient(assignment.due_date);
            if (!r) return null;
            const cls =
              r.tone === 'overdue'
                ? 'border-rose-400/45 bg-rose-600/25 text-rose-100 dark:border-rose-500/55 dark:bg-rose-950/80 dark:text-rose-100'
                : r.tone === 'today'
                  ? 'border-orange-400/50 bg-orange-500/30 text-orange-50 dark:border-orange-500/55 dark:bg-orange-950/75 dark:text-orange-100'
                  : 'border-emerald-400/40 bg-emerald-600/20 text-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-950/75 dark:text-emerald-100';
            return (
              <span
                className={`rounded-xl border px-3 py-2 text-xs font-medium ${cls}`}
              >
                {r.label}
              </span>
            );
          })()}
          {!isTeacher && assignment.grade_level && (
            <span className="rounded-xl border border-fuchsia-300/10 bg-fuchsia-300/10 px-3 py-2 text-fuchsia-800 dark:border-fuchsia-400/45 dark:bg-fuchsia-950/85 dark:text-fuchsia-100">
              {formatGradeLevelDisplay(assignment.grade_level)}
            </span>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-white/95 to-cyan-50 p-4 text-slate-900 shadow-inner dark:border-slate-600/50 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100 sm:p-5">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border-[18px] border-cyan-300/40 dark:border-cyan-500/25" />
          <div className="absolute -left-10 bottom-0 h-16 w-28 rounded-t-full border-t-[10px] border-cyan-400/30 dark:border-cyan-500/20" />

          {assignment.question_image_url ? (
            <div className="flex min-h-0 flex-1 flex-col items-center gap-2">
              <img
                src={assignment.question_image_url}
                alt="Đề bài"
                className="max-h-32 w-auto rounded-2xl object-contain shadow-md sm:max-h-36"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(assignment.id);
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <p className="line-clamp-4 w-full max-w-full break-words text-center text-xs leading-snug text-slate-600 dark:text-slate-300 sm:text-sm">
                {requirementPreview}
              </p>
            </div>
          ) : (
            <div className="flex min-h-[5.25rem] flex-1 items-start justify-center">
              <p className="line-clamp-4 w-full max-w-full break-words text-center font-serif text-sm leading-snug tracking-tight text-slate-700 dark:text-slate-200 sm:text-[0.95rem] sm:leading-snug">
                {requirementPreview}
              </p>
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
            className="flex-1 rounded-2xl border border-orange-200/70 bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a59_100%)] px-4 py-3 font-medium text-white shadow-[0_10px_24px_rgba(255,140,61,0.18)] transition hover:-translate-y-0.5 dark:border-cyan-300/25 dark:bg-gradient-to-r dark:from-cyan-500/80 dark:to-blue-600/80 dark:shadow-cyan-950/30"
          >
            Xem chi tiết
          </button>
          {isStudent ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReportProblem(assignment.id);
              }}
              disabled={
                Boolean(assignment.student_reported_problem) ||
                reportingAssignmentId === assignment.id
              }
              className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-white/90 px-3 py-3 text-amber-600 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-amber-400/45 dark:bg-slate-800 dark:text-amber-400 dark:hover:bg-slate-700"
              title={
                assignment.student_reported_problem
                  ? 'Bạn đã báo lỗi đề bài này'
                  : 'Báo đề bài có lỗi cho giáo viên'
              }
              aria-label="Báo đề bài có lỗi cho giáo viên"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-6 w-6"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ) : null}
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
  const [availableClasses, setAvailableClasses] = useState([]);

  const classesByGrade = useMemo(
    () => groupClassesByGrade(availableClasses),
    [availableClasses]
  );

  const assignmentCount = assignmentIds?.length ?? 0;

  useEffect(() => {
    const loadAssignedClasses = async () => {
      if (!assignmentIds?.length) return;
      try {
        setLoadingClasses(true);
        const [schoolList, ...lists] = await Promise.all([
          fetchSchoolClasses(),
          ...assignmentIds.map((id) => getAssignmentClasses(id)),
        ]);
        setAvailableClasses(schoolList);
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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/25 px-4 py-8 backdrop-blur-md dark:bg-slate-950/75"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-sky-200/80 bg-white/95 p-6 shadow-[0_24px_60px_rgba(86,132,214,0.15)] backdrop-blur-xl dark:border-cyan-300/20 dark:bg-slate-900/95 dark:shadow-2xl dark:shadow-cyan-950/50"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
      >
        <div className="mb-5 flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-white/10">
          <div>
            <h2 id="assign-modal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              {assignmentCount > 1
                ? `Gán ${assignmentCount} bài tập cho lớp`
                : 'Gán bài tập cho lớp'}
            </h2>
            {assignmentCount > 1 && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Các lớp bạn chọn sẽ được gán cho tất cả bài đã chọn.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Chọn lớp
            </label>
            {loadingClasses ? (
              <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-6 text-center text-slate-600 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-300">
                Đang tải...
              </div>
            ) : classesByGrade.length === 0 ? (
              <div className="rounded-2xl border border-amber-200/60 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100">
                Chưa có lớp nào trong hệ thống. Vui lòng nhờ quản trị viên thêm lớp ở trang Quản trị.
              </div>
            ) : (
              <div className="flex max-h-[min(50vh,420px)] flex-col gap-4 overflow-y-auto pr-1">
                {classesByGrade.map(([gradeName, gradeClasses]) => {
                  const allSelected = gradeClasses.every((className) =>
                    selectedClasses.includes(className)
                  );
                  const someSelected = gradeClasses.some((className) =>
                    selectedClasses.includes(className)
                  );

                  return (
                    <div
                      key={gradeName}
                      className="rounded-2xl border border-sky-100 bg-slate-50/90 p-4 dark:border-white/10 dark:bg-slate-950/40"
                    >
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-3 dark:border-white/10">
                        <h3 className="m-0 text-base font-semibold text-slate-800 dark:text-slate-100">{gradeName}</h3>
                        <button
                          type="button"
                          onClick={() => handleSelectGrade(gradeClasses)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                            allSelected
                              ? 'border-emerald-300/80 bg-emerald-100 text-emerald-900 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-100'
                              : someSelected
                                ? 'border-amber-300/80 bg-amber-100 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-100'
                                : 'border-sky-200/80 bg-white text-sky-800 hover:bg-sky-50 dark:border-cyan-400/30 dark:bg-cyan-500/10 dark:text-cyan-100 dark:hover:bg-cyan-500/20'
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
                                  ? 'border-sky-400/70 bg-sky-100 text-sky-950 dark:border-cyan-400/50 dark:bg-cyan-500/15 dark:text-cyan-50'
                                  : isAssigned
                                    ? 'border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-100'
                                    : 'border-slate-200/80 bg-white text-slate-700 hover:border-sky-300 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:border-cyan-400/30'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mb-1 h-4 w-4 rounded border-sky-300 bg-white text-sky-600 dark:border-cyan-400/40 dark:bg-slate-900 dark:text-cyan-400"
                                checked={isSelected}
                                onChange={() => handleClassToggle(className)}
                                disabled={loading}
                              />
                              <span className="font-medium">{className}</span>
                              {isAssigned && (
                                <span className="mt-1 rounded-full bg-emerald-200/80 px-2 py-0.5 text-[0.65rem] text-emerald-900 dark:bg-emerald-500/30 dark:text-emerald-100">
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
            <div className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200/80 pt-4 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/15 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700/80"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="rounded-2xl border border-orange-200/80 bg-[linear-gradient(135deg,#ffd36a_0%,#ff9b3d_55%,#ff7a2f_100%)] px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-orange-200/40 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-400/30 dark:bg-gradient-to-r dark:from-cyan-500/80 dark:to-blue-600/80 dark:shadow-lg dark:shadow-cyan-950/40"
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
