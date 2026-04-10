/**
 * Students Module - Quản lý học viên
 */
async function renderStudents() {
    const content = document.getElementById('content-area');

    let html = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="student-search" placeholder="Tìm học viên..." onkeyup="searchStudents()">
                </div>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openStudentModal()">
                    <span class="material-icons-outlined">person_add</span>
                    <span>Thêm học viên</span>
                </button>
            </div>
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Mã HV</th>
                            <th>Tài khoản</th>
                            <th>Họ tên</th>
                            <th>Email</th>
                            <th>SĐT</th>
                            <th>Trình độ</th>
                            <th>Ngày ĐK</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="students-table-body">
                        <tr><td colspan="8"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="students-pagination"></div>
        </div>
    </div>`;

    content.innerHTML = html;
    loadStudents();
}

async function loadStudents(page = 1) {
    try {
        const search = document.getElementById('student-search')?.value || '';
        const data = await API.get(CONFIG.ENDPOINTS.STUDENTS, { page, search });
        const students = data.results || data;
        const tbody = document.getElementById('students-table-body');

        if (!students.length) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><span class="material-icons-outlined">school</span><h3>Chưa có học viên nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = students.map(s => `
            <tr>
                <td><strong>${s.student_code}</strong></td>
                <td><code style="background:var(--bg-secondary);padding:2px 8px;border-radius:4px;font-size:0.85rem">${s.user.username}</code></td>
                <td>${s.user.last_name} ${s.user.first_name}</td>
                <td>${s.user.email || '-'}</td>
                <td>${s.user.phone || '-'}</td>
                <td><span class="badge badge-info">${s.level || '-'}</span></td>
                <td>${formatDate(s.enrollment_date)}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editStudent(${s.id})" title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteStudent(${s.id})" title="Xóa">
                            <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('students-pagination').innerHTML = renderPagination(data, 'loadStudents');
        }
    } catch (error) {
        document.getElementById('students-table-body').innerHTML =
            '<tr><td colspan="8"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

function searchStudents() {
    clearTimeout(window._studentSearchTimeout);
    window._studentSearchTimeout = setTimeout(() => loadStudents(), 400);
}

function openStudentModal(student = null) {
    const isEdit = !!student;
    const title = isEdit ? 'Sửa thông tin học viên' : 'Thêm học viên mới';

    const html = `
        <form id="student-form" onsubmit="return saveStudent(event, ${isEdit ? student.id : 'null'})">
            <div class="form-row">
                <div class="form-group">
                    <label>Mã học viên *</label>
                    <input type="text" name="student_code" value="${isEdit ? student.student_code : ''}" required ${isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Trình độ</label>
                    <select name="level">
                        <option value="">-- Chọn --</option>
                        <option value="Sơ cấp" ${isEdit && student.level === 'Sơ cấp' ? 'selected' : ''}>Sơ cấp</option>
                        <option value="Cơ bản" ${isEdit && student.level === 'Cơ bản' ? 'selected' : ''}>Cơ bản</option>
                        <option value="Trung cấp" ${isEdit && student.level === 'Trung cấp' ? 'selected' : ''}>Trung cấp</option>
                        <option value="Cao cấp" ${isEdit && student.level === 'Cao cấp' ? 'selected' : ''}>Cao cấp</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Họ *</label>
                    <input type="text" name="last_name" value="${isEdit ? student.user.last_name : ''}" required>
                </div>
                <div class="form-group">
                    <label>Tên *</label>
                    <input type="text" name="first_name" value="${isEdit ? student.user.first_name : ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Email *</label>
                    <input type="email" name="email" value="${isEdit ? student.user.email : ''}" required>
                </div>
                <div class="form-group">
                    <label>Số điện thoại</label>
                    <input type="text" name="phone" value="${isEdit ? (student.user.phone || '') : ''}">
                </div>
            </div>
            ${isEdit ? `
            <div class="form-row">
                <div class="form-group" style="width: 100%;">
                    <label>Mật khẩu mới <span style="font-weight:normal; font-size: 0.8rem; color: var(--text-muted)">(Bỏ trống nếu không đổi)</span></label>
                    <div style="position:relative">
                        <input type="password" name="password" id="student-password-edit" placeholder="Nhập mật khẩu mới tại đây" minlength="6">
                        <span class="material-icons-outlined" onclick="togglePasswordVisibility('student-password-edit')" 
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
                        <input type="password" name="password" id="student-password-new" required minlength="6">
                        <span class="material-icons-outlined" onclick="togglePasswordVisibility('student-password-new')" 
                              style="position:absolute; right:10px; top:50%; transform:translateY(-50%); cursor:pointer; color:var(--text-muted); font-size:1.2rem">visibility</span>
                    </div>
                </div>
            </div>`}
            <div class="form-group">
                <label>Địa chỉ</label>
                <input type="text" name="address" value="${isEdit ? (student.user.address || '') : ''}">
            </div>
            <div class="form-group">
                <label>Ngày sinh</label>
                <input type="date" name="date_of_birth" value="${isEdit ? (student.user.date_of_birth || '') : ''}">
            </div>
            <div class="form-group">
                <label>Ghi chú</label>
                <textarea name="notes">${isEdit ? (student.notes || '') : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Thêm học viên'}</button>
        </form>
    `;

    openModal(title, html);
}

async function saveStudent(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
        if (id) {
            await API.put(`${CONFIG.ENDPOINTS.STUDENTS}${id}/`, data);
            showToast('Cập nhật học viên thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.STUDENTS, data);
            showToast('Thêm học viên thành công', 'success');
        }
        closeModal();
        loadStudents();
    } catch (error) {
        const msg = error.data ? JSON.stringify(error.data) : 'Có lỗi xảy ra';
        showToast(msg, 'error');
    }
    return false;
}

async function editStudent(id) {
    try {
        const student = await API.get(`${CONFIG.ENDPOINTS.STUDENTS}${id}/`);
        openStudentModal(student);
    } catch (error) {
        showToast('Không thể tải thông tin học viên', 'error');
    }
}

async function deleteStudent(id) {
    const confirmed = await showConfirm('Xóa học viên', 'Bạn có chắc muốn xóa học viên này?');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.STUDENTS}${id}/`);
        showToast('Đã xóa học viên', 'success');
        loadStudents();
    } catch (error) {
        showToast('Lỗi khi xóa', 'error');
    }
}
