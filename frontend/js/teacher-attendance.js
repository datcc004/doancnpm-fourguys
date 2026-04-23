/**
 * Chấm công giảng viên — giao diện & gọi API
 */

function todayLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateTimeVN(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        return '—';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function teacherAttErrorMessage(err) {
    const d = err && err.data;
    if (!d) return 'Không thể kết nối server';
    if (typeof d.detail === 'string') return d.detail;
    if (Array.isArray(d.detail) && d.detail.length) return String(d.detail[0]);
    const keys = Object.keys(d);
    if (keys.length) {
        const v = d[keys[0]];
        if (Array.isArray(v)) return String(v[0]);
        if (typeof v === 'string') return v;
    }
    return 'Có lỗi xảy ra';
}

let teacherAttListPage = 1;

async function renderTeacherAttendance() {
    const content = document.getElementById('content-area');
    const canAccess = hasRole('admin', 'staff', 'teacher');
    if (!canAccess) {
        content.innerHTML =
            '<div class="page-enter"><div class="empty-state"><h3>Không có quyền truy cập</h3><p>Chỉ giảng viên hoặc nhân sự được dùng trang này.</p></div></div>';
        return;
    }

    if (hasRole('teacher')) {
        content.innerHTML = `
        <style>
            .tta-grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; align-items: start; }
            .tta-today-inner { padding: 4px 0 8px; }
        </style>
        <div class="page-enter att-page">
            <div class="card" style="margin-bottom:20px">
                <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
                    <h3 style="margin:0;display:flex;align-items:center;gap:8px">
                        <span class="material-icons-outlined">schedule</span>
                        Chấm công hôm nay
                    </h3>
                    <span style="color:var(--text-muted);font-size:0.9rem">${todayLocalISO()}</span>
                </div>
                <div id="tta-today-card" class="tta-today-inner">
                    <div class="loading-spinner"><div class="spinner"></div></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header"><h3>Lịch sử chấm công</h3></div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Ngày</th>
                                <th>Trạng thái</th>
                                <th>Giờ vào</th>
                                <th>Giờ ra</th>
                                <th>Ghi chú</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody id="tta-table-body">
                            <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                        </tbody>
                    </table>
                </div>
                <div id="tta-pagination"></div>
            </div>
        </div>`;
        await refreshTeacherTodayCard();
        loadTeacherAttendanceList(1);
        return;
    }

    // Admin / Staff
    let teachers = [];
    try {
        const t = await API.get(CONFIG.ENDPOINTS.TEACHERS, { page_size: 500 });
        teachers = t.results || t || [];
    } catch (e) {
        console.error(e);
    }

    const teacherOpts = teachers
        .map(
            (x) =>
                `<option value="${x.id}">${x.teacher_code} — ${x.user ? x.user.last_name + ' ' + x.user.first_name : ''}</option>`
        )
        .join('');

    const firstOfMonth = todayLocalISO().slice(0, 8) + '01';

    content.innerHTML = `
    <div class="page-enter att-page">
        <div class="stats-grid stagger-in" style="margin-bottom:16px" id="tta-summary-row">
            <div class="stat-card blue"><div class="stat-info"><h4 id="tta-sum-total">—</h4><p>Tổng bản ghi (lọc)</p></div></div>
        </div>

        <div class="toolbar" style="margin-bottom:16px;flex-wrap:wrap;gap:12px">
            <div class="toolbar-left" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center">
                <select class="filter-select" id="tta-filter-teacher" onchange="loadTeacherAttendanceAdmin(1)">
                    <option value="">Tất cả giảng viên</option>
                    ${teacherOpts}
                </select>
                <select class="filter-select" id="tta-filter-status" onchange="loadTeacherAttendanceAdmin(1)">
                    <option value="">Mọi trạng thái</option>
                    <option value="present">Đúng giờ</option>
                    <option value="late">Đi muộn</option>
                    <option value="absent">Vắng</option>
                    <option value="leave">Nghỉ có phép</option>
                    <option value="leave_unpaid">Nghỉ không phép</option>
                </select>
                <label style="display:flex;align-items:center;gap:6px;font-size:0.9rem;color:var(--text-secondary)">
                    Từ <input type="date" class="filter-select" id="tta-date-from" value="${firstOfMonth}">
                </label>
                <label style="display:flex;align-items:center;gap:6px;font-size:0.9rem;color:var(--text-secondary)">
                    Đến <input type="date" class="filter-select" id="tta-date-to" value="${todayLocalISO()}">
                </label>
                <input type="text" class="search-input" id="tta-search" placeholder="Tìm mã/tên GV..." style="min-width:200px" onkeyup="ttaSearchDebounced()">
            </div>
            <div class="toolbar-right">
                <button type="button" class="btn btn-primary" onclick="openTeacherAttendanceFormModal(null)">
                    <span class="material-icons-outlined">add</span>
                    <span>Thêm bản ghi</span>
                </button>
            </div>
        </div>

        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Giảng viên</th>
                            <th>Ngày</th>
                            <th>Trạng thái</th>
                            <th>Giờ vào</th>
                            <th>Giờ ra</th>
                            <th>Người ghi</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="tta-admin-table-body">
                        <tr><td colspan="7"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="tta-admin-pagination"></div>
        </div>
    </div>`;

    loadTeacherAttendanceAdmin(1);
}

let _ttaSearchTimer = null;
function ttaSearchDebounced() {
    clearTimeout(_ttaSearchTimer);
    _ttaSearchTimer = setTimeout(() => loadTeacherAttendanceAdmin(1), 400);
}

async function refreshTeacherTodayCard() {
    const box = document.getElementById('tta-today-card');
    if (!box) return;
    const today = todayLocalISO();
    try {
        const data = await API.get(CONFIG.ENDPOINTS.TEACHER_ATTENDANCE, {
            work_date: today,
            page_size: 5,
        });
        const list = data.results || data || [];
        const rec = Array.isArray(list) ? list[0] : null;

        if (!rec) {
            box.innerHTML = `
            <div class="tta-actions">
                <p style="margin:0 0 16px;color:var(--text-secondary)">Chưa có bản ghi trong ngày. Nhấn chấm vào khi đến trung tâm.</p>
                <div style="display:flex;flex-wrap:wrap;gap:10px">
                    <button type="button" class="btn btn-primary" onclick="teacherAttClockIn()">
                        <span class="material-icons-outlined">login</span> Chấm vào
                    </button>
                </div>
            </div>`;
            return;
        }

        const st = rec.status || 'present';
        const badge = getStatusBadge(st);
        const label = CONFIG.TEACHER_ATTENDANCE_LABELS[st] || st;
        const canOut = rec.check_in && !rec.check_out;

        box.innerHTML = `
        <div class="tta-grid">
            <div>
                <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px">Trạng thái</div>
                <span class="badge ${badge}">${label}</span>
            </div>
            <div>
                <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px">Giờ vào</div>
                <strong>${formatDateTimeVN(rec.check_in)}</strong>
            </div>
            <div>
                <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:6px">Giờ ra</div>
                <strong>${rec.check_out ? formatDateTimeVN(rec.check_out) : '—'}</strong>
            </div>
        </div>
        <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px;align-items:center">
            ${!rec.check_in ? `<button type="button" class="btn btn-primary" onclick="teacherAttClockIn()"><span class="material-icons-outlined">login</span> Chấm vào</button>` : ''}
            ${canOut ? `<button type="button" class="btn btn-secondary" onclick="teacherAttClockOut()"><span class="material-icons-outlined">logout</span> Chấm ra</button>` : ''}
            <button type="button" class="btn btn-secondary" onclick="openTeacherSelfEditModal(${rec.id})">
                <span class="material-icons-outlined">edit</span> Sửa trạng thái / ghi chú
            </button>
        </div>`;
    } catch (e) {
        box.innerHTML = `<p style="color:var(--danger-600)">${teacherAttErrorMessage(e)}</p>`;
    }
}

async function teacherAttClockIn() {
    try {
        await API.post(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}clock-in/`, {});
        showToast('Đã chấm vào thành công', 'success');
        await refreshTeacherTodayCard();
        loadTeacherAttendanceList(teacherAttListPage);
    } catch (e) {
        showToast(teacherAttErrorMessage(e), 'error');
    }
}

async function teacherAttClockOut() {
    try {
        await API.post(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}clock-out/`, {});
        showToast('Đã chấm ra thành công', 'success');
        await refreshTeacherTodayCard();
        loadTeacherAttendanceList(teacherAttListPage);
    } catch (e) {
        showToast(teacherAttErrorMessage(e), 'error');
    }
}

async function loadTeacherAttendanceList(page) {
    teacherAttListPage = page;
    const tbody = document.getElementById('tta-table-body');
    const pag = document.getElementById('tta-pagination');
    if (!tbody) return;
    try {
        const data = await API.get(CONFIG.ENDPOINTS.TEACHER_ATTENDANCE, {
            page,
            ordering: '-work_date',
            page_size: 15,
        });
        const rows = data.results || data || [];
        const count = data.count != null ? data.count : rows.length;

        if (!rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">Chưa có lịch sử</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map((r) => {
                    const st = r.status || 'present';
                    const badge = getStatusBadge(st);
                    const label = CONFIG.TEACHER_ATTENDANCE_LABELS[st] || st;
                    return `
                <tr>
                    <td>${r.work_date || '—'}</td>
                    <td><span class="badge ${badge}">${label}</span></td>
                    <td>${formatDateTimeVN(r.check_in)}</td>
                    <td>${formatDateTimeVN(r.check_out)}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${r.notes || '—'}</td>
                    <td><button type="button" class="btn btn-sm btn-secondary" onclick="openTeacherSelfEditModal(${r.id})">Sửa</button></td>
                </tr>`;
                })
                .join('');
        }
        if (pag) pag.innerHTML = renderPagination(data, 'loadTeacherAttendanceList');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6">${teacherAttErrorMessage(e)}</td></tr>`;
    }
}

async function loadTeacherAttendanceAdmin(page) {
    const tbody = document.getElementById('tta-admin-table-body');
    const pag = document.getElementById('tta-admin-pagination');
    if (!tbody) return;

    const teacher = document.getElementById('tta-filter-teacher')?.value || '';
    const status = document.getElementById('tta-filter-status')?.value || '';
    const from = document.getElementById('tta-date-from')?.value || '';
    const to = document.getElementById('tta-date-to')?.value || '';
    const search = document.getElementById('tta-search')?.value?.trim() || '';

    const params = { page, ordering: '-work_date', page_size: 20 };
    if (teacher) params.teacher = teacher;
    if (status) params.status = status;
    if (from) params.work_date_after = from;
    if (to) params.work_date_before = to;
    if (search) params.search = search;

    try {
        const summaryParams = {};
        if (teacher) summaryParams.teacher = teacher;
        if (from) summaryParams.from_date = from;
        if (to) summaryParams.to_date = to;

        const [data, summary] = await Promise.all([
            API.get(CONFIG.ENDPOINTS.TEACHER_ATTENDANCE, params),
            API.get(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}summary/`, summaryParams).catch(() => ({})),
        ]);

        const sumEl = document.getElementById('tta-sum-total');
        if (sumEl) sumEl.textContent = summary.total_records != null ? summary.total_records : (data.count ?? '—');

        const rows = data.results || data || [];
        if (!rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted)">Không có dữ liệu</td></tr>';
        } else {
            tbody.innerHTML = rows
                .map((r) => {
                    const st = r.status || 'present';
                    const badge = getStatusBadge(st);
                    const label = CONFIG.TEACHER_ATTENDANCE_LABELS[st] || st;
                    const name = r.teacher_name || '—';
                    return `
                <tr>
                    <td><strong>${name}</strong><div style="font-size:0.8rem;color:var(--text-muted)">${r.teacher_code || ''}</div></td>
                    <td>${r.work_date || '—'}</td>
                    <td><span class="badge ${badge}">${label}</span></td>
                    <td>${formatDateTimeVN(r.check_in)}</td>
                    <td>${formatDateTimeVN(r.check_out)}</td>
                    <td>${r.recorded_by_name || '—'}</td>
                    <td>
                        <button type="button" class="btn btn-sm btn-secondary" onclick="openTeacherAttendanceFormModal(${r.id})">Sửa</button>
                        <button type="button" class="btn btn-sm btn-danger" onclick="deleteTeacherAttendance(${r.id})">Xóa</button>
                    </td>
                </tr>`;
                })
                .join('');
        }
        if (pag) pag.innerHTML = renderPagination(data, 'loadTeacherAttendanceAdmin');
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7">${teacherAttErrorMessage(e)}</td></tr>`;
    }
}

function openTeacherSelfEditModal(id) {
    API.get(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}${id}/`)
        .then((r) => {
            const body = `
            <form id="tta-self-form" onsubmit="return submitTeacherSelfEdit(event, ${id})">
                <div class="form-group">
                    <label>Trạng thái</label>
                    <select name="status">
                        <option value="present" ${r.status === 'present' ? 'selected' : ''}>Đúng giờ</option>
                        <option value="late" ${r.status === 'late' ? 'selected' : ''}>Đi muộn</option>
                        <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>Vắng</option>
                        <option value="leave" ${r.status === 'leave' ? 'selected' : ''}>Nghỉ có phép</option>
                        <option value="leave_unpaid" ${r.status === 'leave_unpaid' ? 'selected' : ''}>Nghỉ không phép</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Lý do (nếu vắng/nghỉ)</label>
                    <input type="text" name="absence_reason" value="${escapeHtml(r.absence_reason)}">
                </div>
                <div class="form-group">
                    <label>Ghi chú</label>
                    <textarea name="notes" rows="3">${escapeHtml(r.notes)}</textarea>
                </div>
                <div class="modal-footer" style="margin-top:16px;padding:0;border:0">
                    <button type="button" class="btn btn-secondary" onclick="closeModal()">Đóng</button>
                    <button type="submit" class="btn btn-primary">Lưu</button>
                </div>
            </form>`;
            openModal('Cập nhật chấm công', body);
        })
        .catch((e) => showToast(teacherAttErrorMessage(e), 'error'));
}

async function submitTeacherSelfEdit(event, id) {
    event.preventDefault();
    const form = document.getElementById('tta-self-form');
    const fd = new FormData(form);
    const payload = {
        status: fd.get('status'),
        absence_reason: fd.get('absence_reason') || null,
        notes: fd.get('notes') || null,
    };
    try {
        await API.patch(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}${id}/`, payload);
        showToast('Đã cập nhật', 'success');
        closeModal();
        await refreshTeacherTodayCard();
        loadTeacherAttendanceList(teacherAttListPage);
    } catch (e) {
        showToast(teacherAttErrorMessage(e), 'error');
    }
    return false;
}

async function openTeacherAttendanceFormModal(id) {
    let teachers = [];
    try {
        const t = await API.get(CONFIG.ENDPOINTS.TEACHERS, { page_size: 500 });
        teachers = t.results || t || [];
    } catch (e) {
        console.error(e);
    }
    let r = {};
    if (id) {
        try {
            r = await API.get(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}${id}/`);
        } catch (e) {
            showToast(teacherAttErrorMessage(e), 'error');
            return;
        }
    }

    const isEdit = !!id;
    const body = `
    <form id="tta-admin-form" onsubmit="return submitTeacherAttendanceForm(event, ${id || 'null'})">
        <div class="form-group">
            <label>Giảng viên *</label>
            <select name="teacher" required ${isEdit ? 'disabled' : ''}>
                <option value="">-- Chọn --</option>
                ${teachers
                    .map(
                        (x) =>
                            `<option value="${x.id}" ${r.teacher === x.id || r.teacher_id === x.id ? 'selected' : ''}>${x.teacher_code} — ${x.user ? x.user.last_name + ' ' + x.user.first_name : ''}</option>`
                    )
                    .join('')}
            </select>
            ${isEdit ? `<input type="hidden" name="teacher" value="${r.teacher || r.teacher_id}">` : ''}
        </div>
        <div class="form-group">
            <label>Ngày làm việc *</label>
            <input type="date" name="work_date" required value="${r.work_date || todayLocalISO()}">
        </div>
        <div class="form-group">
            <label>Trạng thái</label>
            <select name="status">
                <option value="present" ${(r.status || 'present') === 'present' ? 'selected' : ''}>Đúng giờ</option>
                <option value="late" ${r.status === 'late' ? 'selected' : ''}>Đi muộn</option>
                <option value="absent" ${r.status === 'absent' ? 'selected' : ''}>Vắng</option>
                <option value="leave" ${r.status === 'leave' ? 'selected' : ''}>Nghỉ có phép</option>
                <option value="leave_unpaid" ${r.status === 'leave_unpaid' ? 'selected' : ''}>Nghỉ không phép</option>
            </select>
        </div>
        <div class="form-group">
            <label>Lý do</label>
            <input type="text" name="absence_reason" value="${escapeHtml(r.absence_reason)}">
        </div>
        <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" rows="2">${escapeHtml(r.notes)}</textarea>
        </div>
        <p style="font-size:0.85rem;color:var(--text-muted)">Giờ vào/ra có thể bổ sung sau qua chấm công trên app giảng viên hoặc sửa bản ghi (API).</p>
        <div class="modal-footer" style="margin-top:16px;padding:0;border:0">
            <button type="button" class="btn btn-secondary" onclick="closeModal()">Đóng</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Cập nhật' : 'Tạo'}</button>
        </div>
    </form>`;
    openModal(isEdit ? 'Sửa chấm công giảng viên' : 'Thêm chấm công giảng viên', body);
}

async function submitTeacherAttendanceForm(event, id) {
    event.preventDefault();
    const form = document.getElementById('tta-admin-form');
    const fd = new FormData(form);
    const teacherVal = fd.get('teacher');
    const payload = {
        teacher: Number(teacherVal),
        work_date: fd.get('work_date'),
        status: fd.get('status'),
        absence_reason: fd.get('absence_reason') || null,
        notes: fd.get('notes') || null,
    };
    try {
        if (id) {
            await API.patch(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}${id}/`, {
                work_date: payload.work_date,
                status: payload.status,
                absence_reason: payload.absence_reason,
                notes: payload.notes,
            });
        } else {
            await API.post(CONFIG.ENDPOINTS.TEACHER_ATTENDANCE, payload);
        }
        showToast(id ? 'Đã cập nhật' : 'Đã tạo bản ghi', 'success');
        closeModal();
        loadTeacherAttendanceAdmin(1);
    } catch (e) {
        showToast(teacherAttErrorMessage(e), 'error');
    }
    return false;
}

async function deleteTeacherAttendance(id) {
    const ok = await showConfirm('Xóa bản ghi', 'Bạn có chắc muốn xóa bản ghi chấm công này?');
    if (!ok) return;
    try {
        await API.delete(`${CONFIG.ENDPOINTS.TEACHER_ATTENDANCE}${id}/`);
        showToast('Đã xóa', 'success');
        loadTeacherAttendanceAdmin(1);
    } catch (e) {
        showToast(teacherAttErrorMessage(e), 'error');
    }
}
