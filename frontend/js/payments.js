/**
 * Payments Module - Quản lý học phí
 */
async function renderPayments() {
    const content = document.getElementById('content-area');

    // Load summary
    let summary = {};
    try {
        summary = await API.get(`${CONFIG.ENDPOINTS.PAYMENTS}summary/`);
    } catch (e) {}

    let html = `<div class="page-enter">
        <div class="stats-grid stagger-in" style="margin-bottom:20px">
            <div class="stat-card green">
                <div class="stat-icon"><span class="material-icons-outlined">check_circle</span></div>
                <div class="stat-info">
                    <h4>${formatCurrency(summary.total_paid || 0)}</h4>
                    <p>Đã thu (${summary.count_paid || 0})</p>
                </div>
            </div>
            <div class="stat-card orange">
                <div class="stat-icon"><span class="material-icons-outlined">schedule</span></div>
                <div class="stat-info">
                    <h4>${formatCurrency(summary.total_pending || 0)}</h4>
                    <p>Chờ thu (${summary.count_pending || 0})</p>
                </div>
            </div>
            <div class="stat-card pink">
                <div class="stat-icon"><span class="material-icons-outlined">warning</span></div>
                <div class="stat-info">
                    <h4>${formatCurrency(summary.total_overdue || 0)}</h4>
                    <p>Quá hạn (${summary.count_overdue || 0})</p>
                </div>
            </div>
        </div>

        <div class="toolbar">
            <div class="toolbar-left">
                <div style="position:relative">
                    <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:1.1rem;">search</span>
                    <input type="text" class="search-input" id="payment-search" placeholder="Tìm thanh toán..." onkeyup="searchPayments()">
                </div>
                <select class="filter-select" id="payment-status-filter" onchange="loadPayments()">
                    <option value="">Tất cả</option>
                    <option value="paid">Đã thanh toán</option>
                    <option value="pending">Chờ thanh toán</option>
                    <option value="overdue">Quá hạn</option>
                    <option value="refunded">Đã hoàn</option>
                </select>
            </div>
            ${hasRole('admin', 'staff') ? `
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openPaymentModal()">
                    <span class="material-icons-outlined">add_circle</span>
                    <span>Tạo thanh toán</span>
                </button>
            </div>` : ''}
        </div>
        <div class="card">
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Học viên</th>
                            <th>Lớp học</th>
                            <th>Số tiền</th>
                            <th>Giảm giá</th>
                            <th>Thành tiền</th>
                            <th>PT thanh toán</th>
                            <th>Trạng thái</th>
                            <th>Ngày TT</th>
                            ${hasRole('admin', 'staff') ? '<th>Thao tác</th>' : ''}
                        </tr>
                    </thead>
                    <tbody id="payments-table-body">
                        <tr><td colspan="10"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
            <div id="payments-pagination"></div>
        </div>
    </div>`;

    content.innerHTML = html;
    loadPayments();
}

async function loadPayments(page = 1) {
    try {
        const search = document.getElementById('payment-search')?.value || '';
        const status = document.getElementById('payment-status-filter')?.value || '';
        const params = { page, search };
        if (status) params.status = status;

        const data = await API.get(CONFIG.ENDPOINTS.PAYMENTS, params);
        const payments = data.results || data;
        const tbody = document.getElementById('payments-table-body');

        const methodLabels = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', card: 'Thẻ', other: 'Khác' };

        if (!payments.length) {
            tbody.innerHTML = '<tr><td colspan="10"><div class="empty-state"><span class="material-icons-outlined">payments</span><h3>Chưa có thanh toán nào</h3></div></td></tr>';
            return;
        }

        tbody.innerHTML = payments.map(p => `
            <tr>
                <td>#${p.id}</td>
                <td>${p.student_name}</td>
                <td>${p.classroom_name || '-'}</td>
                <td>${formatCurrency(p.amount)}</td>
                <td>${p.discount > 0 ? formatCurrency(p.discount) : '-'}</td>
                <td><strong>${formatCurrency(p.final_amount)}</strong></td>
                <td>${methodLabels[p.payment_method] || p.payment_method}</td>
                <td><span class="badge ${getStatusBadge(p.status)}">${getStatusLabel(p.status)}</span></td>
                <td>${(p.status === 'paid' || p.status === 'refunded') ? formatDateTime(p.payment_date) : '-'}</td>
                <td>
                    <div class="btn-group">
                        ${hasRole('admin', 'staff') ? `
                            ${p.status === 'pending' ? `
                            <button class="btn btn-sm btn-success" onclick="markPaid(${p.id})" title="Xác nhận thanh toán">
                                <span class="material-icons-outlined" style="font-size:1rem">check</span>
                            </button>` : ''}
                            <button class="btn btn-sm btn-secondary" onclick="editPayment(${p.id})" title="Sửa">
                                <span class="material-icons-outlined" style="font-size:1rem">edit</span>
                            </button>
                        ` : `
                            ${p.status === 'pending' ? `
                            <button class="btn btn-sm btn-primary" onclick="openStudentPayModal(${p.id}, ${p.final_amount})" title="Thanh toán ngay">
                                <span class="material-icons-outlined" style="font-size:1rem">payment</span>
                                <span>Thanh toán</span>
                            </button>` : '<span class="text-muted" style="font-size:0.8rem">N/A</span>'}
                        `}
                    </div>
                </td>
            </tr>
        `).join('');

        if (data.count) {
            document.getElementById('payments-pagination').innerHTML = renderPagination(data, 'loadPayments');
        }
    } catch (error) {
        document.getElementById('payments-table-body').innerHTML =
            '<tr><td colspan="10"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

function searchPayments() {
    clearTimeout(window._paymentSearchTimeout);
    window._paymentSearchTimeout = setTimeout(() => loadPayments(), 400);
}

async function openPaymentModal(payment = null) {
    const isEdit = !!payment;
    const title = isEdit ? 'Sửa thanh toán' : 'Tạo thanh toán mới';

    let students = [], enrollments = [];
    try {
        const studentsData = await API.get(CONFIG.ENDPOINTS.STUDENTS, { page_size: 200 });
        students = studentsData.results || studentsData;
    } catch (e) {}

    const studentOptions = students.map(s =>
        `<option value="${s.id}" ${isEdit && payment.student == s.id ? 'selected' : ''}>${s.student_code} - ${s.user.last_name} ${s.user.first_name}</option>`
    ).join('');

    const html = `
        <form onsubmit="return savePayment(event, ${isEdit ? payment.id : 'null'})">
            <div class="form-group">
                <label>Học viên *</label>
                <select name="student" required>${studentOptions ? '<option value="">-- Chọn --</option>' + studentOptions : '<option>Không có dữ liệu</option>'}</select>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Số tiền (VNĐ) *</label>
                    <input type="number" name="amount" value="${isEdit ? payment.amount : ''}" required min="0">
                </div>
                <div class="form-group">
                    <label>Giảm giá (VNĐ)</label>
                    <input type="number" name="discount" value="${isEdit ? payment.discount : 0}" min="0">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Thành tiền (VNĐ) *</label>
                    <input type="number" name="final_amount" value="${isEdit ? payment.final_amount : ''}" required min="0">
                </div>
                <div class="form-group">
                    <label>Phương thức</label>
                    <select name="payment_method">
                        <option value="cash" ${isEdit && payment.payment_method === 'cash' ? 'selected' : ''}>Tiền mặt</option>
                        <option value="transfer" ${isEdit && payment.payment_method === 'transfer' ? 'selected' : ''}>Chuyển khoản</option>
                        <option value="card" ${isEdit && payment.payment_method === 'card' ? 'selected' : ''}>Thẻ</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Trạng thái</label>
                    <select name="status">
                        <option value="pending" ${isEdit && payment.status === 'pending' ? 'selected' : ''}>Chờ thanh toán</option>
                        <option value="paid" ${isEdit && payment.status === 'paid' ? 'selected' : ''}>Đã thanh toán</option>
                        <option value="overdue" ${isEdit && payment.status === 'overdue' ? 'selected' : ''}>Quá hạn</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Hạn thanh toán</label>
                    <input type="date" name="due_date" value="${isEdit ? (payment.due_date || '') : ''}">
                </div>
            </div>
            <div class="form-group">
                <label>Ghi chú</label>
                <textarea name="notes">${isEdit ? (payment.notes || '') : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Cập nhật' : 'Tạo thanh toán'}</button>
        </form>
    `;

    openModal(title, html);
}

async function savePayment(event, id) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    try {
        if (id) {
            await API.patch(`${CONFIG.ENDPOINTS.PAYMENTS}${id}/`, data);
            showToast('Cập nhật thành công', 'success');
        } else {
            await API.post(CONFIG.ENDPOINTS.PAYMENTS, data);
            showToast('Tạo thanh toán thành công', 'success');
        }
        closeModal();
        renderPayments();
    } catch (error) {
        const msg = error.data ? JSON.stringify(error.data) : 'Có lỗi xảy ra';
        showToast(msg, 'error');
    }
    return false;
}

async function editPayment(id) {
    try {
        const payment = await API.get(`${CONFIG.ENDPOINTS.PAYMENTS}${id}/`);
        openPaymentModal(payment);
    } catch (error) {
        showToast('Lỗi tải dữ liệu', 'error');
    }
}

async function markPaid(id) {
    const confirmed = await showConfirm('Xác nhận thanh toán', 'Đánh dấu đã thanh toán?');
    if (!confirmed) return;

    try {
        await API.post(`${CONFIG.ENDPOINTS.PAYMENTS}${id}/mark_paid/`);
        showToast('Đã xác nhận thanh toán', 'success');
        renderPayments();
    } catch (error) {
        showToast('Lỗi khi xác nhận', 'error');
    }
}
async function openStudentPayModal(id, amount) {
    const html = `
        <div class="payment-gateway page-enter">
            <div style="text-align:center;margin-bottom:20px">
                <p class="text-secondary">Số tiền cần thanh toán:</p>
                <h2 style="color:var(--primary-600);font-size:2rem">${formatCurrency(amount)}</h2>
            </div>
            
            <div class="form-group">
                <label>Chọn phương thức thanh toán</label>
                <div class="payment-methods-grid">
                    <div class="payment-method-card active" onclick="selectPayMethod(this, 'transfer', ${id})">
                        <span class="material-icons-outlined">account_balance</span>
                        <p>Chuyển khoản</p>
                    </div>
                    <div class="payment-method-card" onclick="selectPayMethod(this, 'card', ${id})">
                        <span class="material-icons-outlined">credit_card</span>
                        <p>Thẻ ATM/Visa</p>
                    </div>
                </div>
            </div>

            <div id="payment-details-area" style="margin-top:20px;padding:15px;background:var(--gray-50);border-radius:var(--radius-md);border:1px dashed var(--border-color)">
                <div style="text-align:center">
                    <p style="font-weight:600;margin-bottom:10px">Quét mã QR để thanh toán</p>
                    <div style="width:200px;height:200px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;border-radius:var(--radius-md);overflow:hidden">
                        <img src="qr_payment.jpg" alt="QR Payment" style="width:100%;height:100%;object-fit:contain">
                    </div>
                    <p class="text-muted" style="font-size:0.85rem">Nội dung: <strong>HOCPHI ${id}</strong></p>
                </div>
            </div>

            <button class="btn btn-primary btn-full" style="margin-top:20px" onclick="confirmStudentPayment(${id})">Tôi đã thanh toán</button>
        </div>
    `;
    openModal('Thanh toán học phí', html);
}

function selectPayMethod(el, method, id) {
    document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const details = document.getElementById('payment-details-area');
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
                <p class="text-muted" style="font-size:0.85rem">Nội dung: <strong>HOCPHI ${id}</strong></p>
            </div>
        `;
    }
}

async function confirmStudentPayment(id) {
    try {
        await API.post(`${CONFIG.ENDPOINTS.PAYMENTS}${id}/mark_paid/`);
        showToast('Thanh toán thành công! Vui lòng chờ xác nhận từ trung tâm.', 'success');
        closeModal();
        renderPayments();
    } catch (e) {
        showToast('Có lỗi xảy ra', 'error');
    }
}
