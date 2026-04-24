/**
 * Materials Module - Quản lý tài liệu bài giảng
 * - Giảng viên: Upload/Sửa/Xóa tài liệu cho lớp mình dạy
 * - Học viên: Xem/Tải tài liệu của lớp mình đang học
 * - Admin/Staff: Toàn quyền
 */

// Icon mapping theo loại file
const FILE_TYPE_ICONS = {
    pdf: { icon: 'picture_as_pdf', color: '#E53E3E', bg: '#FFF5F5' },
    doc: { icon: 'description', color: '#2B6CB0', bg: '#EBF8FF' },
    xls: { icon: 'table_chart', color: '#2F855A', bg: '#F0FFF4' },
    ppt: { icon: 'slideshow', color: '#C05621', bg: '#FFFAF0' },
    image: { icon: 'image', color: '#6B46C1', bg: '#FAF5FF' },
    video: { icon: 'videocam', color: '#B83280', bg: '#FFF5F7' },
    audio: { icon: 'audiotrack', color: '#2C7A7B', bg: '#E6FFFA' },
    archive: { icon: 'archive', color: '#744210', bg: '#FFFFF0' },
    other: { icon: 'insert_drive_file', color: '#4A5568', bg: '#F7FAFC' },
};

let materialsClassList = [];

async function renderMaterials() {
    const content = document.getElementById('content-area');
    const isTeacherOrAdmin = hasRole('admin', 'staff', 'teacher');

    // Load danh sách lớp
    try {
        const data = await API.get(CONFIG.ENDPOINTS.CLASSES + 'my_classes/');
        materialsClassList = Array.isArray(data) ? data : (data.results || []);
    } catch (e) {
        materialsClassList = [];
    }

    const classOptions = materialsClassList.map(c =>
        `<option value="${c.id}">${c.code} - ${c.name}</option>`
    ).join('');

    let html = `<div class="page-enter">
        <div class="toolbar">
            <div class="toolbar-left">
                <select class="filter-select" id="material-class-filter" onchange="loadMaterials()" style="min-width: 260px;">
                    <option value="">-- Chọn lớp học --</option>
                    ${classOptions}
                </select>
                <select class="filter-select" id="material-type-filter" onchange="loadMaterials()">
                    <option value="">Tất cả loại</option>
                    <option value="pdf">PDF</option>
                    <option value="doc">Word</option>
                    <option value="xls">Excel</option>
                    <option value="ppt">PowerPoint</option>
                    <option value="image">Hình ảnh</option>
                    <option value="video">Video</option>
                    <option value="other">Khác</option>
                </select>
            </div>
            ${isTeacherOrAdmin ? `
            <div class="toolbar-right">
                <button class="btn btn-primary" onclick="openUploadMaterialModal()" id="btn-upload-material">
                    <span class="material-icons-outlined">cloud_upload</span>
                    <span>Tải lên tài liệu</span>
                </button>
            </div>` : ''}
        </div>

        <div id="materials-container">
            <div class="materials-empty-state">
                <div class="materials-empty-icon">
                    <span class="material-icons-outlined">folder_open</span>
                </div>
                <h3>Chọn lớp học để xem tài liệu</h3>
                <p>Hãy chọn một lớp học từ danh sách phía trên để xem các tài liệu bài giảng.</p>
            </div>
        </div>
    </div>`;

    content.innerHTML = html;

    // Auto-select first class if only one
    if (materialsClassList.length === 1) {
        document.getElementById('material-class-filter').value = materialsClassList[0].id;
        loadMaterials();
    }
}

async function loadMaterials() {
    const classId = document.getElementById('material-class-filter')?.value;
    const fileType = document.getElementById('material-type-filter')?.value;
    const container = document.getElementById('materials-container');

    if (!classId) {
        container.innerHTML = `
            <div class="materials-empty-state">
                <div class="materials-empty-icon">
                    <span class="material-icons-outlined">folder_open</span>
                </div>
                <h3>Chọn lớp học để xem tài liệu</h3>
                <p>Hãy chọn một lớp học từ danh sách phía trên để xem các tài liệu bài giảng.</p>
            </div>`;
        return;
    }

    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        const params = { classroom: classId };
        if (fileType) params.file_type = fileType;

        const data = await API.get(CONFIG.ENDPOINTS.MATERIALS, params);
        const materials = data.results || data;

        if (!materials.length) {
            const isTeacherOrAdmin = hasRole('admin', 'staff', 'teacher');
            container.innerHTML = `
                <div class="materials-empty-state">
                    <div class="materials-empty-icon">
                        <span class="material-icons-outlined">cloud_off</span>
                    </div>
                    <h3>Chưa có tài liệu nào</h3>
                    <p>${isTeacherOrAdmin ? 'Hãy tải lên tài liệu bài giảng đầu tiên cho lớp học này.' : 'Giảng viên chưa tải lên tài liệu nào cho lớp học này.'}</p>
                    ${isTeacherOrAdmin ? `<button class="btn btn-primary" onclick="openUploadMaterialModal()" style="margin-top: 16px;">
                        <span class="material-icons-outlined">cloud_upload</span> Tải lên ngay
                    </button>` : ''}
                </div>`;
            return;
        }

        // Render material cards
        const selectedClass = materialsClassList.find(c => c.id == classId);
        const className = selectedClass ? `${selectedClass.code} - ${selectedClass.name}` : '';

        container.innerHTML = `
            <div class="materials-header">
                <div class="materials-header-info">
                    <h3><span class="material-icons-outlined">library_books</span> Tài liệu lớp ${className}</h3>
                    <span class="badge badge-info">${materials.length} tài liệu</span>
                </div>
            </div>
            <div class="materials-grid">
                ${materials.map(m => renderMaterialCard(m)).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Load materials error:', error);
        container.innerHTML = `
            <div class="materials-empty-state">
                <div class="materials-empty-icon" style="color: var(--danger-500);">
                    <span class="material-icons-outlined">error</span>
                </div>
                <h3>Lỗi tải dữ liệu</h3>
                <p>Không thể tải danh sách tài liệu. Vui lòng thử lại.</p>
            </div>`;
    }
}

function renderMaterialCard(m) {
    const typeInfo = FILE_TYPE_ICONS[m.file_type] || FILE_TYPE_ICONS.other;
    const isOwnerOrAdmin = hasRole('admin', 'staff') || (currentUser && m.uploaded_by === currentUser.id);

    return `
        <div class="material-card">
            <div class="material-card-icon" style="background: ${typeInfo.bg}; color: ${typeInfo.color};">
                <span class="material-icons-outlined">${typeInfo.icon}</span>
            </div>
            <div class="material-card-body">
                <h4 class="material-card-title" title="${m.title}">${m.title}</h4>
                ${m.description ? `<p class="material-card-desc">${m.description}</p>` : ''}
                <div class="material-card-meta">
                    <span><span class="material-icons-outlined">person</span> ${m.uploaded_by_name}</span>
                    <span><span class="material-icons-outlined">schedule</span> ${formatDate(m.created_at)}</span>
                    <span><span class="material-icons-outlined">save</span> ${m.file_size_display}</span>
                    <span><span class="material-icons-outlined">download</span> ${m.download_count} lượt</span>
                </div>
                <div class="material-card-filename">
                    <span class="material-icons-outlined">attach_file</span> ${m.original_filename || 'Tệp đính kèm'}
                </div>
            </div>
            <div class="material-card-actions">
                <button class="btn btn-sm btn-primary" onclick="downloadMaterial(${m.id}, '${m.file_url || ''}')" title="Tải xuống">
                    <span class="material-icons-outlined">download</span>
                    Tải xuống
                </button>
                ${isOwnerOrAdmin ? `
                    <button class="btn-action danger" onclick="deleteMaterial(${m.id})" title="Xóa">
                        <span class="material-icons-outlined">delete</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function openUploadMaterialModal() {
    const classId = document.getElementById('material-class-filter')?.value;

    // Build class options for modal
    const classOptions = materialsClassList.map(c =>
        `<option value="${c.id}" ${c.id == classId ? 'selected' : ''}>${c.code} - ${c.name}</option>`
    ).join('');

    const html = `
        <form id="upload-material-form" onsubmit="return submitMaterial(event)" enctype="multipart/form-data">
            <div class="form-group">
                <label>Lớp học *</label>
                <select name="classroom" id="material-upload-class" required>
                    <option value="">-- Chọn lớp --</option>
                    ${classOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Tiêu đề tài liệu *</label>
                <input type="text" name="title" placeholder="VD: Slide bài 1 - Ngữ pháp cơ bản" required>
            </div>
            <div class="form-group">
                <label>Mô tả</label>
                <textarea name="description" rows="3" placeholder="Mô tả ngắn về tài liệu (không bắt buộc)"></textarea>
            </div>
            <div class="form-group">
                <label>Chọn tệp *</label>
                <div class="upload-drop-zone" id="upload-drop-zone">
                    <input type="file" name="file" id="material-file-input" required 
                           accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip,.rar,.7z"
                           onchange="handleFileSelect(this)">
                    <div class="upload-drop-content" id="upload-drop-content">
                        <span class="material-icons-outlined" style="font-size: 3rem; color: var(--primary-400);">cloud_upload</span>
                        <p style="font-weight: 600; margin-top: 10px;">Kéo & thả tệp vào đây</p>
                        <p style="color: var(--text-muted); font-size: 0.85rem;">hoặc nhấp để chọn tệp</p>
                        <p style="color: var(--text-muted); font-size: 0.75rem; margin-top: 8px;">
                            Hỗ trợ: PDF, Word, Excel, PPT, Hình ảnh, Video, MP3, ZIP (Tối đa 50MB)
                        </p>
                    </div>
                    <div class="upload-file-preview hidden" id="upload-file-preview">
                        <span class="material-icons-outlined" id="preview-file-icon">insert_drive_file</span>
                        <div>
                            <p id="preview-file-name" style="font-weight: 600;"></p>
                            <p id="preview-file-size" style="font-size: 0.8rem; color: var(--text-muted);"></p>
                        </div>
                        <button type="button" class="btn-action danger" onclick="clearFileInput()" title="Xóa file">
                            <span class="material-icons-outlined">close</span>
                        </button>
                    </div>
                </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" id="btn-submit-material">
                <span class="material-icons-outlined">cloud_upload</span>
                Tải lên
            </button>
        </form>
    `;

    openModal('Tải lên Tài liệu Bài giảng', html);

    // Setup drag & drop
    setTimeout(() => setupDragDrop(), 100);
}

function setupDragDrop() {
    const zone = document.getElementById('upload-drop-zone');
    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const input = document.getElementById('material-file-input');
            input.files = files;
            handleFileSelect(input);
        }
    });
}

function handleFileSelect(input) {
    const file = input.files[0];
    if (!file) return;

    // Check file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
        showToast('Kích thước tệp vượt quá 50MB', 'error');
        input.value = '';
        return;
    }

    // Show preview
    const dropContent = document.getElementById('upload-drop-content');
    const preview = document.getElementById('upload-file-preview');
    const nameEl = document.getElementById('preview-file-name');
    const sizeEl = document.getElementById('preview-file-size');
    const iconEl = document.getElementById('preview-file-icon');

    // Detect type for icon
    const ext = file.name.split('.').pop().toLowerCase();
    const extMap = {
        'pdf': 'pdf', 'doc': 'doc', 'docx': 'doc',
        'xls': 'xls', 'xlsx': 'xls', 'ppt': 'ppt', 'pptx': 'ppt',
        'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image',
        'mp4': 'video', 'avi': 'video', 'mp3': 'audio', 'wav': 'audio',
        'zip': 'archive', 'rar': 'archive', '7z': 'archive',
    };
    const fileType = extMap[ext] || 'other';
    const typeInfo = FILE_TYPE_ICONS[fileType];

    nameEl.textContent = file.name;
    sizeEl.textContent = formatFileSize(file.size);
    iconEl.textContent = typeInfo.icon;
    iconEl.style.color = typeInfo.color;

    dropContent.classList.add('hidden');
    preview.classList.remove('hidden');

    // Auto-fill title if empty
    const titleInput = document.querySelector('#upload-material-form input[name="title"]');
    if (titleInput && !titleInput.value) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '');
    }
}

function clearFileInput() {
    const input = document.getElementById('material-file-input');
    input.value = '';

    document.getElementById('upload-drop-content').classList.remove('hidden');
    document.getElementById('upload-file-preview').classList.add('hidden');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

async function submitMaterial(event) {
    event.preventDefault();
    const form = event.target;
    const btn = document.getElementById('btn-submit-material');
    const formData = new FormData(form);

    // Validate
    if (!formData.get('classroom')) {
        showToast('Vui lòng chọn lớp học', 'warning');
        return false;
    }
    if (!formData.get('file') || !formData.get('file').size) {
        showToast('Vui lòng chọn tệp', 'warning');
        return false;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-outlined">hourglass_top</span> Đang tải lên...';

    try {
        await API.post(CONFIG.ENDPOINTS.MATERIALS, formData);
        showToast('Tải lên tài liệu thành công!', 'success');
        closeModal();

        // Refresh materials list with the uploaded class
        const uploadClass = formData.get('classroom');
        document.getElementById('material-class-filter').value = uploadClass;
        loadMaterials();
    } catch (error) {
        console.error('Upload error:', error);
        let msg = 'Không thể tải lên tài liệu';
        if (error.data) {
            if (error.data.detail) msg = error.data.detail;
            else if (error.data.error) msg = error.data.error;
            else if (typeof error.data === 'object') {
                const firstErr = Object.values(error.data).flat()[0];
                if (firstErr) msg = Array.isArray(firstErr) ? firstErr[0] : firstErr;
            }
        }
        showToast(msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons-outlined">cloud_upload</span> Tải lên';
    }
    return false;
}

async function downloadMaterial(id, fileUrl) {
    try {
        // Track download count
        const result = await API.post(`${CONFIG.ENDPOINTS.MATERIALS}${id}/download/`, {});
        const url = result.file_url || fileUrl;

        if (url) {
            // Open download in new tab
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Đang tải xuống tài liệu...', 'info');
        } else {
            showToast('Không tìm thấy file tải xuống', 'error');
        }
        // Refresh to update download count
        loadMaterials();
    } catch (error) {
        console.error('Download error:', error);
        // Fallback: try direct download
        if (fileUrl) {
            window.open(fileUrl, '_blank');
        } else {
            showToast('Không thể tải tài liệu', 'error');
        }
    }
}

async function deleteMaterial(id) {
    const confirmed = await showConfirm('Xóa tài liệu', 'Bạn có chắc chắn muốn xóa tài liệu này? Hành động này không thể hoàn tác.');
    if (!confirmed) return;

    try {
        await API.delete(`${CONFIG.ENDPOINTS.MATERIALS}${id}/`);
        showToast('Đã xóa tài liệu thành công', 'success');
        loadMaterials();
    } catch (error) {
        const msg = error.data?.detail || error.data?.error || 'Không thể xóa tài liệu';
        showToast(msg, 'error');
    }
}
