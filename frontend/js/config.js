/**
 * Config - Cấu hình ứng dụng
 */
const CONFIG = {
    // URL API Backend
    API_BASE_URL: 'http://localhost:8000/api',

    // Endpoints
    ENDPOINTS: {
        // Auth
        LOGIN: '/auth/login/',
        REGISTER: '/auth/register/',
        ME: '/auth/me/',
        PROFILE: '/auth/profile/',
        CHANGE_PASSWORD: '/auth/change-password/',
        DASHBOARD: '/auth/dashboard/',

        // Users
        USERS: '/auth/users/',
        STUDENTS: '/auth/students/',
        TEACHERS: '/auth/teachers/',

        // Courses
        COURSES: '/courses/list/',
        CLASSES: '/courses/classes/',
        ENROLLMENTS: '/courses/enrollments/',

        // Payments
        PAYMENTS: '/payments/',

        // Attendance
        ATTENDANCE_SESSIONS: '/attendance/sessions/',
        ATTENDANCE_RECORDS: '/attendance/records/',
        TEACHER_ATTENDANCE: '/attendance/teacher-attendance/',

        // Test Scores
        TEST_SCORES: '/courses/scores/',
    },

    // Role labels
    ROLE_LABELS: {
        admin: 'Quản trị viên',
        staff: 'Nhân viên',
        teacher: 'Giảng viên',
        student: 'Học viên',
    },

    // Status labels
    STATUS_LABELS: {
        active: 'Đang học',
        completed: 'Hoàn thành',
        dropped: 'Đã nghỉ',
        suspended: 'Tạm nghỉ',
        upcoming: 'Sắp khai giảng',
        cancelled: 'Đã hủy',
        pending: 'Chờ thanh toán',
        paid: 'Đã thanh toán',
        overdue: 'Quá hạn',
        refunded: 'Đã hoàn tiền',
        present: 'Có mặt',
        absent: 'Vắng',
        absent_excused: 'Vắng có phép',
        absent_unexcused: 'Vắng không phép',
        // Enrollment payment/approval
        unpaid: 'Chưa thanh toán',
        deposited: 'Đã đặt cọc',
        approved: 'Đã duyệt',
        rejected: 'Từ chối',
    },

    // Chấm công giảng viên (TeacherAttendance.status)
    TEACHER_ATTENDANCE_LABELS: {
        present: 'Đúng giờ',
        late: 'Đi muộn',
        absent: 'Vắng',
        leave: 'Nghỉ có phép',
        leave_unpaid: 'Nghỉ không phép',
    },

    // Language labels
    LANGUAGE_LABELS: {
        english: 'Tiếng Anh',
        japanese: 'Tiếng Nhật',
        korean: 'Tiếng Hàn',
        chinese: 'Tiếng Trung',
        french: 'Tiếng Pháp',
        german: 'Tiếng Đức',
        other: 'Khác',
    },

    // Level labels
    LEVEL_LABELS: {
        beginner: 'Sơ cấp',
        elementary: 'Cơ bản',
        intermediate: 'Trung cấp',
        upper_intermediate: 'Trung cấp cao',
        advanced: 'Cao cấp',
    },
};
