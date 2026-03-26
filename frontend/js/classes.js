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
                            <th>Mã lớp</th>
                            <th>Tên lớp</th>
                            <th>Khóa học</th>
                            <th>Giảng viên</th>
                            <th>Phòng</th>
                            <th>Lịch học</th>
                            <th>Bắt đầu</th>
                            <th>Kết thúc</th>
                            <th>SL HV</th>
                            <th>Trạng thái</th>
                            ${hasRole('admin', 'staff') ? '<th>Thao tác</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="classes-table-body">
                        <tr><td colspan="11"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
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
            tbody.innerHTML = '<tr><td colspan="11"><div class="empty-state"><span class="material-icons-outlined">class</span><h3>Chưa có lớp học nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = classes.map(c => `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td>${c.course_name || '-'}</td>
                <td>${c.teacher_name || '<span style="color:var(--warning-500)">Chưa phân công</span>'}</td>
                <td>${c.room || '-'}</td>
                <td style="font-size:0.8rem">${c.schedule || '-'}</td>
                <td>${formatDate(c.start_date)}</td>
                <td>${formatDate(c.end_date)}</td>
                <td>${c.current_students}/${c.max_students}</td>
                <td><span class="badge ${getStatusBadge(c.status)}">${getStatusLabel(c.status)}</span></td>
                ${hasRole('admin', 'staff') ? `
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editClass(${c.id})" title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteClass(${c.id})" title="Xóa">
                            <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                        </button>
                    </div>
                </td>` : hasRole('student') ? `
                <td>
                    <button class="btn btn-sm btn-primary" onclick="enrollInClass(${c.id}, '${c.status}')" ${c.status !== 'upcoming' && c.status !== 'active' ? 'disabled' : ''}>
                        <span class="material-icons-outlined" style="font-size:1rem">how_to_reg</span> Đăng ký
                    </button>
                </td>` : ''}
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('classes-pagination').innerHTML = renderPagination(data, 'loadClasses');
        }
    } catch (error) {
        document.getElementById('classes-table-body').innerHTML =
            '<tr><td colspan="11"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
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

    const courseOptions = courses.map(c =>
        `<option value="${c.id}" ${isEdit && classRoom.course == c.id ? 'selected' : ''}>${c.code} - ${c.name}</option>`
    ).join('');

    const teacherOptions = teachers.map(t =>
        `<option value="${t.id}" ${isEdit && classRoom.teacher == t.id ? 'selected' : ''}>${t.teacher_code} - ${t.user.last_name} ${t.user.first_name}</option>`
    ).join('');

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
                    <select name="course" required><option value="">-- Chọn khóa học --</option>${courseOptions}</select>
                </div>
                <div class="form-group">
                    <label>Giảng viên</label>
                    <select name="teacher"><option value="">-- Chọn GV --</option>${teacherOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Phòng học</label>
                    <input type="text" name="room" value="${isEdit ? (classRoom.room || '') : ''}">
                </div>
                <div class="form-group">
                    <label>Lịch học</label>
                    <input type="text" name="schedule" value="${isEdit ? (classRoom.schedule || '') : ''}" placeholder="VD: T2-T4-T6 8:00-10:00">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ngày bắt đầu *</label>
                    <input type="date" name="start_date" value="${isEdit ? classRoom.start_date : ''}" required>
                </div>
                <div class="form-group">
                    <label>Ngày kết thúc *</label>
                    <input type="date" name="end_date" value="${isEdit ? classRoom.end_date : ''}" required>
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
        const msg = error.data ? JSON.stringify(error.data) : 'Có lỗi xảy ra';
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
    if (status !== 'upcoming' && status !== 'active') {
        showToast('Lớp học này không mở đăng ký', 'error');
        return;
    }

    const confirmed = await showConfirm('Đăng ký lớp học', 'Bạn muốn đăng ký tham gia lớp học này?');
    if (!confirmed) return;

    try {
        await API.post(`${CONFIG.ENDPOINTS.CLASSES}${classId}/enroll/`, {});
        showToast('Đăng ký lớp học thành công! Vui lòng chờ xác nhận/thanh toán.', 'success');
        loadClasses();
    } catch (error) {
        const msg = (error.data && error.data.error) ? error.data.error : 'Không thể đăng ký lớp học này';
        showToast(msg, 'error');
    }
}
