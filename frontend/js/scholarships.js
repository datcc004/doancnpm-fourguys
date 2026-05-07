/**
 * Scholarships Module - Quản lý học bổng
 */
async function renderScholarships() {
    const content = document.getElementById('content-area');
    content.innerHTML = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="scholarship-search" placeholder="Tìm học bổng..." onkeyup="searchScholarships()">
                </div>
            </div>
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openScholarshipModal()">
                    <span class="material-icons-outlined">add_circle</span>
                    <span>Thêm học bổng</span>
                </button>
            </div>
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Tiêu đề</th>
                            <th>Giá trị</th>
                            <th>Hạn nộp</th>
                            <th>Trạng thái</th>
                            <th>Xuất bản</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody id="scholarships-table-body">
                        <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="scholarships-pagination"></div>
        </div>
    </div>`;

    await loadScholarships();
}

async function loadScholarships(page = 1) {
    try {
        const search = document.getElementById('scholarship-search')?.value || '';
        const data = await API.get(CONFIG.ENDPOINTS.SCHOLARSHIPS, { page, search });
        const rows = data.results || data;
        const tbody = document.getElementById('scholarships-table-body');

        if (!rows.length) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="material-icons-outlined">workspace_premium</span><h3>Chưa có học bổng nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = rows.map((s) => `
            <tr>
                <td><strong>${escapeScholarshipText(s.title)}</strong></td>
                <td>${escapeScholarshipText(s.amount_text || '-')}</td>
                <td>${formatDateVN(s.deadline)}</td>
                <td><span class="badge ${s.is_published ? 'badge-success' : 'badge-warning'}">${s.is_published ? 'Công khai' : 'Ẩn'}</span></td>
                <td>${formatDateVN(s.published_at || s.created_at)}</td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-info" onclick='viewScholarshipDetail(${JSON.stringify(s.slug || "")})' title="Xem">
                            <span class="material-icons-outlined" style="font-size:1rem">visibility</span>
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick='editScholarship(${JSON.stringify(s.slug || "")})' title="Sửa">
                            <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick='deleteScholarship(${JSON.stringify(s.slug || "")})' title="Xóa">
                            <span class="material-icons-outlined" style="font-size:1rem">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('scholarships-pagination').innerHTML = renderPagination(data, 'loadScholarships');
        }
    } catch (error) {
        document.getElementById('scholarships-table-body').innerHTML =
            '<tr><td colspan="6"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu học bổng</p></td></tr>';
    }
}

function searchScholarships() {
    clearTimeout(window._scholarshipSearchTimeout);
    window._scholarshipSearchTimeout = setTimeout(() => loadScholarships(), 350);
}

function escapeScholarshipText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openScholarshipModal(item = null) {
    const isEdit = !!item;
    const title = isEdit ? 'Cập nhật học bổng' : 'Thêm học bổng';

    const html = `
        <form onsubmit='return saveScholarship(event, ${isEdit ? JSON.stringify(item.slug || '') : 'null'})'>
            <div class="form-group">
                <label>Tiêu đề *</label>
                <input type="text" name="title" value="${isEdit ? escapeScholarshipText(item.title) : ''}" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Giá trị học bổng</label>
                    <input type="text" name="amount_text" value="${isEdit ? escapeScholarshipText(item.amount_text || '') : ''}" placeholder="VD: 30% học phí">
                </div>
                <div class="form-group">
                    <label>Hạn nộp hồ sơ</label>
                    <input type="date" name="deadline" value="${isEdit && item.deadline ? item.deadline : ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Mô tả ngắn</label>
                <textarea name="short_description">${isEdit ? escapeScholarshipText(item.short_description || '') : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Nội dung chi tiết *</label>
                <textarea name="content" required>${isEdit ? escapeScholarshipText(item.content || '') : ''}</textarea>
            </div>
            <div class="form-group">
                <label>Điều kiện áp dụng</label>
                <textarea name="eligibility">${isEdit ? escapeScholarshipText(item.eligibility || '') : ''}</textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Ảnh minh họa (URL)</label>
                    <input type="url" name="image_url" value="${isEdit ? escapeScholarshipText(item.image_url || '') : ''}">
                </div>
                <div class="form-group">
                    <label>Ngày xuất bản</label>
                    <input type="datetime-local" name="published_at" value="${isEdit && item.published_at ? toDatetimeLocal(item.published_at) : ''}">
                </div>
            </div>
            <div class="form-group">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
                    <input type="checkbox" name="is_published" ${!isEdit || item.is_published ? 'checked' : ''}>
                    <span>Công khai trên landing</span>
                </label>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật học bổng' : 'Tạo học bổng'}</button>
        </form>
    `;
    openModal(title, html);
}

function toDatetimeLocal(isoString) {
    const date = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hour = pad(date.getHours());
    const minute = pad(date.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`;
}

async function saveScholarship(event, slug) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    data.is_published = form.querySelector('[name="is_published"]').checked;
    if (!data.deadline) data.deadline = null;
    if (!data.published_at) data.published_at = null;

    try {
        if (slug) {
            await API.put(`${CONFIG.ENDPOINTS.SCHOLARSHIPS}${slug}/`, data);
            showToast('Cập nhật học bổng thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.SCHOLARSHIPS, data);
            showToast('Tạo học bổng thành công', 'success');
        }
        closeModal();
        loadScholarships();
        if (typeof loadLandingScholarships === 'function') {
            loadLandingScholarships();
        }
    } catch (error) {
        const msg = error.data ? JSON.stringify(error.data) : 'Không thể lưu học bổng';
        showToast(msg, 'error');
    }
    return false;
}

async function editScholarship(slug) {
    try {
        const item = await API.get(`${CONFIG.ENDPOINTS.SCHOLARSHIPS}${slug}/`);
        openScholarshipModal(item);
    } catch (error) {
        showToast('Không tải được dữ liệu học bổng', 'error');
    }
}

async function viewScholarshipDetail(slug) {
    try {
        const item = await API.get(`${CONFIG.ENDPOINTS.SCHOLARSHIPS}${slug}/`);
        const image = item.image_url ? `<img src="${escapeScholarshipText(item.image_url)}" alt="${escapeScholarshipText(item.title)}" class="landing-detail-cover">` : '';
        const body = `
            <div class="landing-detail">
                ${image}
                <h2>${escapeScholarshipText(item.title)}</h2>
                <p class="landing-detail-date">Hạn nộp: ${formatDateVN(item.deadline)} · Giá trị: ${escapeScholarshipText(item.amount_text || 'Đang cập nhật')}</p>
                <div class="landing-detail-content">${escapeScholarshipText(item.content).replace(/\n/g, '<br>')}</div>
            </div>
        `;
        openModal('Chi tiết học bổng', body);
    } catch (error) {
        showToast('Không tải được chi tiết học bổng', 'error');
    }
}

async function deleteScholarship(slug) {
    const ok = await showConfirm('Xóa học bổng', 'Bạn có chắc muốn xóa học bổng này?');
    if (!ok) return;
    try {
        await API.delete(`${CONFIG.ENDPOINTS.SCHOLARSHIPS}${slug}/`);
        showToast('Đã xóa học bổng', 'success');
        loadScholarships();
        if (typeof loadLandingScholarships === 'function') {
            loadLandingScholarships();
        }
    } catch (error) {
        showToast('Không thể xóa học bổng', 'error');
    }
}
