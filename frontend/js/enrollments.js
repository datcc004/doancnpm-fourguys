/**
 * Enrollments Module - Đăng ký lớp học
 */
async function renderEnrollments() {
    const content = document.getElementById('content-area');

    let html = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="enrollment-search" placeholder="Tìm đăng ký..." onkeyup="searchEnrollments()">
                </div>
                <select class="filter-select" id="enrollment-status-filter" onchange="loadEnrollments()">
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Đang học</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="dropped">Đã nghỉ</option>
                    <option value="suspended">Tạm nghỉ</option>
                </select>
            </div>
            ${hasRole('admin', 'staff') ? `
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openEnrollmentModal()">
                    <span class="material-icons-outlined">how_to_reg</span>
                    <span>Đăng ký mới</span>
                </button>
            </div>` : ''}
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Học viên</th>
                            <th>Lớp học</th>
                            <th>Khóa học</th>
                            <th>Ngày ĐK</th>
                            <th>Trạng thái</th>
                            <th>Điểm</th>
                            ${hasRole('admin', 'staff') ? '<th>Thao tác</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="enrollments-table-body">
                        <tr><td colspan="8"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="enrollments-pagination"></div>
        </div>
    </div>`;

    content.innerHTML = html;
    loadEnrollments();
}

async function loadEnrollments(page = 1) {
    try {
        const status = document.getElementById('enrollment-status-filter')?.value || '';
        const params = { page };
        if (status) params.status = status;

        const data = await API.get(CONFIG.ENDPOINTS.ENROLLMENTS, params);
        const enrollments = data.results || data;
        const tbody = document.getElementById('enrollments-table-body');

        if (!enrollments.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><span class="material-icons-outlined">how_to_reg</span><h3>Chưa có đăng ký nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = enrollments.map(e => `
            <tr>
                <td>#${e.id}</td>
                <td>${e.student_name}</td>
                <td>${e.classroom_name || '-'}</td>
                <td>${e.course_name || '-'}</td>
                <td>${formatDate(e.enrollment_date)}</td>
                <td><span class="badge ${getStatusBadge(e.status)}">${getStatusLabel(e.status)}</span></td>
                <td>${e.final_grade || '-'}</td>
                ${hasRole('admin', 'staff') ? `
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editEnrollment(${e.id})" title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteEnrollment(${e.id})" title="Xóa">
                            <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                        </button>
                    </div>
                </td>` : ''}
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('enrollments-pagination').innerHTML = renderPagination(data, 'loadEnrollments');
        }
    } catch (error) {
        document.getElementById('enrollments-table-body').innerHTML =
            '<tr><td colspan="8"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

function searchEnrollments() {
    clearTimeout(window._enrollmentSearchTimeout);
    window._enrollmentSearchTimeout = setTimeout(() => loadEnrollments(), 400);
}

async function openEnrollmentModal(enrollment = null) {
    const isEdit = !!enrollment;
    const title = isEdit ? 'Sửa đăng ký' : 'Đăng ký mới';

    let students = [], classes = [];
    try {
        const [studentsData, classesData] = await Promise.all([
            API.get(CONFIG.ENDPOINTS.STUDENTS, { page_size: 200 }),
            API.get(CONFIG.ENDPOINTS.CLASSES, { status: 'active', page_size: 100 })
        ]);
        students = studentsData.results || studentsData;
        classes = classesData.results || classesData;
    } catch (e) {}

    const studentOptions = students.map(s =>
        `<option value="${s.id}" ${isEdit && enrollment.student == s.id ? 'selected' : ''}>${s.student_code} - ${s.user.last_name} ${s.user.first_name}</option>`
    ).join('');

    const classOptions = classes.map(c =>
        `<option value="${c.id}" ${isEdit && enrollment.classroom == c.id ? 'selected' : ''}>${c.code} - ${c.name} (${c.current_students}/${c.max_students})</option>`
    ).join('');

    const html = `
        <form onsubmit="return saveEnrollment(event, ${isEdit ? enrollment.id : 'null'})">
            <div class="form-group">
                <label>Học viên *</label>
                <select name="student" required ${isEdit ? 'disabled' : ''}>
                    <option value="">-- Chọn học viên --</option>
                    ${studentOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Lớp học *</label>
                <select name="classroom" required ${isEdit ? 'disabled' : ''}>
                    <option value="">-- Chọn lớp --</option>
                    ${classOptions}
                </select>
            </div>
            ${isEdit ? `
            <div class="form-row">
                <div class="form-group">
                    <label>Trạng thái</label>
                    <select name="status">
                        <option value="active" ${enrollment.status === 'active' ? 'selected' : ''}>Đang học</option>
                        <option value="completed" ${enrollment.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                        <option value="dropped" ${enrollment.status === 'dropped' ? 'selected' : ''}>Đã nghỉ</option>
                        <option value="suspended" ${enrollment.status === 'suspended' ? 'selected' : ''}>Tạm nghỉ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Điểm cuối kỳ</label>
                    <input type="number" name="final_grade" value="${enrollment.final_grade || ''}" step="0.1" min="0" max="10">
                </div>
            </div>` : ''}
            <div class="form-group">
                <label>Ghi chú</label>
                <textarea name="notes">${isEdit ? (enrollment.notes || '') : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Đăng ký'}</button>
        </form>
    `;

    openModal(title, html);
}

async function saveEnrollment(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
        if (id) {
            await API.patch(`${CONFIG.ENDPOINTS.ENROLLMENTS}${id}/`, data);
            showToast('Cập nhật thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.ENROLLMENTS, data);
            showToast('Đăng ký thành công', 'success');
        }
        closeModal();
        loadEnrollments();
    } catch (error) {
        const msg = error.data ? JSON.stringify(error.data) : 'Có lỗi xảy ra';
        showToast(msg, 'error');
    }
    return false;
}

async function editEnrollment(id) {
    try {
        const enrollment = await API.get(`${CONFIG.ENDPOINTS.ENROLLMENTS}${id}/`);
        openEnrollmentModal(enrollment);
    } catch (error) {
        showToast('Lỗi tải dữ liệu', 'error');
    }
}

async function deleteEnrollment(id) {
    const confirmed = await showConfirm('Hủy đăng ký', 'Bạn có chắc muốn hủy đăng ký này?');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.ENROLLMENTS}${id}/`);
        showToast('Đã hủy đăng ký', 'success');
        loadEnrollments();
    } catch (error) {
        showToast('Lỗi khi hủy', 'error');
    }
}
