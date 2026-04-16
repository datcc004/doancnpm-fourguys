/**
 * Enrollments Module - Đăng ký ghi danh
 * 
 * Nghiệp vụ: Đăng ký ghi danh → Nộp tiền (đặt cọc) → Admin duyệt
 * 
 * Trạng thái:
 * - payment_status: unpaid → deposited → paid
 * - approval_status: pending → approved / rejected
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
                <select class="filter-select" id="enrollment-payment-filter" onchange="loadEnrollments()">
                    <option value="">Tất cả TT thanh toán</option>
                    <option value="unpaid">Chưa thanh toán</option>
                    <option value="deposited">Đã đặt cọc</option>
                    <option value="paid">Đã thanh toán đủ</option>
                </select>
                <select class="filter-select" id="enrollment-approval-filter" onchange="loadEnrollments()">
                    <option value="">Tất cả TT duyệt</option>
                    <option value="pending">Chờ duyệt</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="rejected">Từ chối</option>
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
                            <th>Đặt cọc</th>
                            <th>Thanh toán</th>
                            <th>Duyệt</th>
                            <th>Trạng thái</th>
                            ${hasRole('admin', 'staff') ? '<th>Thao tác</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="enrollments-table-body">
                        <tr><td colspan="10"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
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
        const statusFilter = document.getElementById('enrollment-status-filter')?.value || '';
        const paymentFilter = document.getElementById('enrollment-payment-filter')?.value || '';
        const approvalFilter = document.getElementById('enrollment-approval-filter')?.value || '';
        const params = { page };
        if (statusFilter) params.status = statusFilter;
        if (paymentFilter) params.payment_status = paymentFilter;
        if (approvalFilter) params.approval_status = approvalFilter;

        const data = await API.get(CONFIG.ENDPOINTS.ENROLLMENTS, params);
        const enrollments = data.results || data;
        const tbody = document.getElementById('enrollments-table-body');

        if (!enrollments.length) {
            tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-outlined">how_to_reg</span><h3>Chưa có đăng ký nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = enrollments.map(e => `
            <tr>
                <td>#${e.id}</td>
                <td>${e.student_name}</td>
                <td>${e.classroom_name ? e.classroom_code + ' - ' + e.classroom_name : '<span class="text-muted"><i>Chưa xếp lớp</i></span>'}</td>
                <td>${e.course_name || '-'}</td>
                <td>${formatDate(e.enrollment_date)}</td>
                <td style="font-weight:600">${e.deposit_amount ? formatCurrency(e.deposit_amount) : '-'}</td>
                <td><span class="badge ${getStatusBadge(e.payment_status)}">${getStatusLabel(e.payment_status) || e.payment_status_display}</span></td>
                <td><span class="badge ${getStatusBadge(e.approval_status)}">${getStatusLabel(e.approval_status) || e.approval_status_display}</span></td>
                <td><span class="badge ${getStatusBadge(e.status)}">${getStatusLabel(e.status)}</span></td>
                ${hasRole('admin', 'staff') ? `
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-secondary" onclick="editEnrollment(${e.id})" title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        ${e.approval_status === 'pending' ? `
                        <button class="btn btn-sm btn-success" onclick="approveEnrollment(${e.id})" title="Duyệt">
                            <span class="material-icons-outlined" style="font-size:1rem">check_circle</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="rejectEnrollment(${e.id})" title="Từ chối">
                            <span class="material-icons-outlined" style="font-size:1rem">cancel</span>
                        </button>` : ''}
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
        console.error("Enrollment load error:", error);
        document.getElementById('enrollments-table-body').innerHTML =
            `<tr><td colspan="10"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu: ${error.message || JSON.stringify(error)}</p></td></tr>`;
    }
}

function searchEnrollments() {
    clearTimeout(window._enrollmentSearchTimeout);
    window._enrollmentSearchTimeout = setTimeout(() => loadEnrollments(), 400);
}

async function openEnrollmentModal(enrollment = null) {
    const isEdit = !!enrollment;
    const title = isEdit ? 'Sửa đăng ký' : 'Đăng ký mới';

    let students = [], courses = [], classes = [];
    try {
        const [studentsData, coursesData, allClassesData] = await Promise.all([
            API.get(CONFIG.ENDPOINTS.STUDENTS, { page_size: 200 }),
            API.get(CONFIG.ENDPOINTS.COURSES, { page_size: 200 }),
            API.get(CONFIG.ENDPOINTS.CLASSES, { status: 'active', page_size: 200 })
        ]);
        students = studentsData.results || studentsData;
        courses = coursesData.results || coursesData;
        classes = allClassesData.results || allClassesData;
        
        // Nếu đang sửa, chỉ hiện các lớp thuộc khóa học đó
        if (isEdit && enrollment.course) {
            classes = classes.filter(c => c.course == enrollment.course || c.course?.id == enrollment.course);
        }
    } catch (e) {}

    const studentOptions = students.map(s =>
        `<option value="${s.id}" ${isEdit && enrollment.student == s.id ? 'selected' : ''}>${s.student_code} - ${s.user.last_name} ${s.user.first_name}</option>`
    ).join('');

    const courseOptions = courses.map(c =>
        `<option value="${c.id}" ${isEdit && enrollment.course == c.id ? 'selected' : ''}>${c.name} (${c.code})</option>`
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
                <label>Khóa học *</label>
                <select name="course" required ${isEdit ? 'disabled' : ''}>
                    <option value="">-- Chọn khóa học --</option>
                    ${courseOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Lớp học (Staff chia lớp)</label>
                <select name="classroom">
                    <option value="">-- Chưa xếp lớp --</option>
                    ${classOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Số tiền đặt cọc (Bắt buộc tối thiểu 30% học phí) *</label>
                <input type="number" name="deposit_amount" value="${isEdit ? (enrollment.deposit_amount || 0) : 0}" step="1000" min="0" required placeholder="VD: 500000">
            </div>
            ${isEdit ? `
            <div class="form-row">
                <div class="form-group">
                    <label>Trạng thái học</label>
                    <select name="status">
                        <option value="active" ${enrollment.status === 'active' ? 'selected' : ''}>Đang học</option>
                        <option value="completed" ${enrollment.status === 'completed' ? 'selected' : ''}>Hoàn thành</option>
                        <option value="dropped" ${enrollment.status === 'dropped' ? 'selected' : ''}>Đã nghỉ</option>
                        <option value="suspended" ${enrollment.status === 'suspended' ? 'selected' : ''}>Tạm nghỉ</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Trạng thái thanh toán</label>
                    <select name="payment_status">
                        <option value="unpaid" ${enrollment.payment_status === 'unpaid' ? 'selected' : ''}>Chưa thanh toán</option>
                        <option value="deposited" ${enrollment.payment_status === 'deposited' ? 'selected' : ''}>Đã đặt cọc</option>
                        <option value="paid" ${enrollment.payment_status === 'paid' ? 'selected' : ''}>Đã thanh toán đủ</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Trạng thái duyệt</label>
                    <select name="approval_status">
                        <option value="pending" ${enrollment.approval_status === 'pending' ? 'selected' : ''}>Chờ duyệt</option>
                        <option value="approved" ${enrollment.approval_status === 'approved' ? 'selected' : ''}>Đã duyệt</option>
                        <option value="rejected" ${enrollment.approval_status === 'rejected' ? 'selected' : ''}>Từ chối</option>
                    </select>
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
        const msg = (error.data && error.data.error) || 'Lỗi khi hủy';
        showToast(msg, 'error');
    }
}

async function approveEnrollment(id) {
    const confirmed = await showConfirm('Duyệt đăng ký', 'Xác nhận duyệt đăng ký này?');
    if (!confirmed) return;

    try {
        await API.post(`${CONFIG.ENDPOINTS.ENROLLMENTS}${id}/approve/`);
        showToast('Đã duyệt đăng ký', 'success');
        loadEnrollments();
    } catch (error) {
        showToast('Lỗi khi duyệt', 'error');
    }
}

async function rejectEnrollment(id) {
    const confirmed = await showConfirm('Từ chối đăng ký', 'Xác nhận từ chối đăng ký này?');
    if (!confirmed) return;

    try {
        await API.post(`${CONFIG.ENDPOINTS.ENROLLMENTS}${id}/reject/`);
        showToast('Đã từ chối đăng ký', 'success');
        loadEnrollments();
    } catch (error) {
        showToast('Lỗi khi từ chối', 'error');
    }
}

function formatCurrency(amount) {
    if (!amount) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}
