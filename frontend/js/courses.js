/**
 * Courses Module - Quản lý khóa học
 */
async function renderCourses() {
    const content = document.getElementById('content-area');

    let html = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="course-search" placeholder="Tìm khóa học..." onkeyup="searchCourses()">
                </div>
                <select class="filter-select" id="course-lang-filter" onchange="loadCourses()">
                    <option value="">Tất cả ngôn ngữ</option>
                    <option value="english">Tiếng Anh</option>
                    <option value="japanese">Tiếng Nhật</option>
                    <option value="korean">Tiếng Hàn</option>
                    <option value="chinese">Tiếng Trung</option>
                    <option value="french">Tiếng Pháp</option>
                </select>
            </div>
            ${hasRole('admin', 'staff') ? `
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openCourseModal()">
                    <span class="material-icons-outlined">add_circle</span>
                    <span>Thêm khóa học</span>
                </button>
            </div>` : ''}
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Mã KH</th>
                            <th>Tên khóa học</th>
                            <th>Ngôn ngữ</th>
                            <th>Trình độ</th>
                            <th>Thời lượng</th>
                            <th>Học phí</th>
                            <th>Lớp</th>
                            <th>HV</th>
                            <th>Trạng thái</th>
                            ${hasRole('admin', 'staff') ? '<th>Thao tác</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="courses-table-body">
                        <tr><td colspan="10"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="courses-pagination"></div>
        </div>
    </div>`;

    content.innerHTML = html;
    loadCourses();
}

async function loadCourses(page = 1) {
    try {
        const search = document.getElementById('course-search')?.value || '';
        const language = document.getElementById('course-lang-filter')?.value || '';
        const params = { page, search };
        if (language) params.language = language;

        const data = await API.get(CONFIG.ENDPOINTS.COURSES, params);
        const courses = data.results || data;
        const tbody = document.getElementById('courses-table-body');

        if (!courses.length) {
            tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-outlined">menu_book</span><h3>Chưa có khóa học nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = courses.map(c => `
            <tr>
                <td><strong>${c.code}</strong></td>
                <td>${c.name}</td>
                <td>${CONFIG.LANGUAGE_LABELS[c.language] || c.language}</td>
                <td><span class="badge badge-info">${CONFIG.LEVEL_LABELS[c.level] || c.level}</span></td>
                <td>${c.duration_weeks} tuần (${c.total_hours}h)</td>
                <td>${formatCurrency(c.tuition_fee)}</td>
                <td>${c.total_classes || 0}</td>
                <td>${c.total_students || 0}</td>
                <td>
                    <span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">
                        ${c.is_active ? 'Đang mở' : 'Đã đóng'}
                    </span>
                </td>
                ${hasRole('admin', 'staff') ? `
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editCourse(${c.id})" title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.id})" title="Xóa">
                            <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                        </button>
                    </div>
                </td>` : ''}
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('courses-pagination').innerHTML = renderPagination(data, 'loadCourses');
        }
    } catch (error) {
        document.getElementById('courses-table-body').innerHTML =
            '<tr><td colspan="10"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

function searchCourses() {
    clearTimeout(window._courseSearchTimeout);
    window._courseSearchTimeout = setTimeout(() => loadCourses(), 400);
}

function openCourseModal(course = null) {
    const isEdit = !!course;
    const title = isEdit ? 'Sửa khóa học' : 'Thêm khóa học mới';

    const langOptions = Object.entries(CONFIG.LANGUAGE_LABELS).map(([k, v]) =>
        `<option value="${k}" ${isEdit && course.language === k ? 'selected' : ''}>${v}</option>`
    ).join('');

    const levelOptions = Object.entries(CONFIG.LEVEL_LABELS).map(([k, v]) =>
        `<option value="${k}" ${isEdit && course.level === k ? 'selected' : ''}>${v}</option>`
    ).join('');

    const html = `
        <form onsubmit="return saveCourse(event, ${isEdit ? course.id : 'null'})">
            <div class="form-row">
                <div class="form-group">
                    <label>Mã khóa học *</label>
                    <input type="text" name="code" value="${isEdit ? course.code : ''}" required ${isEdit ? 'readonly' : ''}>
                </div>
                <div class="form-group">
                    <label>Tên khóa học *</label>
                    <input type="text" name="name" value="${isEdit ? course.name : ''}" required>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ngôn ngữ *</label>
                    <select name="language" required>${langOptions}</select>
                </div>
                <div class="form-group">
                    <label>Trình độ *</label>
                    <select name="level" required>${levelOptions}</select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Thời lượng (tuần)</label>
                    <input type="number" name="duration_weeks" value="${isEdit ? course.duration_weeks : 12}" min="1">
                </div>
                <div class="form-group">
                    <label>Tổng số giờ</label>
                    <input type="number" name="total_hours" value="${isEdit ? course.total_hours : 36}" min="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Học phí (VNĐ) *</label>
                    <input type="number" name="tuition_fee" value="${isEdit ? course.tuition_fee : 0}" min="0" required>
                </div>
                <div class="form-group">
                    <label>Số HV tối đa</label>
                    <input type="number" name="max_students" value="${isEdit ? course.max_students : 30}" min="1">
                </div>
            </div>
            <div class="form-group">
                <label>Mô tả</label>
                <textarea name="description">${isEdit ? (course.description || '') : ''}</textarea>
            </div>
            <div class="form-group" style="display:flex; align-items:center; gap:8px; margin-top:8px;">
                <input type="checkbox" name="is_active" id="course-active-cb" ${isEdit ? (course.is_active ? 'checked' : '') : 'checked'} style="width:auto;">
                <label for="course-active-cb" style="margin-bottom:0; cursor:pointer;">Đang mở đăng ký</label>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Thêm khóa học'}</button>
        </form>
    `;

    openModal(title, html);
}

async function saveCourse(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    data.is_active = form.querySelector('[name="is_active"]').checked;

    try {
        if (id) {
            await API.put(`${CONFIG.ENDPOINTS.COURSES}${id}/`, data);
            showToast('Cập nhật khóa học thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.COURSES, data);
            showToast('Thêm khóa học thành công', 'success');
        }
        closeModal();
        loadCourses();
    } catch (error) {
        const msg = error.data ? JSON.stringify(error.data) : 'Có lỗi xảy ra';
        showToast(msg, 'error');
    }
    return false;
}

async function editCourse(id) {
    try {
        const course = await API.get(`${CONFIG.ENDPOINTS.COURSES}${id}/`);
        openCourseModal(course);
    } catch (error) {
        showToast('Không thể tải thông tin khóa học', 'error');
    }
}

async function deleteCourse(id) {
    const confirmed = await showConfirm('Xóa khóa học', 'Bạn có chắc muốn xóa khóa học này?');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.COURSES}${id}/`);
        showToast('Đã xóa khóa học', 'success');
        loadCourses();
    } catch (error) {
        showToast('Lỗi khi xóa', 'error');
    }
}
