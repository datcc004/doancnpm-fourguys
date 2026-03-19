# 🌐 LangCenter - Hệ thống Quản lý Trung tâm Ngoại ngữ

## Mô tả dự án

Hệ thống quản lý trung tâm ngoại ngữ đầy đủ tính năng, bao gồm:

- Quản lý học viên, giảng viên (CRUD)
- Quản lý khóa học và lớp học
- Phân công giảng viên
- Quản lý học phí và thanh toán
- Điểm danh học viên
- Dashboard thống kê, báo cáo
- Phân quyền: Admin, Staff, Teacher, Student

## Công nghệ sử dụng

| Layer | Công nghệ |
|-------|-----------|
| Frontend | HTML, CSS, JavaScript (Vanilla) |
| Backend | Django 4.2, Django REST Framework |
| Database | MySQL 8.0 |
| Auth | JWT (JSON Web Token) |
| Container | Docker, Docker Compose |
| Web Server | Nginx (production) |

## Cấu trúc thư mục

```
doancnpm/
├── backend/                    # Django backend
│   ├── apps/
│   │   ├── accounts/           # User, Student, Teacher, Auth
│   │   ├── courses/            # Course, ClassRoom, Enrollment
│   │   ├── payments/           # Payment
│   │   └── attendance/         # AttendanceSession, AttendanceRecord
│   ├── language_center/        # Django project settings
│   ├── manage.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
├── frontend/                   # Static frontend
│   ├── css/                    # Stylesheets
│   │   ├── variables.css       # Design system
│   │   ├── base.css            # Reset & typography
│   │   ├── components.css      # UI components
│   │   ├── layout.css          # Layout & responsive
│   │   ├── pages.css           # Page-specific
│   │   └── animations.css      # Animations
│   ├── js/                     # JavaScript modules
│   │   ├── config.js           # API config
│   │   ├── api.js              # API client
│   │   ├── auth.js             # Authentication
│   │   ├── ui.js               # UI utilities
│   │   ├── dashboard.js        # Dashboard page
│   │   ├── students.js         # Students CRUD
│   │   ├── teachers.js         # Teachers CRUD
│   │   ├── courses.js          # Courses CRUD
│   │   ├── classes.js          # Classes CRUD
│   │   ├── enrollments.js      # Enrollments
│   │   ├── payments.js         # Payments
│   │   ├── attendance.js       # Attendance
│   │   ├── profile.js          # Profile
│   │   └── app.js              # App init
│   ├── index.html
│   ├── nginx.conf
│   └── Dockerfile
├── database/
│   └── init.sql                # MySQL init script
├── docker-compose.yml
├── .gitignore
└── README.md
```

---

## 🚀 Hướng dẫn chạy dự án

### Cách 1: Chạy bằng Docker (Khuyến nghị)

#### Yêu cầu

- Docker Desktop đã cài đặt

#### Các bước

```bash
# 1. Clone project
git clone <repo-url>
cd doancnpm

# 2. Chạy Docker Compose
docker-compose up --build

# 3. Truy cập
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/
# MySQL: localhost:3307
```

Hệ thống sẽ tự động:

- Khởi tạo MySQL database
- Chạy migrations
- Tạo dữ liệu mẫu
- Start cả backend và frontend

---

### Cách 2: Chạy thủ công (Development)

#### Yêu cầu

- Python 3.10+
- MySQL Server 8.0+
- Node.js (tùy chọn, dùng live server)

#### Bước 1: Cài đặt MySQL

```sql
-- Đăng nhập MySQL và chạy:
CREATE DATABASE language_center CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### Bước 2: Cài đặt Backend

```bash
# Vào thư mục backend
cd backend

# Tạo virtual environment
python -m venv venv

# Kích hoạt (Windows)
venv\Scripts\activate

# Cài dependencies
pip install -r requirements.txt

# Cấu hình .env
# Sửa file .env với thông tin MySQL của bạn:
# DB_HOST=localhost
# DB_USER=root
# DB_PASSWORD=your_password

# Chạy migrations
python manage.py migrate

# Tạo dữ liệu mẫu
python manage.py seed_data

# Chạy server
python manage.py runserver
```

Backend sẽ chạy tại: `http://localhost:8000`

#### Bước 3: Chạy Frontend

```bash
# Cách 1: Dùng Python HTTP Server
cd frontend
python -m http.server 3000

# Cách 2: Dùng Live Server (VS Code Extension)
# Mở frontend/index.html -> Click "Go Live"

# Cách 3: Dùng Node.js
npx -y serve frontend -l 3000
```

Frontend sẽ chạy tại: `http://localhost:3000`

⚠️ **Lưu ý:** Cập nhật `API_BASE_URL` trong `frontend/js/config.js` nếu backend chạy ở host/port khác.

---

## 📋 Tài khoản demo

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Nhân viên | `staff01` | `staff123` |
| Giảng viên | `gv001` | `teacher123` |
| Học viên | `hv001` | `student123` |

---

## 📡 API Endpoints

### Auth

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/login/` | Đăng nhập |
| POST | `/api/auth/register/` | Đăng ký |
| GET | `/api/auth/me/` | Thông tin user |
| PUT | `/api/auth/profile/` | Cập nhật profile |
| POST | `/api/auth/change-password/` | Đổi mật khẩu |
| GET | `/api/auth/dashboard/` | Dashboard stats |

### CRUD Resources

| Resource | Endpoint | Actions |
|----------|----------|---------|
| Users | `/api/auth/users/` | GET, POST, PUT, DELETE |
| Students | `/api/auth/students/` | GET, POST, PUT, DELETE |
| Teachers | `/api/auth/teachers/` | GET, POST, PUT, DELETE |
| Courses | `/api/courses/list/` | GET, POST, PUT, DELETE |
| Classes | `/api/courses/classes/` | GET, POST, PUT, DELETE |
| Enrollments | `/api/courses/enrollments/` | GET, POST, PATCH, DELETE |
| Payments | `/api/payments/` | GET, POST, PATCH |
| Attendance | `/api/attendance/sessions/` | GET, POST |

---

## 🔐 Phân quyền

| Chức năng | Admin | Staff | Teacher | Student |
|-----------|:-----:|:-----:|:-------:|:-------:|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Quản lý học viên | ✅ | ✅ | ❌ | ❌ |
| Quản lý giảng viên | ✅ | ✅ | ❌ | ❌ |
| Xem khóa học | ✅ | ✅ | ✅ | ✅ |
| CRUD khóa học | ✅ | ✅ | ❌ | ❌ |
| Quản lý lớp học | ✅ | ✅ | ❌ | ❌ |
| Đăng ký lớp | ✅ | ✅ | ❌ | ❌ |
| Quản lý học phí | ✅ | ✅ | ❌ | ❌ |
| Điểm danh | ✅ | ✅ | ✅ | ✅ |

---

## 🗄️ Database Schema

```
users ─────────┐
               ├── students ──── enrollments ──── classes ──── courses
               ├── teachers ─────────────────────┘
               │
               ├── payments (linked to students & enrollments)
               │
               └── attendance_sessions ──── attendance_records (linked to students)
```

---

## Tác giả

FourGuys
