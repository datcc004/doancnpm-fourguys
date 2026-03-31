/**
 * Grades Module - Quản lý điểm số university-style (Excel Mode)
 */
async function renderGrades() {
    const content = document.getElementById('content-area');
    const user = currentUser;
    if (!user) return;

    if (user.role === 'student') {
        return renderGradesStudent(content);
    } else {
        return renderGradesManagement(content);
    }
}

/**
 * Giao diện Học viên: Xem kết quả cá nhân
 */
async function renderGradesStudent(content) {
    content.innerHTML = `
        <div class="page-enter">
            <div class="toolbar">
                <div class="toolbar-left">
                    <h2 style="margin:0; font-size:1.5rem; color:var(--primary-700)">Kết quả học tập cá nhân</h2>
                </div>
            </div>
            <div class="card">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Lớp học</th>
                                <th>Khóa học</th>
                                <th>Chuyên cần</th>
                                <th>Giữa kỳ</th>
                                <th>Cuối kỳ</th>
                                <th>Hệ 10</th>
                                <th>Hệ 4</th>
                                <th>Chữ</th>
                                <th>Kết quả</th>
                            </tr>
                        </thead>
                        <tbody id="grades-student-body">
                            <tr><td colspan="9"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
    
    try {
        const data = await API.get(CONFIG.ENDPOINTS.ENROLLMENTS, { student_id: currentUser.student_id });
        const enrollments = data.results || data;
        const tbody = document.getElementById('grades-student-body');

        if (!enrollments.length) {
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><h3>Bạn chưa có kết quả học tập nào</h3></div></td></tr>`;
            return;
        }

        tbody.innerHTML = enrollments.map(e => {
            const hasGrade = e.letter_grade && e.letter_grade !== '-';
            const isFailed = e.letter_grade === 'F';
            return `
            <tr>
                <td style="font-weight:600">
                    ${e.classroom_code ? e.classroom_code : '<span style="color:var(--text-muted); font-style:italic; font-size:0.85rem; font-weight:normal;">Chưa xếp lớp</span>'}
                </td>
                <td>${e.course_name}</td>
                <td>${formatScore(e.attendance_grade)}</td>
                <td>${formatScore(e.midterm_grade)}</td>
                <td>${formatScore(e.final_test_grade)}</td>
                <td style="font-weight:700">${formatScore(e.final_grade)}</td>
                <td style="font-weight:700">${formatScore(e.gpa4_score)}</td>
                <td><span class="badge ${getGradeBadge(e.letter_grade)}">${e.letter_grade || '-'}</span></td>
                <td>
                    ${hasGrade ? (isFailed ? '<span class="text-danger" style="font-weight:600">Rớt môn (F)</span>' : '<span class="text-success" style="font-weight:600">Qua môn</span>') : '-'}
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        document.getElementById('grades-student-body').innerHTML = '<tr><td colspan="9"><p style="color:var(--danger-500);padding:20px">Lỗi tải dữ liệu</p></td></tr>';
    }
}

/**
 * Giao diện Quản lý: Nhập điểm Excel Mode
 */
async function renderGradesManagement(content) {
    let classes = [];
    try {
        const endpoint = hasRole('teacher') ? `${CONFIG.ENDPOINTS.CLASSES}my_classes/` : CONFIG.ENDPOINTS.CLASSES;
        const data = await API.get(endpoint, { page_size: 100 });
        classes = data.results || data;
    } catch (e) {}

    const classOptions = classes.map(c => `<option value="${c.id}">${c.code} - ${c.name}</option>`).join('');

    content.innerHTML = `
        <div class="page-enter">
            <div class="toolbar">
                <div class="toolbar-left" style="display:flex; align-items:center; gap:20px">
                    <h2 style="margin:0; font-size:1.5rem; color:var(--primary-700)">Nhập điểm học viên</h2>
                    <select class="filter-select" id="grade-class-select" onchange="loadClassGradesExcel()" style="min-width:320px">
                        <option value="">-- Chọn lớp học để nhập điểm --</option>
                        ${classOptions}
                    </select>
                </div>
                <div class="toolbar-right" id="grades-excel-actions" style="display:none">
                    <button class="btn btn-primary" onclick="saveAllGrades()">
                        <span class="material-icons-outlined">save</span>
                        <span>Lưu tất cả thay đổi</span>
                    </button>
                </div>
            </div>

            <div id="grades-excel-area">
                <div class="card">
                    <div class="empty-state">
                        <span class="material-icons-outlined">table_view</span>
                        <h3>Chế độ nhập điểm Excel</h3>
                        <p style="color:var(--text-muted)">Vui lòng chọn một lớp học. Sau đó bạn có thể nhập điểm trực tiếp vào ô tương ứng.</p>
                    </div>
                </div>
            </div>
        </div>`;
}

async function loadClassGradesExcel() {
    const classId = document.getElementById('grade-class-select').value;
    const area = document.getElementById('grades-excel-area');
    const actions = document.getElementById('grades-excel-actions');

    if (!classId) {
        area.innerHTML = '<div class="card"><div class="empty-state"><h3>Vui lòng chọn một lớp học</h3></div></div>';
        actions.style.display = 'none';
        return;
    }

    area.innerHTML = `
        <div class="card" style="padding:0; overflow:hidden">
            <div class="table-wrapper">
                <table class="table-excel">
                    <thead>
                        <tr>
                            <th style="width:200px">Học viên</th>
                            <th>Chuyên cần (10%)</th>
                            <th>Giữa kỳ (20%)</th>
                            <th>Cuối kỳ (70%)</th>
                            <th>Hệ 10</th>
                            <th>Hệ 4</th>
                            <th>Chữ</th>
                            <th style="width:200px">Ghi chú</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody id="class-grades-excel-body">
                        <tr><td colspan="9"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
                    </tbody>
                </table>
            </div>
        </div>`;

    try {
        const enrollments = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/students/`);
        const tbody = document.getElementById('class-grades-excel-body');
        actions.style.display = 'block';

        if (!enrollments.length) {
            tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><h3>Lớp chưa có học viên nào</h3></div></td></tr>`;
            return;
        }

        tbody.innerHTML = enrollments.map(e => `
            <tr id="row-${e.id}" class="grade-row" data-enrollment-id="${e.id}">
                <td style="font-weight:600; color:var(--text-primary)">${e.student_name}</td>
                <td><input type="number" class="excel-input grade-input" data-field="attendance_grade" value="${e.attendance_grade || ''}" step="0.1" min="0" max="10" placeholder="0.0" oninput="handleNumericInput(this); recalculateRow(${e.id})"></td>
                <td><input type="number" class="excel-input grade-input" data-field="midterm_grade" value="${e.midterm_grade || ''}" step="0.1" min="0" max="10" placeholder="0.0" oninput="handleNumericInput(this); recalculateRow(${e.id})"></td>
                <td><input type="number" class="excel-input grade-input" data-field="final_test_grade" value="${e.final_test_grade || ''}" step="0.1" min="0" max="10" placeholder="0.0" oninput="handleNumericInput(this); recalculateRow(${e.id})"></td>
                <td id="final10-${e.id}" style="font-weight:700; color:var(--primary-600); font-family:monospace">${e.final_grade || '-'}</td>
                <td id="final4-${e.id}" style="font-weight:700; color:var(--text-secondary); font-family:monospace">${e.gpa4_score || '-'}</td>
                <td><span id="letter-${e.id}" class="badge ${getGradeBadge(e.letter_grade)}">${e.letter_grade || '-'}</span></td>
                <td><input type="text" class="excel-input note-input" data-field="notes" value="${e.notes || ''}" placeholder="Ghi chú..." style="text-align:left; font-size:0.85rem"></td>
                <td id="status-${e.id}">
                    ${e.letter_grade === 'F' ? '<span class="status-tag status-fail">Rớt môn</span>' : (e.letter_grade ? '<span class="status-tag status-pass">Qua môn</span>' : '-')}
                </td>
            </tr>
        `).join('');
    } catch (error) {
        area.innerHTML = `<div class="card"><p style="color:var(--danger-500);padding:20px">Lỗi khi tải dữ liệu lớp</p></div>`;
        actions.style.display = 'none';
    }
}

/**
 * Tính toán lại dữ liệu 1 hàng ngay khi nhập
 */
function recalculateRow(id) {
    const row = document.getElementById(`row-${id}`);
    const inputs = row.querySelectorAll('.grade-input');
    const att = parseFloat(row.querySelector('[data-field="attendance_grade"]').value);
    const mid = parseFloat(row.querySelector('[data-field="midterm_grade"]').value);
    const fin = parseFloat(row.querySelector('[data-field="final_test_grade"]').value);

    // Đánh dấu hàng có thay đổi
    row.classList.add('modified');

    if (!isNaN(att) && !isNaN(mid) && !isNaN(fin)) {
        const total = (att * 0.1) + (mid * 0.2) + (fin * 0.7);
        const totalRound = total.toFixed(2);
        
        document.getElementById(`final10-${id}`).textContent = totalRound;
        
        let letter = "F";
        let gpa4 = 0.0;
        
        if (total >= 8.5) { letter = "A"; gpa4 = 4.0; }
        else if (total >= 7.8) { letter = "B+"; gpa4 = 3.5; }
        else if (total >= 7.0) { letter = "B"; gpa4 = 3.0; }
        else if (total >= 6.3) { letter = "C+"; gpa4 = 2.5; }
        else if (total >= 5.5) { letter = "C"; gpa4 = 2.0; }
        else if (total >= 4.8) { letter = "D+"; gpa4 = 1.5; }
        else if (total >= 4.0) { letter = "D"; gpa4 = 1.0; }
        
        document.getElementById(`final4-${id}`).textContent = gpa4.toFixed(1);
        const letterEl = document.getElementById(`letter-${id}`);
        letterEl.textContent = letter;
        letterEl.className = `badge ${getGradeBadge(letter)}`;
        
        const statusEl = document.getElementById(`status-${id}`);
        if (letter === 'F') {
            statusEl.innerHTML = '<span class="status-tag status-fail">Rớt môn</span>';
        } else {
            statusEl.innerHTML = '<span class="status-tag status-pass">Qua môn</span>';
        }
    } else {
        document.getElementById(`final10-${id}`).textContent = '-';
        document.getElementById(`final4-${id}`).textContent = '-';
        document.getElementById(`letter-${id}`).textContent = '-';
        document.getElementById(`letter-${id}`).className = 'badge';
        document.getElementById(`status-${id}`).textContent = '-';
    }
}

/**
 * Lưu tất cả hàng có thay đổi
 */
async function saveAllGrades() {
    const modifiedRows = document.querySelectorAll('.grade-row.modified');
    if (!modifiedRows.length) {
        showToast('Không có thay đổi nào cần lưu', 'info');
        return;
    }

    const btn = document.querySelector('#grades-excel-actions button');
    btn.disabled = true;
    btn.textContent = 'Đang lưu dữ liệu...';

    const promises = [];
    modifiedRows.forEach(row => {
        const id = row.dataset.enrollmentId;
        const data = {};
        row.querySelectorAll('.excel-input').forEach(input => {
            const field = input.dataset.field;
            data[field] = input.value === '' ? null : input.value;
        });
        promises.push(API.patch(`${CONFIG.ENDPOINTS.ENROLLMENTS}${id}/`, data));
    });

    try {
        await Promise.all(promises);
        showToast(`Đã lưu thành công ${promises.length} bản ghi`, 'success');
        modifiedRows.forEach(row => row.classList.remove('modified'));
    } catch (error) {
        showToast('Lỗi khi lưu một số bản ghi. Vui lòng thử lại.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-outlined">save</span><span>Lưu tất cả thay đổi</span>';
    }
}

function formatScore(val) {
    return (val !== null && val !== undefined) ? val : '-';
}

function handleNumericInput(input) {
    // Chỉ cho phép số và dấu chấm
    input.value = input.value.replace(/[^0-9.]/g, '');
    
    // Ngăn chặn có nhiều hơn một dấu chấm
    const parts = input.value.split('.');
    if (parts.length > 2) {
        input.value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Giới hạn giá trị từ 0 đến 10
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
        if (val > 10) input.value = '10';
        if (val < 0) input.value = '0';
    }
}

function getGradeBadge(letter) {
    if (!letter || letter === '-') return '';
    if (letter.startsWith('A')) return 'badge-success';
    if (letter.startsWith('B')) return 'badge-primary';
    if (letter.startsWith('C')) return 'badge-warning';
    if (letter.startsWith('D')) return 'badge-info';
    return 'badge-danger';
}
