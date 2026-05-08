/**
 * Chat Module - Chatbox giữa các actor trong hệ thống
 */
let chatState = {
    isOpen: false,
    activeTab: 'conversations',
    activeConversationId: null,
    conversations: [],
    users: [],
    messages: [],
    aiMessages: [],
    unreadCount: 0,
    search: '',
    pollTimer: null,
    messageTimer: null,
};

const CHAT_AI_USER = {
    full_name: 'AI Assistant',
    role: 'Gemini',
    is_ai: true,
};

function initChatWidget() {
    if (!currentUser) return;
    if (!document.getElementById('chat-widget')) {
        createChatWidget();
    }

    document.getElementById('chat-widget').classList.remove('hidden');
    loadChatUnreadCount();
    loadChatConversations();

    clearInterval(chatState.pollTimer);
    chatState.pollTimer = setInterval(() => {
        loadChatUnreadCount();
        if (chatState.isOpen) loadChatConversations(false);
    }, 15000);
}

function destroyChatWidget() {
    clearInterval(chatState.pollTimer);
    clearInterval(chatState.messageTimer);
    chatState = {
        isOpen: false,
        activeTab: 'conversations',
        activeConversationId: null,
        conversations: [],
        users: [],
        messages: [],
        aiMessages: [],
        unreadCount: 0,
        search: '',
        pollTimer: null,
        messageTimer: null,
    };
    document.getElementById('chat-widget')?.remove();
}

function createChatWidget() {
    const widget = document.createElement('div');
    widget.id = 'chat-widget';
    widget.className = 'chat-widget hidden';
    widget.innerHTML = `
        <button class="chat-fab" onclick="toggleChatWidget()" title="Tin nhắn">
            <span class="material-icons-outlined">chat</span>
            <span id="chat-unread-badge" class="chat-unread-badge hidden">0</span>
        </button>
        <section id="chat-panel" class="chat-panel hidden" aria-label="Tin nhắn">
            <div class="chat-header">
                <div class="chat-header-main">
                    <span class="chat-header-icon">
                        <span class="material-icons-outlined">forum</span>
                    </span>
                    <div>
                        <h3>Tin nhắn</h3>
                        <p id="chat-header-subtitle">Trao đổi nhanh trong hệ thống</p>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <span class="chat-status-pill">Trực tuyến</span>
                    <button class="btn-icon" onclick="refreshChatWidget()" title="Tải lại">
                        <span class="material-icons-outlined">refresh</span>
                    </button>
                    <button class="btn-icon" onclick="toggleChatWidget(false)" title="Đóng">
                        <span class="material-icons-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="chat-tabs">
                <button id="chat-tab-conversations" class="chat-tab active" onclick="switchChatTab('conversations')">
                    <span class="material-icons-outlined">forum</span>
                    <span>Hội thoại</span>
                </button>
                <button id="chat-tab-users" class="chat-tab" onclick="switchChatTab('users')">
                    <span class="material-icons-outlined">group</span>
                    <span>Người dùng</span>
                </button>
                <button id="chat-tab-ai" class="chat-tab" onclick="switchChatTab('ai')">
                    <span class="material-icons-outlined">smart_toy</span>
                    <span>AI</span>
                </button>
            </div>
            <div class="chat-search">
                <span class="material-icons-outlined">search</span>
                <input id="chat-search-input" type="text" placeholder="Tìm người dùng hoặc hội thoại..." oninput="handleChatSearch(event)">
            </div>
            <div id="chat-list" class="chat-list"></div>
            <div id="chat-thread" class="chat-thread hidden">
                <div class="chat-thread-header">
                    <button class="btn-icon" onclick="closeChatThread()" title="Quay lại">
                        <span class="material-icons-outlined">arrow_back</span>
                    </button>
                    <div id="chat-thread-user" class="chat-thread-user"></div>
                </div>
                <div id="chat-messages" class="chat-messages"></div>
                <form class="chat-composer" onsubmit="return sendChatMessage(event)">
                    <textarea id="chat-message-input" rows="1" placeholder="Nhập tin nhắn..." onkeydown="handleChatComposerKeydown(event)"></textarea>
                    <button class="btn btn-primary" type="submit" title="Gửi">
                        <span class="material-icons-outlined">send</span>
                    </button>
                </form>
            </div>
        </section>
    `;
    document.body.appendChild(widget);
}

function toggleChatWidget(forceOpen = null) {
    const panel = document.getElementById('chat-panel');
    if (!panel) return;

    chatState.isOpen = forceOpen === null ? panel.classList.contains('hidden') : forceOpen;
    panel.classList.toggle('hidden', !chatState.isOpen);

    if (chatState.isOpen) {
        if (chatState.activeTab === 'ai') {
            renderChatThreadHeader(CHAT_AI_USER);
            renderAiMessages();
        } else {
            loadChatConversations();
            if (chatState.activeConversationId) loadChatMessages(chatState.activeConversationId);
        }
    }
}

function refreshChatWidget() {
    loadChatUnreadCount();
    if (chatState.activeTab === 'ai') {
        renderAiMessages(false);
        return;
    } else if (chatState.activeTab === 'users') {
        loadChatUsers();
    } else {
        loadChatConversations();
    }
    if (chatState.activeConversationId) loadChatMessages(chatState.activeConversationId);
}

function switchChatTab(tab) {
    chatState.activeTab = tab;
    chatState.activeConversationId = null;
    clearInterval(chatState.messageTimer);

    document.getElementById('chat-tab-conversations')?.classList.toggle('active', tab === 'conversations');
    document.getElementById('chat-tab-users')?.classList.toggle('active', tab === 'users');
    document.getElementById('chat-tab-ai')?.classList.toggle('active', tab === 'ai');
    document.getElementById('chat-search-input').value = '';
    document.querySelector('.chat-search')?.classList.toggle('hidden', tab === 'ai');
    chatState.search = '';

    if (tab === 'ai') {
        document.getElementById('chat-list')?.classList.add('hidden');
        document.getElementById('chat-thread')?.classList.remove('hidden');
        renderChatThreadHeader(CHAT_AI_USER);
        renderAiMessages();
    } else if (tab === 'users') {
        document.getElementById('chat-thread')?.classList.add('hidden');
        document.getElementById('chat-list')?.classList.remove('hidden');
        loadChatUsers();
    } else {
        document.getElementById('chat-thread')?.classList.add('hidden');
        document.getElementById('chat-list')?.classList.remove('hidden');
        loadChatConversations();
    }
}

function handleChatSearch(event) {
    chatState.search = event.target.value.trim();
    clearTimeout(window._chatSearchTimeout);
    window._chatSearchTimeout = setTimeout(() => {
        if (chatState.activeTab === 'users') loadChatUsers();
        else renderChatConversationList();
    }, 250);
}

async function loadChatUnreadCount() {
    try {
        const data = await API.get(CONFIG.ENDPOINTS.CHAT_UNREAD_COUNT);
        chatState.unreadCount = data.unread_count || 0;
        renderChatUnreadBadge();
    } catch (error) {
        console.warn('Chat unread error:', error);
    }
}

async function loadChatConversations(showLoading = true) {
    const list = document.getElementById('chat-list');
    if (showLoading && list && chatState.activeTab === 'conversations') {
        list.innerHTML = '<div class="chat-loading"><div class="spinner"></div></div>';
    }

    try {
        const data = await API.get(CONFIG.ENDPOINTS.CHAT_CONVERSATIONS);
        chatState.conversations = normalizeChatList(data);
        renderChatConversationList();
        renderChatUnreadBadge();
    } catch (error) {
        if (list) list.innerHTML = '<div class="chat-empty">Không tải được hội thoại</div>';
    }
}

async function loadChatUsers() {
    const list = document.getElementById('chat-list');
    if (list) list.innerHTML = '<div class="chat-loading"><div class="spinner"></div></div>';

    try {
        const params = chatState.search ? { search: chatState.search } : {};
        const data = await API.get(CONFIG.ENDPOINTS.CHAT_USERS, params);
        chatState.users = normalizeChatList(data);
        renderChatUserList();
    } catch (error) {
        if (list) list.innerHTML = '<div class="chat-empty">Không tải được danh sách người dùng</div>';
    }
}

function renderChatUnreadBadge() {
    const badge = document.getElementById('chat-unread-badge');
    if (!badge) return;
    const count = chatState.unreadCount || chatState.conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.toggle('hidden', count <= 0);
}

function renderChatConversationList() {
    if (chatState.activeTab !== 'conversations' || chatState.activeConversationId) return;
    const list = document.getElementById('chat-list');
    if (!list) return;

    const keyword = chatState.search.toLowerCase();
    const conversations = chatState.conversations.filter(c => {
        const user = c.other_participant || {};
        return !keyword || chatDisplayName(user).toLowerCase().includes(keyword) || (user.username || '').toLowerCase().includes(keyword);
    });

    if (!conversations.length) {
        list.innerHTML = `
            <div class="chat-empty">
                <span class="material-icons-outlined">forum</span>
                <p>Chưa có hội thoại nào</p>
                <button class="btn btn-sm btn-primary" onclick="switchChatTab('users')">Tạo hội thoại</button>
            </div>
        `;
        return;
    }

    list.innerHTML = conversations.map(c => {
        const user = c.other_participant || {};
        const last = c.last_message;
        const preview = last ? `${last.is_mine ? 'Bạn: ' : ''}${last.content}` : 'Chưa có tin nhắn';
        return `
            <button class="chat-list-item" onclick="openChatConversation(${c.id})">
                ${renderChatAvatar(user)}
                <span class="chat-list-main">
                    <span class="chat-list-title">${escapeChatHtml(chatDisplayName(user))}</span>
                    <span class="chat-list-preview">${escapeChatHtml(preview)}</span>
                </span>
                <span class="chat-list-meta">
                    <span>${formatChatTime(last?.created_at || c.updated_at)}</span>
                    ${c.unread_count ? `<strong>${c.unread_count}</strong>` : ''}
                </span>
            </button>
        `;
    }).join('');
}

function renderChatUserList() {
    if (chatState.activeTab !== 'users' || chatState.activeConversationId) return;
    const list = document.getElementById('chat-list');
    if (!list) return;

    if (!chatState.users.length) {
        list.innerHTML = `
            <div class="chat-empty">
                <span class="material-icons-outlined">person_search</span>
                <p>Không tìm thấy người dùng phù hợp</p>
            </div>
        `;
        return;
    }

    list.innerHTML = chatState.users.map(user => `
        <button class="chat-list-item" onclick="startChatWithUser(${user.id})">
            ${renderChatAvatar(user)}
            <span class="chat-list-main">
                <span class="chat-list-title">${escapeChatHtml(chatDisplayName(user))}</span>
                <span class="chat-list-preview">${escapeChatHtml(CONFIG.ROLE_LABELS[user.role] || user.role)}</span>
            </span>
            <span class="material-icons-outlined chat-start-icon">chevron_right</span>
        </button>
    `).join('');
}

async function startChatWithUser(userId) {
    try {
        const conversation = await API.post(CONFIG.ENDPOINTS.CHAT_CONVERSATIONS, { recipient_id: userId });
        await loadChatConversations(false);
        openChatConversation(conversation.id);
    } catch (error) {
        showToast(chatErrorMessage(error, 'Không thể tạo hội thoại'), 'error');
    }
}

async function openChatConversation(conversationId) {
    chatState.activeConversationId = conversationId;
    document.getElementById('chat-list')?.classList.add('hidden');
    document.getElementById('chat-thread')?.classList.remove('hidden');

    const conversation = chatState.conversations.find(c => c.id === conversationId);
    renderChatThreadHeader(conversation?.other_participant);
    await loadChatMessages(conversationId);

    clearInterval(chatState.messageTimer);
    chatState.messageTimer = setInterval(() => {
        if (chatState.isOpen && chatState.activeConversationId) {
            loadChatMessages(chatState.activeConversationId, false);
        }
    }, 8000);
}

function closeChatThread() {
    if (chatState.activeTab === 'ai') {
        switchChatTab('conversations');
        return;
    }

    chatState.activeConversationId = null;
    clearInterval(chatState.messageTimer);
    document.getElementById('chat-thread')?.classList.add('hidden');
    document.getElementById('chat-list')?.classList.remove('hidden');
    loadChatConversations(false);
}

function renderChatThreadHeader(user) {
    const target = document.getElementById('chat-thread-user');
    if (!target) return;
    target.innerHTML = user ? `
        ${renderChatAvatar(user)}
        <span>
            <strong>${escapeChatHtml(chatDisplayName(user))}</strong>
            <small>${escapeChatHtml(CONFIG.ROLE_LABELS[user.role] || user.role || '')}</small>
        </span>
    ` : '<span><strong>Hội thoại</strong></span>';
}

async function loadChatMessages(conversationId, scrollToBottom = true) {
    const messagesBox = document.getElementById('chat-messages');
    if (!messagesBox) return;

    if (scrollToBottom) {
        messagesBox.innerHTML = '<div class="chat-loading"><div class="spinner"></div></div>';
    }

    try {
        const data = await API.get(`${CONFIG.ENDPOINTS.CHAT_CONVERSATIONS}${conversationId}/messages/`);
        chatState.messages = normalizeChatList(data);
        renderChatMessages(scrollToBottom);
        loadChatUnreadCount();
        loadChatConversations(false);
    } catch (error) {
        messagesBox.innerHTML = '<div class="chat-empty">Không tải được tin nhắn</div>';
    }
}

function renderChatMessages(scrollToBottom = true) {
    const messagesBox = document.getElementById('chat-messages');
    if (!messagesBox) return;

    if (!chatState.messages.length) {
        messagesBox.innerHTML = `
            <div class="chat-empty chat-empty-thread">
                <span class="material-icons-outlined">chat_bubble_outline</span>
                <p>Bắt đầu cuộc trò chuyện</p>
            </div>
        `;
        return;
    }

    messagesBox.innerHTML = chatState.messages.map(message => `
        <div class="chat-message ${message.is_mine ? 'mine' : 'theirs'}">
            <div class="chat-message-bubble">
                ${escapeChatHtml(message.content)}
            </div>
            <div class="chat-message-time">${formatChatTime(message.created_at)}</div>
        </div>
    `).join('');

    if (scrollToBottom) {
        messagesBox.scrollTop = messagesBox.scrollHeight;
    }
}

function renderAiMessages(scrollToBottom = true) {
    const messagesBox = document.getElementById('chat-messages');
    if (!messagesBox) return;

    if (!chatState.aiMessages.length) {
        messagesBox.innerHTML = `
            <div class="chat-empty chat-empty-thread">
                <span class="material-icons-outlined">smart_toy</span>
                <p>Hỏi Gemini về học tập, lịch học hoặc cách sử dụng hệ thống</p>
            </div>
        `;
        return;
    }

    chatState.messages = chatState.aiMessages;
    renderChatMessages(scrollToBottom);
}

async function sendChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById('chat-message-input');
    const content = input?.value.trim();
    if (!content) return false;
    if (chatState.activeTab === 'ai') return sendAiChatMessage(input, content);
    if (!chatState.activeConversationId) return false;

    input.disabled = true;
    try {
        await API.post(`${CONFIG.ENDPOINTS.CHAT_CONVERSATIONS}${chatState.activeConversationId}/messages/`, { content });
        input.value = '';
        await loadChatMessages(chatState.activeConversationId);
    } catch (error) {
        showToast(chatErrorMessage(error, 'Không gửi được tin nhắn'), 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }
    return false;
}

async function sendAiChatMessage(input, content) {
    const history = chatState.aiMessages.slice(-10);
    const userMessage = {
        content,
        is_mine: true,
        created_at: new Date().toISOString(),
    };
    const pendingMessage = {
        content: 'Đang trả lời...',
        is_mine: false,
        created_at: new Date().toISOString(),
    };

    chatState.aiMessages.push(userMessage, pendingMessage);
    input.value = '';
    input.disabled = true;
    renderAiMessages();

    try {
        const data = await API.post(CONFIG.ENDPOINTS.CHAT_AI, { message: content, history });
        pendingMessage.content = data.reply || 'Xin lỗi, tôi chưa có câu trả lời.';
        pendingMessage.created_at = new Date().toISOString();
        renderAiMessages();
    } catch (error) {
        chatState.aiMessages = chatState.aiMessages.filter(message => message !== pendingMessage);
        renderAiMessages(false);
        showToast(chatErrorMessage(error, 'Không thể hỏi Gemini'), 'error');
    } finally {
        input.disabled = false;
        input.focus();
    }

    return false;
}

function handleChatComposerKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendChatMessage(event);
    }
}

function normalizeChatList(data) {
    if (Array.isArray(data)) return data;
    return data?.results || [];
}

function chatDisplayName(user) {
    if (!user) return 'Người dùng';
    const name = user.full_name || `${user.last_name || ''} ${user.first_name || ''}`.trim();
    return name || user.username || 'Người dùng';
}

function renderChatAvatar(user) {
    if (user?.is_ai) {
        return `<span class="chat-avatar chat-avatar-ai"><span class="material-icons-outlined">smart_toy</span></span>`;
    }

    const label = chatDisplayName(user).charAt(0).toUpperCase();
    if (user?.avatar_url) {
        return `<span class="chat-avatar"><img src="${escapeChatAttr(user.avatar_url)}" alt=""></span>`;
    }
    return `<span class="chat-avatar">${escapeChatHtml(label)}</span>`;
}

function formatChatTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

function chatErrorMessage(error, fallback) {
    const data = error?.data;
    if (!data) return fallback;
    if (typeof data.detail === 'string') return data.detail;
    if (typeof data.error === 'string') return data.error;
    const key = Object.keys(data)[0];
    const value = key ? data[key] : null;
    if (Array.isArray(value) && value.length) return value[0];
    if (typeof value === 'string') return value;
    return fallback;
}

function escapeChatHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeChatAttr(str) {
    return escapeChatHtml(str).replace(/`/g, '&#96;');
}
