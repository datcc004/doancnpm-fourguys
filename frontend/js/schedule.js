/**
 * Schedule Module - Lịch học & Thời khóa biểu
 */
async function renderSchedule() {
    const content = document.getElementById('content-area');
    
    // Tạo cấu trúc giao diện lịch
    content.innerHTML = `
        <div class="page-enter">
            <div class="schedule-control-bar card">
                <div class="control-left">
                    <h3 id="schedule-week-range-title">--</h3>
                </div>
                <div class="control-right">
                    <div class="date-navigator">
                        <input type="date" id="schedule-date-picker" class="filter-select" onchange="jumpToDate(this.value)">
                        <button class="btn btn-primary" onclick="resetScheduleToToday()">
                            <span class="material-icons-outlined">today</span>
                            <span>Hiện tại</span>
                        </button>
                        <div class="nav-arrows">
                            <button class="btn btn-secondary btn-icon" onclick="changeScheduleWeek(-1)" title="Tuần trước">
                                <span class="material-icons-outlined">chevron_left</span>
                            </button>
                            <span id="schedule-week-range-label" class="week-label">--</span>
                            <button class="btn btn-secondary btn-icon" onclick="changeScheduleWeek(1)" title="Tuần sau">
                                <span class="material-icons-outlined">chevron_right</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card schedule-card">
                <div class="schedule-grid" id="schedule-grid">
                    <div class="schedule-body">
                        <div class="loading-spinner"><div class="spinner"></div></div>
                    </div>
                </div>
                
                <div class="schedule-legend">
                    <div class="legend-item"><span class="dot theory"></span> Lịch học trực tiếp</div>
                    <div class="legend-item"><span class="dot online"></span> Lịch học trực tuyến</div>
                </div>
            </div>
        </div>
    `;

    loadMySchedule();
}

let currentScheduleOffset = 0;

async function loadMySchedule(offset = 0) {
    currentScheduleOffset += offset;
    const grid = document.getElementById('schedule-grid');
    
    try {
        // Lấy danh sách các lớp của tôi
        const classes = await API.get(`${CONFIG.ENDPOINTS.CLASSES}my_classes/`);
        const myClasses = classes.results || classes;

        // Xử lý các ngày trong tuần đang xem
        const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
        const dayCodes = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        
        // Tính toán dải ngày của tuần dựa trên offset
        const today = new Date();
        // Lấy ngày đầu tuần (Thứ 2)
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) + (currentScheduleOffset * 7));
        
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(firstDayOfWeek.getDate() + 6);
        
        const weekRangeText = `${formatDateVN(firstDayOfWeek)} - ${formatDateVN(lastDayOfWeek)}`;
        const titleEl = document.getElementById('schedule-week-range-title');
        const labelEl = document.getElementById('schedule-week-range-label');
        if (titleEl) titleEl.textContent = weekRangeText;
        if (labelEl) labelEl.textContent = weekRangeText;
        
        // Render Header
        const rightNow = new Date();
        const todayStr = rightNow.toDateString();

        let headerHtml = `<div class="schedule-time-col">Giờ</div>`;
        days.forEach((day, index) => {
            const currentDayDate = new Date(firstDayOfWeek);
            currentDayDate.setDate(firstDayOfWeek.getDate() + index);
            const isToday = currentDayDate.toDateString() === todayStr;
            const dateStr = formatDateVN(currentDayDate).split('/20')[0];
            
            headerHtml += `
                <div class="schedule-day-col ${isToday ? 'today-col' : ''}" 
                     style="${isToday ? 'background-color: var(--primary-50); border-bottom: 2px solid var(--primary-500);' : ''}">
                    <div style="font-weight: 600;">${day}</div>
                    <div style="font-size: 0.75rem; font-weight: 400; color: var(--text-muted); margin-top: 2px;">${dateStr}</div>
                </div>`;
        });

        // Render Body (Các khung giờ tiêu chuẩn)
        const timeSlots = [
            '08:00 - 10:00', '10:00 - 12:00', 
            '13:00 - 15:00', '15:00 - 17:00',
            '18:00 - 20:00', '20:00 - 22:00'
        ];

        let bodyHtml = '';
        timeSlots.forEach(slot => {
            bodyHtml += `<div class="schedule-time-row">${slot}</div>`;
            
            dayCodes.forEach((dayCode, index) => {
                const currentDayDate = new Date(firstDayOfWeek);
                currentDayDate.setDate(firstDayOfWeek.getDate() + index);
                const isToday = currentDayDate.toDateString() === todayStr;

                // Kiểm tra dữ liệu an toàn để tránh crash
                const match = myClasses && Array.isArray(myClasses) ? myClasses.find(c => {
                    if (!c.schedule) return false;

                    // 1. Kiểm tra Ngày bắt đầu và Kết thúc (Chỉ hiển thị nếu tuần này nằm trong khoảng học)
                    if (c.start_date && c.end_date) {
                        const classStart = new Date(c.start_date);
                        const classEnd = new Date(c.end_date);
                        
                        // Nếu ngày hiện tại của lịch nằm ngoài khoảng học của lớp -> Không hiển thị
                        if (currentDayDate < classStart || currentDayDate > classEnd) {
                            return false;
                        }
                    }

                    // 2. So khớp Thứ và Giờ
                    const classSchedule = String(c.schedule).toUpperCase();
                    return classSchedule.includes(dayCode.toUpperCase()) && 
                           classSchedule.includes(slot.split(' - ')[0]);
                }) : null;

                if (match) {
                    const isOnline = match.learning_mode === 'online';
                    bodyHtml += `
                        <div class="schedule-cell occupied ${isOnline ? 'online-class' : ''} ${isToday ? 'today-cell' : ''}" 
                             style="${isToday ? 'background-color: rgba(var(--primary-500-rgb, 79, 70, 229), 0.05);' : ''}">
                            <div class="schedule-item-content">
                                <span class="class-code">${match.code}</span>
                                <span class="class-name">${match.name}</span>
                                <span class="class-room"><i class="material-icons-outlined" style="font-size:10px">room</i> ${match.room || 'P.101'}</span>
                            </div>
                        </div>`;
                } else {
                    bodyHtml += `<div class="schedule-cell ${isToday ? 'today-cell' : ''}" 
                                      style="${isToday ? 'background-color: rgba(var(--primary-500-rgb, 79, 70, 229), 0.03);' : ''}"></div>`;
                }
            });
        });

        grid.innerHTML = `
            <div class="schedule-header-row">${headerHtml}</div>
            <div class="schedule-body-grid">${bodyHtml}</div>
        `;

    } catch (error) {
        console.error('Schedule Error:', error);
        grid.innerHTML = `
            <div class="card" style="padding:40px;text-align:center">
                <span class="material-icons-outlined" style="font-size:3rem;color:var(--gray-300)">calendar_today</span>
                <p style="margin-top:10px;color:var(--text-secondary)">Chưa có lịch học cho tuần này</p>
            </div>`;
    }
}

function changeScheduleWeek(dir) {
    loadMySchedule(dir);
}

function resetScheduleToToday() {
    currentScheduleOffset = 0;
    const picker = document.getElementById('schedule-date-picker');
    if (picker) picker.value = new Date().toISOString().split('T')[0];
    loadMySchedule(0);
}

function jumpToDate(dateStr) {
    if (!dateStr) return;
    const selected = new Date(dateStr);
    const today = new Date();
    
    // Tính số tuần lệch
    const diffTime = selected - today;
    currentScheduleOffset = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    loadMySchedule(0);
}
