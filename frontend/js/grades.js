/**
 * Grades Module - Quản lý điểm Test
 * 
 * Nghiệp vụ mới:
 * - KHÔNG sử dụng điểm chuyên cần
 * - Chỉ dùng điểm Test (midterm, final, quiz, oral, practice...)
 * - Mỗi HV có thể có nhiều bài Test
 * - Điểm tổng kết = Giữa kỳ 30% + Cuối kỳ 70% (hoặc TB tất cả)
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

// ============ STUDENT VIEW ============
async function renderGradesStudent(content) {
    let classes = [];
    try {
        const data = await API.get(`${CONFIG.ENDPOINTS.CLASSES}my_classes/`);
        classes = data.results || data;
    } catch (e) {}

    const classOptions = classes.map(c =>
        `<option value="${c.id}">${c.code} - ${c.name}</option>`
    ).join('');

    content.innerHTML = `
    <div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left" style="display:flex; align-items:center; gap:20px">
                <h2 style="margin:0; font-size:1.3rem; color:var(--primary-700)">Kết quả học tập</h2>
                <select class="filter-select" id="student-grade-class" onchange="loadStudentGradeReport()" style="min-width:300px">
                    <option value="">-- Chọn lớp học --</option>
                    ${classOptions}
                </select>
            </div>
        </div>

        <div id="student-grade-summary"></div>
        <div id="student-grade-detail">
            <div class="card">
                <div class="empty-state">
                    <span class="material-icons-outlined">assessment</span>
                    <h3>Chọn lớp học để xem điểm Test</h3>
                    <p style="color:var(--text-muted)">Điểm của bạn sẽ được hiển thị tại đây</p>
                </div>
            </div>
        </div>
    </div>`;
}

async function loadStudentGradeReport() {
    const classId = document.getElementById('student-grade-class').value;
    const summaryArea = document.getElementById('student-grade-summary');
    const detailArea = document.getElementById('student-grade-detail');

    if (!classId) {
        summaryArea.innerHTML = '';
        detailArea.innerHTML = '';
        return;
    }

    try {
        summaryArea.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        const report = await API.get(`${CONFIG.ENDPOINTS.TEST_SCORES}student_report/`, {
            student_id: currentUser.student_id,
            classroom_id: classId
        });

        // Summary cards
        const hasGrade = report.final_grade !== null;
        summaryArea.innerHTML = `
        <div class="stats-grid" style="margin-bottom:20px">
            <div class="stat-card blue">
                <div class="stat-info"><h4>${report.total_tests}</h4><p>Tổng bài Test</p></div>
            </div>
            <div class="stat-card green">
                <div class="stat-info"><h4>${report.avg_midterm !== null ? report.avg_midterm : '-'}</h4><p>TB Giữa kỳ</p></div>
            </div>
            <div class="stat-card orange">
                <div class="stat-info"><h4>${report.avg_final !== null ? report.avg_final : '-'}</h4><p>TB Cuối kỳ</p></div>
            </div>
            <div class="stat-card purple">
                <div class="stat-info"><h4>${hasGrade ? report.final_grade : '-'}</h4><p>Tổng kết</p></div>
            </div>
            <div class="stat-card ${report.letter_grade === 'F' ? 'pink' : 'green'}">
                <div class="stat-info"><h4>${report.letter_grade}</h4><p>Xếp loại</p></div>
            </div>
        </div>`;

        if (!report.scores.length) {
            detailArea.innerHTML = '<div class="card"><p style="padding:20px;text-align:center" class="text-muted">Chưa có điểm Test nào</p></div>';
            return;
        }

        detailArea.innerHTML = `
        <div class="card">
            <div class="card-header"><h3>Chi tiết điểm Test</h3></div>
            <div class="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Bài Test</th>
                            <th>Loại</th>
                            <th>Ngày thi</th>
                            <th>Điểm</th>
                            <th>Hệ 10</th>
                            <th>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${report.scores.map(s => `
                        <tr>
                            <td style="font-weight:600">${s.test_name}</td>
                            <td><span class="badge ${getTestTypeBadge(s.test_type)}">${s.test_type_display}</span></td>
                            <td>${formatDate(s.test_date)}</td>
                            <td style="font-weight:700">${s.score}/${s.max_score}</td>
                            <td style="font-weight:700; color:var(--primary-600)">${s.score_10}</td>
                            <td><small class="text-muted">${s.notes || '-'}</small></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    } catch (error) {
        console.error("Grade student load error", error);
        showToast('Lỗi tải dữ liệu điểm: ' + (error.message || ''), 'error');
    }
}

// ============ MANAGEMENT VIEW ============
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
                <h2 style="margin:0; font-size:1.3rem; color:var(--primary-700)">Quản lý điểm Test</h2>
                <select class="filter-select" id="grade-class-select" onchange="loadClassScoreSummary()" style="min-width:320px">
                    <option value="">-- Chọn lớp học --</option>
                    ${classOptions}
                </select>
            </div>
            <div class="toolbar-right" id="grades-actions" style="display:none">
                <button class="btn btn-primary" onclick="openAddTestScoreModal()">
                    <span class="material-icons-outlined">add</span>
                    <span>Thêm bài Test</span>
                </button>
            </div>
        </div>

        <div id="grades-content-area">
            <div class="card">
                <div class="empty-state">
                    <span class="material-icons-outlined">table_view</span>
                    <h3>Quản lý điểm Test</h3>
                    <p style="color:var(--text-muted)">Chọn lớp học để xem và nhập điểm bài Test cho học viên.</p>
                </div>
            </div>
        </div>
    </div>`;
}

async function loadClassScoreSummary() {
    const classId = document.getElementById('grade-class-select').value;
    const area = document.getElementById('grades-content-area');
    const actions = document.getElementById('grades-actions');

    if (!classId) {
        area.innerHTML = '<div class="card"><div class="empty-state"><h3>Vui lòng chọn một lớp học</h3></div></div>';
        actions.style.display = 'none';
        return;
    }

    area.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
    actions.style.display = 'block';

    try {
        const summary = await API.get(`${CONFIG.ENDPOINTS.TEST_SCORES}class_summary/`, { classroom_id: classId });
        const testNames = summary.test_names || [];
        const students = summary.students || [];

        if (!students.length) {
            area.innerHTML = '<div class="card"><div class="empty-state"><h3>Lớp chưa có học viên nào</h3></div></div>';
            return;
        }

        let html = `
        <div class="card" style="padding:0; overflow:hidden">
            <div class="table-wrapper">
                <table class="table-excel">
                    <thead>
                        <tr>
                            <th style="width:180px; text-align:left; padding-left:16px">Học viên</th>
                            ${testNames.map(t => `<th style="min-width:80px">${t}</th>`).join('')}
                            <th>TB Giữa kỳ</th>
                            <th>TB Cuối kỳ</th>
                            <th>Tổng kết</th>
                            <th>Xếp loại</th>
                            <th>Kết quả</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => {
                            const isFailed = s.letter_grade === 'F';
                            return `
                            <tr class="grade-row">
                                <td style="font-weight:600; text-align:left; padding-left:16px">
                                    ${s.student_name}
                                    ${s.student_code ? `<br><small style="color:var(--text-muted)">${s.student_code}</small>` : ''}
                                </td>
                                ${testNames.map(t => {
                                    const sc = s.scores[t];
                                    return `<td style="font-family:monospace; font-weight:600; color:${sc ? 'var(--text-primary)' : 'var(--gray-300)'}">${sc ? sc.score : '-'}</td>`;
                                }).join('')}
                                <td style="font-weight:700; color:var(--primary-600)">${s.avg_midterm !== null ? s.avg_midterm : '-'}</td>
                                <td style="font-weight:700; color:var(--primary-600)">${s.avg_final !== null ? s.avg_final : '-'}</td>
                                <td style="font-weight:700; color:var(--primary-700)">${s.final_grade !== null ? s.final_grade : '-'}</td>
                                <td><span class="badge ${getGradeBadge(s.letter_grade)}">${s.letter_grade}</span></td>
                                <td>
                                    ${s.letter_grade !== '-' ? (isFailed ? '<span class="status-tag status-fail">Rớt</span>' : '<span class="status-tag status-pass">Đạt</span>') : '-'}
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

        area.innerHTML = html;
    } catch (error) {
        console.error("Grade class summary error", error);
        area.innerHTML = `<div class="card"><p style="color:var(--danger-500);padding:20px">Lỗi khi tải dữ liệu lớp: ${error.message || JSON.stringify(error)}</p></div>`;
        actions.style.display = 'none';
    }
}

// ============ ADD TEST SCORE MODAL ============
async function openAddTestScoreModal() {
    const classId = document.getElementById('grade-class-select').value;
    if (!classId) {
        showToast('Vui lòng chọn lớp trước', 'warning');
        return;
    }

    // Load students
    let students = [];
    try {
        const data = await API.get(`${CONFIG.ENDPOINTS.CLASSES}${classId}/students/`);
        students = Array.isArray(data) ? data : (data.results || []);
    } catch (e) {}

    if (!students.length) {
        showToast('Lớp chưa có học viên', 'warning');
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    const html = `
    <form onsubmit="return saveBulkTestScore(event, ${classId})">
        <div class="form-row">
            <div class="form-group">
                <label>Tên bài Test *</label>
                <input type="text" name="test_name" required placeholder="VD: Quiz 1, Midterm, Final Exam">
            </div>
            <div class="form-group">
                <label>Loại bài Test *</label>
                <select name="test_type" required>
                    <option value="quiz">Kiểm tra ngắn</option>
                    <option value="midterm">Giữa kỳ</option>
                    <option value="final">Cuối kỳ</option>
                    <option value="oral">Kiểm tra miệng</option>
                    <option value="practice">Bài tập thực hành</option>
                    <option value="other">Khác</option>
                </select>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label>Ngày thi *</label>
                <input type="date" name="test_date" value="${today}" required>
            </div>
            <div class="form-group">
                <label>Điểm tối đa</label>
                <input type="number" name="max_score" value="10" step="0.1" min="1">
            </div>
        </div>

        <div style="margin: 16px 0; border-top: 1px solid var(--border-light); padding-top: 16px">
            <h4 style="margin-bottom:12px">Nhập điểm từng học viên</h4>
            <div class="table-wrapper" style="max-height:300px; overflow-y:auto">
                <table>
                    <thead>
                        <tr>
                            <th style="text-align:left">Học viên</th>
                            <th style="width:100px">Điểm</th>
                            <th style="width:150px">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${students.map(s => `
                        <tr>
                            <td style="font-weight:600">${s.student_name}</td>
                            <td><input type="number" class="score-input" data-student="${s.student}" step="0.1" min="0" max="10" placeholder="0" style="width:80px; padding:6px 8px; border:1px solid var(--border-color); border-radius:var(--radius-sm)"></td>
                            <td><input type="text" class="score-note" data-student="${s.student}" placeholder="Ghi chú..." style="width:130px; padding:6px 8px; border:1px solid var(--border-color); border-radius:var(--radius-sm); font-size:0.8rem"></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full">
            <span class="material-icons-outlined">save</span>
            Lưu điểm
        </button>
    </form>`;

    openModal('Thêm bài Test mới', html);
}

async function saveBulkTestScore(event, classId) {
    event.preventDefault();
    const form = event.target;

    const testName = form.querySelector('[name="test_name"]').value;
    const testType = form.querySelector('[name="test_type"]').value;
    const testDate = form.querySelector('[name="test_date"]').value;
    const maxScore = parseFloat(form.querySelector('[name="max_score"]').value) || 10;

    const scoreInputs = form.querySelectorAll('.score-input');
    const scores = [];

    scoreInputs.forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
            const studentId = parseInt(input.dataset.student);
            const noteInput = form.querySelector(`.score-note[data-student="${studentId}"]`);
            scores.push({
                student_id: studentId,
                score: val,
                notes: noteInput ? noteInput.value : '',
            });
        }
    });

    if (!scores.length) {
        showToast('Vui lòng nhập điểm ít nhất cho 1 học viên', 'warning');
        return false;
    }

    try {
        const result = await API.post(`${CONFIG.ENDPOINTS.TEST_SCORES}bulk_create/`, {
            classroom_id: classId,
            test_name: testName,
            test_type: testType,
            test_date: testDate,
            max_score: maxScore,
            scores: scores,
        });
        showToast(result.message || 'Đã lưu điểm thành công', 'success');
        closeModal();
        loadClassScoreSummary();
    } catch (error) {
        showToast('Lỗi khi lưu điểm', 'error');
    }
    return false;
}

// ============ HELPERS ============
function formatScore(val) {
    return (val !== null && val !== undefined) ? val : '-';
}

function handleNumericInput(input) {
    input.value = input.value.replace(/[^0-9.]/g, '');
    const parts = input.value.split('.');
    if (parts.length > 2) {
        input.value = parts[0] + '.' + parts.slice(1).join('');
    }
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

function getTestTypeBadge(type) {
    const map = {
        midterm: 'badge-warning',
        final: 'badge-danger',
        quiz: 'badge-info',
        oral: 'badge-primary',
        practice: 'badge-success',
        other: 'badge-neutral',
    };
    return map[type] || 'badge-neutral';
}
