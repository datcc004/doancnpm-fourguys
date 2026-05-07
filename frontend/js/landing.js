/**
 * Landing: điều hướng theo mục menu (hash) + blog động từ API
 */

const LANDING_KEY_TO_HASH = {
    home: 'trang-chu',
    about: 'gioi-thieu',
    courses: 'khoa-hoc',
    scholarships: 'hoc-bong',
    events: 'su-kien',
    news: 'tin-tuc',
    contact: 'lien-he',
};

const LANDING_HASH_TO_KEY = {
    'trang-chu': 'home',
    'gioi-thieu': 'about',
    'khoa-hoc': 'courses',
    'hoc-bong': 'scholarships',
    'su-kien': 'events',
    'tin-tuc': 'news',
    'lien-he': 'contact',
};

const LANDING_TITLES = {
    home: 'FourGuys — Học ngoại ngữ',
    about: 'Giới thiệu — FourGuys',
    courses: 'Khóa học — FourGuys',
    scholarships: 'Học bổng — FourGuys',
    events: 'Sự kiện — FourGuys',
    news: 'Tin tức — FourGuys',
    contact: 'Liên hệ — FourGuys',
};

function getLandingKeyFromHash() {
    const raw = (location.hash || '#').replace(/^#/, '') || 'trang-chu';
    return LANDING_HASH_TO_KEY[raw] || 'home';
}

function showLandingByKey(key) {
    if (!key || !document.querySelector(`.landing-section[data-landing="${key}"]`)) {
        key = 'home';
    }
    const loginPage = document.getElementById('login-page');
    if (loginPage) {
        loginPage.classList.toggle('landing-courses-only', key === 'courses');
    }
    document.querySelectorAll('.landing-section').forEach((el) => {
        el.classList.toggle('is-active', el.getAttribute('data-landing') === key);
    });
    document.querySelectorAll('#landing-nav a[data-landing]').forEach((a) => {
        a.classList.toggle('is-active', a.getAttribute('data-landing') === key);
    });
    document.title = LANDING_TITLES[key] || LANDING_TITLES.home;
}

/**
 * Nút/liên kết: chuyển nội dung. `hashSeg` tương ứng LANDING_KEY_TO_HASH, ví dụ 'lien-he'.
 */
function goLanding(landingKey, hashSeg) {
    const h = hashSeg || LANDING_KEY_TO_HASH[landingKey] || 'trang-chu';
    if (location.hash === '#' + h) {
        showLandingByKey(landingKey);
    } else {
        location.hash = h;
    }
}

function syncLandingFromHash() {
    if (!document.getElementById('landing-nav')) return;
    showLandingByKey(getLandingKeyFromHash());
}

function initLandingNav() {
    const nav = document.getElementById('landing-nav');
    if (!nav) return;
    nav.addEventListener('click', (e) => {
        const a = e.target.closest('a[data-landing]');
        if (!a) return;
        e.preventDefault();
        const key = a.getAttribute('data-landing');
        const h = a.getAttribute('data-hash') || 'trang-chu';
        goLanding(key, h);
    });
    window.addEventListener('hashchange', syncLandingFromHash);
    syncLandingFromHash();
}

function escapeHtmlText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openLandingBlogDetail(slug) {
    API.get(`${CONFIG.ENDPOINTS.BLOG_POSTS}${slug}/`)
        .then((post) => {
            const cover = post.cover_image_url
                ? `<img src="${escapeHtmlText(post.cover_image_url)}" alt="${escapeHtmlText(post.title)}" class="landing-detail-cover">`
                : '';
            const body = `
                <div class="landing-detail">
                    ${cover}
                    <h2>${escapeHtmlText(post.title)}</h2>
                    <p class="landing-detail-date">${formatDateVN(post.published_at || post.created_at)}</p>
                    <div class="landing-detail-content">${escapeHtmlText(post.content).replace(/\n/g, '<br>')}</div>
                </div>
            `;
            openModal('Chi tiết bài viết', body);
        })
        .catch(() => {
            showToast('Không thể tải chi tiết bài viết', 'error');
        });
}

function renderLandingFallback() {
    const grid = document.getElementById('landing-blog-grid');
    if (!grid) return;
    grid.innerHTML = `
        <article class="landing-blog-card">
            <span class="material-icons-outlined">auto_stories</span>
            <h3>Vì sao nên học ngoại ngữ sớm?</h3>
            <p>Nâng cao cơ hội học tập, nghề nghiệp và khả năng giao tiếp toàn cầu ngay từ hôm nay.</p>
            <button type="button" class="btn btn-secondary btn-sm">Xem thêm</button>
        </article>
        <article class="landing-blog-card">
            <span class="material-icons-outlined">school</span>
            <h3>Lộ trình cá nhân hóa tại trung tâm</h3>
            <p>Đánh giá đầu vào kỹ lưỡng để xây dựng kế hoạch học phù hợp cho từng học viên.</p>
            <button type="button" class="btn btn-secondary btn-sm">Xem thêm</button>
        </article>
        <article class="landing-blog-card">
            <span class="material-icons-outlined">groups</span>
            <h3>Cộng đồng học tập tích cực</h3>
            <p>Học nhóm, workshop và hoạt động ngoại khóa giúp bạn duy trì động lực mỗi tuần.</p>
            <button type="button" class="btn btn-secondary btn-sm">Xem thêm</button>
        </article>
    `;
}

function loadLandingBlogs() {
    const grid = document.getElementById('landing-blog-grid');
    if (!grid) return;

    API.get(CONFIG.ENDPOINTS.BLOG_POSTS, { page_size: 3 })
        .then((data) => {
            const posts = data.results || data || [];
            if (!Array.isArray(posts) || posts.length === 0) {
                renderLandingFallback();
                return;
            }

            grid.innerHTML = posts.map((post) => {
                const cover = post.cover_image_url
                    ? `<img src="${escapeHtmlText(post.cover_image_url)}" alt="${escapeHtmlText(post.title)}" class="landing-blog-image">`
                    : `<span class="material-icons-outlined">article</span>`;
                const preview = post.content_preview || post.excerpt || '';
                return `
                    <article class="landing-blog-card">
                        ${cover}
                        <h3>${escapeHtmlText(post.title)}</h3>
                        <p>${escapeHtmlText(preview)}</p>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openLandingBlogDetail(${JSON.stringify(post.slug || '')})">
                            Xem thêm
                        </button>
                    </article>
                `;
            }).join('');
        })
        .catch(() => renderLandingFallback());
}

function renderLandingScholarshipFallback() {
    const grid = document.getElementById('landing-scholarship-grid');
    if (!grid) return;
    grid.innerHTML = `
        <article class="landing-blog-card">
            <span class="material-icons-outlined">workspace_premium</span>
            <h3>Học bổng khuyến học</h3>
            <p>Ưu đãi học phí theo tháng và hỗ trợ dành cho học viên đạt thành tích tốt.</p>
        </article>
    `;
}

function openLandingScholarshipDetail(slug) {
    API.get(`${CONFIG.ENDPOINTS.SCHOLARSHIPS}${slug}/`)
        .then((item) => {
            const image = item.image_url
                ? `<img src="${escapeHtmlText(item.image_url)}" alt="${escapeHtmlText(item.title)}" class="landing-detail-cover">`
                : '';
            const body = `
                <div class="landing-detail">
                    ${image}
                    <h2>${escapeHtmlText(item.title)}</h2>
                    <p class="landing-detail-date">
                        Giá trị: ${escapeHtmlText(item.amount_text || 'Đang cập nhật')}
                        ${item.deadline ? ` · Hạn nộp: ${formatDateVN(item.deadline)}` : ''}
                    </p>
                    <div class="landing-detail-content">${escapeHtmlText(item.content || '').replace(/\n/g, '<br>')}</div>
                </div>
            `;
            openModal('Chi tiết học bổng', body);
        })
        .catch(() => {
            showToast('Không thể tải chi tiết học bổng', 'error');
        });
}

function loadLandingScholarships() {
    const grid = document.getElementById('landing-scholarship-grid');
    if (!grid) return;

    API.get(CONFIG.ENDPOINTS.SCHOLARSHIPS, { page_size: 6 })
        .then((data) => {
            const rows = data.results || data || [];
            if (!Array.isArray(rows) || rows.length === 0) {
                renderLandingScholarshipFallback();
                return;
            }

            grid.innerHTML = rows.map((item) => `
                <article class="landing-blog-card">
                    ${item.image_url
                        ? `<img src="${escapeHtmlText(item.image_url)}" alt="${escapeHtmlText(item.title)}" class="landing-blog-image">`
                        : '<span class="material-icons-outlined">workspace_premium</span>'
                    }
                    <h3>${escapeHtmlText(item.title)}</h3>
                    <p>${escapeHtmlText(item.content_preview || item.short_description || '')}</p>
                    <button type="button" class="btn btn-secondary btn-sm" onclick="openLandingScholarshipDetail(${JSON.stringify(item.slug || '')})">
                        Xem chi tiết
                    </button>
                </article>
            `).join('');
        })
        .catch(() => renderLandingScholarshipFallback());
}

function renderLandingCoursesFallback() {
    const grid = document.getElementById('landing-courses-grid');
    if (!grid) return;
    grid.innerHTML = `
        <article class="landing-blog-card">
            <span class="material-icons-outlined">menu_book</span>
            <h3>Chưa có khóa học</h3>
            <p>Hiện tại hệ thống chưa có khóa học đang mở hoặc chưa bật công khai.</p>
        </article>
    `;
}

function openLandingCourseDetail(courseId) {
    API.get(`${CONFIG.ENDPOINTS.COURSES}${courseId}/`)
        .then((course) => {
            const lang = CONFIG.LANGUAGE_LABELS?.[course.language] || course.language || '-';
            const level = CONFIG.LEVEL_LABELS?.[course.level] || course.level || '-';
            const tuition = typeof course.tuition_fee !== 'undefined' ? formatCurrency(course.tuition_fee) : '-';
            const code = course.code || '';
            const name = course.name || '';
            const description = (course.description || '').trim();
            const descriptionFull = description || '';

            const body = `
                <div class="landing-detail">
                    <h2>${escapeHtmlText(code)} - ${escapeHtmlText(name)}</h2>
                    <p class="landing-detail-date">
                        Ngôn ngữ: ${escapeHtmlText(lang)}
                    </p>
                    <div class="landing-detail-content">
                        <p><strong>Trình độ:</strong> ${escapeHtmlText(level)}</p>
                        <p><strong>Học phí:</strong> ${escapeHtmlText(tuition)}</p>
                        ${descriptionFull ? `<p style="margin-top:10px">${escapeHtmlText(descriptionFull)}</p>` : ''}
                        <p style="color:var(--text-muted);font-size:0.9rem;margin-top:12px">
                            Bạn có thể đăng nhập để xem lịch/lớp học chi tiết.
                        </p>
                    </div>
                </div>
            `;
            openModal('Chi tiết khóa học', body);
        })
        .catch(() => {
            showToast('Không thể tải chi tiết khóa học', 'error');
        });
}

function loadLandingCourses() {
    const grid = document.getElementById('landing-courses-grid');
    if (!grid) return;

    const defaultCourseImages = {
        // Ảnh local (đã copy vào frontend/assets/courses/)
        english: 'assets/courses/english-1.png',
        japanese: 'assets/courses/japanese.png',
        korean: 'assets/courses/other.png',
        chinese: 'assets/courses/chinese.png',
        other: 'assets/courses/other.png',
    };

    API.get(CONFIG.ENDPOINTS.COURSES, { page_size: 9, is_active: true })
        .then((data) => {
            const rows = data.results || data || [];
            if (!Array.isArray(rows) || rows.length === 0) {
                renderLandingCoursesFallback();
                return;
            }

            grid.innerHTML = rows.map((course) => {
                const lang = CONFIG.LANGUAGE_LABELS?.[course.language] || course.language || '-';
                const level = CONFIG.LEVEL_LABELS?.[course.level] || course.level || '-';
                const tuition = typeof course.tuition_fee !== 'undefined' ? formatCurrency(course.tuition_fee) : '-';
                const code = course.code || '';
                const name = course.name || '';
                const desc = (course.description || '').trim();
                const preview = desc.length > 120 ? `${desc.slice(0, 117)}...` : desc;
                const imageUrl =
                    course.cover_image_url ||
                    defaultCourseImages[course.language] ||
                    defaultCourseImages.other;

                return `
                    <article class="landing-blog-card landing-course-card">
                        <img src="${escapeHtmlText(imageUrl)}" alt="${escapeHtmlText(name)}" class="landing-blog-image landing-course-image">
                        <h3>${escapeHtmlText(code)} - ${escapeHtmlText(name)}</h3>
                        <p>${escapeHtmlText(lang)} · ${escapeHtmlText(level)}</p>
                        <p><strong>Học phí:</strong> ${escapeHtmlText(tuition)}</p>
                        ${preview ? `<p class="landing-course-desc">${escapeHtmlText(preview)}</p>` : ''}
                        <button type="button" class="btn btn-secondary btn-sm" onclick="openLandingCourseDetail(${JSON.stringify(course.id)})">
                            Xem chi tiết
                        </button>
                    </article>
                `;
            }).join('');
        })
        .catch(() => renderLandingCoursesFallback());
}

document.addEventListener('DOMContentLoaded', () => {
    initLandingNav();
    loadLandingBlogs();
    loadLandingScholarships();
    loadLandingCourses();
});
