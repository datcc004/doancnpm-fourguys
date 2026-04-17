/**
 * Dashboard - Trang thống kê tổng quan
 */
async function renderDashboard() {
    const content = document.getElementById('content-area');

    try {
        const stats = await API.get(CONFIG.ENDPOINTS.DASHBOARD);

        let html = `<div class="page-enter">`;

        let statsHtml = `<div class="stats-grid stagger-in">
            <div class="stat-card blue">
                <div class="stat-icon"><span class="material-icons-outlined">school</span></div>
                <div class="stat-info">
                    <h4>${stats.total_students}</h4>
                    <p>Học viên</p>
                </div>
            </div>
            <div class="stat-card green">
                <div class="stat-icon"><span class="material-icons-outlined">person</span></div>
                <div class="stat-info">
                    <h4>${stats.total_teachers}</h4>
                    <p>Giảng viên</p>
                </div>
            </div>
            <div class="stat-card orange">
                <div class="stat-icon"><span class="material-icons-outlined">menu_book</span></div>
                <div class="stat-info">
                    <h4>${stats.total_courses}</h4>
                    <p>Khóa học</p>
                </div>
            </div>
            <div class="stat-card cyan">
                <div class="stat-icon"><span class="material-icons-outlined">class</span></div>
                <div class="stat-info">
                    <h4>${stats.total_classes}</h4>
                    <p>Lớp đang học</p>
                </div>
            </div>
            <div class="stat-card purple">
                <div class="stat-icon"><span class="material-icons-outlined">how_to_reg</span></div>
                <div class="stat-info">
                    <h4>${stats.total_enrollments}</h4>
                    <p>Đăng ký</p>
                </div>
            </div>
            ${hasRole('admin', 'staff') ? `
            <div class="stat-card pink">
                <div class="stat-icon"><span class="material-icons-outlined">payments</span></div>
                <div class="stat-info">
                    <h4>${formatCurrency(stats.total_revenue)}</h4>
                    <p>Tổng doanh thu</p>
                </div>
            </div>
            ` : ''}
        </div>`;

        // Charts & Top Courses
        const isAdminOrStaff = hasRole('admin', 'staff');
        let chartsHtml = `<div class="charts-grid" ${!isAdminOrStaff ? 'style="grid-template-columns: 1fr;"' : ''}>
            ${isAdminOrStaff ? `
            <div class="card">
                <div class="card-header">
                    <h3>Doanh thu 6 tháng gần nhất</h3>
                </div>
                <div class="chart-container">
                    ${renderRevenueChart(stats.monthly_revenue || [])}
                </div>
            </div>
            ` : ''}
            <div class="card">
                <div class="card-header">
                    <h3>Top khóa học</h3>
                </div>
                ${renderTopCourses(stats.top_courses || [])}
            </div>
        </div>`;

        // Quick Actions (chỉ admin/staff)
        let adminActionsHtml = '';
        if (isAdminOrStaff) {
            adminActionsHtml = `<div class="card">
                <div class="card-header"><h3>Thao tác nhanh</h3></div>
                <div class="quick-actions">
                    <button class="quick-action-btn blue" onclick="navigate('students')">
                        <span class="material-icons-outlined">person_add</span>
                        <span>Thêm học viên</span>
                    </button>
                    <button class="quick-action-btn green" onclick="navigate('teachers')">
                        <span class="material-icons-outlined">assignment_ind</span>
                        <span>Thêm giảng viên</span>
                    </button>
                    <button class="quick-action-btn orange" onclick="navigate('courses')">
                        <span class="material-icons-outlined">library_add</span>
                        <span>Thêm khóa học</span>
                    </button>
                    <button class="quick-action-btn cyan" onclick="navigate('classes')">
                        <span class="material-icons-outlined">groups</span>
                        <span>Tạo lớp học</span>
                    </button>
                    <button class="quick-action-btn pink" onclick="navigate('payments')">
                        <span class="material-icons-outlined">payments</span>
                        <span>Thu học phí</span>
                    </button>
                    <button class="quick-action-btn purple" onclick="navigate('attendance')">
                        <span class="material-icons-outlined">fact_check</span>
                        <span>Điểm danh</span>
                    </button>
                    <button class="quick-action-btn green" onclick="navigate('teacher-attendance')">
                        <span class="material-icons-outlined">schedule</span>
                        <span>Chấm công GV</span>
                    </button>
                    <button class="quick-action-btn indigo" onclick="navigate('grades')">
                        <span class="material-icons-outlined">trending_up</span>
                        <span>Nhập điểm</span>
                    </button>
                </div>
            </div>`;
        }

        // Phần dành riêng cho Học viên (Giao diện giống Cổng thông tin sinh viên)
        let studentPortalHtml = '';
        if (!isAdminOrStaff) {
            const isTeacher = currentUser && currentUser.role === 'teacher';
            let profileData = null;
            let myClasses = [];
            let enrollments = [];
            try {
                if (isTeacher && currentUser.teacher_id) {
                    profileData = await API.get(`${CONFIG.ENDPOINTS.TEACHERS}${currentUser.teacher_id}/`);
                } else if (!isTeacher && currentUser && currentUser.student_id) {
                    profileData = await API.get(`${CONFIG.ENDPOINTS.STUDENTS}${currentUser.student_id}/`);
                    // Fetch grades
                    const enrollData = await API.get(CONFIG.ENDPOINTS.ENROLLMENTS, { student_id: currentUser.student_id });
                    enrollments = enrollData.results || enrollData || [];
                }
                const classesRes = await API.get(`${CONFIG.ENDPOINTS.CLASSES}my_classes/`);
                myClasses = classesRes.results || classesRes || [];
            } catch (e) { console.error("Lỗi tải thông tin", e); }

            const u = currentUser || {};
            const p = profileData || {};
            const initials = (u.first_name || 'U')[0].toUpperCase();
            const avatarUrl = u.avatar ? (u.avatar.startsWith('http') ? u.avatar : (CONFIG.API_BASE_URL.replace('/api','') + u.avatar)) : null;

            // Tính số tiết học trong tuần
            let weeklyLessonsCount = 0;
            myClasses.forEach(c => {
                let sched = (c.schedule || '').toUpperCase().replace(/\s+/g, '');
                let days = new Set();
                if (sched.includes('T2') || sched.includes('THỨ2') || sched.includes('THỨHAI')) days.add(2);
                if (sched.includes('T3') || sched.includes('THỨ3') || sched.includes('THỨBA')) days.add(3);
                if (sched.includes('T4') || sched.includes('THỨ4') || sched.includes('THỨTƯ')) days.add(4);
                if (sched.includes('T5') || sched.includes('THỨ5') || sched.includes('THỨNĂM')) days.add(5);
                if (sched.includes('T6') || sched.includes('THỨ6') || sched.includes('THỨSÁU')) days.add(6);
                if (sched.includes('T7') || sched.includes('THỨ7') || sched.includes('THỨBẢY')) days.add(7);
                if (sched.includes('CN') || sched.includes('CHỦNHẬT')) days.add(8);
                weeklyLessonsCount += days.size > 0 ? days.size : 1; 
            });

            // Tiến độ học tập (Tính theo số lớp đã hoàn thành / tổng số lớp)
            let completedClasses = 0;
            let totalClasses = 0;

            if (isTeacher) {
                totalClasses = myClasses.length;
                completedClasses = myClasses.filter(c => c.status === 'completed').length;
            } else {
                totalClasses = enrollments.length;
                completedClasses = enrollments.filter(e => e.status === 'completed').length;
            }

            const avgProgress = totalClasses > 0 ? Math.round((completedClasses / totalClasses) * 100) : 0;

            // Nhắc nhở (Reminders)
            let remindersCount = 0;
            let reminderText = 'Không có nhắc nhở mới';
            
            if (!isTeacher && currentUser.student_id) {
                try {
                    // Kiểm tra học phí chưa đóng
                    const payRes = await API.get(CONFIG.ENDPOINTS.PAYMENTS, { student_id: currentUser.student_id, status: 'pending' });
                    const unpaid = payRes.results || payRes || [];
                    if (unpaid.length > 0) {
                        remindersCount = unpaid.length;
                        reminderText = `Bạn có ${unpaid.length} hóa đơn chờ thanh toán`;
                    }
                } catch(e){}
            } else if (isTeacher) {
                // Đối với GV: nhắc nhở về các lớp sắp khai giảng
                const upcomingClasses = myClasses.filter(c => c.status === 'upcoming');
                if (upcomingClasses.length > 0) {
                    remindersCount = upcomingClasses.length;
                    reminderText = `Có ${upcomingClasses.length} lớp sắp khai giảng`;
                }
            }

            // Kết quả học tập - sử dụng TestScore API
            let gradesHtml = '<div style="flex:1; display:flex; align-items:center; justify-content:center;"><span style="color:var(--text-muted);">Chưa có dữ liệu hiển thị</span></div>';
            if (!isTeacher && myClasses.length > 0) {
                // Lấy điểm từ TestScore API cho các lớp đang học
                let classGrades = [];
                for (const cls of myClasses) {
                    try {
                        const report = await API.get(`${CONFIG.ENDPOINTS.TEST_SCORES}student_report/`, {
                            student_id: currentUser.student_id,
                            classroom_id: cls.id
                        });
                        if (report.total_tests > 0) {
                            classGrades.push({
                                classroom_code: cls.code,
                                course_name: cls.course_name || cls.name,
                                final_grade: report.final_grade,
                                letter_grade: report.letter_grade,
                                total_tests: report.total_tests,
                            });
                        }
                    } catch (e) {}
                }

                if (classGrades.length > 0) {
                    gradesHtml = `
                        <div style="display:flex; justify-content:space-between; font-size: 0.8rem; color: var(--text-muted); padding-bottom: 5px; border-bottom: 1px solid var(--border-light);">
                            <span>Môn học</span>
                            <span>Điểm tổng / Chữ</span>
                        </div>
                        <div style="flex:1; overflow-y:auto; padding-top: 10px;">
                            ${classGrades.map(e => `
                                <div style="padding: 10px 0; border-bottom: 1px dashed var(--border-light); display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <div style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${e.classroom_code}</div>
                                        <div style="font-size: 0.8rem; color: var(--text-secondary);">${e.course_name} (${e.total_tests} bài test)</div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="font-weight:bold; color:var(--primary-600);">${e.final_grade !== null ? e.final_grade : '-'}</div>
                                        <span class="badge ${e.letter_grade && e.letter_grade.startsWith('F') ? 'badge-danger' : 'badge-success'}" style="font-size:0.75rem">${e.letter_grade || '-'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } else if (isTeacher && myClasses.length > 0) {
                gradesHtml = `
                    <div style="display:flex; justify-content:space-between; font-size: 0.8rem; color: var(--text-muted); padding-bottom: 5px; border-bottom: 1px solid var(--border-light);">
                        <span>Lớp học</span>
                        <span>Sĩ số</span>
                    </div>
                    <div style="flex:1; overflow-y:auto; padding-top: 10px;">
                        ${myClasses.map(c => `
                            <div style="padding: 10px 0; border-bottom: 1px dashed var(--border-light); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="font-weight: 500; font-size: 0.95rem; color: var(--text-primary);">${c.code}</div>
                                </div>
                                <div style="text-align: right;">
                                    <span style="font-weight:bold; color:var(--primary-600);">${c.current_students || 0}</span>
                                    <span style="font-size: 0.8rem; color: var(--text-secondary);">/ ${c.max_students || 0}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else if (isTeacher) {
                gradesHtml = '<div style="flex:1; display:flex; align-items:center; justify-content:center;"><span style="color:var(--text-muted);">Chưa có lớp học nào</span></div>';
            }

            studentPortalHtml = `
            <style>
                .student-portal-grid { display: grid; gap: 24px; grid-template-columns: 2fr 1fr; margin-bottom: 24px; }
                .sp-card { 
                    background: #ffffff; 
                    border-radius: 16px; 
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03), 0 1px 3px rgba(0,0,0,0.02); 
                    padding: 24px; 
                    display:flex; flex-direction:column; 
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                    border: 1px solid rgba(0,0,0,0.02);
                }
                .sp-card:hover {
                    box-shadow: 0 10px 25px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.04);
                }
                .sp-card-title { 
                    font-size: 1.15rem; 
                    font-weight: 700; 
                    color: var(--gray-800); 
                    margin-bottom: 20px; 
                    padding-bottom: 15px; 
                    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
                    display: flex; align-items: center; gap: 8px;
                }
                
                /* Thông tin sinh viên/giảng viên */
                .sp-info-layout { display: flex; gap: 30px; align-items: center;}
                .sp-avatar-col { display: flex; flex-direction: column; align-items: center; min-width: 140px; }
                .sp-avatar { 
                    width: 110px; height: 110px; 
                    border-radius: 50%; object-fit: cover; 
                    margin-bottom: 12px; 
                    background: linear-gradient(135deg, var(--primary-100), #e0e7ff); 
                    color: var(--primary-600); 
                    display: flex; align-items: center; justify-content: center; 
                    font-size: 2.8rem; font-weight: bold;
                    border: 4px solid white;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.08);
                    transition: transform 0.3s ease;
                }
                .sp-avatar:hover { transform: scale(1.05); }
                .sp-detail-col { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 0.95rem; color: var(--gray-600); }
                .sp-detail-col div > div { margin-bottom: 10px; background: rgba(248,250,252,0.6); padding: 8px 12px; border-radius: 8px; }
                .sp-detail-col strong { color: var(--gray-800); margin-right: 6px; font-weight: 600; }
                
                /* Widgets bên phải */
                .sp-widget { 
                    border: none !important; border-radius: 16px; padding: 20px; position: relative; margin-bottom: 20px; 
                    color: white !important; overflow: hidden;
                }
                .sp-widget.reminders {
                    background: linear-gradient(135deg, #0ea5e9, #3b82f6) !important;
                    box-shadow: 0 10px 20px rgba(59, 130, 246, 0.2) !important;
                }
                .sp-widget.schedule {
                    background: linear-gradient(135deg, #10b981, #059669) !important;
                    box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2) !important;
                }
                /* Decorative circles */
                .sp-widget::before {
                    content: ''; position: absolute; top: -20px; right: -20px; width: 100px; height: 100px;
                    background: rgba(255,255,255,0.1); border-radius: 50%;
                }
                .sp-widget::after {
                    content: ''; position: absolute; bottom: -30px; left: -10px; width: 80px; height: 80px;
                    background: rgba(255,255,255,0.1); border-radius: 50%;
                }
                .sp-widget-title { font-size: 0.95rem; font-weight: 500; margin-bottom: 8px; display: block; opacity: 0.9;}
                .sp-widget-value { font-size: 2.8rem; font-weight: 700; margin-bottom: 4px; line-height: 1; color: white !important; }
                .sp-widget-link { font-size: 0.85rem; color: white !important; text-decoration: underline; text-underline-offset: 4px; cursor: pointer; font-weight: 500; opacity: 0.9;}
                .sp-widget-link:hover { opacity: 1; }
                .sp-widget-icon { position: absolute; right: 20px; top: 20px; color: rgba(255,255,255,0.3) !important; font-size: 4rem !important; }
                
                /* Quick Actions */
                .sp-actions-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; }
                .sp-action-btn { 
                    background: #ffffff; border: 1px solid rgba(0,0,0,0.04); border-radius: 16px; padding: 24px 10px; 
                    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; 
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); min-height: 120px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                }
                .sp-action-btn:hover { 
                    box-shadow: 0 12px 24px rgba(0,0,0,0.06); transform: translateY(-4px); 
                    border-color: var(--primary-200); background: linear-gradient(to bottom, #ffffff, var(--primary-50));
                }
                .sp-action-btn:hover .icon-wrapper {
                    transform: scale(1.1) rotate(5deg); background: var(--primary-500); color: white;
                }
                .sp-action-btn .icon-wrapper {
                    width: 50px; height: 50px; border-radius: 14px; background: var(--primary-50);
                    display: flex; align-items: center; justify-content: center; margin-bottom: 15px;
                    transition: all 0.3s ease; color: var(--primary-500);
                }
                .sp-action-btn .material-icons-outlined { font-size: 1.8rem; }
                .sp-action-btn span { font-size: 0.9rem; color: var(--gray-700); font-weight: 600; line-height: 1.3; }
                
                /* Bottom stats */
                .sp-bottom-grid { display: grid; gap: 24px; grid-template-columns: 1fr 1fr 1fr; }
                .progress-circle-wrapper { position: relative; width: 150px; height: 150px; }
                .progress-circle-bg {
                    width: 100%; height: 100%; border-radius: 50%;
                    background: conic-gradient(var(--primary-500) ${avgProgress}%, var(--primary-100) 0); 
                    display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.06);
                    transition: all 0.5s ease-out;
                }
                .progress-circle-inner {
                    width: 120px; height: 120px; border-radius: 50%; background: white; 
                    display: flex; align-items: center; justify-content: center; flex-direction: column; 
                    box-shadow: inset 0 2px 8px rgba(0,0,0,0.05);
                }
                
                @media (max-width: 1024px) {
                    .student-portal-grid { grid-template-columns: 1fr; }
                    .sp-actions-grid { grid-template-columns: repeat(3, 1fr); }
                    .sp-bottom-grid { grid-template-columns: 1fr; }
                }
                @media (max-width: 600px) {
                    .sp-info-layout { flex-direction: column; align-items: center; }
                    .sp-detail-col { grid-template-columns: 1fr; width: 100%; }
                    .sp-actions-grid { grid-template-columns: repeat(2, 1fr); }
                }
            </style>

            <div class="student-portal-grid stagger-in">
                <!-- Thông tin người dùng -->
                <div class="sp-card">
                    <div class="sp-card-title">${isTeacher ? 'Thông tin giảng viên' : 'Thông tin học viên'}</div>
                    <div class="sp-info-layout">
                        <div class="sp-avatar-col">
                            ${avatarUrl ? `<img src="${avatarUrl}" class="sp-avatar">` : `<div class="sp-avatar">${initials}</div>`}
                            <a class="sp-widget-link" onclick="navigate('profile')">Xem chi tiết</a>
                        </div>
                        <div class="sp-detail-col">
                            <div>
                                <div style="margin-bottom:8px"><strong>${isTeacher ? 'Mã GV' : 'Mã HV'}:</strong> ${isTeacher ? (p.teacher_code || '--') : (p.student_code || '--')}</div>
                                <div style="margin-bottom:8px"><strong>Họ tên:</strong> ${u.last_name} ${u.first_name}</div>
                                <div style="margin-bottom:8px"><strong>Giới tính:</strong> ${u.gender_display || 'N/A'}</div>
                                <div style="margin-bottom:8px"><strong>Ngày sinh:</strong> ${formatDateVN(u.date_of_birth) || '--'}</div>
                                <div style="margin-bottom:8px"><strong>Quê quán:</strong> ${u.hometown || '--'}</div>
                                <div style="margin-bottom:8px"><strong>Địa chỉ thường trú:</strong> ${u.address || '--'}</div>
                            </div>
                            <div>
                                <div style="margin-bottom:8px"><strong>${isTeacher ? 'Lớp đảm nhiệm' : 'Lớp học'}:</strong> ${myClasses.length > 0 ? myClasses.map(c => c.code).join(', ') : 'Chưa có'}</div>
                                <div style="margin-bottom:8px"><strong>Khóa học:</strong> Khóa 2026</div>
                                <div style="margin-bottom:8px"><strong>${isTeacher ? 'Cấp bậc' : 'Bậc đào tạo'}:</strong> Tiêu chuẩn</div>
                                <div style="margin-bottom:8px"><strong>Loại hình đào tạo:</strong> Chính quy</div>
                                <div style="margin-bottom:8px"><strong>Ngành:</strong> Ngoại ngữ</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Lịch & Nhắc nhở -->
                <div style="display: flex; flex-direction: column;">
                    <div class="sp-card sp-widget reminders">
                        <span class="sp-widget-title">Nhắc nhở mới, chưa xem</span>
                        <div class="sp-widget-value">${remindersCount}</div>
                        <a class="sp-widget-link" ${remindersCount > 0 ? `onclick="navigate('${!isTeacher ? 'payments' : 'classes'}')"` : 'style="cursor:default; opacity:0.6; text-decoration:none;"'}>${reminderText}</a>
                        <span class="material-icons-outlined sp-widget-icon">notifications_active</span>
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr; gap: 20px; flex: 1;">
                        <div class="sp-card sp-widget schedule" style="margin-bottom: 0;">
                            <span class="sp-widget-title">${isTeacher ? 'Lịch dạy trong tuần' : 'Lịch học trong tuần'}</span>
                            <div class="sp-widget-value">${weeklyLessonsCount}</div>
                            <a class="sp-widget-link" onclick="navigate('schedule')">Xem chi tiết lịch biểu</a>
                            <span class="material-icons-outlined sp-widget-icon">event_note</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Nút hành động nhanh -->
            <div class="sp-actions-grid stagger-in">
                ${isTeacher ? `
                <div class="sp-action-btn" onclick="navigate('schedule')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">calendar_month</span></div>
                    <span>Lịch giảng dạy</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('classes')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">groups</span></div>
                    <span>Lớp học quản lý</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('attendance')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">fact_check</span></div>
                    <span>Điểm danh học viên</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('teacher-attendance')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">schedule</span></div>
                    <span>Chấm công giảng viên</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('grades')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">edit_note</span></div>
                    <span>Nhập điểm đánh giá</span>
                </div>
                ` : `
                <div class="sp-action-btn" onclick="navigate('grades')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">insights</span></div>
                    <span>Kết quả<br>học tập</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('schedule')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">calendar_today</span></div>
                    <span>Lịch theo<br>tuần</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('classes')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">toc</span></div>
                    <span>Lịch theo<br>tiến độ</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('payments')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">request_quote</span></div>
                    <span>Tra cứu<br>công nợ</span>
                </div>
                <div class="sp-action-btn" onclick="navigate('payments')">
                    <div class="icon-wrapper"><span class="material-icons-outlined">credit_score</span></div>
                    <span>Thanh toán<br>trực tuyến</span>
                </div>
                `}
            </div>

            <!-- Thống kê & Lớp học phần -->
            <div class="sp-bottom-grid stagger-in">
                <div class="sp-card" style="height: 300px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                        <h3 style="font-size: 1.1rem; color: var(--text-primary); margin:0;">${isTeacher ? 'Tổng quan sĩ số lớp' : 'Kết quả học tập'}</h3>
                    </div>
                    ${gradesHtml}
                </div>
                
                <div class="sp-card" style="height: 300px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                        <h3 style="font-size: 1.1rem; color: var(--text-primary); margin:0;">${isTeacher ? 'Tiến độ giảng dạy' : 'Tiến độ học tập'}</h3>
                    </div>
                    <div style="flex:1; display: flex; align-items: center; justify-content: center; flex-direction: column;">
                        <div class="progress-circle-wrapper">
                            <div class="progress-circle-bg">
                                <div class="progress-circle-inner">
                                    <span style="font-size: 2.2rem; font-weight: 800; color: var(--primary-600); line-height:1;">${avgProgress}%</span>
                                </div>
                            </div>
                        </div>
                        <span style="margin-top: 15px; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">Đã hoàn thành ${completedClasses}/${totalClasses} lớp ${isTeacher ? 'giảng dạy' : 'đăng ký'}</span>
                    </div>
                </div>

                <div class="sp-card" style="height: 300px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                        <h3 style="font-size: 1.1rem; color: var(--text-primary); margin:0;">${isTeacher ? 'Lớp đang hướng dẫn' : 'Lớp học phần'}</h3>
                    </div>
                    <div style="flex:1; overflow-y:auto; padding-right: 5px;">
                        <div style="display:flex; justify-content:space-between; font-size: 0.8rem; color: var(--text-muted); padding-bottom: 10px; border-bottom: 1px solid var(--border-light);">
                            <span>Môn học / Lớp học</span>
                            <span>Số tiết</span>
                        </div>
                        ${myClasses.length > 0 ? myClasses.map(c => `
                            <div style="padding: 12px 0; border-bottom: 1px dashed var(--border-light); display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <div style="color: var(--primary-600); font-weight: 500;">${c.code}</div>
                                    <div style="font-size: 0.85rem; color: var(--text-secondary);">${c.name}</div>
                                </div>
                                <div>${c.total_lessons || '--'}</div>
                            </div>
                        `).join('') : `<div style="padding: 20px; text-align: center; color: var(--text-muted);">${isTeacher ? 'Chưa nhận lớp nào' : 'Chưa đăng ký lớp nào'}</div>`}
                    </div>
                </div>
            </div>
            `;
        }

        // Combine HTML based on user role
        if (!isAdminOrStaff) {
            html += studentPortalHtml;
            html += '<div style="margin-top: 30px; margin-bottom: 15px;"><h3 style="color: var(--text-primary); font-size: 1.1rem;">Thống kê trung tâm</h3></div>';
            html += statsHtml;
            html += chartsHtml;
        } else {
            html += statsHtml;
            html += chartsHtml;
            html += adminActionsHtml;
        }

        html += `</div>`;
        content.innerHTML = html;

    } catch (error) {
        console.error("Dashboard error:", error);
        content.innerHTML = `
            <div class="stats-grid stagger-in">
                <div class="stat-card blue"><div class="stat-icon"><span class="material-icons-outlined">school</span></div><div class="stat-info"><h4>--</h4><p>Học viên</p></div></div>
                <div class="stat-card green"><div class="stat-icon"><span class="material-icons-outlined">person</span></div><div class="stat-info"><h4>--</h4><p>Giảng viên</p></div></div>
                <div class="stat-card orange"><div class="stat-icon"><span class="material-icons-outlined">menu_book</span></div><div class="stat-info"><h4>--</h4><p>Khóa học</p></div></div>
                <div class="stat-card cyan"><div class="stat-icon"><span class="material-icons-outlined">class</span></div><div class="stat-info"><h4>--</h4><p>Lớp học</p></div></div>
            </div>
            <div class="card"><p style="color:var(--danger-500);padding:20px">Lỗi Dashboard: ${error.message || JSON.stringify(error)}</p></div>`;
    }
}

/**
 * Render biểu đồ doanh thu
 */
function renderRevenueChart(data) {
    if (!data.length) return '<p style="color:var(--text-muted)">Chưa có dữ liệu</p>';

    const maxVal = Math.max(...data.map(d => d.revenue), 1);

    return data.map(d => {
        const height = Math.max((d.revenue / maxVal) * 250, 4);
        return `
            <div class="chart-bar-group">
                <div class="chart-bar-value">${d.revenue > 0 ? (d.revenue / 1000000).toFixed(1) + 'tr' : '0'}</div>
                <div class="chart-bar" style="height:${height}px" title="${formatCurrency(d.revenue)}"></div>
                <div class="chart-bar-label">${d.month}</div>
            </div>`;
    }).join('');
}

/**
 * Render top khóa học
 */
function renderTopCourses(courses) {
    if (!courses.length) return '<p style="color:var(--text-muted);padding:10px">Chưa có dữ liệu</p>';

    return courses.map(c => `
        <div class="top-course-item" onclick="goToCourse('${c.name.replace(/'/g, "\\'")}')" style="cursor:pointer; transition: background 0.2s; padding: 8px; border-radius: 8px;" onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
            <span class="top-course-name" style="color:var(--primary-600); font-weight:600">${c.name}</span>
            <span class="top-course-count" style="color:var(--text-muted)">${c.students} HV</span>
        </div>
    `).join('');
}

function goToCourse(name) {
    navigate('courses', { search: name });
}
