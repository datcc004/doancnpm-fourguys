/**
 * UI Module - Các hàm giao diện chung
 */

/**
 * Hiển thị toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const icons = {
        success: 'check_circle',
        error: 'error',
        warning: 'warning',
        info: 'info',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="material-icons-outlined">${icons[type]}</span>
        <span class="toast-text">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Điều hướng trang
 */
let currentPage = 'dashboard';
function navigate(page) {
    currentPage = page;

    // Cập nhật active menu
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Cập nhật title
    const titles = {
        dashboard: 'Trang chủ',
        students: 'Quản lý Học viên',
        teachers: 'Quản lý Giảng viên',
        courses: 'Quản lý Khóa học',
        classes: 'Quản lý Lớp học',
        enrollments: 'Đăng ký Lớp học',
        payments: 'Quản lý Học phí',
        attendance: 'Điểm danh',
        schedule: 'Lịch học & Thời khóa biểu',
        profile: 'Thông tin cá nhân',
    };
    document.getElementById('page-title').textContent = titles[page] || page;

    // Load content
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    // Đóng sidebar trên mobile
    document.getElementById('sidebar').classList.remove('open');

    // Gọi hàm render tương ứng
    setTimeout(() => {
        switch (page) {
            case 'dashboard': renderDashboard(); break;
            case 'students': renderStudents(); break;
            case 'teachers': renderTeachers(); break;
            case 'courses': renderCourses(); break;
            case 'classes': renderClasses(); break;
            case 'enrollments': renderEnrollments(); break;
            case 'payments': renderPayments(); break;
            case 'attendance': renderAttendance(); break;
            case 'schedule': 
                currentScheduleOffset = 0; // Reset về tuần hiện tại khi bấm menu
                renderSchedule(); 
                break;
            case 'profile': renderProfile(); break;
            default: contentArea.innerHTML = '<div class="empty-state"><h3>Trang không tồn tại</h3></div>';
        }
    }, 100);

    return false;
}

/**
 * Toggle sidebar
 */
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

/**
 * Mở modal
 */
function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

/**
 * Đóng modal
 */
function closeModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
}

/**
 * Confirm dialog
 */
let confirmResolve = null;
function showConfirm(title, message) {
    return new Promise(resolve => {
        confirmResolve = resolve;
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-overlay').classList.remove('hidden');
    });
}

function closeConfirm(result) {
    document.getElementById('confirm-overlay').classList.add('hidden');
    if (confirmResolve) {
        confirmResolve(result);
        confirmResolve = null;
    }
}

/**
 * Format tiền VNĐ
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

/**
 * Format ngày
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility';
    }
}

function formatDateVN(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    // Format quốc tế: Feb 18, 2026 3:30 PM
    return date.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true 
    });
}

/**
 * Lấy badge CSS class theo status
 */
function getStatusBadge(status) {
    const badges = {
        active: 'badge-success', paid: 'badge-success', present: 'badge-success', completed: 'badge-info',
        pending: 'badge-warning', late: 'badge-warning', upcoming: 'badge-warning', suspended: 'badge-warning',
        absent: 'badge-danger', dropped: 'badge-danger', overdue: 'badge-danger', cancelled: 'badge-danger',
        excused: 'badge-neutral', refunded: 'badge-neutral',
    };
    return badges[status] || 'badge-neutral';
}

/**
 * Lấy label cho status
 */
function getStatusLabel(status) {
    return CONFIG.STATUS_LABELS[status] || status;
}

/**
 * Render pagination
 */
function renderPagination(data, loadFn) {
    const totalPages = Math.ceil(data.count / 20);
    const currentPageNum = Number(data.current_page) || 1;

    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    html += `<button ${!data.previous ? 'disabled' : ''} onclick="${loadFn}(${currentPageNum - 1})">‹</button>`;

    for (let i = 1; i <= totalPages; i++) {
        // Luôn hiện trang 1, trang cuối, và các trang lân cận trang hiện tại
        if (totalPages <= 7 || i <= 1 || i === totalPages || Math.abs(i - currentPageNum) <= 1) {
            html += `<button class="${i === currentPageNum ? 'active' : ''}" onclick="${loadFn}(${i})">${i}</button>`;
        } else if (i === 2 && currentPageNum > 3) {
            html += '<button disabled>…</button>';
            i = currentPageNum - 2; // Nhảy nhanh đến gần trang hiện tại
        } else if (i === currentPageNum + 2 && currentPageNum < totalPages - 2) {
            html += '<button disabled>…</button>';
            i = totalPages - 1; // Nhảy nhanh đến trang cuối
        }
    }

    html += `<button ${!data.next ? 'disabled' : ''} onclick="${loadFn}(${currentPageNum + 1})">›</button>`;
    html += '</div>';
    return html;
}

/**
 * Global search
 */
function handleGlobalSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value.trim();
        if (query) {
            showToast(`Tìm kiếm: "${query}"`, 'info');
        }
    }
}
/**
 * Hiển thị thông tin liên hệ quản trị
 */
function showAdminContact() {
    const bodyHtml = `
        <div style="text-align: center; padding: 10px 0;">
            <p style="margin-bottom: 24px; color: var(--text-secondary); line-height: 1.6;">
                Vui lòng liên hệ với Quản trị viên qua Facebook để được hỗ trợ cấp lại mật khẩu hoặc xử lý các vấn đề về tài khoản.
            </p>
            <a href="https://www.facebook.com/xuan.at.233237" target="_blank" 
               style="display: inline-flex; align-items: center; justify-content: center; gap: 12px; 
                      background: linear-gradient(135deg, #1877F2, #0C63D1); color: white; 
                      padding: 14px 28px; border-radius: 12px; text-decoration: none; 
                      font-weight: 600; box-shadow: 0 4px 15px rgba(24, 119, 242, 0.3);
                      transition: all 0.3s ease;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Trò chuyện qua Facebook
            </a>
        </div>
    `;
    openModal('Hỗ trợ Quản trị', bodyHtml);
}
