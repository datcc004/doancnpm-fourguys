/**
 * Courses Module - Quản lý khóa học
 */
async function renderCourses(params = null) {
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
                            <th>Số tiết</th>
                            <th>Học phí</th>
                            <th>Lớp mở đăng ký</th>
                            <th>Lớp</th>
                            <th>HV</th>
                            <th>Thao tác</th>
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
    
    // Nếu có tham số tìm kiếm từ Dashboard (ưu tiên params từ ui.js hoặc fallback window)
    const activeParams = params || window.navParams;
    if (activeParams && activeParams.search) {
        const searchInput = document.getElementById('course-search');
        if (searchInput) searchInput.value = activeParams.search;
        window.navParams = null; // Dùng xong xóa ngay
    }

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
                <td>
                    <strong style="cursor:pointer; color:var(--primary-600); text-decoration:underline;" onclick="viewCourseDetails(${c.id})">
                        ${c.code}
                    </strong>
                </td>
                <td>
                    <span style="cursor:pointer; color:var(--primary-600);" onclick="viewCourseDetails(${c.id})">
                        ${c.name}
                    </span>
                </td>
                <td>${CONFIG.LANGUAGE_LABELS[c.language] || c.language}</td>
                <td><span class="badge badge-info">${CONFIG.LEVEL_LABELS[c.level] || c.level}</span></td>
                <td>${c.total_lessons || 0} tiết</td>
                <td>${formatCurrency(c.tuition_fee)}</td>
                <td>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${(c.classrooms || [])
                            .filter(cls => cls.status === 'upcoming')
                            .map(cls => `<span class="badge badge-success" style="cursor: pointer;" onclick="viewCourseDetails(${c.id})" title="Nhấn để xem chi tiết">${cls.code}</span>`)
                            .join('') || '<span class="text-muted" style="font-size: 0.8rem;">Chưa có lớp</span>'}
                    </div>
                </td>
                <td>${c.total_classes || 0}</td>
                <td>${c.total_students || 0}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-info" onclick="viewCourseDetails(${c.id})" title="Xem chi tiết lớp học">
                            <span class="material-icons-outlined" style="font-size:1rem">visibility</span>
                        </button>
                        ${hasRole('admin', 'staff') ? `
                            <button class="btn btn-sm btn-secondary" onclick="editCourse(${c.id})" title="Sửa">
                                <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.id})" title="Xóa">
                                <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                            </button>
                        ` : ''}
                        ${hasRole('student') && !c.is_enrolled ? (
                            (c.classrooms || []).some(cls => cls.status === 'upcoming') ? `
                                <button class="btn btn-sm btn-primary" onclick="enrollCourse(${c.id}, ${c.tuition_fee})" title="Đăng ký khóa học">
                                    <span class="material-icons-outlined" style="font-size:1rem">app_registration</span>
                                    <span style="margin-left:4px">Đăng ký</span>
                                </button>
                            ` : `<span class="text-muted" style="font-size:0.85rem">Chưa mở đăng ký</span>`
                        ) : ''}
                        ${hasRole('student') && c.is_enrolled && !c.is_studying ? `
                            <button class="btn btn-sm" style="background-color: var(--danger-500); color: white;" onclick="cancelEnrollment(${c.id})" title="Hủy đăng ký khóa học">
                                <span class="material-icons-outlined" style="font-size:1rem">cancel</span>
                                <span style="margin-left:4px">Hủy ĐK</span>
                            </button>
                        ` : ''}
                        ${hasRole('student') && c.is_studying ? `
                            <span class="badge" style="background-color: var(--success-100); color: var(--success-700); padding: 6px 10px; display:inline-flex; align-items:center; border:1px solid var(--success-200);">
                                <span class="material-icons-outlined" style="font-size:1rem; margin-right:4px;">check_circle</span>
                                Đang học
                            </span>
                        ` : ''}
                    </div>
                </td>
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
                    <label>Số tiết học</label>
                    <input type="number" name="total_lessons" value="${isEdit ? (course.total_lessons || 24) : 24}" min="1">
                </div>
                <div class="form-group">
                    <label>Số HV tối đa</label>
                    <input type="number" name="max_students" value="${isEdit ? course.max_students : 30}" min="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Học phí (VNĐ) *</label>
                    <input type="number" name="tuition_fee" value="${isEdit ? course.tuition_fee : 0}" min="0" required>
                </div>
            </div>
            <div class="form-group">
                <label>Mô tả</label>
                <textarea name="description">${isEdit ? (course.description || '') : ''}</textarea>
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
    data.is_active = true;

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

async function enrollCourse(courseId, tuitionFee) {
    const depositAmount = tuitionFee * 0.3;
    
    const html = `
        <div style="text-align:center; padding: 20px;">
            <p style="margin-bottom:20px; font-size:1.05rem">Vui lòng chọn hình thức thanh toán để hoàn tất ghi danh:</p>
            <div style="display:flex; justify-content:center; gap:20px; margin-bottom:20px;">
                <button class="btn btn-outline-primary" style="padding:20px; flex:1; height:auto; display:flex; flex-direction:column; align-items:center;" onclick="submitEnrollCourse(${courseId}, ${depositAmount})">
                    <span class="material-icons-outlined" style="font-size:2.5rem; margin-bottom:10px">payments</span>
                    <strong style="font-size:1.1rem; margin-bottom:5px">Đặt cọc 30%</strong>
                    <span style="font-size:1rem; color:var(--text-secondary)">${formatCurrency(depositAmount)}</span>
                </button>
                <button class="btn btn-primary" style="padding:20px; flex:1; height:auto; display:flex; flex-direction:column; align-items:center;" onclick="submitEnrollCourse(${courseId}, ${tuitionFee})">
                    <span class="material-icons-outlined" style="font-size:2.5rem; margin-bottom:10px">task_alt</span>
                    <strong style="font-size:1.1rem; margin-bottom:5px">Thanh toán toàn bộ</strong>
                    <span style="font-size:1rem; color:rgba(255,255,255,0.9)">${formatCurrency(tuitionFee)}</span>
                </button>
            </div>
            <p style="color:var(--text-muted); font-size:0.85rem">* Yêu cầu thanh toán tối thiểu 30% học phí mới có thể ghi danh vào hệ thống.</p>
        </div>
    `;
    openModal('Thanh toán Đăng ký Khóa học', html);
}

async function submitEnrollCourse(courseId, amount) {
    const html = `
        <div class="payment-gateway page-enter">
            <div style="text-align:center;margin-bottom:20px">
                <p class="text-secondary">Số tiền cần thanh toán:</p>
                <h2 style="color:var(--primary-600);font-size:2rem">${formatCurrency(amount)}</h2>
            </div>
            
            <div class="form-group">
                <label>Chọn phương thức thanh toán</label>
                <div class="payment-methods-grid">
                    <div class="payment-method-card active" onclick="selectCoursePayMethod(this, 'transfer', ${courseId})">
                        <span class="material-icons-outlined">account_balance</span>
                        <p>Chuyển khoản</p>
                    </div>
                    <div class="payment-method-card" onclick="selectCoursePayMethod(this, 'card', ${courseId})">
                        <span class="material-icons-outlined">credit_card</span>
                        <p>Thẻ ATM/Visa</p>
                    </div>
                </div>
            </div>

            <div id="course-payment-details" style="margin-top:20px;padding:15px;background:var(--gray-50);border-radius:var(--radius-md);border:1px dashed var(--border-color)">
                <div style="text-align:center">
                    <p style="font-weight:600;margin-bottom:10px">Quét mã QR để thanh toán</p>
                    <div style="width:200px;height:200px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md);overflow:hidden">
                        <img src="qr_payment.jpg" alt="QR Payment" style="width:100%;height:100%;object-fit:contain">
                    </div>
                    <p class="text-muted" style="font-size:0.85rem">Nội dung: <strong>DANGKY KH ${courseId}</strong></p>
                </div>
            </div>

            <button class="btn btn-primary btn-full" style="margin-top:20px" onclick="finalizeEnrollCourse(${courseId}, ${amount})">Tôi đã thanh toán</button>
            <button class="btn btn-outline-secondary btn-full" style="margin-top:10px" onclick="closeModal()">Hủy thanh toán</button>
        </div>
    `;
    openModal('Thanh toán Đăng ký', html);
}

function selectCoursePayMethod(el, method, courseId) {
    document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const details = document.getElementById('course-payment-details');
    if (method === 'card') {
        details.innerHTML = `
            <div class="form-group">
                <label>Số thẻ</label>
                <input type="text" placeholder="**** **** **** ****" class="search-input" style="width:100%">
            </div>
            <div class="form-row" style="margin-top:10px">
                <div class="form-group">
                    <label>Ngày hết hạn</label>
                    <input type="text" placeholder="MM/YY" class="search-input" style="width:100%">
                </div>
                <div class="form-group">
                    <label>CVV</label>
                    <input type="password" placeholder="***" class="search-input" style="width:100%">
                </div>
            </div>
        `;
    } else {
        details.innerHTML = `
            <div style="text-align:center">
                <p style="font-weight:600;margin-bottom:10px">Quét mã QR để thanh toán</p>
                <div style="width:200px;height:200px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md);overflow:hidden">
                    <img src="qr_payment.jpg" alt="QR Payment" style="width:100%;height:100%;object-fit:contain">
                </div>
                <p class="text-muted" style="font-size:0.85rem">Nội dung: <strong>DANGKY KH ${courseId}</strong></p>
            </div>
        `;
    }
}

async function finalizeEnrollCourse(courseId, amount) {
    try {
        await API.post(`${CONFIG.ENDPOINTS.ENROLLMENTS}`, {
            course: courseId,
            deposit_amount: amount
        });
        closeModal();
        showToast('Đăng ký và xác nhận chuyển khoản thành công! Vui lòng chờ trung tâm sắp xếp lớp.', 'success');
        loadCourses();
    } catch (e) {
        const errorMsg = e.data?.error || e.data?.detail || (e.data ? JSON.stringify(e.data) : 'Đăng ký thất bại');
        showToast(errorMsg, 'error');
    }
}

async function cancelEnrollment(courseId) {
    const confirmed = await showConfirm('Hủy đăng ký', 'Bạn có chắc chắn muốn hủy đăng ký khóa học này không?');
    if (!confirmed) return;
    
    try {
        await API.post(`${CONFIG.ENDPOINTS.COURSES}${courseId}/cancel_enrollment/`);
        showToast('Đã hủy đăng ký khóa học thành công.', 'success');
        loadCourses();
    } catch (e) {
        const errorMsg = e.data?.error || e.data?.detail || (e.data ? JSON.stringify(e.data) : 'Hủy đăng ký thất bại');
        showToast(errorMsg, 'error');
    }
}

async function viewCourseDetails(id) {
    try {
        const course = await API.get(`${CONFIG.ENDPOINTS.COURSES}${id}/`);
        const classes = course.classrooms || []; // API trả về classrooms kèm theo

        let html = `
            <div class="course-info-header" style="margin-bottom:20px; padding:15px; background:var(--bg-light); border-radius:8px;">
                <p><strong>Mã khóa học:</strong> ${course.code}</p>
                <p><strong>Ngôn ngữ:</strong> ${CONFIG.LANGUAGE_LABELS[course.language] || course.language}</p>
                <p><strong>Học phí:</strong> ${formatCurrency(course.tuition_fee)}</p>
            </div>
            <h4>Danh sách lớp học (${classes.length})</h4>
            <div class="table-wrapper" style="margin-top:10px">
                <table>
                    <thead>
                        <tr>
                            <th>Mã lớp</th>
                            <th>Tên lớp</th>
                            <th>Giảng viên</th>
                            <th>Lịch học</th>
                            <th>Sĩ số</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${classes.length ? classes.map(cls => `
                            <tr>
                                <td><strong>${cls.code}</strong></td>
                                <td>${cls.name}</td>
                                <td>${cls.teacher_name || 'Chưa phân công'}</td>
                                <td>${cls.schedule || '-'}</td>
                                <td>${cls.current_students}/${cls.max_students}</td>
                                <td><span class="badge ${getStatusBadge(cls.status)}">${CONFIG.STATUS_LABELS[cls.status]}</span></td>
                            </tr>
                        `).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px">Chưa có lớp nào được mở cho khóa học này</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;

        openModal(`Chi tiết khóa học: ${course.name}`, html);
    } catch (error) {
        showToast('Không thể tải chi tiết khóa học', 'error');
    }
}
