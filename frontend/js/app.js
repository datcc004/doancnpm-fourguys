/**
 * App Initialization - Khởi tạo ứng dụng
 */
document.addEventListener('DOMContentLoaded', () => {
    // Kiểm tra đăng nhập
    checkAuth();

    // Đóng sidebar khi click ngoài (mobile)
    document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !e.target.closest('.mobile-menu')) {
            sidebar.classList.remove('open');
        }
    });

    // ESC để đóng modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeConfirm(false);
        }
    });

    console.log('🌐 LangCenter - Hệ thống quản lý trung tâm ngoại ngữ');
    console.log('📡 API:', CONFIG.API_BASE_URL);

    // Hiệu ứng sóng nước khi di chuột ở vùng ngoài (login-left)
    const loginLeft = document.querySelector('.login-left');
    if (loginLeft) {
        let lastRippleTime = 0;
        loginLeft.addEventListener('mousemove', function(e) {
            const now = Date.now();
            if (now - lastRippleTime < 50) return; // throttle để ko lag (20 ripples/sec)
            lastRippleTime = now;
            
            const ripple = document.createElement('div');
            ripple.className = 'mouse-ripple';
            // Căn tọa độ theo cửa sổ chuột
            ripple.style.left = e.clientX + 'px';
            ripple.style.top = e.clientY + 'px';
            document.body.appendChild(ripple);
            
            // Xóa phần tử sau khi animation kết thúc
            setTimeout(() => {
                ripple.remove();
            }, 800);
        });
    }
});
