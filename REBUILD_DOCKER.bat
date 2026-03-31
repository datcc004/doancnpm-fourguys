@echo off
echo.
echo [1/3] Dừng và xóa toàn bộ các container hiện có...
docker-compose down -v

echo.
echo [2/3] Xây dựng lại các image mới từ mã nguồn...
docker-compose build --no-cache

echo.
echo [3/3] Khởi chạy hệ thống trung tâm ngoại ngữ (lc)...
docker-compose up -d

echo.
echo ========================================================
echo DỰ ÁN ĐÃ ĐƯỢC TẠO LẠI VÀ ĐANG CHẠY TRONG DOCKER
echo Các dịch vụ:
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:8000 (API: http://localhost:8000/api/)
echo - Adminer:  http://localhost:8080 (DB Gui)
echo - MySQL:    localhost:3307 (Ngoài Docker)
echo ========================================================
pause
