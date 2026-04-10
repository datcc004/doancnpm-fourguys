/**
 * Classes Module - Quản lý lớp học
 */
async function renderClasses() {
    const content = document.getElementById('content-area');

    let html = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="class-search" placeholder="Tìm lớp học..." onkeyup="searchClasses()">
                </div>
                <select class="filter-select" id="class-status-filter" onchange="loadClasses()">
                    <option value="">Tất cả trạng thái</option>
                    <option value="upcoming">Sắp khai giảng</option>
                    <option value="active">Đang học</option>
                    <option value="completed">Đã kết thúc</option>
                    <option value="cancelled">Đã hủy</option>
                </select>
            </div>
            ${hasRole('admin', 'staff') ? `
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openClassModal()">
                    <span class="material-icons-outlined">add_circle</span>
                    <span>Tạo lớp học</span>
                </button>
            </div>` : ''}
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Lớp học</th>
                            <th>Khóa học</th>
                            <th>Giảng viên</th>
                            <th>Thời gian</th>
                            <th>Lịch học</th>
                            <th>Sĩ số</th>
                            <th>Trạng thái</th>
                            ${hasRole('admin', 'staff') ? '<th style="text-align:right">Thao tác</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="classes-table-body">
                        <tr><td colspan="10"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="classes-pagination"></div>
        </div>
    </div>`;

    content.innerHTML = html;
    loadClasses();
}

async function loadClasses(page = 1) {
    try {
        const search = document.getElementById('class-search')?.value || '';
        const status = document.getElementById('class-status-filter')?.value || '';
        const params = { page, search };
        if (status) params.status = status;

        const data = await API.get(CONFIG.ENDPOINTS.CLASSES, params);
        const classes = data.results || data;
        const tbody = document.getElementById('classes-table-body');

        if (!classes.length) {
            tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-outlined">class</span><h3>Chưa có lớp học nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = classes.map(c => {
            const percent = Math.round((c.current_students / c.max_students) * 100);
            return `
            <tr>
                <td>
                    <div style="font-weight:700; color:var(--primary-700)">${c.code}</div>
                    <div style="font-size:0.85rem; color:var(--text-secondary)">${c.name}</div>
                    ${c.room ? `<div style="font-size:0.75rem; color:var(--text-muted)"><span class="material-icons-outlined" style="font-size:12px">room</span> ${c.room}</div>` : ''}
                </td>
                <td><div style="font-size:0.9rem">${c.course_name || '-'}</div></td>
                <td>
                    <div style="font-size:0.9rem">${c.teacher_name || '<span style="color:var(--warning-600)">Chưa phân công</span>'}</div>
                </td>
                <td>
                    <div style="font-size:0.8rem">${formatDate(c.start_date)}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted)">đến ${formatDate(c.end_date)}</div>
                </td>
                <td><div style="font-size:0.85rem; font-weight:500">${c.schedule || '-'}</div></td>
                <td style="min-width:120px">
                    <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px">
                        <span style="font-weight:600">${c.current_students}/${c.max_students}</span>
                        <span style="color:var(--text-muted)">${percent}%</span>
                    </div>
                    <div class="progress-bar-sm">
                        <div class="progress-fill" style="width: ${percent}%; background: ${percent > 90 ? 'var(--danger-500)' : 'var(--primary-500)'}"></div>
                    </div>
                </td>
                <td><span class="badge ${getStatusBadge(c.status)}">${getStatusLabel(c.status)}</span></td>
                ${hasRole('admin', 'staff') ? `
                <td style="text-align:right">
                    <div class="action-btn-group">
                        <button class="btn-action edit" onclick="editClass(${c.id})" title="Sửa thông tin"><span class="material-icons-outlined">edit</span></button>
                        <button class="btn-action info" onclick="manageClassStudents(${c.id}, '${c.code}')" title="Học viên"><span class="material-icons-outlined">group</span></button>
                        ${c.status === 'active' ? `<button class="btn-action success" onclick="completeClass(${c.id})" title="Kết thúc"><span class="material-icons-outlined">check_circle</span></button>` : ''}
                        <button class="btn-action danger" onclick="deleteClass(${c.id})" title="Xóa"><span class="material-icons-outlined">delete</span></button>
                    </div>
                </td>` : hasRole('student') ? `
                <td>
                    ${c.is_enrolled ? `
                        <span class="badge badge-success"><span class="material-icons-outlined" style="font-size:14px">check</span> Đang theo học</span>
                    ` : ''}
                </td>` : ''}
            </tr>
        `}).join('');

        if (data.count) {
            document.getElementById('classes-pagination').innerHTML = renderPagination(data, 'loadClasses');
        }
    } catch (error) {
        document.getElementById('classes-table-body').innerHTML =
            '<tr><td colspan="10"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

function searchClasses() {
    clearTimeout(window._classSearchTimeout);
    window._classSearchTimeout = setTimeout(() => loadClasses(), 400);
}

async function openClassModal(classRoom = null) {
    const isEdit = !!classRoom;
    const title = isEdit ? 'Sửa lớp học' : 'Tạo lớp học mới';

    // Load courses & teachers
    let courses = [], teachers = [];
    try {
        const [coursesData, teachersData] = await Promise.all([
            API.get(CONFIG.ENDPOINTS.COURSES, { is_active: true, page_size: 100 }),
            API.get(CONFIG.ENDPOINTS.TEACHERS, { page_size: 100 })
        ]);
        courses = coursesData.results || coursesData;
        teachers = teachersData.results || teachersData;
    } catch (e) {}

    const courseOptions = courses.map(c => {
        const selected = isEdit && (classRoom.course && (classRoom.course.id === c.id || classRoom.course === c.id));
        return `<option value="${c.id}" ${selected ? 'selected' : ''}>${c.code} - ${c.name}</option>`;
    }).join('');

    const teacherOptions = teachers.map(t => {
        const selected = isEdit && (classRoom.teacher && (classRoom.teacher.id === t.id || classRoom.teacher === t.id));
        return `<option value="${t.id}" ${selected ? 'selected' : ''}>${t.teacher_code} - ${t.user.last_name} ${t.user.first_name}</option>`;
    }).join('');

    const html = `
        <form onsubmit="return saveClass(event, ${isEdit ? classRoom.id : 'null'})">
            <div class="form-row">
                <div class="form-group">
                    <label>Mã lớp *</label>
                    <input type="text" name="code" value="${isEdit ? classRoom.code : ''}" required ${isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Tên lớp *</label>
                    <input type="text" name="name" value="${isEdit ? classRoom.name : ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Khóa học *</label>
                    <select name="course" id="modal-class-course" required onchange="syncCourseLessons(); autoCalculateEndDate();">
                        <option value="">-- Chọn khóa học --</option>${courseOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Giảng viên</label>
                    <select name="teacher"><option value="">-- Chọn GV --</option>${teacherOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Số tiết học *</label>
                    <input type="number" name="total_lessons" id="modal-class-lessons" value="${isEdit ? (classRoom.total_lessons || '') : ''}" required onchange="autoCalculateEndDate()">
                </div>
                <div class="form-group">
                    <label>Phòng học</label>
                    <input type="text" name="room" value="${isEdit ? (classRoom.room || '') : ''}">
                </div>
            </div>
                <div class="form-group">
                    <label>Lịch học *</label>
                    <div class="schedule-selector" style="display: flex; flex-direction: column; gap: 10px;">
                        <input type="hidden" name="schedule" id="class-schedule-value" value="${isEdit ? (classRoom.schedule || '') : ''}">
                        <div class="days-selector" style="display: flex; gap: 5px; flex-wrap: wrap;">
                            ${['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(day => `
                                <label class="day-chip" style="cursor: pointer; padding: 5px 10px; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 0.8rem; user-select: none;">
                                    <input type="checkbox" class="schedule-day" value="${day}" style="display: none;" onchange="updateScheduleString()">
                                    <span>${day}</span>
                                </label>
                            `).join('')}
                        </div>
                        <div class="time-selector" style="display: flex; align-items: center; gap: 8px;">
                            <input type="time" class="schedule-start" onchange="updateScheduleString()" style="flex: 1; padding: 5px;" value="${isEdit ? parseScheduleTime(classRoom.schedule, 0) : '08:00'}">
                            <span>-</span>
                            <input type="time" class="schedule-end" onchange="updateScheduleString()" style="flex: 1; padding: 5px;" value="${isEdit ? parseScheduleTime(classRoom.schedule, 1) : '10:00'}">
                        </div>
                    </div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ngày bắt đầu *</label>
                    <input type="date" name="start_date" id="modal-class-start-date" value="${isEdit ? classRoom.start_date : ''}" required onchange="autoCalculateEndDate()">
                </div>
                <div class="form-group">
                    <label>Ngày kết thúc *</label>
                    <input type="date" name="end_date" id="modal-class-end-date" value="${isEdit ? classRoom.end_date : ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Hình thức học</label>
                    <select name="learning_mode">
                        <option value="offline" ${isEdit && classRoom.learning_mode === 'offline' ? 'selected' : ''}>Tại trung tâm (Offline)</option>
                        <option value="online" ${isEdit && classRoom.learning_mode === 'online' ? 'selected' : ''}>Trực tuyến (Online)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Trạng thái</label>
                    <select name="status">
                        <option value="upcoming" ${isEdit && classRoom.status === 'upcoming' ? 'selected' : ''}>Sắp khai giảng</option>
                        <option value="active" ${isEdit && classRoom.status === 'active' ? 'selected' : ''}>Đang học</option>
                        <option value="completed" ${isEdit && classRoom.status === 'completed' ? 'selected' : ''}>Đã kết thúc</option>
                        <option value="cancelled" ${isEdit && classRoom.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Số HV tối đa</label>
                    <input type="number" name="max_students" value="${isEdit ? classRoom.max_students : 25}" min="1">
                </div>
            </div>
            <div class="form-group">
                <label>Ghi chú</label>
                <textarea name="notes">${isEdit ? (classRoom.notes || '') : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Tạo lớp học'}</button>
        </form>
    `;

    openModal(title, html);
    
    // Lưu tạm danh sách khóa học để sync
    window._currentCourses = courses;

    // Khởi tạo trạng thái cho Day chips
    if (isEdit && classRoom.schedule) {
        const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        days.forEach(day => {
            if (classRoom.schedule.toUpperCase().includes(day)) {
                const label = document.querySelector(`.day-chip input[value="${day}"]`).parentElement;
                label.querySelector('input').checked = true;
                label.style.background = 'var(--primary-600)';
                label.style.color = 'white';
                label.style.borderColor = 'var(--primary-700)';
            }
        });
    }
}

function updateScheduleString() {
    const days = Array.from(document.querySelectorAll('.schedule-day:checked')).map(cb => cb.value);
    const start = document.querySelector('.schedule-start').value;
    const end = document.querySelector('.schedule-end').value;
    
    // Update chip styles
    document.querySelectorAll('.day-chip').forEach(label => {
        const cb = label.querySelector('input');
        if (cb.checked) {
            label.style.background = 'var(--primary-600)';
            label.style.color = 'white';
            label.style.borderColor = 'var(--primary-700)';
        } else {
            label.style.background = 'transparent';
            label.style.color = 'var(--text-primary)';
            label.style.borderColor = 'var(--border-color)';
        }
    });

    const scheduleStr = days.length ? `${days.join('-')} ${start}-${end}` : '';
    document.getElementById('class-schedule-value').value = scheduleStr;
    autoCalculateEndDate();
}

function parseScheduleTime(scheduleStr, index) {
    if (!scheduleStr) return index === 0 ? '08:00' : '10:00';
    const parts = scheduleStr.split(' ');
    if (parts.length < 2) return index === 0 ? '08:00' : '10:00';
    const times = parts[1].split('-');
    if (times.length < 2) return index === 0 ? '08:00' : '10:00';
    
    // Đảm bảo định dạng HH:mm cho input time
    let time = times[index].trim();
    if (time.length === 4) time = '0' + time; // e.g. 8:00 -> 08:00
    return time;
}

async function saveClass(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    // Convert empty teacher to null
    if (!data.teacher) data.teacher = null;

    try {
        if (id) {
            await API.put(`${CONFIG.ENDPOINTS.CLASSES}${id}/`, data);
            showToast('Cập nhật lớp học thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.CLASSES, data);
            showToast('Tạo lớp học thành công', 'success');
        }
        closeModal();
        loadClasses();
    } catch (error) {
        console.error('Save Class Error:', error);
        let msg = 'Có lỗi xảy ra khi lưu dữ liệu';
        
        if (error.data) {
            if (typeof error.data === 'string') {
                msg = error.data;
            } else if (error.data.error) {
                msg = error.data.error;
            } else if (typeof error.data === 'object') {
                // Extract first error from field errors (e.g. {teacher: ["..."]})
                const fieldErrors = Object.values(error.data);
                if (fieldErrors.length > 0) {
                    const firstError = fieldErrors[0];
                    msg = Array.isArray(firstError) ? firstError[0] : firstError;
                }
            }
        }
        showToast(msg, 'error');
    }
    return false;
}

async function editClass(id) {
    try {
        const classRoom = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${id}/`);
        openClassModal(classRoom);
    } catch (error) {
        showToast('Không thể tải thông tin lớp học', 'error');
    }
}

async function deleteClass(id) {
    const confirmed = await showConfirm('Xóa lớp học', 'Bạn có chắc muốn xóa lớp học này?');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.CLASSES}${id}/`);
        showToast('Đã xóa lớp học', 'success');
        loadClasses();
    } catch (error) {
        showToast('Lỗi khi xóa', 'error');
    }
}

async function enrollInClass(classId, status) {
    if (status !== 'upcoming') {
        showToast('Chỉ có thể đăng ký các lớp Sắp khai giảng. Lớp đang học/kết thúc vui lòng liên hệ trực tiếp tại trung tâm.', 'info');
        return;
    }

    const confirmed = await showConfirm('Đăng ký lớp học', 'Bạn muốn đăng ký tham gia lớp học này?');
    if (!confirmed) return;

    try {
        const response = await API.post(`${CONFIG.ENDPOINTS.CLASSES}${classId}/enroll/`, {});
        const msg = response.message || 'Đăng ký lớp học thành công! Vui lòng chờ xác nhận/thanh toán.';
        showToast(msg, 'success');
        loadClasses();
        
        // Nếu có payment_id, có thể chuyển hướng sang trang thanh toán hoặc thông báo chi tiết hơn
        if (response.payment_id) {
            console.log('Created payment request:', response.payment_id);
        }
    } catch (error) {
        const msg = (error.data && error.data.error) ? error.data.error : 'Không thể đăng ký lớp học này';
        showToast(msg, 'error');
    }
}

async function completeClass(id) {
    const confirmed = await showConfirm('Kết thúc lớp học', 'Bạn có chắc muốn kết thúc lớp học này? Tất cả học viên trong lớp sẽ được đánh dấu là Hoàn thành.');
    if (!confirmed) return;

    try {
        await API.post(`${CONFIG.ENDPOINTS.CLASSES}${id}/complete/`, {});
        showToast('Kết thúc lớp học thành công', 'success');
        loadClasses();
    } catch (error) {
        showToast(msg, 'error');
    }
}

async function manageClassStudents(classId, classCode) {
    try {
        const enrollments = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/students/`);
        const students = Array.isArray(enrollments) ? enrollments : (enrollments.results || []);

        let html = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <p>Danh sách học viên lớp <strong>${classCode}</strong> (${students.length} học viên)</p>
                <button class="btn btn-primary btn-sm" onclick="openAddStudentModal(${classId}, '${classCode}')">
                    <span class="material-icons-outlined">person_add</span> Thêm học viên
                </button>
            </div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr><th>Mã HV</th><th>Họ tên</th><th>Ngày ĐK</th><th>Trạng thái</th><th>Thao tác</th></tr>
                    </thead>
                    <tbody>
                        ${students.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:20px">Chưa có học viên</td></tr>' : 
                            students.map(e => `
                            <tr>
                                <td>${e.student_code}</td>
                                <td>${e.student_name}</td>
                                <td>${formatDate(e.enrollment_date)}</td>
                                <td><span class="badge ${getStatusBadge(e.status)}">${getStatusLabel(e.status)}</span></td>
                                <td>
                                    <button class="btn btn-sm btn-danger" onclick="removeStudentFromClass(${classId}, ${e.id}, '${classCode}')" title="Gỡ khỏi lớp">
                                        <span class="material-icons-outlined" style="font-size:1rem">person_remove</span>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        openModal(`Quản lý học viên - ${classCode}`, html);
    } catch (error) {
        showToast('Lỗi tải danh sách học viên', 'error');
    }
}

async function removeStudentFromClass(classId, enrollmentId, classCode) {
    const confirmed = await showConfirm('Gỡ học viên', 'Bạn có chắc muốn gỡ học viên này khỏi lớp?');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.ENROLLMENTS}${enrollmentId}/`);
        showToast('Đã gỡ học viên thành công', 'success');
        manageClassStudents(classId, classCode); // Reload list
        loadClasses(); // Reload main table (for student count)
    } catch (error) {
        showToast('Lỗi khi gỡ học viên', 'error');
    }
}

async function openAddStudentModal(classId, classCode) {
    try {
        // 1. Lấy danh sách học viên hiện đang có trong lớp
        const currentEnrollments = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/students/`);
        const currentStudentIds = (Array.isArray(currentEnrollments) ? currentEnrollments : (currentEnrollments.results || [])).map(e => e.student);

        // 2. Lấy tất cả học viên
        const allStudentsData = await API.get(CONFIG.ENDPOINTS.STUDENTS, { page_size: 1000 });
        const allStudents = allStudentsData.results || allStudentsData;

        // 3. Lọc bỏ những người đã có trong lớp
        const filteredList = allStudents.filter(s => !currentStudentIds.includes(s.id));

        const html = `
            <div class="form-group">
                <label>Chọn học viên cần thêm (Chỉ hiện những HV chưa có trong lớp)</label>
                <input type="text" id="add-student-search" placeholder="Gõ tên hoặc mã HV..." onkeyup="filterAddStudentList()" style="margin-bottom:10px">
                <div id="add-student-list" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
                    ${filteredList.length === 0 ? '<div style="padding:20px; text-align:center; color:var(--text-muted)">Tất cả học viên đều đã có mặt trong lớp này</div>' : 
                        filteredList.map(s => `
                        <div class="selectable-student-item" data-name="${s.user.last_name} ${s.user.first_name}" data-code="${s.student_code}" 
                             onclick="confirmAddStudent(${classId}, ${s.id}, '${s.user.last_name} ${s.user.first_name}', '${classCode}')"
                             style="padding: 10px; border-bottom: 1px solid var(--border-light); cursor: pointer; transition: background 0.2s;">
                            <strong>${s.student_code}</strong> - ${s.user.last_name} ${s.user.first_name}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.querySelector('.modal-header h3').innerText = 'Thêm học viên vào lớp';
        document.getElementById('modal-body').innerHTML = `
            <button class="btn btn-secondary btn-sm" onclick="manageClassStudents(${classId}, '${classCode}')" style="margin-bottom:15px">
                <span class="material-icons-outlined">arrow_back</span> Quay lại
            </button>
            ${html}
        `;
    } catch (e) {
        showToast('Lỗi tải danh sách học viên', 'error');
    }
}

function filterAddStudentList() {
    const q = document.getElementById('add-student-search').value.toLowerCase();
    document.querySelectorAll('.selectable-student-item').forEach(item => {
        const text = (item.dataset.name + item.dataset.code).toLowerCase();
        item.style.display = text.includes(q) ? 'block' : 'none';
    });
}

async function confirmAddStudent(classId, studentId, studentName, classCode) {
    const confirmed = await showConfirm('Xác nhận thêm', `Bạn có chắc muốn thêm học viên <strong>${studentName}</strong> vào lớp <strong>${classCode}</strong>?`);
    if (!confirmed) return;

    try {
        await API.post(`${CONFIG.ENDPOINTS.CLASSES}${classId}/enroll/`, { student_id: studentId });
        showToast('Thêm học viên thành công', 'success');
        manageClassStudents(classId, classCode);
        loadClasses();
    } catch (error) {
        const msg = error.data?.error || 'Không thể thêm học viên (có thể do trùng lịch hoặc lớp đầy)';
        showToast(msg, 'error');
    }
}

function syncCourseLessons() {
    const selector = document.getElementById('modal-class-course');
    if (!selector) return;
    const courseId = parseInt(selector.value);
    const lessonsInput = document.getElementById('modal-class-lessons');
    
    if (courseId && window._currentCourses && lessonsInput) {
        const selected = window._currentCourses.find(c => c.id === courseId);
        if (selected && selected.total_lessons) {
            lessonsInput.value = selected.total_lessons;
        }
    }
}
function autoCalculateEndDate() {
    const lessonsInput = document.getElementById('modal-class-lessons');
    const startDateInput = document.getElementById('modal-class-start-date');
    const endDateInput = document.getElementById('modal-class-end-date');
    const scheduleDays = Array.from(document.querySelectorAll('.schedule-day:checked')).map(cb => cb.value);

    if (!lessonsInput || !startDateInput || !endDateInput || !scheduleDays.length) return;

    const totalLessons = parseInt(lessonsInput.value);
    const startDate = new Date(startDateInput.value);

    if (isNaN(totalLessons) || totalLessons <= 0 || isNaN(startDate.getTime())) return;

    // Map VN days to JS day numbers (0-6)
    const dayMap = {
        'CN': 0, 'T2': 1, 'T3': 2, 'T4': 3, 'T5': 4, 'T6': 5, 'T7': 6
    };
    const targetDays = scheduleDays.map(d => dayMap[d]);

    let currentDate = new Date(startDate);
    let lessonsCount = 0;
    let lastLessonDate = new Date(startDate);

    // If start date is a scheduled day, it counts as lesson 1
    if (targetDays.includes(currentDate.getDay())) {
        lessonsCount++;
        lastLessonDate = new Date(currentDate);
    }

    // Iterate until all lessons are accounted for
    while (lessonsCount < totalLessons) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (targetDays.includes(currentDate.getDay())) {
            lessonsCount++;
            lastLessonDate = new Date(currentDate);
        }
    }

    // Set end date in YYYY-MM-DD format
    const yyyy = lastLessonDate.getFullYear();
    const mm = String(lastLessonDate.getMonth() + 1).padStart(2, '0');
    const dd = String(lastLessonDate.getDate()).padStart(2, '0');
    endDateInput.value = `${yyyy}-${mm}-${dd}`;
}

