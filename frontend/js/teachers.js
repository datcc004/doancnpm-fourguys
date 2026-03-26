/**
 * Teachers Module - Quản lý giảng viên
 */
async function renderTeachers() {
    const content = document.getElementById('content-area');

    let html = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="teacher-search" placeholder="Tìm giảng viên..." onkeyup="searchTeachers()">
                </div>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openTeacherModal()">
                    <span class="material-icons-outlined">person_add</span>
                    <span>Thêm giảng viên</span>
                </button>
            </div>
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Mã GV</th>
                            <th>Họ tên</th>
                            <th>Email</th>
                            <th>Chuyên môn</th>
                            <th>Bằng cấp</th>
                            <th>Kinh nghiệm</th>
                            <th>Lương/giờ</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="teachers-table-body">
                        <tr><td colspan="8"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="teachers-pagination"></div>
        </div>
    </div>`;

    content.innerHTML = html;
    loadTeachers();
}

async function loadTeachers(page = 1) {
    try {
        const search = document.getElementById('teacher-search')?.value || '';
        const data = await API.get(CONFIG.ENDPOINTS.TEACHERS, { page, search });
        const teachers = data.results || data;
        const tbody = document.getElementById('teachers-table-body');

        if (!teachers.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><span class="material-icons-outlined">person</span><h3>Chưa có giảng viên nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = teachers.map(t => `
            <tr>
                <td><strong>${t.teacher_code}</strong></td>
                <td>${t.user.last_name} ${t.user.first_name}</td>
                <td>${t.user.email || '-'}</td>
                <td><span class="badge badge-primary">${t.specialization || '-'}</span></td>
                <td>${t.qualification || '-'}</td>
                <td>${t.experience_years} năm</td>
                <td>${formatCurrency(t.hourly_rate)}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editTeacher(${t.id})" title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTeacher(${t.id})" title="Xóa">
                            <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('teachers-pagination').innerHTML = renderPagination(data, 'loadTeachers');
        }
    } catch (error) {
        document.getElementById('teachers-table-body').innerHTML =
            '<tr><td colspan="8"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

function searchTeachers() {
    clearTimeout(window._teacherSearchTimeout);
    window._teacherSearchTimeout = setTimeout(() => loadTeachers(), 400);
}

function openTeacherModal(teacher = null) {
    const isEdit = !!teacher;
    const title = isEdit ? 'Sửa thông tin giảng viên' : 'Thêm giảng viên mới';

    const html = `
        <form id="teacher-form" onsubmit="return saveTeacher(event, ${isEdit ? teacher.id : 'null'})">
            <div class="form-row">
                <div class="form-group">
                    <label>Mã giảng viên *</label>
                    <input type="text" name="teacher_code" value="${isEdit ? teacher.teacher_code : ''}" required ${isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Chuyên môn</label>
                    <input type="text" name="specialization" value="${isEdit ? (teacher.specialization || '') : ''}" placeholder="VD: IELTS, TOEIC...">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Họ *</label>
                    <input type="text" name="last_name" value="${isEdit ? teacher.user.last_name : ''}" required>
                </div>
                <div class="form-group">
                    <label>Tên *</label>
                    <input type="text" name="first_name" value="${isEdit ? teacher.user.first_name : ''}" required>
                </div>
            </div>
             <div class="form-row">
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value="${isEdit ? teacher.user.email : ''}" required>
                </div>
                <div class="form-group">
                    <label>Số điện thoại</label>
                    <input type="text" name="phone" value="${isEdit ? (teacher.user.phone || '') : ''}">
                </div>
            </div>
            ${isEdit ? `
            <div class="form-row">
                <div class="form-group" style="width: 100%;">
                    <label>Mật khẩu mới <span style="font-weight:normal; font-size: 0.8rem; color: var(--text-muted)">(Bỏ trống nếu không đổi)</span></label>
                    <div style="position:relative">
                        <input type="password" name="password" id="teacher-password-edit" placeholder="Nhập mật khẩu mới tại đây" minlength="6">
                        <span class="material-icons-outlined" onclick="togglePasswordVisibility('teacher-password-edit')" 
                              style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; color:var(--text-muted); font-size:1.2rem">visibility</span>
                    </div>
                </div>
            </div>` : `
            <div class="form-row">
                <div class="form-group">
                    <label>Tên đăng nhập *</label>
                    <input type="text" name="username" required>
                </div>
                <div class="form-group">
                    <label>Mật khẩu *</label>
                    <div style="position:relative">
                        <input type="password" name="password" id="teacher-password-new" required minlength="6">
                        <span class="material-icons-outlined" onclick="togglePasswordVisibility('teacher-password-new')" 
                              style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; color:var(--text-muted); font-size:1.2rem">visibility</span>
                    </div>
                </div>
            </div>`}
            <div class="form-row">
                <div class="form-group">
                    <label>Bằng cấp</label>
                    <input type="text" name="qualification" value="${isEdit ? (teacher.qualification || '') : ''}">
                </div>
                <div class="form-group">
                    <label>Số năm kinh nghiệm</label>
                    <input type="number" name="experience_years" value="${isEdit ? teacher.experience_years : 0}" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Lương/giờ (VNĐ)</label>
                    <input type="number" name="hourly_rate" value="${isEdit ? teacher.hourly_rate : 0}" min="0">
                </div>
                <div class="form-group">
                    <label>Ngày sinh</label>
                    <input type="date" name="date_of_birth" value="${isEdit ? (teacher.user.date_of_birth || '') : ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Giới thiệu</label>
                <textarea name="bio">${isEdit ? (teacher.bio || '') : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Thêm giảng viên'}</button>
        </form>
    `;

    openModal(title, html);
}

async function saveTeacher(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
        if (id) {
            await API.put(`${CONFIG.ENDPOINTS.TEACHERS}${id}/`, data);
            showToast('Cập nhật giảng viên thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.TEACHERS, data);
            showToast('Thêm giảng viên thành công', 'success');
        }
        closeModal();
        loadTeachers();
    } catch (error) {
        const msg = error.data ? JSON.stringify(error.data) : 'Có lỗi xảy ra';
        showToast(msg, 'error');
    }
    return false;
}

async function editTeacher(id) {
    try {
        const teacher = await API.get(`${CONFIG.ENDPOINTS.TEACHERS}${id}/`);
        openTeacherModal(teacher);
    } catch (error) {
        showToast('Không thể tải thông tin giảng viên', 'error');
    }
}

async function deleteTeacher(id) {
    const confirmed = await showConfirm('Xóa giảng viên', 'Bạn có chắc muốn xóa giảng viên này?');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.TEACHERS}${id}/`);
        showToast('Đã xóa giảng viên', 'success');
        loadTeachers();
    } catch (error) {
        showToast('Lỗi khi xóa', 'error');
    }
}
