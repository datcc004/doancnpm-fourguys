/**
 * Attendance Module - Điểm danh
 * Nghiệp vụ mới: Chọn lớp → Chọn buổi học → Điểm danh học viên
 * 
 * Quy tắc:
 * - Mỗi buổi chỉ có 1 danh sách điểm danh
 * - Trạng thái: Có mặt (present) / Vắng (absent)
 * - Nếu vắng: phải có lý do + chọn có phép/không phép
 * - Hiển thị trạng thái bằng màu: Xanh=có mặt, Đỏ=vắng không phép, Vàng=vắng có phép
 */

// ============ STATE MANAGEMENT ============
let attendanceState = {
    classId: null,
    classInfo: null,
    scheduledDates: [],
    sessions: [],        // Danh sách các buổi đã điểm danh
    selectedSessionId: null,
    selectedDate: null,
    viewDate: new Date(),
    students: [],
    searchQuery: '',
    isEditing: false,     // Đang sửa điểm danh
};

// ============ MAIN RENDER ============
async function renderAttendance() {
    const content = document.getElementById('content-area');
    const isStudent = hasRole('student');

    if (isStudent) {
        return renderStudentAttendance(content);
    }

    // Reset state
    attendanceState = {
        classId: null, classInfo: null, scheduledDates: [], sessions: [],
        selectedSessionId: null, selectedDate: null, viewDate: new Date(),
        students: [], searchQuery: '', isEditing: false,
    };

    let classes = [];
    try {
        const endpoint = hasRole('teacher') ? `${CONFIG.ENDPOINTS.CLASSES}my_classes/` : CONFIG.ENDPOINTS.CLASSES;
        const data = await API.get(endpoint, { status: 'active', page_size: 100 });
        classes = data.results || data;
    } catch (e) {}

    const classOptions = classes.map(c =>
        `<option value="${c.id}">${c.code} - ${c.name}</option>`
    ).join('');

    content.innerHTML = `
    <div class="att-page">
        <!-- STEP 1: Chọn lớp -->
        <div class="att-toolbar card">
            <div class="att-toolbar-left">
                <span class="material-icons-outlined att-toolbar-icon">school</span>
                <div class="att-toolbar-group">
                    <label class="att-label">Chọn lớp học</label>
                    <select class="att-select" id="att-class-select" onchange="onAttClassChange()">
                        <option value="">-- Chọn lớp --</option>
                        ${classOptions}
                    </select>
                </div>
            </div>
        </div>

        <!-- STEP 2: Chọn buổi học -->
        <div class="att-layout" id="att-layout" style="display:none">
            <div class="att-sidebar-col">
                <!-- Calendar -->
                <div id="att-calendar-container"></div>
                
                <!-- Danh sách buổi học -->
                <div class="att-session-list card" id="att-session-list">
                    <div class="att-session-list-header">
                        <h4><span class="material-icons-outlined">list_alt</span> Danh sách buổi học</h4>
                    </div>
                    <div id="att-session-items" class="att-session-items">
                        <div class="att-empty-mini">Chọn ngày trên lịch để xem buổi học</div>
                    </div>
                </div>
            </div>

            <!-- STEP 3: Điểm danh -->
            <div class="att-main-col">
                <div id="att-attendance-area">
                    <div class="card att-placeholder">
                        <div class="att-placeholder-content">
                            <span class="material-icons-outlined att-placeholder-icon">how_to_reg</span>
                            <h3>Chọn buổi học để bắt đầu điểm danh</h3>
                            <p>Nhấn vào ngày có tiết học trên lịch, sau đó chọn buổi từ danh sách bên trái</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// ============ STEP 1: Chọn lớp ============
async function onAttClassChange() {
    const classId = document.getElementById('att-class-select').value;
    const layout = document.getElementById('att-layout');

    if (!classId) {
        layout.style.display = 'none';
        attendanceState.classId = null;
        return;
    }

    attendanceState.classId = classId;
    attendanceState.selectedDate = null;
    attendanceState.selectedSessionId = null;
    attendanceState.viewDate = new Date();
    layout.style.display = '';

    // Load thông tin lớp & lịch học
    try {
        attendanceState.classInfo = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/`);
    } catch (e) {}

    try {
        const response = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/scheduled_dates/`);
        attendanceState.scheduledDates = Array.isArray(response) ? response : (response.results || []);
    } catch (e) {
        if (attendanceState.classInfo) {
            attendanceState.scheduledDates = getScheduledDatesFallback(attendanceState.classInfo);
        }
    }

    // Load danh sách HV
    try {
        const enrollments = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/students/`);
        attendanceState.students = Array.isArray(enrollments) ? enrollments : (enrollments.results || []);
    } catch (e) {
        attendanceState.students = [];
    }

    // Load lịch sử buổi điểm danh
    try {
        const data = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}by_class/`, { classroom_id: classId });
        attendanceState.sessions = Array.isArray(data) ? data : (data.results || []);
    } catch (e) {
        attendanceState.sessions = [];
    }

    renderAttCalendar();
    renderAttSessionList();
    renderAttPlaceholder();
}

// ============ CALENDAR ============
function renderAttCalendar() {
    const container = document.getElementById('att-calendar-container');
    const { viewDate, scheduledDates, selectedDate, sessions } = attendanceState;
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Dates that already have attendance
    const attendedDates = sessions.map(s => s.session_date);

    const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric' }).format(viewDate);
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayVn = (firstDay === 0) ? 6 : firstDay - 1;

    let html = `
    <div class="att-calendar card">
        <div class="att-cal-header">
            <button class="btn-icon" onclick="changeAttCalMonth(-1)"><span class="material-icons-outlined">chevron_left</span></button>
            <h4>${monthName}</h4>
            <button class="btn-icon" onclick="changeAttCalMonth(1)"><span class="material-icons-outlined">chevron_right</span></button>
        </div>
        <div class="att-cal-grid">
            <div class="att-cal-weekday">T2</div>
            <div class="att-cal-weekday">T3</div>
            <div class="att-cal-weekday">T4</div>
            <div class="att-cal-weekday">T5</div>
            <div class="att-cal-weekday">T6</div>
            <div class="att-cal-weekday">T7</div>
            <div class="att-cal-weekday">CN</div>`;

    for (let i = 0; i < firstDayVn; i++) {
        html += `<div class="att-cal-day"></div>`;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    for (let day = 1; day <= daysInMonth; day++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isScheduled = scheduledDates.includes(dStr);
        const isSelected = selectedDate === dStr;
        const isToday = todayStr === dStr;
        const hasAttendance = attendedDates.includes(dStr);

        let cls = ['att-cal-day', 'att-cal-active'];
        if (isScheduled) cls.push('att-cal-scheduled');
        if (isSelected) cls.push('att-cal-selected');
        if (isToday) cls.push('att-cal-today');
        if (hasAttendance) cls.push('att-cal-attended');

        html += `<div class="${cls.join(' ')}" onclick="onAttDateClick('${dStr}')">${day}</div>`;
    }

    html += `</div>
        <div class="att-cal-legend">
            <div class="att-cal-legend-item"><span class="att-dot att-dot-scheduled"></span> Có tiết</div>
            <div class="att-cal-legend-item"><span class="att-dot att-dot-attended"></span> Đã điểm danh</div>
            <div class="att-cal-legend-item"><span class="att-dot att-dot-today"></span> Hôm nay</div>
        </div>
    </div>`;

    container.innerHTML = html;
}

function changeAttCalMonth(offset) {
    const d = attendanceState.viewDate;
    attendanceState.viewDate = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    renderAttCalendar();
}

function onAttDateClick(date) {
    attendanceState.selectedDate = date;
    attendanceState.selectedSessionId = null;
    renderAttCalendar();
    renderAttSessionList();

    // Nếu ngày có buổi học, tự động chọn buổi đầu tiên
    const sessionForDate = attendanceState.sessions.find(s => s.session_date === date);
    if (sessionForDate) {
        onAttSessionSelect(sessionForDate.id);
    } else if (attendanceState.scheduledDates.includes(date)) {
        // Ngày có lịch nhưng chưa điểm danh → mở form mới
        renderAttNewForm(date);
    } else {
        renderAttPlaceholder(`Ngày ${formatDate(date)} không có lớp học. Vui lòng chọn ngày có tiết.`);
    }
}

// ============ SESSION LIST ============
function renderAttSessionList() {
    const container = document.getElementById('att-session-items');
    const { sessions, selectedDate, scheduledDates, selectedSessionId } = attendanceState;

    // Show all sessions, sorted by session_number
    const allSessions = [...sessions].sort((a, b) => a.session_number - b.session_number);

    if (!allSessions.length) {
        container.innerHTML = `<div class="att-empty-mini">Chưa có buổi điểm danh nào</div>`;
        return;
    }

    container.innerHTML = allSessions.map(s => {
        const isActive = selectedSessionId == s.id;
        const sessionIdx = scheduledDates.indexOf(s.session_date);
        const label = `Buổi ${s.session_number}`;
        const pct = s.total_students > 0 ? Math.round((s.total_present / s.total_students) * 100) : 0;

        let statusCls = 'att-session-ok';
        if (pct < 100 && pct >= 50) statusCls = 'att-session-warn';
        if (pct < 50) statusCls = 'att-session-bad';

        return `
        <div class="att-session-item ${isActive ? 'att-session-active' : ''} ${statusCls}"
             onclick="onAttSessionSelect(${s.id})">
            <div class="att-session-num">${s.session_number}</div>
            <div class="att-session-info">
                <div class="att-session-label">${label} - ${formatDate(s.session_date)}</div>
                <div class="att-session-meta">${s.topic || 'Chưa có nội dung'}</div>
            </div>
            <div class="att-session-stats">
                <span class="att-present-count">${s.total_present}/${s.total_students}</span>
            </div>
        </div>`;
    }).join('');
}

// ============ STEP 3: ATTENDANCE FORM ============
async function onAttSessionSelect(sessionId) {
    attendanceState.selectedSessionId = sessionId;
    attendanceState.isEditing = true;
    renderAttSessionList();

    const area = document.getElementById('att-attendance-area');
    area.innerHTML = `<div class="card"><div class="att-loading"><div class="spinner"></div> Đang tải...</div></div>`;

    try {
        const session = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}${sessionId}/`);
        renderAttForm(session);
    } catch (e) {
        area.innerHTML = `<div class="card"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu buổi học</p></div>`;
    }
}

function renderAttNewForm(date) {
    attendanceState.isEditing = false;
    const { students, scheduledDates, classId, classInfo } = attendanceState;
    const sessionNumber = scheduledDates.indexOf(date) + 1 || 1;

    if (!students.length) {
        renderAttPlaceholder('Lớp chưa có học viên nào.');
        return;
    }

    const timeStr = (classInfo && classInfo.start_time && classInfo.end_time)
        ? `${classInfo.start_time.substring(0, 5)} - ${classInfo.end_time.substring(0, 5)}`
        : '';

    const area = document.getElementById('att-attendance-area');
    area.innerHTML = `
    <div class="card att-form-card">
        <div class="att-form-header">
            <div class="att-form-title">
                <span class="material-icons-outlined">edit_note</span>
                <div>
                    <h3>Điểm danh mới - Buổi ${sessionNumber}</h3>
                    <p class="att-form-subtitle">${formatDate(date)} ${timeStr ? '• ' + timeStr : ''}</p>
                </div>
            </div>
            <button class="btn btn-success att-save-btn" onclick="submitAttendance(${classId}, '${date}', ${sessionNumber})">
                <span class="material-icons-outlined">save</span>
                Lưu điểm danh
            </button>
        </div>

        <div class="att-topic-row">
            <label>Nội dung buổi học</label>
            <input type="text" id="att-topic" placeholder="VD: Unit 5 - Grammar Review" class="att-topic-input">
        </div>

        <div class="att-search-row">
            <span class="material-icons-outlined">search</span>
            <input type="text" id="att-search" placeholder="Tìm kiếm học viên..." oninput="filterAttStudents()">
        </div>

        <div class="att-table-wrapper">
            <table class="att-table" id="att-table">
                <thead>
                    <tr>
                        <th class="att-th-stt">STT</th>
                        <th class="att-th-name">Học viên</th>
                        <th class="att-th-status">Có mặt</th>
                        <th class="att-th-status">Vắng</th>
                        <th class="att-th-reason">Lý do</th>
                        <th class="att-th-excused">Có phép</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map((e, i) => renderAttRow(e, i, 'present', '', false)).join('')}
                </tbody>
            </table>
        </div>

        <div class="att-form-footer">
            <div class="att-legend-bar">
                <span class="att-legend-item"><span class="att-dot-lg" style="background:var(--success-500)"></span> Có mặt</span>
                <span class="att-legend-item"><span class="att-dot-lg" style="background:var(--danger-500)"></span> Vắng không phép</span>
                <span class="att-legend-item"><span class="att-dot-lg" style="background:var(--warning-500)"></span> Vắng có phép</span>
            </div>
            <button class="btn btn-success" onclick="submitAttendance(${classId}, '${date}', ${sessionNumber})">
                <span class="material-icons-outlined">save</span>
                Lưu điểm danh
            </button>
        </div>
    </div>`;

    updateAllRowColors();
}

function renderAttForm(session) {
    const { students, classId, classInfo } = attendanceState;
    const records = session.records || [];

    const timeStr = (classInfo && classInfo.start_time && classInfo.end_time)
        ? `${classInfo.start_time.substring(0, 5)} - ${classInfo.end_time.substring(0, 5)}`
        : '';

    // Map records by student_id
    const recordMap = {};
    records.forEach(r => { recordMap[r.student] = r; });

    // Merge existing records with all students
    const allStudents = students.map(e => {
        const rec = recordMap[e.student];
        return {
            ...e,
            status: rec ? rec.status : 'present',
            absence_reason: rec ? (rec.absence_reason || '') : '',
            is_excused: rec ? rec.is_excused : false,
        };
    });

    const area = document.getElementById('att-attendance-area');
    area.innerHTML = `
    <div class="card att-form-card">
        <div class="att-form-header">
            <div class="att-form-title">
                <span class="material-icons-outlined">fact_check</span>
                <div>
                    <h3>Buổi ${session.session_number} - ${formatDate(session.session_date)}</h3>
                    <p class="att-form-subtitle">${session.topic || 'Chưa có nội dung'} ${timeStr ? '• ' + timeStr : ''}</p>
                </div>
            </div>
            <div class="att-header-actions">
                <div class="att-stats-mini">
                    <span class="att-stat-present"><span class="material-icons-outlined">check_circle</span> ${session.total_present}</span>
                    <span class="att-stat-absent"><span class="material-icons-outlined">cancel</span> ${session.total_absent}</span>
                </div>
                <button class="btn btn-primary att-save-btn" onclick="submitAttendance(${classId}, '${session.session_date}', ${session.session_number})">
                    <span class="material-icons-outlined">save</span>
                    Cập nhật điểm danh
                </button>
            </div>
        </div>

        <div class="att-topic-row">
            <label>Nội dung buổi học</label>
            <input type="text" id="att-topic" value="${session.topic || ''}" placeholder="VD: Unit 5 - Grammar Review" class="att-topic-input">
        </div>

        <div class="att-search-row">
            <span class="material-icons-outlined">search</span>
            <input type="text" id="att-search" placeholder="Tìm kiếm học viên..." oninput="filterAttStudents()">
        </div>

        <div class="att-table-wrapper">
            <table class="att-table" id="att-table">
                <thead>
                    <tr>
                        <th class="att-th-stt">STT</th>
                        <th class="att-th-name">Học viên</th>
                        <th class="att-th-status">Có mặt</th>
                        <th class="att-th-status">Vắng</th>
                        <th class="att-th-reason">Lý do</th>
                        <th class="att-th-excused">Có phép</th>
                    </tr>
                </thead>
                <tbody>
                    ${allStudents.map((e, i) => renderAttRow(e, i, e.status, e.absence_reason, e.is_excused)).join('')}
                </tbody>
            </table>
        </div>

        <div class="att-form-footer">
            <div class="att-legend-bar">
                <span class="att-legend-item"><span class="att-dot-lg" style="background:var(--success-500)"></span> Có mặt</span>
                <span class="att-legend-item"><span class="att-dot-lg" style="background:var(--danger-500)"></span> Vắng không phép</span>
                <span class="att-legend-item"><span class="att-dot-lg" style="background:var(--warning-500)"></span> Vắng có phép</span>
            </div>
            <button class="btn btn-primary" onclick="submitAttendance(${classId}, '${session.session_date}', ${session.session_number})">
                <span class="material-icons-outlined">save</span>
                Cập nhật điểm danh
            </button>
        </div>
    </div>`;

    updateAllRowColors();
}

function renderAttRow(student, index, status, absenceReason, isExcused) {
    const studentId = student.student || student.id;
    const name = student.student_name || student.name || 'Học viên';
    const code = student.student_code || '';
    const isPresent = status === 'present';
    const isAbsent = status === 'absent';
    const reasonDisabled = isPresent ? 'disabled' : '';
    const excusedDisabled = isPresent ? 'disabled' : '';

    return `
    <tr class="att-row" data-student-id="${studentId}" id="att-row-${studentId}">
        <td class="att-td-stt">${index + 1}</td>
        <td class="att-td-name">
            <div class="att-student-info">
                <div class="att-avatar">${name.charAt(0)}</div>
                <div>
                    <div class="att-student-fullname">${name}</div>
                    ${code ? `<div class="att-student-code">${code}</div>` : ''}
                </div>
            </div>
        </td>
        <td class="att-td-check">
            <label class="att-radio att-radio-present">
                <input type="radio" name="att-status-${studentId}" value="present" 
                       ${isPresent ? 'checked' : ''} onchange="onAttStatusChange(${studentId})">
                <span class="att-radio-mark att-mark-present"></span>
            </label>
        </td>
        <td class="att-td-check">
            <label class="att-radio att-radio-absent">
                <input type="radio" name="att-status-${studentId}" value="absent"
                       ${isAbsent ? 'checked' : ''} onchange="onAttStatusChange(${studentId})">
                <span class="att-radio-mark att-mark-absent"></span>
            </label>
        </td>
        <td class="att-td-reason">
            <input type="text" class="att-reason-input" id="att-reason-${studentId}" 
                   value="${absenceReason || ''}" placeholder="Nhập lý do..." ${reasonDisabled}>
        </td>
        <td class="att-td-excused">
            <label class="att-checkbox">
                <input type="checkbox" id="att-excused-${studentId}" 
                       ${isExcused ? 'checked' : ''} ${excusedDisabled}
                       onchange="onAttExcusedChange(${studentId})">
                <span class="att-checkbox-mark"></span>
            </label>
        </td>
    </tr>`;
}

// ============ INTERACTIVE HANDLERS ============
function onAttStatusChange(studentId) {
    const row = document.getElementById(`att-row-${studentId}`);
    const status = row.querySelector(`input[name="att-status-${studentId}"]:checked`).value;
    const reasonInput = document.getElementById(`att-reason-${studentId}`);
    const excusedInput = document.getElementById(`att-excused-${studentId}`);

    if (status === 'present') {
        reasonInput.disabled = true;
        reasonInput.value = '';
        excusedInput.disabled = true;
        excusedInput.checked = false;
    } else {
        reasonInput.disabled = false;
        excusedInput.disabled = false;
        reasonInput.focus();
    }

    updateRowColor(studentId);
}

function onAttExcusedChange(studentId) {
    updateRowColor(studentId);
}

function updateRowColor(studentId) {
    const row = document.getElementById(`att-row-${studentId}`);
    if (!row) return;

    const status = row.querySelector(`input[name="att-status-${studentId}"]:checked`)?.value;
    const isExcused = document.getElementById(`att-excused-${studentId}`)?.checked;

    row.classList.remove('att-row-present', 'att-row-absent', 'att-row-excused');

    if (status === 'present') {
        row.classList.add('att-row-present');
    } else if (isExcused) {
        row.classList.add('att-row-excused');
    } else {
        row.classList.add('att-row-absent');
    }
}

function updateAllRowColors() {
    document.querySelectorAll('.att-row').forEach(row => {
        const studentId = row.dataset.studentId;
        if (studentId) updateRowColor(studentId);
    });
}

function filterAttStudents() {
    const query = document.getElementById('att-search').value.toLowerCase().trim();
    const rows = document.querySelectorAll('.att-row');
    rows.forEach(row => {
        const name = row.querySelector('.att-student-fullname')?.textContent.toLowerCase() || '';
        const code = row.querySelector('.att-student-code')?.textContent.toLowerCase() || '';
        row.style.display = (name.includes(query) || code.includes(query)) ? '' : 'none';
    });
}

// ============ SUBMIT ATTENDANCE ============
async function submitAttendance(classId, date, sessionNumber) {
    const topic = document.getElementById('att-topic')?.value || '';
    const rows = document.querySelectorAll('.att-row');

    const records = [];
    let hasError = false;

    rows.forEach(row => {
        const studentId = parseInt(row.dataset.studentId);
        const statusInput = row.querySelector(`input[name="att-status-${studentId}"]:checked`);
        const status = statusInput ? statusInput.value : 'present';
        const absenceReason = document.getElementById(`att-reason-${studentId}`)?.value || '';
        const isExcused = document.getElementById(`att-excused-${studentId}`)?.checked || false;

        records.push({
            student_id: studentId,
            status: status,
            absence_reason: status === 'absent' ? (absenceReason || 'Không rõ') : '',
            is_excused: status === 'absent' ? isExcused : false,
        });
    });

    try {
        await API.post(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}bulk_create/`, {
            classroom_id: classId,
            session_date: date,
            session_number: sessionNumber,
            topic: topic,
            records: records,
        });

        showToast(`Đã lưu điểm danh buổi ${sessionNumber} thành công!`, 'success');

        // Reload sessions
        try {
            const data = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}by_class/`, { classroom_id: classId });
            attendanceState.sessions = Array.isArray(data) ? data : (data.results || []);
        } catch (e) {}

        renderAttCalendar();
        renderAttSessionList();

        // Reload form with updated data
        const savedSession = attendanceState.sessions.find(
            s => s.session_date === date && s.session_number === sessionNumber
        );
        if (savedSession) {
            onAttSessionSelect(savedSession.id);
        }

    } catch (error) {
        showToast('Lỗi khi lưu điểm danh', 'error');
    }
}

// ============ PLACEHOLDER ============
function renderAttPlaceholder(msg) {
    const area = document.getElementById('att-attendance-area');
    area.innerHTML = `
    <div class="card att-placeholder">
        <div class="att-placeholder-content">
            <span class="material-icons-outlined att-placeholder-icon">how_to_reg</span>
            <h3>${msg || 'Chọn buổi học để bắt đầu điểm danh'}</h3>
            <p>Nhấn vào ngày có tiết học trên lịch, sau đó chọn buổi từ danh sách bên trái</p>
        </div>
    </div>`;
}

// ============ HELPER ============
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


// ============ STUDENT VIEW ============
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
    <div class="att-page">
        <div class="att-toolbar card">
            <div class="att-toolbar-left">
                <span class="material-icons-outlined att-toolbar-icon">school</span>
                <div class="att-toolbar-group">
                    <label class="att-label">Chọn lớp học</label>
                    <select class="att-select" id="student-attendance-class" onchange="loadMyAttendance()" style="min-width:300px">
                        <option value="">-- Chọn lớp học để xem điểm danh --</option>
                        ${classOptions}
                    </select>
                </div>
            </div>
        </div>

        <div id="attendance-summary-area"></div>
        <div id="attendance-records-area">
            <div class="card att-placeholder">
                <div class="att-placeholder-content">
                    <span class="material-icons-outlined att-placeholder-icon">fact_check</span>
                    <h3>Chọn lớp học để xem lịch sử điểm danh</h3>
                </div>
            </div>
        </div>
    </div>`;
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
        summaryArea.innerHTML = '<div class="att-loading"><div class="spinner"></div></div>';
        const report = await API.get(`${CONFIG.ENDPOINTS.ATTENDANCE_SESSIONS}student_report/`, {
            student_id: currentUser.student_id,
            classroom_id: classId
        });

        summaryArea.innerHTML = `
        <div class="stats-grid" style="margin-bottom:20px">
            <div class="stat-card blue">
                <div class="stat-info"><h4>${report.total_sessions}</h4><p>Tổng số buổi</p></div>
            </div>
            <div class="stat-card green">
                <div class="stat-info"><h4>${report.present}</h4><p>Có mặt</p></div>
            </div>
            <div class="stat-card orange">
                <div class="stat-info"><h4>${report.absent_excused || 0}</h4><p>Vắng có phép</p></div>
            </div>
            <div class="stat-card pink">
                <div class="stat-info"><h4>${report.absent_unexcused || 0}</h4><p>Vắng không phép</p></div>
            </div>
            <div class="stat-card purple">
                <div class="stat-info"><h4>${report.attendance_rate}%</h4><p>Tỷ lệ chuyên cần</p></div>
            </div>
        </div>`;

        if (!report.records.length) {
            recordsArea.innerHTML = '<div class="card"><p style="padding:20px;text-align:center" class="text-muted">Chưa có dữ liệu điểm danh cho lớp này</p></div>';
            return;
        }

        recordsArea.innerHTML = `
        <div class="card">
            <div class="att-table-wrapper">
                <table class="att-table att-table-student">
                    <thead>
                        <tr>
                            <th>Buổi</th>
                            <th>Ngày học</th>
                            <th>Nội dung</th>
                            <th>Trạng thái</th>
                            <th>Lý do</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.records.map(r => {
                            let badgeCls = 'att-badge-present';
                            let label = 'Có mặt';
                            if (r.status === 'absent') {
                                if (r.is_excused) {
                                    badgeCls = 'att-badge-excused';
                                    label = 'Vắng có phép';
                                } else {
                                    badgeCls = 'att-badge-absent';
                                    label = 'Vắng không phép';
                                }
                            }
                            return `
                            <tr>
                                <td>Buổi ${r.session_number || '-'}</td>
                                <td><strong>${formatDate(r.session_date)}</strong></td>
                                <td>${r.topic || '-'}</td>
                                <td><span class="att-badge ${badgeCls}">${label}</span></td>
                                <td>${r.absence_reason || '-'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    } catch (error) {
        showToast('Lỗi tải dữ liệu báo cáo', 'error');
    }
}
