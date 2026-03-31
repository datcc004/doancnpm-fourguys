@echo off
title FourGuys - Manual Startup
echo ==================================================
echo   FOURGUYS - HE THONG QUAN LY TRUNG TAM NGOAI NGU
echo ==================================================
echo.

:: 1. Kiem tra Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Khong tim thay Python! Hay vao python.org tai ve va nho chon "Add to PATH".
    pause
    exit /b
)

:: 2. Setup Venv va Backend
echo [1/3] Dang chuan bi moi truong Backend...
cd backend
if not exist .venv (
    echo Dang tao moi truong ao (.venv)...
    python -m venv .venv
)
call .venv\Scripts\activate
echo Dang cai dat thu vien (python -m pip install -r requirements.txt)...
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt >nul

echo [2/3] Dang cap nhat Database (python manage.py migrate)...
python manage.py migrate

:: 3. Chay Backend va Frontend trong cua so moi
echo [3/3] Dang khoi dong cac dich vu...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.

start "Backend Server" cmd /c "call .venv\Scripts\activate && python manage.py runserver"
cd ..
cd frontend
start "Frontend Server" cmd /c "echo Dang chay Frontend tai http://localhost:3000 && python -m http.server 3000"

echo [SUCCESS] Ung dung da khoi dong thanh cong! 
echo Vui long mo trinh duyet truy cap: http://localhost:3000
echo.
pause
