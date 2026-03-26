-- ============================================
-- Database: Hệ thống quản lý trung tâm ngoại ngữ
-- ============================================

CREATE DATABASE IF NOT EXISTS language_center
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE language_center;

-- Tạo user cho ứng dụng
CREATE USER IF NOT EXISTS 'lc_user'@'%' IDENTIFIED BY 'lc_password_123';
GRANT ALL PRIVILEGES ON language_center.* TO 'lc_user'@'%';
FLUSH PRIVILEGES;
