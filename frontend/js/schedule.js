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
                        <input type="text" id="schedule-date-picker" class="filter-select" placeholder="Chọn ngày..." readonly>
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

    loadScheduleData();
}

async function loadScheduleData() {
    try {
        const classes = await API.get(`${CONFIG.ENDPOINTS.CLASSES}my_classes/`);
        const myClasses = classes.results || classes;
        
        // 1. Tính toán danh sách ngày học tại chỗ (Frontend) để nhanh hơn và không bị lỗi đồng bộ
        const allScheduledDatesSet = new Set();
        myClasses.forEach(c => {
            const dates = getLocalScheduledDates(c);
            dates.forEach(d => allScheduledDatesSet.add(d));
        });
        const allScheduledDates = Array.from(allScheduledDatesSet);

        // 2. Khởi tạo Flatpickr
        flatpickr("#schedule-date-picker", {
            locale: "vn",
            dateFormat: "Y-m-d",
            onDayCreate: (dObj, dStr, fp, dayElem) => {
                const date = dayElem.dateObj;
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                if (allScheduledDates.includes(dateKey)) {
                    dayElem.classList.add("has-class-highlight");
                    dayElem.innerHTML += '<span class="class-dot"></span>';
                }
            },
            onChange: (selectedDates, dateStr) => {
                jumpToDate(dateStr);
            }
        });
        
        loadMySchedule(0, myClasses);
    } catch (e) {
        console.error('Data error:', e);
    }
}

// Hàm tính toán ngày học dựa trên start, end và schedule (T2-T4-T6)
function getLocalScheduledDates(c) {
    if (!c || !c.start_date || !c.end_date || !c.schedule) return [];
    const dates = [];
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    const schedule = String(c.schedule).toUpperCase();
    
    // 0=Sun, 1=Mon, ..., 6=Sat
    const mapping = { 'T2': 1, 'T3': 2, 'T4': 3, 'T5': 4, 'T6': 5, 'T7': 6, 'CN': 0 };
    const activeDays = [];
    for (let key in mapping) { if (schedule.includes(key)) activeDays.push(mapping[key]); }
    
    let curr = new Date(start);
    while (curr <= end) {
        if (activeDays.includes(curr.getDay())) {
            dates.push(`${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`);
        }
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

let currentScheduleOffset = 0;

async function loadMySchedule(offset = 0, preloadedClasses = null) {
    currentScheduleOffset += offset;
    const grid = document.getElementById('schedule-grid');
    
    try {
        const myClasses = preloadedClasses || await (async () => {
            const classes = await API.get(`${CONFIG.ENDPOINTS.CLASSES}my_classes/`);
            return classes.results || classes;
        })();

        // Hiển thị trạng thái trống nếu không có lớp nào
        if (!myClasses || myClasses.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="padding: 60px 20px; text-align: center; background: white; border-radius: 12px;">
                    <span class="material-icons-outlined" style="font-size: 4rem; color: var(--gray-300); margin-bottom: 20px;">calendar_today</span>
                    <h3 style="color: var(--text-primary); margin-bottom: 10px;">Bạn chưa có lớp học nào</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 24px; max-width: 400px; margin-left: auto; margin-right: auto;">
                        Lịch học sẽ hiển thị tại đây sau khi bạn đăng ký và được xếp vào lớp học chính thức.
                    </p>
                    <button class="btn btn-primary" onclick="navigate('courses')">
                        <span class="material-icons-outlined">explore</span>
                        <span>Khám phá khóa học ngay</span>
                    </button>
                </div>
            `;
            // Cập nhật title/label thành dấu gạch ngang
            const titleEl = document.getElementById('schedule-week-range-title');
            const labelEl = document.getElementById('schedule-week-range-label');
            if (titleEl) titleEl.textContent = "-- / --";
            if (labelEl) labelEl.textContent = "-- / --";
            return;
        }

        // Khai báo các ngày trong tuần (Cần thiết cho phần render bên dưới)
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
                    if (!classSchedule.includes(dayCode.toUpperCase())) return false;
                    
                    const timeMatch = classSchedule.match(/(\d{1,2}):\d{2}/);
                    if (timeMatch) {
                        const classStartHour = parseInt(timeMatch[1]);
                        const slotStartHour = parseInt(slot.split(':')[0]);
                        
                        // Các ca học thường kéo dài 2-2.5 giờ.
                        // So khớp nếu giờ bắt đầu của lớp học nằm trong khoảng [slotStartHour, slotStartHour + 2]
                        let slotEndHour = slotStartHour + 2;
                        if (slotStartHour === 15) slotEndHour = 18; // Cho phép ca 15h kéo dài đến 18h
                        
                        return classStartHour >= slotStartHour && classStartHour < slotEndHour;
                    }

                    return classSchedule.includes(slot.split(' - ')[0]);
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
