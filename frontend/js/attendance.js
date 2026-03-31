/**
 * Attendance Module - Điểm danh
 */
async function renderAttendance() {
    const content = document.getElementById('content-area');
    const isStudent = hasRole('student');

    if (isStudent) {
        return renderStudentAttendance(content);
    }

    let classes = [];
    try {
        const endpoint = hasRole('teacher') ? `${CONFIG.ENDPOINTS.CLASSES}my_classes/` : CONFIG.ENDPOINTS.CLASSES;
        const data = await API.get(endpoint, { status: 'active', page_size: 100 });
        classes = data.results || data;
    } catch (e) {}

    const classOptions = classes.map(c =>
        `<option value="${c.id}">${c.code} - ${c.name}</option>`
    ).join('');

    let html = `<div class="attendance-page-v2" style="display: flex; flex-direction: column; gap: 20px; padding: 10px;">
        <div class="card" style="padding: 15px;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <label style="font-weight: 600; white-space: nowrap;">Chọn lớp học:</label>
                <select class="filter-select" id="attendance-class-select" onchange="loadAttendanceSessions()" style="max-width: 400px; flex: 1;">
                    <option value="">-- Click để chọn lớp đang dạy --</option>
                    ${classOptions}
                </select>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 320px 1fr; gap: 20px; align-items: start;">
            <!-- Cột trái: Lịch học -->
            <div id="calendar-v2-container"></div>

            <!-- Cột phải: Form điểm danh & Lịch sử -->
            <div id="attendance-main-area" style="display: flex; flex-direction: column; gap: 20px;">
                <div id="attendance-content">
                    <div class="card">
                        <div class="empty-state">
                            <span class="material-icons-outlined">calendar_today</span>
                            <h3>Vui lòng chọn lớp và nhấn vào ngày trên lịch</h3>
                            <p style="color:var(--text-muted)">Danh sách điểm danh sẽ hiện ra tự động khi bạn nhấn vào các ngày có dấu chấm</p>
                        </div>
                    </div>
                </div>
                <div id="attendance-sessions"></div>
            </div>
        </div>
    </div>`;

    content.innerHTML = html;
}

async function loadAttendanceSessions() {
    const classId = document.getElementById('attendance-class-select').value;
    const sessionsDiv = document.getElementById('attendance-sessions');
    const attendanceDiv = document.getElementById('attendance-content');
    const calendarContainer = document.getElementById('calendar-v2-container');

    if (!classId) {
        sessionsDiv.innerHTML = '';
        attendanceDiv.innerHTML = '';
        calendarContainer.innerHTML = '';
        return;
    }
    
    // Xóa nội dung cũ khi chuyển lớp để giao diện sạch sẽ
    attendanceDiv.innerHTML = `<div class="card"><div class="empty-state"><h3>Đang tải dữ liệu lớp...</h3></div></div>`;
    sessionsDiv.innerHTML = '';

    // Luôn reset lịch về ngày hôm nay khi chuyển lớp
    currentCalendarState.viewDate = new Date();
    currentCalendarState.selectedDate = null;

    // 1. Phân luồng: Lấy lịch học và giờ học
    let scheduledDates = [];
    let classInfo = null;

    try {
        classInfo = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/`);
    } catch (e) {
        console.warn("Lỗi tải thông tin lớp cơ bản:", e);
    }

    try {
        const response = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/scheduled_dates/`);
        scheduledDates = Array.isArray(response) ? response : (response.results || []);
    } catch (e) {
        console.warn("API lịch học lỗi - sử dụng tính toán dự phòng:", e);
        if (classInfo) scheduledDates = getScheduledDatesFallback(classInfo);
    }
    
    renderSmartCalendar(calendarContainer, scheduledDates, classId);

    // 2. Hiển thị giờ học
    const timeStr = (classInfo && classInfo.start_time && classInfo.end_time) 
                    ? `<div class="badge badge-info" style="margin-top:8px"><span class="material-icons-outlined" style="font-size:14px">schedule</span> ${classInfo.start_time.substring(0,5)} - ${classInfo.end_time.substring(0,5)}</div>`
                    : '';

    // 3. Lấy danh sách buổi điểm danh thực tế
    try {
        const today = new Date().toISOString().split('T')[0];
        const selectedDate = scheduledDates.includes(today) ? today : '';
        if (selectedDate) currentCalendarState.selectedDate = today;

        const data = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}by_class/`, { 
            classroom_id: classId,
            session_date: selectedDate
        });
        const sessions = Array.isArray(data) ? data : (data.results || []);
        
        // Render ... (html building part - skipping for brevitiy in this diff but should remain)

        // Render tiêu đề kèm giờ học (nếu có)
        let html = `
            <div class="card">
                <div class="card-header">
                    <h3>Lịch sử điểm danh</h3>
                    ${timeStr}
                </div>`;

        if (!sessions.length) {
            html += `<p style="color:var(--text-muted);padding:16px">Chưa có buổi điểm danh nào cho ngày này</p></div>`;
            sessionsDiv.innerHTML = html;
            return;
        }

        html += `
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr><th>Buổi</th><th>Ngày</th><th>Nội dung</th><th>Có mặt</th><th>Tổng</th><th>Thao tác</th></tr>
                        </thead>
                        <tbody>
                            ${sessions.map(s => `
                                <tr>
                                    <td>Buổi ${(currentCalendarState.scheduledDates.indexOf(s.session_date) + 1) || s.session_number}</td>
                                    <td>${formatDate(s.session_date)}</td>
                                    <td>${s.topic || '-'}</td>
                                    <td><span class="badge badge-success">${s.total_present || 0}</span></td>
                                    <td>${s.total_students || 0}</td>
                                    <td>
                                        <button class="btn btn-sm btn-secondary" onclick="viewAttendanceDetail(${s.id})" title="Chi tiết">
                                            <span class="material-icons-outlined" style="font-size:1rem">visibility</span>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;
        sessionsDiv.innerHTML = html;
    } catch (error) {
        console.error("Attendance Main Flow Error:", error);
        const msg = error.data?.error || error.message || 'Không thể lấy dữ liệu buổi học';
        sessionsDiv.innerHTML = `<div class="card"><p style="color:var(--danger-500);padding:16px">Lỗi: ${msg}</p></div>`;
    }
}


// --- Quản lý biến trạng thái Smart Calendar ---
let currentCalendarState = {
    classId: null,
    scheduledDates: [],
    selectedDate: null,
    viewDate: new Date() // Luôn khởi tạo là ngày hiện tại
};

// Hàm dự phòng tính toán ngày học tại Frontend nếu API Backend lỗi
function getScheduledDatesFallback(classInfo) {
    if (!classInfo.start_date || !classInfo.end_date || !classInfo.schedule) return [];
    
    const start = new Date(classInfo.start_date);
    const end = new Date(classInfo.end_date);
    const schedule = classInfo.schedule.toUpperCase();
    
    const mapping = { 'T2': 1, 'T3': 2, 'T4': 3, 'T5': 4, 'T6': 5, 'T7': 6, 'CN': 0 };
    const activeDays = [];
    for (const [key, day] of Object.entries(mapping)) {
        if (schedule.includes(key)) activeDays.push(day);
    }
    
    const dates = [];
    let curr = new Date(start);
    while (curr <= end) {
        if (activeDays.includes(curr.getDay())) {
            dates.push(curr.toISOString().split('T')[0]);
        }
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

function renderSmartCalendar(container, scheduledDates, classId) {
    currentCalendarState.classId = classId;
    currentCalendarState.scheduledDates = scheduledDates;
    // Đồng bộ lại viewDate về tháng có tiết học gần nhất hoặc tháng hiện tại
    if (scheduledDates.length > 0) {
        const firstDate = new Date(scheduledDates[0]);
        const today = new Date();
        // Nếu tháng hiện tại không có tiết, nhưng trong tương lai có, có thể nhảy tới đó
        // Tuy nhiên tốt nhất là giữ ở tháng hiện tại để người dùng không bị "lạc"
    } else {
        currentCalendarState.viewDate = new Date();
    }
    
    internalRender(container);
}

function internalRender(container) {
    const { viewDate, scheduledDates, selectedDate } = currentCalendarState;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(viewDate);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Điều chỉnh firstDay cho Thứ 2 là ngày đầu tuần (0=Mon, 6=Sun)
    let firstDayVn = (firstDay === 0) ? 6 : firstDay - 1;
    
    let html = `
        <div class="calendar-container">
            <div class="calendar-header">
                <button class="btn-icon" onclick="changeCalendarMonth(-1)"><span class="material-icons-outlined">chevron_left</span></button>
                <h4 style="text-transform: capitalize">${monthName}</h4>
                <button class="btn-icon" onclick="changeCalendarMonth(1)"><span class="material-icons-outlined">chevron_right</span></button>
            </div>
            <div class="calendar-grid">
                <div class="calendar-weekday">H</div>
                <div class="calendar-weekday">B</div>
                <div class="calendar-weekday">T</div>
                <div class="calendar-weekday">N</div>
                <div class="calendar-weekday">S</div>
                <div class="calendar-weekday">B</div>
                <div class="calendar-weekday">C</div>
    `;
    
    // Empty cells for padding
    for (let i = 0; i < firstDayVn; i++) {
        html += `<div class="calendar-day"></div>`;
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isScheduled = scheduledDates.includes(dStr);
        const isSelected = selectedDate === dStr;
        const isToday = new Date().toISOString().split('T')[0] === dStr;
        
        let classes = ['calendar-day', 'active-month'];
        if (isScheduled) classes.push('day-scheduled');
        if (isSelected) classes.push('selected');
        if (isToday) classes.push('today');
        
        html += `
            <div class="${classes.join(' ')}" 
                 onclick="selectCalendarDate('${dStr}')">
                ${day}
            </div>
        `;
    }
    
    html += `</div>
            <div class="calendar-footer">
                <div class="calendar-dot"></div>
                <span>Ngày có tiết học</span>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

function selectCalendarDate(date) {
    currentCalendarState.selectedDate = date;
    const container = document.getElementById('calendar-v2-container');
    internalRender(container);
    
    // Tự động mở giao diện điểm danh học viên cho ngày đã chọn
    startAttendance();
}

function changeCalendarMonth(offset) {
    const d = currentCalendarState.viewDate;
    currentCalendarState.viewDate = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const container = document.getElementById('calendar-v2-container');
    internalRender(container);
}

async function loadAttendanceSessionsByDate(date) {
    const classId = currentCalendarState.classId;
    const sessionsDiv = document.getElementById('attendance-sessions');
    
    try {
        const data = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}by_class/`, { 
            classroom_id: classId,
            session_date: date
        });
        // Tái sử dụng logic cũ để render danh sách buổi
        renderSessionsTable(sessionsDiv, data);
    } catch (e) {
        showToast('Lỗi tải dữ liệu', 'error');
    }
}

function renderSessionsTable(container, data) {
    const sessions = Array.isArray(data) ? data : (data.results || []);
    if (!sessions.length) {
        container.innerHTML = `<div class="card"><p style="color:var(--text-muted);padding:16px">Không có dữ liệu điểm danh cho ngày này</p></div>`;
        return;
    }
    container.innerHTML = `
        <div class="card">
            <div class="card-header"><h3>Lịch sử ngày ${formatDate(currentCalendarState.selectedDate)}</h3></div>
            <div class="table-wrapper">
                <table>
                        <thead>
                            <tr><th>Buổi</th><th>Ngày</th><th>Nội dung</th><th>Có mặt</th><th>Tổng</th><th>Thao tác</th></tr>
                        </thead>
                        <tbody>
                            ${sessions.map(s => `
                                <tr>
                                    <td>Buổi ${(currentCalendarState.scheduledDates.indexOf(s.session_date) + 1) || s.session_number}</td>
                                    <td>${formatDate(s.session_date)}</td>
                                    <td>${s.topic || '-'}</td>
                                    <td><span class="badge badge-success">${s.total_present || 0}</span></td>
                                    <td>${s.total_students || 0}</td>
                                    <td><button class="btn btn-sm btn-secondary" onclick="viewAttendanceDetail(${s.id})"><span class="material-icons-outlined" style="font-size:1rem">visibility</span></button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                </table>
            </div>
        </div>`;
}

// Cập nhật lại startAttendance để dùng state từ lịch
async function startAttendance() {
    const classId = document.getElementById('attendance-class-select').value;
    const date = currentCalendarState.selectedDate;

    if (!classId) {
        showToast('Vui lòng chọn lớp học', 'warning');
        return;
    }

    if (!date) {
        showToast('Vui lòng chọn một ngày có tiết trên lịch', 'warning');
        return;
    }

    try {
        const classInfo = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/`);
        const timeStr = (classInfo.start_time && classInfo.end_time) 
                        ? ` <span class="badge badge-info">${classInfo.start_time.substring(0,5)} - ${classInfo.end_time.substring(0,5)}</span>`
                        : '';

        const enrollments = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/students/`);
        const students = Array.isArray(enrollments) ? enrollments : (enrollments.results || []);

        if (!students.length) {
            showToast('Lớp chưa có học viên nào', 'warning');
            return;
        }

        const attendanceDiv = document.getElementById('attendance-content');
        
        // Kiểm tra nếu ngày chọn không có trong lịch học
        if (!currentCalendarState.scheduledDates.includes(date)) {
            attendanceDiv.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <span class="material-icons-outlined">event_busy</span>
                        <h3>Ngày ${formatDate(date)} không có lớp học</h3>
                        <p style="color:var(--text-muted)">Vui lòng chọn các ngày có đánh dấu màu xanh trên lịch để tiến hành điểm danh.</p>
                    </div>
                </div>`;
            return;
        }

        attendanceDiv.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3>Điểm danh - ${formatDate(date)} ${timeStr}</h3>
                    <button class="btn btn-success" onclick="submitAttendance(${classId}, '${date}')">
                        <span class="material-icons-outlined">save</span>
                        <span>Lưu điểm danh</span>
                    </button>
                </div>
                <div class="form-group">
                    <label>Nội dung buổi học</label>
                    <input type="text" id="attendance-topic" placeholder="VD: Unit 5 - Grammar Review">
                </div>
                <div class="attendance-grid">
                    ${students.map(e => `
                        <div class="attendance-student-card" id="att-${e.student}">
                            <div class="user-avatar" style="width:32px;height:32px;font-size:0.75rem">${(e.student_name || 'U')[0]}</div>
                            <div class="attendance-student-name">${e.student_name}</div>
                            <select data-student-id="${e.student}">
                                <option value="present">Có mặt</option>
                                <option value="late">Đi trễ</option>
                                <option value="absent">Vắng</option>
                                <option value="excused">Có phép</option>
                            </select>
                        </div>
                    `).join('')}
                </div>
            </div>`;

    } catch (error) {
        showToast('Lỗi tải danh sách học viên', 'error');
    }
}

async function submitAttendance(classId, date) {
    const topic = document.getElementById('attendance-topic')?.value || '';
    const selects = document.querySelectorAll('.attendance-student-card select');

    const records = [];
    selects.forEach(sel => {
        records.push({
            student_id: parseInt(sel.dataset.studentId),
            status: sel.value,
        });
    });

    try {
        // Tìm số thứ tự buổi học dựa trên vị trí ngày trong lịch trình
        const sessionNumber = (currentCalendarState.scheduledDates.indexOf(date) + 1) || 1;

        await API.post(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}bulk_create/`, {
            classroom_id: classId,
            session_date: date,
            session_number: sessionNumber,
            topic: topic,
            records: records,
        });
        showToast(`Đã lưu điểm danh buổi ${sessionNumber}`, 'success');
        loadAttendanceSessions();
    } catch (error) {
        showToast('Lỗi khi lưu điểm danh', 'error');
    }
}

async function viewAttendanceDetail(sessionId) {
    try {
        const session = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}${sessionId}/`);
        const records = session.records || [];

        const html = `
            <p style="margin-bottom:16px;color:var(--text-secondary)">
                Ngày: <strong>${formatDate(session.session_date)}</strong> |
                Nội dung: <strong>${session.topic || '-'}</strong> |
                Có mặt: <strong>${session.total_present}/${session.total_students}</strong>
            </p>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Mã HV</th><th>Họ tên</th><th>Trạng thái</th><th>Ghi chú</th></tr>
                    </thead>
                    <tbody>
                        ${records.map(r => `
                            <tr>
                                <td>${r.student_code || '-'}</td>
                                <td>${r.student_name}</td>
                                <td><span class="badge ${getStatusBadge(r.status)}">${r.status_display || getStatusLabel(r.status)}</span></td>
                                <td>${r.notes || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>`;

        openModal(`Chi tiết điểm danh - Buổi ${session.session_number}`, html);
    } catch (error) {
        showToast('Lỗi tải chi tiết', 'error');
    }
}

async function renderStudentAttendance(content) {
    let classes = [];
    try {
        const data = await API.get(`${CONFIG.ENDPOINTS.CLASSES}my_classes/`);
        classes = data.results || data;
    } catch (e) {}

    const classOptions = classes.map(c =>
        `<option value="${c.id}">${c.code} - ${c.name}</option>`
    ).join('');

    content.innerHTML = `
        <div class="page-enter">
            <div class="toolbar">
                <div class="toolbar-left">
                    <select class="filter-select" id="student-attendance-class" onchange="loadMyAttendance()" style="min-width:300px">
                        <option value="">-- Chọn lớp học để xem điểm danh --</option>
                        ${classOptions}
                    </select>
                </div>
            </div>

            <div id="attendance-summary-area" style="margin-bottom:20px"></div>
            <div id="attendance-records-area">
                <div class="card">
                    <div class="empty-state">
                        <span class="material-icons-outlined">fact_check</span>
                        <h3>Chọn lớp học để xem lịch sử điểm danh</h3>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadMyAttendance() {
    const classId = document.getElementById('student-attendance-class').value;
    const summaryArea = document.getElementById('attendance-summary-area');
    const recordsArea = document.getElementById('attendance-records-area');

    if (!classId) {
        summaryArea.innerHTML = '';
        recordsArea.innerHTML = '';
        return;
    }

    try {
        summaryArea.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        const report = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}student_report/`, { 
            student_id: currentUser.student_id,
            classroom_id: classId 
        });

        summaryArea.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card blue">
                    <div class="stat-info"><h4>${report.total_sessions}</h4><p>Tổng số buổi</p></div>
                </div>
                <div class="stat-card green">
                    <div class="stat-info"><h4>${report.present}</h4><p>Có mặt</p></div>
                </div>
                <div class="stat-card orange">
                    <div class="stat-info"><h4>${report.late}</h4><p>Đi trễ</p></div>
                </div>
                <div class="stat-card pink">
                    <div class="stat-info"><h4>${report.absent + report.excused}</h4><p>Vắng mặt</p></div>
                </div>
                <div class="stat-card purple">
                    <div class="stat-info"><h4>${report.attendance_rate}%</h4><p>Tỷ lệ chuyên cần</p></div>
                </div>
            </div>
        `;

        if (!report.records.length) {
            recordsArea.innerHTML = '<div class="card"><p style="padding:20px;text-align:center" class="text-muted">Chưa có dữ liệu điểm danh cho lớp này</p></div>';
            return;
        }

        recordsArea.innerHTML = `
            <div class="card">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Ngày học</th>
                                <th>Chủ đề / Nội dung</th>
                                <th>Trạng thái</th>
                                <th>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.records.map(r => `
                                <tr>
                                    <td><strong>${formatDate(r.session_date)}</strong></td>
                                    <td>${r.topic || '-'}</td>
                                    <td><span class="badge ${getStatusBadge(r.status)}">${getStatusLabel(r.status)}</span></td>
                                    <td><small class="text-muted">${r.notes || '-'}</small></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        showToast('Lỗi tải dữ liệu báo cáo', 'error');
    }
}
