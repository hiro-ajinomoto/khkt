import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAssignments, fetchAssignmentsByDate, fetchAssignmentsByMonth, deleteAssignment, deleteAssignments, assignAssignmentToClasses, getAssignmentClasses } from '../../api/assignments';
import { useAuth } from '../../contexts/AuthContext';
import './AssignmentsList.css';

function AssignmentsList() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isTeacher, isStudent, user, logout } = useAuth();
  const [allAssignments, setAllAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignmentToAssign, setSelectedAssignmentToAssign] = useState(null);

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
    } else {
      // Find the latest month with assignments
      const monthSet = new Set();
      allAssignments.forEach((assignment) => {
        if (assignment.created_at) {
          const date = new Date(assignment.created_at);
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          monthSet.add(`${year}-${month}`);
        }
      });
      
      if (monthSet.size > 0) {
        const latestMonth = Array.from(monthSet)
          .map((ym) => {
            const [y, m] = ym.split('-').map(Number);
            return { year: y, month: m };
          })
          .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
          })[0];
        
        setSelectedYear(latestMonth.year);
        setSelectedMonth(latestMonth.month);
        setHasAutoSelected(true);
      }
    }
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
    const filtered = allAssignments.filter((assignment) => {
      if (!assignment.created_at) return false;
      const date = new Date(assignment.created_at);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      return year === selectedYear && month === selectedMonth;
    });

    // Group by date
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
  }, [allAssignments, isTeacher, isAdmin, selectedYear, selectedMonth]);

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

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }

    const count = selectedIds.size;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ${count} bài tập đã chọn?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const idsArray = Array.from(selectedIds);
      const result = await deleteAssignments(idsArray);
      
      // Show success message
      const deletedCount = result.deletedCount || idsArray.length;
      alert(`Đã xóa thành công ${deletedCount} bài tập${deletedCount > 1 ? '' : ''}`);
      
      // Clear selection
      setSelectedIds(new Set());
      
      // Reload assignments
      await loadAllAssignments();
    } catch (err) {
      const errorMessage = err.message || 'Lỗi không xác định';
      alert('Không thể xóa bài tập: ' + errorMessage);
      setError(errorMessage);
      console.error('Error deleting assignments:', err);
    } finally {
      setIsDeleting(false);
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

  const handleSelectAll = (assignments) => {
    const assignmentIds = assignments.map((a) => a.id);
    const allSelected = assignmentIds.every((id) => selectedIds.has(id));
    
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        // Bỏ chọn tất cả
        assignmentIds.forEach((id) => newSet.delete(id));
      } else {
        // Chọn tất cả
        assignmentIds.forEach((id) => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleAssign = (assignmentId) => {
    setSelectedAssignmentToAssign(assignmentId);
    setShowAssignModal(true);
  };

  const handleCloseAssignModal = () => {
    setShowAssignModal(false);
    setSelectedAssignmentToAssign(null);
    loadAllAssignments(); // Reload assignments to reflect changes
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
      if (assignment.created_at) {
        const date = new Date(assignment.created_at);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        monthSet.add(`${year}-${month}`);
      }
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
    return (
      <div className="assignments-container">
        <div className="loading">Đang tải...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="assignments-container">
        <div className="error">
          <p>Lỗi: {error}</p>
          <button onClick={loadAssignments} className="retry-button">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="assignments-container">
      <div className="assignments-header">
        <div className="logo-header">
          <img 
            src="/logo.png" 
            alt="Logo trường" 
            className="logo" 
            onClick={() => navigate('/assignments')}
            style={{ cursor: 'pointer' }}
          />
          <h1>Danh sách bài tập</h1>
        </div>
        <div className="header-right">
          {isAuthenticated ? (
            <div className="user-info">
              <span className="user-name">
                {user?.name || user?.username} (
                {user?.role === 'admin'
                  ? 'Quản trị viên'
                  : user?.role === 'teacher'
                  ? 'Giáo viên'
                  : 'Học sinh'}
                )
              </span>
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="admin-button"
                >
                  ⚙️ Quản trị
                </button>
              )}
              <button onClick={logout} className="logout-button">
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="auth-buttons">
              <button
                onClick={() => navigate('/register')}
                className="register-button-header"
              >
                Đăng ký
              </button>
              <button
                onClick={() => navigate('/login')}
                className="login-button-header"
              >
                Đăng nhập
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="header-actions">
        {isStudent && (
          <button
            onClick={() => navigate('/my-submissions')}
            className="my-submissions-button"
          >
            📝 Bài đã nộp
          </button>
        )}
        {isTeacher && (
          <button
            onClick={() => navigate('/assignments/create')}
            className="create-button"
          >
            ➕ Tạo bài tập mới
          </button>
        )}
        <button onClick={loadAllAssignments} className="refresh-button">
          🔄 Làm mới
        </button>
        {isTeacher && selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            className="delete-selected-button"
            disabled={isDeleting}
          >
            {isDeleting ? '⏳ Đang xóa...' : `🗑️ Xóa đã chọn (${selectedIds.size})`}
          </button>
        )}
      </div>

      {/* Date/Month Selector */}
      <div className="filter-section">
        {isTeacher || isAdmin ? (
          <div className="date-selector">
            <label htmlFor="date-select">Chọn ngày:</label>
            <input
              id="date-select"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>
        ) : (
          <div className="month-selector">
            <label htmlFor="month-select">Chọn tháng:</label>
            <div className="month-inputs">
              <input
                id="year-input"
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="year-input"
                min="2020"
                max="2100"
              />
              <select
                id="month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="month-select"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                  <option key={month} value={month}>
                    Tháng {month}
                  </option>
                ))}
              </select>
            </div>
            {availableMonths.length > 0 && (
              <select
                value={`${selectedYear}-${selectedMonth}`}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-').map(Number);
                  setSelectedYear(year);
                  setSelectedMonth(month);
                }}
                className="month-select-dropdown"
              >
                {availableMonths.map(({ year, month }) => (
                  <option key={`${year}-${month}`} value={`${year}-${month}`}>
                    {formatMonthYear(year, month)}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {allAssignments.length === 0 ? (
        <div className="empty-state">
          <p>
            {isTeacher || isAdmin
              ? 'Chưa có bài tập nào. Hãy tạo bài tập mới!'
              : 'Chưa có bài tập nào được gán cho lớp của bạn.'}
          </p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="empty-state">
          <p>
            {isTeacher || isAdmin
              ? `Chưa có bài tập nào vào ngày ${formatDateHeader(selectedDate)}. Tổng số bài tập: ${allAssignments.length}`
              : `Chưa có bài tập nào trong tháng ${formatMonthYear(selectedYear, selectedMonth)}. Tổng số bài tập: ${allAssignments.length}`}
          </p>
        </div>
      ) : (
        <>
          <div className="assignments-stats">
            <span>
              Tổng số: {filteredAssignments.length} bài tập
              {isTeacher || isAdmin
                ? ` vào ngày ${formatDateHeader(selectedDate)}`
                : ` trong tháng ${formatMonthYear(selectedYear, selectedMonth)}`}
            </span>
            {isTeacher && selectedIds.size > 0 && (
              <span>Đã chọn: {selectedIds.size}</span>
            )}
          </div>

          {/* For Teachers: Group by date */}
          {(isTeacher || isAdmin) && Object.keys(filteredAndGroupedByDate).length > 0 && (
            <div className="assignments-by-date">
              {Object.entries(filteredAndGroupedByDate).map(([date, assignments]) => {
                const assignmentIds = assignments.map((a) => a.id);
                const allSelected = assignmentIds.length > 0 && assignmentIds.every((id) => selectedIds.has(id));
                return (
                <div key={date} className="date-group">
                  <div className="date-header-with-actions">
                    <h2 className="date-header">{formatDateHeader(date)}</h2>
                    {isTeacher && assignments.length > 0 && (
                      <button
                        onClick={() => handleSelectAll(assignments)}
                        className="select-all-button"
                      >
                        {allSelected ? '☑️ Bỏ chọn tất cả' : '☐ Chọn tất cả'}
                      </button>
                    )}
                  </div>
                  <div className="assignments-grid">
                    {assignments.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        isTeacher={isTeacher}
                        selectedIds={selectedIds}
                        onSelect={handleSelect}
                        onDelete={handleDelete}
                        onEdit={(id) => navigate(`/assignments/${id}/edit`)}
                        onView={(id) => navigate(`/assignments/${id}`)}
                        onAssign={handleAssign}
                      />
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {/* For Students: Group by date within month */}
          {!isTeacher && !isAdmin && Object.keys(filteredAndGroupedByDateInMonth).length > 0 && (
            <div className="assignments-by-date">
              {Object.entries(filteredAndGroupedByDateInMonth).map(([date, assignments]) => (
                <div key={date} className="date-group">
                  <h2 className="date-header">{formatDateHeader(date)}</h2>
                  <div className="assignments-grid">
                    {assignments.map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        isTeacher={false}
                        selectedIds={selectedIds}
                        onSelect={handleSelect}
                        onDelete={handleDelete}
                        onEdit={(id) => navigate(`/assignments/${id}/edit`)}
                        onView={(id) => navigate(`/assignments/${id}`)}
                        onAssign={handleAssign}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAssignModal && (
        <AssignAssignmentModal
          assignmentId={selectedAssignmentToAssign}
          onClose={handleCloseAssignModal}
          onSuccess={handleCloseAssignModal}
        />
      )}
    </div>
  );
}

// Assignment Card Component
function AssignmentCard({
  assignment,
  isTeacher,
  selectedIds,
  onSelect,
  onDelete,
  onEdit,
  onView,
  onAssign,
}) {
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

  return (
    <div
      className={`assignment-card ${
        selectedIds.has(assignment.id) ? 'selected' : ''
      }`}
    >
      <div className="card-header">
        {isTeacher && (
          <input
            type="checkbox"
            checked={selectedIds.has(assignment.id)}
            onChange={() => onSelect(assignment.id)}
            className="select-checkbox"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <h3
          className="assignment-title"
          onClick={() => onView(assignment.id)}
          style={{ cursor: 'pointer' }}
        >
          {assignment.title}
        </h3>
        {isTeacher && (
          <div className="card-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAssign(assignment.id);
              }}
              className="assign-button"
              title="Gán bài tập cho lớp"
            >
              📋
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(assignment.id);
              }}
              className="edit-button"
              title="Sửa bài tập"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(assignment.id);
              }}
              className="delete-button"
              title="Xóa bài tập"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {assignment.description && (
        <p className="assignment-description">{assignment.description}</p>
      )}

      <div className="assignment-meta">
        <span className="meta-badge subject">
          {assignment.subject || 'math'}
        </span>
        {assignment.grade_level && (
          <span className="meta-badge grade">#{assignment.grade_level}</span>
        )}
        <span className="meta-badge date">
          {formatDate(assignment.created_at)}
        </span>
      </div>

      <div className="assignment-images">
        {assignment.question_image_url && (
          <div className="image-container">
            <label>Hình ảnh câu hỏi:</label>
            <img
              src={assignment.question_image_url}
              alt="Câu hỏi"
              className="assignment-image"
              onClick={() => onView(assignment.id)}
              style={{ cursor: 'pointer' }}
              onError={(e) => {
                console.error(
                  'Failed to load question image:',
                  assignment.question_image_url
                );
                e.target.style.display = 'none';
                const errorDiv = e.target.nextSibling;
                if (errorDiv) {
                  errorDiv.style.display = 'block';
                  errorDiv.innerHTML = `Không thể tải hình ảnh<br/><small>URL: ${assignment.question_image_url}</small>`;
                }
              }}
            />
            <div className="image-error" style={{ display: 'none' }}>
              Không thể tải hình ảnh
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onView(assignment.id)}
        className="view-detail-button"
      >
        Xem chi tiết và nộp bài
      </button>

      {assignment.model_solution && (
        <div className="model-solution">
          <label>Bài giải mẫu:</label>
          <p>{assignment.model_solution}</p>
        </div>
      )}
    </div>
  );
}

// Assign Assignment Modal Component
function AssignAssignmentModal({ assignmentId, onClose, onSuccess }) {
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

  // Flatten all classes for backward compatibility
  const CLASSES = Object.values(CLASSES_BY_GRADE).flat();

  useEffect(() => {
    // Load already assigned classes
    const loadAssignedClasses = async () => {
      try {
        setLoadingClasses(true);
        const classes = await getAssignmentClasses(assignmentId);
        const classNames = classes.map(c => c.class_name);
        setAssignedClasses(classNames);
        setSelectedClasses(classNames); // Pre-select already assigned classes
      } catch (err) {
        console.error('Error loading assigned classes:', err);
      } finally {
        setLoadingClasses(false);
      }
    };
    if (assignmentId) {
      loadAssignedClasses();
    }
  }, [assignmentId]);

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
      const newSelected = new Set(prev);
      if (allSelected) {
        // Bỏ chọn tất cả lớp trong khối
        gradeClasses.forEach((className) => newSelected.delete(className));
      } else {
        // Chọn tất cả lớp trong khối
        gradeClasses.forEach((className) => newSelected.add(className));
      }
      return Array.from(newSelected);
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
      await assignAssignmentToClasses(assignmentId, selectedClasses);
      onSuccess();
    } catch (err) {
      setError(err.message || 'Không thể gán bài tập. Vui lòng thử lại.');
      console.error('Error assigning assignment:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Gán bài tập cho lớp</h2>
          <button onClick={onClose} className="modal-close-button">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="assign-form">
          <div className="form-group">
            <label>Chọn lớp:</label>
            {loadingClasses ? (
              <div>Đang tải...</div>
            ) : (
              <div className="classes-container">
                {Object.entries(CLASSES_BY_GRADE).map(([gradeName, gradeClasses]) => {
                  const allSelected = gradeClasses.every((className) => selectedClasses.includes(className));
                  const someSelected = gradeClasses.some((className) => selectedClasses.includes(className));
                  
                  return (
                    <div key={gradeName} className="grade-group">
                      <div className="grade-header">
                        <h3>{gradeName}</h3>
                        <button
                          type="button"
                          onClick={() => handleSelectGrade(gradeClasses)}
                          className={`select-grade-button ${allSelected ? 'all-selected' : someSelected ? 'some-selected' : ''}`}
                          disabled={loading}
                        >
                          {allSelected ? '☑️ Bỏ chọn cả khối' : '☐ Chọn cả khối'}
                        </button>
                      </div>
                      <div className="classes-grid">
                        {gradeClasses.map((className) => {
                          const isAssigned = assignedClasses.includes(className);
                          const isSelected = selectedClasses.includes(className);
                          return (
                            <label
                              key={className}
                              className={`class-checkbox ${isAssigned ? 'assigned' : ''} ${isSelected ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleClassToggle(className)}
                                disabled={loading}
                              />
                              <span>{className}</span>
                              {isAssigned && <span className="assigned-badge">Đã gán</span>}
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

          {error && <div className="error-message">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={loading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="submit-button"
              disabled={loading || selectedClasses.length === 0}
            >
              {loading ? 'Đang gán...' : 'Gán bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AssignmentsList;
