/**
 * Profile Page - Thông tin cá nhân
 */
console.log('✅ profile.js loaded');
async function renderProfile() {
    const content = document.getElementById('content-area');

    if (!currentUser) {
        content.innerHTML = '<div class="empty-state"><h3>Không có thông tin</h3></div>';
        return;
    }

    const u = currentUser;
    const initials = (u.first_name || 'U')[0].toUpperCase();
    const avatarUrl = u.avatar ? (u.avatar.startsWith('http') ? u.avatar : (CONFIG.API_BASE_URL.replace('/api','') + u.avatar)) : null;

    let html = `<div class="page-enter">
        <div class="profile-header">
            <div class="profile-avatar-container" onclick="document.getElementById('avatar-input').click()" style="cursor:pointer; position:relative">
                ${avatarUrl ? 
                    `<img src="${avatarUrl}" id="profile-avatar-img" class="profile-avatar-large" style="object-fit:cover">` : 
                    `<div class="profile-avatar-large" id="profile-avatar-initials">${initials}</div>`
                }
                <div class="avatar-overlay">
                    <span class="material-icons-outlined">photo_camera</span>
                </div>
                <input type="file" id="avatar-input" style="display:none" accept="image/*" onchange="previewAvatar(this)">
            </div>
            <div class="profile-meta">
                <h2>${u.last_name} ${u.first_name}</h2>
                <p>${CONFIG.ROLE_LABELS[u.role] || u.role} | ${u.email}</p>
                <p style="color:var(--text-muted);font-size:0.85rem">@${u.username} • Tham gia ${formatDate(u.created_at)}</p>
                <div id="avatar-save-btn" style="display:none; margin-top:10px">
                    <button class="btn btn-sm btn-success" onclick="uploadAvatar()">Lưu ảnh mới</button>
                    <button class="btn btn-sm btn-secondary" onclick="renderProfile()">Hủy</button>
                </div>
            </div>
        </div>

        <div class="charts-grid">
            <div class="card">
                <div class="card-header"><h3>Thông tin cá nhân</h3></div>
                <form onsubmit="return updateProfile(event)">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Họ</label>
                            <input type="text" name="last_name" value="${u.last_name || ''}">
                        </div>
                        <div class="form-group">
                            <label>Tên</label>
                            <input type="text" name="first_name" value="${u.first_name || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <input type="email" name="email" value="${u.email || ''}">
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Số điện thoại</label>
                            <input type="text" name="phone" value="${u.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label>Giới tính</label>
                            <select name="gender" class="form-control">
                                <option value="">Chưa chọn</option>
                                <option value="male" ${u.gender === 'male' ? 'selected' : ''}>Nam</option>
                                <option value="female" ${u.gender === 'female' ? 'selected' : ''}>Nữ</option>
                                <option value="other" ${u.gender === 'other' ? 'selected' : ''}>Khác</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Ngày sinh</label>
                            <input type="date" name="date_of_birth" value="${u.date_of_birth || ''}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Quê quán (Nơi sinh)</label>
                        <input type="text" name="hometown" value="${u.hometown || ''}">
                    </div>
                    <div class="form-group">
                        <label>Địa chỉ thường trú</label>
                        <input type="text" name="address" value="${u.address || ''}">
                    </div>
                    <button type="submit" class="btn btn-primary">Cập nhật thông tin</button>
                </form>
            </div>

            <div class="card">
                <div class="card-header"><h3>Đổi mật khẩu</h3></div>
                <form onsubmit="return changePassword(event)">
                    <div class="form-group">
                        <label>Mật khẩu cũ</label>
                        <input type="password" name="old_password" required>
                    </div>
                    <div class="form-group">
                        <label>Mật khẩu mới</label>
                        <input type="password" name="new_password" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-warning">Đổi mật khẩu</button>
                </form>
            </div>
        </div>
    </div>`;

    content.innerHTML = html;
}

async function updateProfile(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);

    try {
        const updated = await API.put(CONFIG.ENDPOINTS.PROFILE, data);
        // Cập nhật local user
        currentUser = { ...currentUser, ...updated };
        localStorage.setItem('user', JSON.stringify(currentUser));
        updateUserInfo();
        showToast('Cập nhật thành công', 'success');
    } catch (error) {
        showToast('Lỗi cập nhật', 'error');
    }
    return false;
}

async function changePassword(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData);

    try {
        await API.post(CONFIG.ENDPOINTS.CHANGE_PASSWORD, data);
        showToast('Đổi mật khẩu thành công', 'success');
        event.target.reset();
    } catch (error) {
        const msg = error.data?.error || 'Lỗi đổi mật khẩu';
        showToast(msg, 'error');
    }
    return false;
}

function previewAvatar(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const imgEl = document.getElementById('profile-avatar-img');
            const initialEl = document.getElementById('profile-avatar-initials');
            
            if (imgEl) {
                imgEl.src = e.target.result;
            } else if (initialEl) {
                // Tạo thẻ img mới
                const newImg = document.createElement('img');
                newImg.id = 'profile-avatar-img';
                newImg.src = e.target.result;
                newImg.className = 'profile-avatar-large';
                newImg.style.objectFit = 'cover';
                
                // Thay thế initials bằng img nhưng giữ nguyên các phần tử khác (như input)
                initialEl.parentNode.insertBefore(newImg, initialEl);
                initialEl.remove();
            }
            const saveBtn = document.getElementById('avatar-save-btn');
            if (saveBtn) saveBtn.style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    }
}

async function uploadAvatar() {
    console.log('uploadAvatar triggered');
    const input = document.getElementById('avatar-input');
    if (!input || !input.files || !input.files[0]) {
        console.warn('No file selected');
        showToast('Vui lòng chọn ảnh trước khi lưu', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('avatar', input.files[0]);

    try {
        showToast('Đang kết nối server...', 'info');
        console.log('Sending PATCH request to:', CONFIG.ENDPOINTS.PROFILE);
        const updated = await API.patch(CONFIG.ENDPOINTS.PROFILE, formData);
        console.log('Upload success:', updated);
        
        currentUser = { ...currentUser, ...updated };
        localStorage.setItem('user', JSON.stringify(currentUser));
        
        updateUserInfo();
        renderProfile();
        showToast('Đã cập nhật ảnh đại diện thành công!', 'success');
    } catch (error) {
        console.error('Final Upload Error:', error);
        let msg = 'Lỗi hệ thống';
        if (error.data) {
             msg = typeof error.data === 'string' ? error.data : JSON.stringify(error.data);
        }
        showToast('Lỗi: ' + msg, 'error');
    }
}
