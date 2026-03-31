# Git Workflow & Phát triển Nhóm (Hướng dẫn)

## 1. Chiến lược nhánh (Git Flow đơn giản)

- **`main`**: Nhánh ổn định nhất, chứa mã nguồn đã sẵn sàng triển khai thực tế.
- **`develop`**: Nhánh phát triển chính. Mọi tính năng mới sẽ được merge vào đây trước khi đẩy lên `main`.
- **`feature/tên-tính-năng`**: Nhánh con cho từng nhiệm vụ (ví dụ: `feature/dang-ky-khoa-hoc`).
- **`fix/tên-lỗi`**: Nhánh sửa lỗi khẩn cấp.

### Quy trình làm việc nhóm

1. Luôn `git pull origin develop` trước khi tạo nhánh mới.
2. Tạo nhánh: `git checkout -b feature/dang-ky-khoa-hoc`.
3. Sau khi hoàn thành, đẩy lên: `git push origin feature/dang-ky-khoa-hoc`.
4. Tạo **Pull Request (PR)** trên GitHub/GitLab vào nhánh `develop`.
5. Thành viên khác review code trước khi merge.

## 2. Quy ước thông điệp Commit (Conventional Commits)

Để lịch sử Git sạch sẽ và dễ theo dõi:

- `feat`: Thêm tính năng mới (ví dụ: `feat: add payment creation on enrollment`)
- `fix`: Sửa lỗi (ví dụ: `fix: validate class status before enrolling`)
- `refactor`: Tái cấu trúc mã nguồn (ví dụ: `refactor: extract enrollment logic to service`)
- `docs`: Cập nhật tài liệu/hướng dẫn.
- `chore`: Cập nhật cấu trúc file, thư viện, cài đặt.

## 3. Cấu trúc mã nguồn dễ mở rộng (Scalability)

- **Apps riêng biệt**: Tiếp tục chia nhỏ các ứng dụng (apps) trong Django như hiện tại (`courses`, `accounts`, `payments`, `attendance`).
- **Service Layer**: Mọi logic nghiệp vụ (business logic) để trong file `services.py` của từng app. Tránh viết logic phức tạp trong `views.py` hay `models.py`.
- **Environment Variables**: Tất cả cấu hình (DB, API Key, Secret Key) để trong file `.env`. **Tuyệt đối không đẩy file `.env` lên Git**.

## 4. Quản lý Quy trình đào tạo (Training Management)

- Lớp học cần có trạng thái rõ ràng: `Sắp khai giảng` -> `Đang học` -> `Kết thúc`.
- Chỉ cho phép đăng ký vào lớp `Sắp khai giảng`.
- Mỗi lượt đăng ký (`Enrollment`) sẽ đi kèm một yêu cầu thanh toán (`Payment`) ở trạng thái `Chờ thanh toán`.
- Học viên chỉ chính thức có tên trong danh sách lớp khi đã `Đã thanh toán` (hoặc theo quy định cụ thể của trung tâm).
