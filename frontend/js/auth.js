/**
 * Auth Module - Xác thực và phân quyền
 */
let currentUser = null;

/**
 * Đăng nhập
 */
async function handleLogin(event) {
    event.preventDefault();
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    // Disable button
    btn.disabled = true;
    btn.innerHTML = '<span>Đang đăng nhập...</span>';
    errorDiv.classList.add('hidden');

    try {
        const data = await API.post(CONFIG.ENDPOINTS.LOGIN, { username, password });
        // Lưu token và user
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;

        showToast('Đăng nhập thành công!', 'success');
        showAppPage();
    } catch (error) {
        const msg = error.data?.error || 'Đăng nhập thất bại';
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Đăng nhập</span><span class="material-icons-outlined">arrow_forward</span>';
    }
}

/**
 * Hiển thị toggle giữa form Đăng nhập và Đăng ký
 */
function toggleAuthForm(formType) {
    const loginContainer = document.getElementById('login-container');
    const registerContainer = document.getElementById('register-container');
    
    if (formType === 'register') {
        loginContainer.classList.add('hidden');
        registerContainer.classList.remove('hidden');
    } else {
        registerContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    }
}

/**
 * Đăng ký tài khoản
 */
async function handleRegister(event) {
    event.preventDefault();
    const btn = document.getElementById('reg-btn');
    const errorDiv = document.getElementById('reg-error');
    
    const firstname = document.getElementById('reg-firstname').value;
    const lastname = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;

    btn.disabled = true;
    btn.innerHTML = '<span>Đang đăng ký...</span>';
    errorDiv.classList.add('hidden');

    try {
        const payload = {
            first_name: firstname,
            last_name: lastname,
            email: email,
            username: username,
            password: password,
            role: 'student' // Mặc định tự đăng ký là học viên
        };
        
        const data = await API.post(CONFIG.ENDPOINTS.REGISTER, payload);
        
        // Tự động đăng nhập luôn
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;

        showToast('Đăng ký thành công!', 'success');
        showAppPage();
        
    } catch (error) {
        let msg = 'Đăng ký thất bại';
        if (error.data) {
            // Hiển thị object error object messages if available
            if (typeof error.data === 'object' && !error.data.error) {
                const msgs = Object.values(error.data).flat();
                if (msgs.length > 0) msg = msgs[0];
            } else {
                msg = error.data.error || 'Đăng ký thất bại';
            }
        }
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Đăng ký</span><span class="material-icons-outlined">person_add</span>';
    }
}

/**
 * Đăng xuất
 */
async function handleLogout() {
    const confirmed = await showConfirm('Xác nhận đăng xuất', 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?');
    if (!confirmed) return;

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    showLoginPage();
    showToast('Đã đăng xuất', 'info');
}

/**
 * Kiểm tra đăng nhập
 */
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');

    if (token && user) {
        currentUser = JSON.parse(user);
        showAppPage();
        return true;
    }

    showLoginPage();
    return false;
}

/**
 * Hiển thị trang login
 */
function showLoginPage() {
    document.getElementById('login-page').classList.add('active');
    document.getElementById('app-container').classList.add('hidden');
    // Reset form
    document.getElementById('login-form').reset();
    document.getElementById('login-error').classList.add('hidden');
}

/**
 * Hiển thị trang app
 */
function showAppPage() {
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('app-container').classList.remove('hidden');

    // Cập nhật sidebar user info
    updateUserInfo();
    // Ẩn menu theo role
    applyRolePermissions();
    // Load dashboard
    navigate('dashboard');
}

/**
 * Cập nhật thông tin user trên sidebar
 */
function updateUserInfo() {
    if (!currentUser) return;
    const name = `${currentUser.last_name} ${currentUser.first_name}`;
    document.getElementById('sidebar-username').textContent = name;
    document.getElementById('sidebar-role').textContent = CONFIG.ROLE_LABELS[currentUser.role] || currentUser.role;
    
    const avatarEl = document.getElementById('sidebar-avatar');
    if (currentUser.avatar) {
        const url = currentUser.avatar.startsWith('http') ? currentUser.avatar : (CONFIG.API_BASE_URL.replace('/api','') + currentUser.avatar);
        avatarEl.innerHTML = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit">`;
    } else {
        avatarEl.textContent = (currentUser.first_name || 'U')[0].toUpperCase();
    }
}

/**
 * Phân quyền menu theo role
 */
function applyRolePermissions() {
    if (!currentUser) return;
    const role = currentUser.role;

    document.querySelectorAll('.nav-item[data-roles]').forEach(item => {
        const allowedRoles = item.dataset.roles.split(',');
        if (allowedRoles.includes(role)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Kiểm tra quyền
 */
function hasRole(...roles) {
    return currentUser && roles.includes(currentUser.role);
}

/**
 * Điền thông tin demo
 */
function fillDemo(username, password) {
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = password;
}
