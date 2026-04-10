/**
 * Dashboard - Trang thống kê tổng quan
 */
async function renderDashboard() {
    const content = document.getElementById('content-area');

    try {
        const stats = await API.get(CONFIG.ENDPOINTS.DASHBOARD);

        let html = `<div class="page-enter">`;

        // Stat Cards
        html += `<div class="stats-grid stagger-in">
            <div class="stat-card blue">
                <div class="stat-icon"><span class="material-icons-outlined">school</span></div>
                <div class="stat-info">
                    <h4>${stats.total_students}</h4>
                    <p>Học viên</p>
                </div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon"><span class="material-icons-outlined">person</span></div>
                <div class="stat-info">
                    <h4>${stats.total_teachers}</h4>
                    <p>Giảng viên</p>
                </div>
            </div>
            <div class="stat-card orange">
                <div class="stat-icon"><span class="material-icons-outlined">menu_book</span></div>
                <div class="stat-info">
                    <h4>${stats.total_courses}</h4>
                    <p>Khóa học</p>
                </div>
            </div>
            <div class="stat-card cyan">
                <div class="stat-icon"><span class="material-icons-outlined">class</span></div>
                <div class="stat-info">
                    <h4>${stats.total_classes}</h4>
                    <p>Lớp đang học</p>
                </div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon"><span class="material-icons-outlined">how_to_reg</span></div>
                <div class="stat-info">
                    <h4>${stats.total_enrollments}</h4>
                    <p>Đăng ký</p>
                </div>
            </div>
            ${hasRole('admin', 'staff') ? `
            <div class="stat-card pink">
                <div class="stat-icon"><span class="material-icons-outlined">payments</span></div>
                <div class="stat-info">
                    <h4>${formatCurrency(stats.total_revenue)}</h4>
                    <p>Tổng doanh thu</p>
                </div>
            </div>
            ` : ''}
        </div>`;

        // Charts & Top Courses
        const isAdminOrStaff = hasRole('admin', 'staff');
        html += `<div class="charts-grid" ${!isAdminOrStaff ? 'style="grid-template-columns: 1fr;"' : ''}>
            ${isAdminOrStaff ? `
            <div class="card">
                <div class="card-header">
                    <h3>Doanh thu 6 tháng gần nhất</h3>
                </div>
                <div class="chart-container">
                    ${renderRevenueChart(stats.monthly_revenue || [])}
                </div>
            </div>
            ` : ''}
            <div class="card">
                <div class="card-header">
                    <h3>Top khóa học</h3>
                </div>
                ${renderTopCourses(stats.top_courses || [])}
            </div>
        </div>`;

        // Quick Actions (chỉ admin/staff)
        if (hasRole('admin', 'staff')) {
            html += `<div class="card">
                <div class="card-header"><h3>Thao tác nhanh</h3></div>
                <div class="quick-actions">
                    <button class="quick-action-btn blue" onclick="navigate('students')">
                        <span class="material-icons-outlined">person_add</span>
                        <span>Thêm học viên</span>
                    </button>
                    <button class="quick-action-btn green" onclick="navigate('teachers')">
                        <span class="material-icons-outlined">assignment_ind</span>
                        <span>Thêm giảng viên</span>
                    </button>
                    <button class="quick-action-btn orange" onclick="navigate('courses')">
                        <span class="material-icons-outlined">library_add</span>
                        <span>Thêm khóa học</span>
                    </button>
                    <button class="quick-action-btn cyan" onclick="navigate('classes')">
                        <span class="material-icons-outlined">groups</span>
                        <span>Tạo lớp học</span>
                    </button>
                    <button class="quick-action-btn pink" onclick="navigate('payments')">
                        <span class="material-icons-outlined">payments</span>
                        <span>Thu học phí</span>
                    </button>
                    <button class="quick-action-btn purple" onclick="navigate('attendance')">
                        <span class="material-icons-outlined">fact_check</span>
                        <span>Điểm danh</span>
                    </button>
                    <button class="quick-action-btn indigo" onclick="navigate('grades')">
                        <span class="material-icons-outlined">trending_up</span>
                        <span>Nhập điểm</span>
                    </button>
                </div>
            </div>`;
        } else {
            // Thao tác nhanh cho Học viên / Khách
            html += `<div class="card" style="margin-top:20px;">
                <div class="card-header"><h3>Lối tắt cho Học viên</h3></div>
                <div class="quick-actions">
                    <button class="quick-action-btn blue" onclick="navigate('courses')">
                        <span class="material-icons-outlined">search</span>
                        <span>Tìm khóa học</span>
                    </button>
                    <button class="quick-action-btn green" onclick="navigate('classes')">
                        <span class="material-icons-outlined">class</span>
                        <span>Lớp học của tôi</span>
                    </button>
                    <button class="quick-action-btn cyan" onclick="navigate('schedule')">
                        <span class="material-icons-outlined">calendar_today</span>
                        <span>Lịch học</span>
                    </button>
                    <button class="quick-action-btn pink" onclick="navigate('payments')">
                        <span class="material-icons-outlined">receipt_long</span>
                        <span>Học phí</span>
                    </button>
                    <button class="quick-action-btn purple" onclick="navigate('grades')">
                        <span class="material-icons-outlined">grade</span>
                        <span>Xem kết quả</span>
                    </button>
                </div>
            </div>`;
        }

        html += `</div>`;
        content.innerHTML = html;

    } catch (error) {
        content.innerHTML = `
            <div class="stats-grid stagger-in">
                <div class="stat-card blue"><div class="stat-icon"><span class="material-icons-outlined">school</span></div><div class="stat-info"><h4>--</h4><p>Học viên</p></div></div>
                <div class="stat-card green"><div class="stat-icon"><span class="material-icons-outlined">person</span></div><div class="stat-info"><h4>--</h4><p>Giảng viên</p></div></div>
                <div class="stat-card orange"><div class="stat-icon"><span class="material-icons-outlined">menu_book</span></div><div class="stat-info"><h4>--</h4><p>Khóa học</p></div></div>
                <div class="stat-card cyan"><div class="stat-icon"><span class="material-icons-outlined">class</span></div><div class="stat-info"><h4>--</h4><p>Lớp học</p></div></div>
            </div>
            <div class="card"><p style="color:var(--text-muted);padding:20px">Không thể tải dữ liệu dashboard. Vui lòng kiểm tra kết nối backend.</p></div>`;
    }
}

/**
 * Render biểu đồ doanh thu
 */
function renderRevenueChart(data) {
    if (!data.length) return '<p style="color:var(--text-muted)">Chưa có dữ liệu</p>';

    const maxVal = Math.max(...data.map(d => d.revenue), 1);

    return data.map(d => {
        const height = Math.max((d.revenue / maxVal) * 250, 4);
        return `
            <div class="chart-bar-group">
                <div class="chart-bar-value">${d.revenue > 0 ? (d.revenue / 1000000).toFixed(1) + 'tr' : '0'}</div>
                <div class="chart-bar" style="height:${height}px" title="${formatCurrency(d.revenue)}"></div>
                <div class="chart-bar-label">${d.month}</div>
            </div>`;
    }).join('');
}

/**
 * Render top khóa học
 */
function renderTopCourses(courses) {
    if (!courses.length) return '<p style="color:var(--text-muted);padding:10px">Chưa có dữ liệu</p>';

    return courses.map(c => `
        <div class="top-course-item" onclick="goToCourse('${c.name.replace(/'/g, "\\'")}')" style="cursor:pointer; transition: background 0.2s; padding: 8px; border-radius: 8px;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
            <span class="top-course-name" style="color:var(--primary-600); font-weight:600">${c.name}</span>
            <span class="top-course-count" style="color:var(--text-muted)">${c.students} HV</span>
        </div>
    `).join('');
}

function goToCourse(name) {
    navigate('courses', { search: name });
}
