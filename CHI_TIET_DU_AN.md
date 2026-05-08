# CHI TIẾT LUỒNG NGHIỆP VỤ DỰ ÁN FOURGUYS

---

## 1. Luồng Đăng Ký (Registration)

**Phía Frontend (`frontend/js/auth.js`):**
- Hàm `handleRegister(event)` thu thập dữ liệu từ form (họ tên, email, username, password).
- Gửi một yêu cầu POST đến API endpoint: `/api/auth/register/`.
- Mặc định, tài khoản mới đăng ký sẽ có role là `student`.

**Phía Backend (`backend/apps/accounts/`):**
- View (`views.py` - hàm `register`): Tiếp nhận dữ liệu và sử dụng `UserCreateSerializer` để xử lý.
- Serializer (`serializers.py` - class `UserCreateSerializer`):
  - Hàm `create()` sẽ băm (hash) mật khẩu bằng `user.set_password()`.
  - Đặc biệt: Nếu là học viên, hệ thống sẽ tự động tạo một mã học viên (ví dụ: `HV-a1b2c3`) và tạo bản ghi trong bảng Student liên kết với User đó.
- Token: Sau khi tạo xong, backend gọi hàm `generate_token(user)` (trong `authentication.py`) để tạo mã xác thực JWT và trả về cho frontend.

---

## 2. Luồng Đăng Nhập (Login)

**Phía Frontend (`frontend/js/auth.js`):**
- Hàm `handleLogin(event)` gửi username và password đến `/api/auth/login/`.
- Khi thành công, nó lưu token và thông tin user vào `localStorage`.
- Gọi hàm `showAppPage()` để chuyển sang giao diện chính và cập nhật thông tin người dùng trên thanh sidebar.

**Phía Backend (`backend/apps/accounts/`):**
- View (`views.py` - hàm `login`): Sử dụng `authenticate()` của Django để kiểm tra thông tin.
- Xác thực: Kiểm tra xem tài khoản có tồn tại không, mật khẩu có đúng không và tài khoản có đang bị khóa (`is_active`) không.
- Response: Trả về thông tin User kèm theo token.

---

## 3. Luồng Đăng Xuất (Logout)

**Phía Frontend (`frontend/js/auth.js`):**
- Hàm `handleLogout()` hiển thị hộp thoại xác nhận.
- Nếu đồng ý: Xóa `token` và `user` khỏi `localStorage`, đặt `currentUser = null`.
- Gọi `showLoginPage()` để quay về trang đăng nhập.

---

## 4. Luồng Đổi Mật khẩu

**Phía Frontend (`frontend/js/profile.js`):**
- Gửi `old_password` và `new_password` đến `/api/auth/change-password/`.

**Phía Backend (`backend/apps/accounts/views.py` - hàm `change_password`):**
- Kiểm tra mật khẩu cũ bằng `request.user.check_password()`.
- Nếu đúng: Đặt mật khẩu mới bằng `request.user.set_password()` và lưu lại.

---

## 5. Luồng Cập nhật Thông tin Cá nhân

**Phía Frontend (`frontend/js/profile.js`):**
- Gửi dữ liệu (tên, SĐT, địa chỉ, ảnh đại diện) đến `/api/auth/profile/` bằng PATCH.

**Phía Backend (`backend/apps/accounts/views.py` - hàm `update_profile`):**
- Hỗ trợ upload file ảnh (sử dụng `MultiPartParser`).
- Dùng `partial=True` để chỉ cập nhật những trường được gửi lên.

---

## 6. Các thành phần Xác thực & Phân quyền

- **`authentication.py`**: Chứa logic tạo và xác thực Token JWT.
  - Class `JWTAuthentication`: Mỗi khi có request, Django tự động gọi class này để giải mã Token từ Header `Authorization: Bearer <token>`, lấy `user_id` và tìm User tương ứng.
  - Hàm `generate_token(user)`: Tạo Token JWT chứa `user_id`, `username`, `role` và thời gian hết hạn (24 giờ).

- **`permissions.py`**: Định nghĩa các quyền truy cập.
  - `IsAdmin`: Chỉ admin mới được vào.
  - `IsStaffOrAdmin`: Nhân viên hoặc admin.
  - `IsTeacher`: Chỉ giảng viên.
  - `IsStudent`: Chỉ học viên.
  - `IsOwnerOrAdmin`: Chỉ chủ sở hữu dữ liệu hoặc admin.

- **`checkAuth()` (Frontend)**: Mỗi khi load lại trang, hàm này sẽ kiểm tra xem trong `localStorage` có token không. Nếu có, nó tự động đăng nhập lại cho bạn.

- **`applyRolePermissions()` (Frontend)**: Sau khi đăng nhập, hàm này sẽ dựa vào role của bạn (admin, teacher, student) để ẩn hoặc hiện các menu trên thanh sidebar (ví dụ: học sinh không thấy menu Quản lý học phí).

---

## 7. Luồng Quản lý Học viên (Admin tạo Student)

**Phía Frontend (`frontend/js/students.js`):**
- Admin nhập thông tin: username, email, password, mã học viên, trình độ.
- Gửi POST đến `/api/auth/students/`.

**Phía Backend (`backend/apps/accounts/views.py` - class `StudentViewSet`):**
- Hàm `create()` sử dụng `@transaction.atomic` để đảm bảo an toàn:
  1. Tạo User mới với role = `student`, băm mật khẩu.
  2. Tạo Student profile liên kết với User đó.
  3. Nếu bất kỳ bước nào lỗi, toàn bộ sẽ bị rollback (không lưu gì cả).
- Hàm `update()` cập nhật cả thông tin User lẫn Student cùng lúc.
- **Bảo vệ dữ liệu**: Học viên chỉ xem được profile của chính mình, Admin/Staff xem được tất cả.

---

## 8. Luồng Quản lý Giảng viên (Admin tạo Teacher)

**Phía Frontend (`frontend/js/teachers.js`):**
- Tương tự như quản lý học viên, nhưng thêm các trường: chuyên môn, ngôn ngữ, bằng cấp, kinh nghiệm, lương/giờ.

**Phía Backend (`backend/apps/accounts/views.py` - class `TeacherViewSet`):**
- Logic tương tự `StudentViewSet`: Tạo User + Teacher profile trong 1 transaction.

---

## 9. Luồng Thống kê Dashboard

**Phía Frontend (`frontend/js/dashboard.js`):**
- Hàm `loadStats()` gọi GET `/api/auth/dashboard/` để lấy dữ liệu tổng quát.
- Sử dụng thư viện Chart.js để vẽ biểu đồ doanh thu theo tháng và top khóa học.

**Phía Backend (`backend/apps/accounts/views.py` - hàm `dashboard_stats`):**
- Đếm tổng số Học viên, Giảng viên, Khóa học, Lớp học, Đăng ký.
- Tính tổng doanh thu từ bảng Payment (chỉ lấy các giao dịch đã thanh toán).
- Thống kê doanh thu 6 tháng gần nhất bằng `TruncMonth` để vẽ biểu đồ.
- Tìm Top 5 khóa học đông học viên nhất.

---

## 10. Luồng Gửi Email Tự động

**File xử lý:** `backend/apps/accounts/utils.py`

- `send_enrollment_email()`: Gửi email xác nhận khi học viên đăng ký lớp thành công. Nội dung gồm: tên lớp, lịch học, học phí, hạn thanh toán.
- `send_attendance_email()`: Gửi email thông báo khi học viên bị ghi nhận vắng mặt trong buổi học.
- `send_grade_email()`: Gửi email khi có điểm Test mới, kèm bảng điểm chi tiết và điểm trung bình.

---

## 11. Lớp gọi API chung

**File xử lý:** `frontend/js/api.js`

Đối tượng `API` là trung tâm giao tiếp giữa Frontend và Backend:
- Tự động lấy Token từ `localStorage` và gắn vào Header `Authorization: Bearer <token>`.
- Nếu server trả mã lỗi `401` (Token hết hạn): Tự động xóa token và đẩy người dùng về trang Login.
- Cung cấp 5 phương thức: `API.get()`, `API.post()`, `API.put()`, `API.patch()`, `API.delete()`.

---

## 12. Cấu hình hệ thống

- **Cài đặt Backend:** `backend/language_center/settings.py` (Kết nối MySQL, cấu hình JWT 24h, danh sách App, CORS).
- **Điều hướng API chính:** `backend/language_center/urls.py` (Nối `/api/auth/`, `/api/courses/`, `/api/payments/`, `/api/attendance/`, `/api/chat/`).
- **Cấu hình Frontend:** `frontend/js/config.js` (Chứa `API_BASE_URL = http://localhost:8000/api` và danh sách tất cả endpoint).

---

**Các file quan trọng cần xem:**
- Frontend Auth: `frontend/js/auth.js`
- Backend Views: `backend/apps/accounts/views.py`
- Backend Serializers: `backend/apps/accounts/serializers.py`
- Backend Authentication: `backend/apps/accounts/authentication.py`
- Backend Permissions: `backend/apps/accounts/permissions.py`
- Backend Utils (Email): `backend/apps/accounts/utils.py`
- Backend Models: `backend/apps/accounts/models.py`
- Backend URLs: `backend/apps/accounts/urls.py`
- Frontend API Wrapper: `frontend/js/api.js`
- Frontend Config: `frontend/js/config.js`

---

# PHẦN 2: CÁC MODULE NGHIỆP VỤ KHÁC

---

## 13. Luồng Quản lý Khóa học (Course Management)

**Phía Frontend (`frontend/js/courses.js`):**
- Hàm `loadCourses()` gọi GET `/api/courses/list/` để lấy danh sách khóa học.
- Hàm `handleCreateCourse()` thu thập thông tin (tên, mã, ngôn ngữ, trình độ, học phí, số tiết) và gửi POST `/api/courses/list/`.
- Hàm `handleEditCourse(id)` gửi PUT `/api/courses/list/{id}/` để cập nhật.
- Hàm `handleDeleteCourse(id)` gửi DELETE `/api/courses/list/{id}/` để xóa.

**Phía Backend (`backend/apps/courses/`):**
- Models (`models.py` - class `Course`): Lưu trữ tên khóa học, mã khóa học (unique), ngôn ngữ (Anh, Nhật, Hàn...), trình độ (Sơ cấp đến Cao cấp), số tiết học, học phí, trạng thái mở/đóng.
- Views (`views.py` - class `CourseViewSet`): Xử lý CRUD cho khóa học. Chỉ Admin/Staff mới tạo, sửa, xóa được.

---

## 14. Luồng Quản lý Lớp học (Class Management)

**Phía Frontend (`frontend/js/classes.js`):**
- Hàm `loadClasses()` gọi GET `/api/courses/classes/` để hiển thị danh sách lớp.
- Hàm `handleCreateClass()` gửi POST với thông tin: tên lớp, mã lớp, khóa học liên kết, giảng viên phụ trách, phòng học, lịch học, hình thức (Online/Offline), ngày bắt đầu/kết thúc.

**Phía Backend (`backend/apps/courses/`):**
- Models (`models.py` - class `ClassRoom`): Mỗi lớp thuộc 1 khóa học (`ForeignKey` đến Course) và có 1 giảng viên phụ trách (`ForeignKey` đến Teacher).
- Trạng thái lớp: `upcoming` (Sắp khai giảng), `active` (Đang học), `completed` (Đã kết thúc), `cancelled` (Đã hủy).
- Property `current_students`: Tự động đếm số học viên đang active trong lớp.
- Property `is_full`: Kiểm tra lớp đã đầy chưa bằng cách so sánh `current_students` với `max_students`.

---

## 15. Luồng Ghi danh Học viên (Enrollment)

**Phía Frontend (`frontend/js/enrollments.js`):**
- Hàm `handleEnroll()` gửi POST `/api/courses/enrollments/` với `student_id` và `classroom_id`.

**Phía Backend (`backend/apps/courses/`):**
- Models (`models.py` - class `Enrollment`): Lưu trữ việc ghi danh với 3 trạng thái riêng biệt:
  1. **Trạng thái học:** `active` (Đang học), `completed` (Hoàn thành), `dropped` (Đã nghỉ), `suspended` (Tạm nghỉ).
  2. **Trạng thái thanh toán:** `unpaid` (Chưa thanh toán), `deposited` (Đã đặt cọc), `paid` (Đã thanh toán đủ).
  3. **Trạng thái duyệt:** `pending` (Chờ duyệt), `approved` (Đã duyệt), `rejected` (Từ chối).
- Luồng nghiệp vụ: Học viên đăng ký → Nộp tiền (đặt cọc) → Admin duyệt → Bắt đầu học.
- Logic (`views.py`): Kiểm tra lớp đã đầy chưa (`is_full`) trước khi cho phép ghi danh. Nếu đầy thì từ chối.

---

## 16. Luồng Quản lý Điểm số (Test Scores / Grades)

**Phía Frontend (`frontend/js/grades.js`):**
- Hàm `loadGrades()` gọi GET `/api/courses/scores/` để lấy bảng điểm.
- Giảng viên có thể nhập điểm cho từng học viên trong lớp mình dạy.

**Phía Backend (`backend/apps/courses/`):**
- Models (`models.py` - class `TestScore`): Lưu trữ điểm test với các loại: `midterm` (Giữa kỳ), `final` (Cuối kỳ), `quiz` (Kiểm tra ngắn), `oral` (Kiểm tra miệng), `practice` (Bài tập thực hành).
- Property `score_10`: Tự động quy đổi điểm về hệ 10. Ví dụ: điểm 8/20 → quy đổi thành 4.0/10.
- Khi nhập điểm mới, hệ thống gọi `send_grade_email()` (trong `accounts/utils.py`) để gửi email thông báo cho học viên.

---

## 17. Luồng Điểm danh Học viên (Attendance)

**Phía Frontend (`frontend/js/attendance.js`):**
- Hàm `loadSessions()` gọi GET `/api/attendance/sessions/` để hiển thị danh sách buổi học.
- Hàm `createSession()` gửi POST `/api/attendance/sessions/` để tạo buổi điểm danh mới (chọn lớp, ngày, buổi thứ mấy, nội dung buổi học).
- Hàm `submitAttendance()` gửi danh sách điểm danh cả lớp: mỗi học viên có trạng thái `present` hoặc `absent`, nếu vắng phải có lý do và phân loại có phép/không phép.

**Phía Backend (`backend/apps/attendance/`):**
- Models (`models.py`):
  - `AttendanceSession`: Đại diện cho 1 buổi học. Ràng buộc `unique_together = ['classroom', 'session_date', 'session_number']` đảm bảo 1 lớp chỉ có 1 buổi điểm danh cho mỗi ngày.
  - `AttendanceRecord`: Chi tiết điểm danh từng học viên. Ràng buộc `unique_together = ['session', 'student']` đảm bảo 1 học viên chỉ có 1 trạng thái trong 1 buổi.
- Views (`views.py`):
  - Sử dụng `transaction.atomic` để đảm bảo nếu lưu 1 bản ghi lỗi thì toàn bộ buổi điểm danh sẽ rollback.
  - Sử dụng `bulk_create` để lưu hàng loạt bản ghi điểm danh chỉ trong 1 câu lệnh SQL.
  - Khi học viên bị ghi nhận vắng, hệ thống gọi `send_attendance_email()` để gửi email thông báo.

---

## 18. Luồng Chấm công Giảng viên (Teacher Attendance)

**Phía Frontend (`frontend/js/teacher-attendance.js`):**
- Ghi nhận giờ vào (`check_in`), giờ ra (`check_out`) và trạng thái làm việc của giảng viên theo ngày.

**Phía Backend (`backend/apps/attendance/`):**
- Models (`models.py` - class `TeacherAttendance`): Mỗi giảng viên chỉ có tối đa 1 bản ghi chấm công mỗi ngày (`unique_together = ['teacher', 'work_date']`).
- Trạng thái: `present` (Đúng giờ), `late` (Đi muộn), `absent` (Vắng), `leave` (Nghỉ có phép), `leave_unpaid` (Nghỉ không phép).

---

## 19. Luồng Quản lý Học phí (Payments)

**Phía Frontend (`frontend/js/payments.js`):**
- Hàm `loadPayments()` gọi GET `/api/payments/` để hiển thị danh sách hóa đơn.
- Hàm `handlePayment()` gửi thông tin thanh toán (số tiền, phương thức, mã giao dịch).

**Phía Backend (`backend/apps/payments/`):**
- Models (`models.py` - class `Payment`):
  - Liên kết với `Student` và `Enrollment`.
  - Trạng thái: `pending` (Chờ thanh toán), `verifying` (Chờ xác nhận), `paid` (Đã thanh toán), `overdue` (Quá hạn), `refunded` (Đã hoàn tiền), `cancelled` (Đã hủy).
  - Phương thức thanh toán: `cash` (Tiền mặt), `transfer` (Chuyển khoản), `card` (Thẻ).
  - Tự động tính `final_amount = amount - discount` khi lưu.
- Khi ghi danh thành công, hệ thống gọi `send_enrollment_email()` để gửi email kèm thông tin học phí và hạn thanh toán.

---

## 20. Luồng Tài liệu Bài giảng (Course Materials)

**Phía Frontend (`frontend/js/materials.js`):**
- Giảng viên upload tài liệu (PDF, Word, PowerPoint, hình ảnh, video...) cho lớp của mình.
- Học viên tải về tài liệu.

**Phía Backend (`backend/apps/courses/`):**
- Models (`models.py` - class `CourseMaterial`):
  - Khi upload, hệ thống tự động nhận diện loại file dựa trên phần mở rộng (.pdf, .docx, .mp4...).
  - Tự động tính kích thước file và lưu tên file gốc.
  - Đếm số lượt tải (`download_count`).

---

## 21. Luồng Chat / Tin nhắn

**Phía Frontend (`frontend/js/chat.js`):**
- Hàm `loadMessages()` gọi GET `/api/chat/conversations/` để lấy lịch sử tin nhắn.
- Hàm `sendMessage()` gửi POST `/api/chat/conversations/` để gửi tin nhắn mới.
- Hàm `loadUnreadCount()` gọi GET `/api/chat/unread-count/` để hiển thị số tin nhắn chưa đọc.

**Phía Backend (`backend/apps/chat/`):**
- Quản lý cuộc trò chuyện giữa các người dùng trong hệ thống.
- Hỗ trợ đánh dấu đã đọc/chưa đọc.

---

## 22. Luồng Blog & Học bổng (Landing Page)

**Phía Frontend (`frontend/js/landing.js`):**
- Hàm `loadLandingBlogs()` gọi GET `/api/courses/blog-posts/` để hiển thị bài viết trên trang chủ.
- Hàm `loadLandingScholarships()` gọi GET `/api/courses/scholarships/` để hiển thị học bổng.

**Phía Backend (`backend/apps/courses/`):**
- Models (`models.py` - class `BlogPost`): Bài viết với tiêu đề, nội dung, ảnh bìa, trạng thái công khai.
- Models (`models.py` - class `Scholarship`): Học bổng với điều kiện, giá trị, hạn nộp hồ sơ. Slug được tự động tạo từ tiêu đề.

---

**Các file quan trọng (bổ sung):**
- Courses Models: `backend/apps/courses/models.py`
- Courses Views: `backend/apps/courses/views.py`
- Courses URLs: `backend/apps/courses/urls.py`
- Attendance Models: `backend/apps/attendance/models.py`
- Attendance Views: `backend/apps/attendance/views.py`
- Payments Models: `backend/apps/payments/models.py`
- Payments Views: `backend/apps/payments/views.py`
- Chat Views: `backend/apps/chat/views.py`
- Frontend Courses: `frontend/js/courses.js`
- Frontend Classes: `frontend/js/classes.js`
- Frontend Attendance: `frontend/js/attendance.js`
- Frontend Payments: `frontend/js/payments.js`
- Frontend Chat: `frontend/js/chat.js`
- Frontend Landing: `frontend/js/landing.js`

