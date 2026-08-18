// Global Application State
const state = {
    token: localStorage.getItem("token") || null,
    currentUserId: localStorage.getItem("user_id") ? parseInt(localStorage.getItem("user_id")) : null,
    currentUser: null,
    conversations: [],
    activeConversationId: null,
    activeSocket: null,
    users: [], // List of users for the new chat modal
    selectedPresetAvatar: "https://api.dicebear.com/7.x/adventurer/svg?seed=An",
    selectedModalUserIds: new Set(),
    uploadedAvatarUrl: null
};

// API Base URL (assumes same host as static files)
const API_BASE_URL = window.location.origin;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    loadSavedThemeAndAccent();
    
    if (state.token && state.currentUserId) {
        // User seems logged in, fetch profile and show chat screen
        fetchUserProfile().then(success => {
            if (success) {
                showChatScreen();
            } else {
                handleLogout();
            }
        });
    } else {
        // User not logged in, show auth screen
        showAuthScreen();
    }
}

function loadSavedThemeAndAccent() {
    const savedTheme = localStorage.getItem("theme") || "dark";
    if (savedTheme === "light") {
        document.body.classList.add("light-theme");
    } else {
        document.body.classList.remove("light-theme");
    }
    
    const savedAccent = localStorage.getItem("accent") || "#0066fe";
    document.documentElement.style.setProperty("--primary-blue", savedAccent);
}

// UI Toggles
function showAuthScreen() {
    document.getElementById("auth-screen").classList.remove("hidden");
    document.getElementById("chat-screen").classList.add("hidden");
}

function showChatScreen() {
    document.getElementById("auth-screen").classList.add("hidden");
    document.getElementById("chat-screen").classList.remove("hidden");
    
    // Set user profile info
    if (state.currentUser) {
        document.getElementById("current-user-name").textContent = state.currentUser.username;
        document.getElementById("current-user-avatar").src = state.currentUser.avatar_url || "https://api.dicebear.com/7.x/adventurer/svg?seed=fallback";
    }
    
    // Load conversations list
    loadConversations();
}

// Authentication Logic
function toggleAuthMode() {
    const regFields = document.getElementById("register-fields");
    regFields.classList.toggle("hidden");
    const isRegister = !regFields.classList.contains("hidden");
    const title = document.getElementById("auth-title");
    const subtitle = document.getElementById("auth-subtitle");
    const btn = document.getElementById("auth-btn");
    const toggleText = document.getElementById("auth-toggle-text");
    const toggleBtn = document.getElementById("auth-toggle-btn");

    if (isRegister) {
        title.textContent = "Create Account";
        subtitle.textContent = "Sign up for a free Bubble PRO account";
        btn.textContent = "Sign Up";
        toggleText.textContent = "Already have an account?";
        toggleBtn.textContent = "Sign In";
    } else {
        title.textContent = "Welcome Back";
        subtitle.textContent = "Sign in to continue chatting with Bubble PRO";
        btn.textContent = "Sign In";
        toggleText.textContent = "Don't have an account?";
        toggleBtn.textContent = "Sign Up";
    }
}

function selectPresetAvatar(element) {
    document.querySelectorAll(".avatar-option").forEach(el => el.classList.remove("selected"));
    element.classList.add("selected");
    state.selectedPresetAvatar = element.src;
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    const username = document.getElementById("auth-username").value.trim();
    const password = document.getElementById("auth-password").value;
    const isRegister = !document.getElementById("register-fields").classList.contains("hidden");

    if (isRegister) {
        // SIGN UP
        let avatarUrl = document.getElementById("auth-avatar-url").value.trim();
        if (!avatarUrl) {
            avatarUrl = state.selectedPresetAvatar;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/users/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, avatar_url: avatarUrl })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Registration failed");
            }

            alert("Account created successfully! Please log in.");
            toggleAuthMode();
        } catch (error) {
            alert(error.message);
        }
    } else {
        // LOG IN
        try {
            // FastAPI OAuth2PasswordRequestForm expects form-urlencoded body
            const bodyParams = new URLSearchParams();
            bodyParams.append("username", username);
            bodyParams.append("password", password);

            const res = await fetch(`${API_BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: bodyParams
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || "Invalid login credentials");
            }

            const data = await res.json();
            state.token = data.access_token;
            state.currentUserId = data.user_id;
            
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("user_id", data.user_id);
            
            // Get profile and switch screen
            await fetchUserProfile();
            showChatScreen();
        } catch (error) {
            alert(error.message);
        }
    }
}

async function fetchUserProfile() {
    try {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (!res.ok) return false;
        
        state.currentUser = await res.json();
        return true;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return false;
    }
}

function handleLogout() {
    // Close WebSocket
    if (state.activeSocket) {
        state.activeSocket.close();
        state.activeSocket = null;
    }
    
    state.token = null;
    state.currentUserId = null;
    state.currentUser = null;
    state.conversations = [];
    state.activeConversationId = null;
    
    localStorage.removeItem("token");
    localStorage.removeItem("user_id");
    
    showAuthScreen();
}

// Conversations Handling
async function loadConversations() {
    const listContainer = document.getElementById("conversations-list-container");
    
    try {
        const res = await fetch(`${API_BASE_URL}/conversations/`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        
        if (!res.ok) throw new Error("Failed to load conversations");
        
        state.conversations = await res.json();
        renderConversationsList();
    } catch (error) {
        listContainer.innerHTML = `<div class="empty-list-placeholder"><i class="fa-solid fa-triangle-exclamation"></i> Error loading conversations: ${error.message}</div>`;
    }
}

function renderConversationsList(filterQuery = "") {
    const listContainer = document.getElementById("conversations-list-container");
    listContainer.innerHTML = "";
    
    const filtered = state.conversations.filter(c => {
        if (!filterQuery) return true;
        const name = getConversationName(c).toLowerCase();
        return name.includes(filterQuery.toLowerCase());
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-list-placeholder">No conversations found.</div>';
        return;
    }

    // Sort by latest message timestamp or creation timestamp
    filtered.sort((a, b) => {
        const timeA = a.messages && a.messages.length ? new Date(a.messages[a.messages.length - 1].timestamp) : new Date(a.created_at);
        const timeB = b.messages && b.messages.length ? new Date(b.messages[b.messages.length - 1].timestamp) : new Date(b.created_at);
        return timeB - timeA;
    });

    filtered.forEach(c => {
        const convName = getConversationName(c);
        const convAvatar = getConversationAvatar(c);
        const isOnline = getConversationOnlineStatus(c);
        const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
        const lastMsgContent = lastMsg ? lastMsg.content : "No messages yet";
        const lastMsgTime = lastMsg ? formatTimeRelative(lastMsg.timestamp) : "";
        const isActive = c.id === state.activeConversationId ? "active" : "";
        
        // Count unread
        let unreadCount = 0;
        if (c.messages && c.id !== state.activeConversationId) {
            unreadCount = c.messages.filter(m => !m.is_read && m.sender_id !== state.currentUserId).length;
        }

        const convItem = document.createElement("div");
        convItem.className = `conv-item ${isActive}`;
        convItem.onclick = () => selectConversation(c.id);
        convItem.innerHTML = `
            <div class="conv-item-avatar-wrapper">
                <img src="${convAvatar}" class="conv-avatar" alt="Avatar">
                ${!c.is_group ? `<div class="online-indicator ${isOnline ? 'online' : 'offline'}"></div>` : ''}
            </div>
            <div class="conv-item-details">
                <div class="conv-item-header">
                    <span class="conv-item-name">${convName}</span>
                    <span class="conv-item-time">${lastMsgTime}</span>
                </div>
                <div class="conv-item-body">
                    <span class="conv-item-message">${lastMsgContent}</span>
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ""}
                </div>
            </div>
        `;
        listContainer.appendChild(convItem);
    });
}

function getConversationName(conversation) {
    if (conversation.is_group) {
        return conversation.name || "Group Chat";
    }
    // Find the participant who is not the current user
    const otherParticipant = conversation.participants.find(p => p.user_id !== state.currentUserId);
    return otherParticipant ? otherParticipant.user.username : "Empty Chat";
}

function getConversationAvatar(conversation) {
    if (conversation.is_group) {
        // Predefined group icon
        return "https://api.dicebear.com/7.x/identicon/svg?seed=group";
    }
    const otherParticipant = conversation.participants.find(p => p.user_id !== state.currentUserId);
    return otherParticipant ? otherParticipant.user.avatar_url : "https://api.dicebear.com/7.x/adventurer/svg?seed=fallback";
}

function getConversationOnlineStatus(conversation) {
    if (conversation.is_group) return false;
    const otherParticipant = conversation.participants.find(p => p.user_id !== state.currentUserId);
    return otherParticipant ? otherParticipant.user.is_online : false;
}

function filterConversations() {
    const query = document.getElementById("conv-search").value;
    renderConversationsList(query);
}

// Select Conversation and load Messages
async function selectConversation(conversationId) {
    if (state.activeConversationId === conversationId) return;
    
    // Close old WebSocket
    if (state.activeSocket) {
        state.activeSocket.close();
        state.activeSocket = null;
    }
    
    state.activeConversationId = conversationId;
    
    // Find conversation in cache
    const conversation = state.conversations.find(c => c.id === conversationId);
    
    // Mark messages in this conversation as read locally immediately
    if (conversation && conversation.messages) {
        conversation.messages.forEach(m => {
            if (m.sender_id !== state.currentUserId) {
                m.is_read = true;
            }
        });
    }
    
    // Refresh conversation list immediately to apply active styling and remove unread badge
    renderConversationsList();
    
    // Show active state and hide empty state
    document.getElementById("chat-empty-state").classList.add("hidden");
    document.getElementById("chat-active-state").classList.remove("hidden");
    
    if (!conversation) return;
    
    // Set Header details
    document.getElementById("active-chat-name").textContent = getConversationName(conversation);
    
    const avatarsContainer = document.getElementById("active-chat-avatars");
    const avatarImg = getConversationAvatar(conversation);
    const isOnline = getConversationOnlineStatus(conversation);
    
    avatarsContainer.innerHTML = `
        <img src="${avatarImg}" class="header-avatar" alt="Avatar">
        ${!conversation.is_group ? `<div class="online-indicator ${isOnline ? 'active' : 'offline'}"></div>` : ''}
    `;
    
    const statusEl = document.getElementById("active-chat-status");
    if (conversation.is_group) {
        statusEl.textContent = `${conversation.participants.length} participants`;
    } else {
        const other = conversation.participants.find(p => p.user_id !== state.currentUserId);
        if (other && other.user.is_online) {
            statusEl.textContent = "Online";
        } else if (other) {
            const lastActive = other.user.last_active_at ? formatTimeRelative(other.user.last_active_at) : "";
            statusEl.textContent = lastActive ? `Active ${lastActive} ago` : "Offline";
        } else {
            statusEl.textContent = "Offline";
        }
    }
    
    // Fetch historical messages
    await loadMessages(conversationId);
    
    // Connect WebSocket for real-time chat
    connectWebSocket(conversationId);
    
    // Refresh conversation list again to ensure loaded messages are in correct sync
    renderConversationsList();
}

async function loadMessages(conversationId) {
    const messagesContainer = document.getElementById("chat-messages-scroll-area");
    messagesContainer.innerHTML = `<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading message history...</div>`;
    
    try {
        const res = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        
        if (!res.ok) throw new Error("Failed to load message history");
        
        const messages = await res.json();
        
        // Update local conversation cache messages
        const conv = state.conversations.find(c => c.id === conversationId);
        if (conv) {
            conv.messages = messages;
        }
        
        renderMessages(messages);
    } catch (error) {
        messagesContainer.innerHTML = `<div class="empty-list-placeholder"><i class="fa-solid fa-triangle-exclamation"></i> Error loading history: ${error.message}</div>`;
    }
}

function formatMessageContent(content) {
    if (content.startsWith("/uploads/")) {
        const fileUrl = content;
        
        // Parse name and extension safely using URL parser
        let displayName = "";
        let ext = "";
        try {
            const urlObj = new URL(window.location.origin + fileUrl);
            displayName = urlObj.searchParams.get("name") || "";
            
            const pathname = urlObj.pathname;
            ext = pathname.substring(pathname.lastIndexOf('.')).toLowerCase();
            
            if (!displayName) {
                const fileName = pathname.substring(pathname.lastIndexOf('/') + 1);
                const uuidIndex = fileName.indexOf('-');
                displayName = uuidIndex !== -1 ? fileName.substring(uuidIndex + 1) : fileName;
            }
        } catch (e) {
            const fileName = fileUrl.substring(fileUrl.lastIndexOf('/') + 1);
            ext = fileUrl.substring(fileUrl.lastIndexOf('.')).toLowerCase();
            const uuidIndex = fileName.indexOf('-');
            displayName = uuidIndex !== -1 ? fileName.substring(uuidIndex + 1) : fileName;
        }
        
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        if (imageExtensions.includes(ext)) {
            return `<img src="${fileUrl}" class="chat-image-bubble" onclick="window.open('${fileUrl}', '_blank')" alt="Image file">`;
        } else {
            let icon = 'fa-file';
            if (['.pdf'].includes(ext)) icon = 'fa-file-pdf';
            else if (['.zip', '.rar', '.7z'].includes(ext)) icon = 'fa-file-zipper';
            else if (['.doc', '.docx'].includes(ext)) icon = 'fa-file-word';
            else if (['.xls', '.xlsx'].includes(ext)) icon = 'fa-file-excel';
            
            return `
                <a href="${fileUrl}" target="_blank" class="chat-file-bubble">
                    <i class="fa-solid ${icon}"></i>
                    <span>${displayName}</span>
                </a>
            `;
        }
    }
    return content;
}

function formatDateSeparator(timestamp) {
    const date = new Date(timestamp);
    const options = { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = date.toLocaleDateString('en-US', options);
    
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const dateGMT7 = date.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const todayGMT7 = today.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    const yesterdayGMT7 = yesterday.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    if (dateGMT7 === todayGMT7) {
        return `Today, ${dateStr}`;
    }
    if (dateGMT7 === yesterdayGMT7) {
        return `Yesterday, ${dateStr}`;
    }
    
    return dateStr;
}

function renderMessages(messages) {
    const messagesContainer = document.getElementById("chat-messages-scroll-area");
    messagesContainer.innerHTML = "";
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-list-placeholder">No messages in this chat. Type a message below to start chatting!</div>';
        state.lastMessageDateStr = "";
        return;
    }
    
    let lastDateStr = "";
    
    messages.forEach(m => {
        const msgDateStr = new Date(m.timestamp).toDateString();
        
        // Render date separator if it's a new day
        if (msgDateStr !== lastDateStr) {
            const sep = document.createElement("div");
            sep.className = "date-separator";
            sep.innerHTML = `<span class="date-pill">${formatDateSeparator(m.timestamp)}</span>`;
            messagesContainer.appendChild(sep);
            lastDateStr = msgDateStr;
        }
        
        const isIncoming = m.sender_id !== state.currentUserId;
        const msgBlock = document.createElement("div");
        msgBlock.className = `message-block ${isIncoming ? 'incoming' : 'outgoing'}`;
        
        const timeStr = new Date(m.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
        
        // Retrieve sender details
        let senderAvatar = "https://api.dicebear.com/7.x/adventurer/svg?seed=fallback";
        if (m.sender) {
            senderAvatar = m.sender.avatar_url;
        } else {
            // Find in conversation cache
            const conv = state.conversations.find(c => c.id === state.activeConversationId);
            const part = conv ? conv.participants.find(p => p.user_id === m.sender_id) : null;
            if (part) {
                senderAvatar = part.user.avatar_url;
            }
        }
        
        msgBlock.innerHTML = `
            ${isIncoming ? `<img src="${senderAvatar}" class="msg-avatar" alt="Avatar">` : ''}
            <div class="message-content-wrapper">
                <div class="message-bubble">${formatMessageContent(m.content)}</div>
                <div class="message-meta">
                    <span>${timeStr}</span>
                    ${!isIncoming ? '<i class="fa-solid fa-check-double"></i>' : ''}
                </div>
            </div>
        `;
        messagesContainer.appendChild(msgBlock);
    });
    
    state.lastMessageDateStr = lastDateStr;
    scrollToBottom();
}

function scrollToBottom() {
    const messagesContainer = document.getElementById("chat-messages-scroll-area");
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// WebSocket connection for real-time updates
function connectWebSocket(conversationId) {
    if (state.activeSocket) {
        state.activeSocket.close();
    }
    
    // Construct WebSocket URL
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProto}//${window.location.host}/ws/${conversationId}?token=${state.token}`;
    
    const socket = new WebSocket(wsUrl);
    state.activeSocket = socket;
    
    socket.onopen = () => {
        console.log(`Connected to chat WebSocket for conversation ${conversationId}`);
    };
    
    socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        console.log("WebSocket message received:", payload);
        
        // Payload format: {id, sender_id, sender_name, avatar_url, conversation_id, content, timestamp}
        // Update local conversations message cache
        const conv = state.conversations.find(c => c.id === payload.conversation_id);
        if (conv) {
            // Add message to cache if it doesn't already exist
            if (!conv.messages) conv.messages = [];
            if (!conv.messages.some(m => m.id === payload.id)) {
                conv.messages.push({
                    id: payload.id,
                    content: payload.content,
                    conversation_id: payload.conversation_id,
                    sender_id: payload.sender_id,
                    timestamp: payload.timestamp,
                    is_read: payload.conversation_id === state.activeConversationId, // Read if currently open
                    sender: {
                        id: payload.sender_id,
                        username: payload.sender_name,
                        avatar_url: payload.avatar_url
                    }
                });
            }
        }
        
        // If this message belongs to the current open chat, append it to the viewport
        if (payload.conversation_id === state.activeConversationId) {
            appendSingleMessage(payload);
        }
        
        // Re-render conversation list to reflect the new message snippet and ordering
        renderConversationsList();
    };
    
    socket.onclose = (event) => {
        console.log("WebSocket connection closed:", event);
        // Automatically reconnect if we're still looking at the same conversation and logged in
        if (state.activeConversationId === conversationId && state.token && state.activeSocket === socket) {
            console.log("Attempting to reconnect WebSocket...");
            setTimeout(() => connectWebSocket(conversationId), 2000);
        }
    };
    
    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
    };
}

function appendSingleMessage(payload) {
    const messagesContainer = document.getElementById("chat-messages-scroll-area");
    
    // Remove empty state placeholder if it exists
    const placeholder = messagesContainer.querySelector(".empty-list-placeholder");
    if (placeholder) placeholder.remove();
    
    const msgDateStr = new Date(payload.timestamp).toDateString();
    
    // Dynamically insert a date separator if this message starts a new day
    if (msgDateStr !== state.lastMessageDateStr) {
        const sep = document.createElement("div");
        sep.className = "date-separator";
        sep.innerHTML = `<span class="date-pill">${formatDateSeparator(payload.timestamp)}</span>`;
        messagesContainer.appendChild(sep);
        state.lastMessageDateStr = msgDateStr;
    }
    
    const isIncoming = payload.sender_id !== state.currentUserId;
    const msgBlock = document.createElement("div");
    msgBlock.className = `message-block ${isIncoming ? 'incoming' : 'outgoing'}`;
    
    const timeStr = new Date(payload.timestamp).toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    
    msgBlock.innerHTML = `
        ${isIncoming ? `<img src="${payload.avatar_url}" class="msg-avatar" alt="Avatar">` : ''}
        <div class="message-content-wrapper">
            <div class="message-bubble">${formatMessageContent(payload.content)}</div>
            <div class="message-meta">
                <span>${timeStr}</span>
                ${!isIncoming ? '<i class="fa-solid fa-check-double"></i>' : ''}
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(msgBlock);
    scrollToBottom();
}

// Send Message
async function handleSendMessage(event) {
    if (event) event.preventDefault();
    
    const input = document.getElementById("chat-message-input");
    const content = input.value.trim();
    if (!content) return;
    
    if (state.activeSocket && state.activeSocket.readyState === WebSocket.OPEN) {
        // Send via WebSocket (real-time broadcast)
        state.activeSocket.send(content);
        input.value = "";
    } else {
        // Fallback: Send via POST request
        try {
            const res = await fetch(`${API_BASE_URL}/messages/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    content: content,
                    conversation_id: state.activeConversationId,
                    sender_id: state.currentUserId
                })
            });
            
            if (!res.ok) throw new Error("Failed to send message");
            
            const message = await res.json();
            input.value = "";
            
            // Add message to cache
            const conv = state.conversations.find(c => c.id === state.activeConversationId);
            if (conv) {
                if (!conv.messages) conv.messages = [];
                conv.messages.push(message);
            }
            
            // Re-render
            renderMessages(conv.messages);
            renderConversationsList();
        } catch (error) {
            alert(`Error sending message: ${error.message}`);
        }
    }
}

// Quick reply
function sendQuickReply(chip) {
    const text = chip.textContent;
    const input = document.getElementById("chat-message-input");
    input.value = text;
    handleSendMessage();
}

// Handle File Upload
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Reset file input value so same file can be uploaded again if needed
    const fileInput = document.getElementById("chat-file-input");
    
    // Check file size (e.g. limit to 20MB)
    if (file.size > 20 * 1024 * 1024) {
        alert("File size exceeds 20MB limit.");
        fileInput.value = "";
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Show a loading indicator in input or disable send
    const inputField = document.getElementById("chat-message-input");
    const originalPlaceholder = inputField.placeholder;
    inputField.disabled = true;
    inputField.placeholder = `Uploading ${file.name}...`;

    try {
        const res = await fetch(`${API_BASE_URL}/upload`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.token}`
            },
            body: formData
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Upload failed");
        }

        const data = await res.json();
        
        // After successful upload, send the URL as a chat message!
        if (state.activeSocket && state.activeSocket.readyState === WebSocket.OPEN) {
            state.activeSocket.send(data.url);
        } else {
            // Fallback to REST
            const msgRes = await fetch(`${API_BASE_URL}/messages/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    content: data.url,
                    conversation_id: state.activeConversationId,
                    sender_id: state.currentUserId
                })
            });
            
            if (!msgRes.ok) throw new Error("Failed to send file link");
            
            const message = await msgRes.json();
            
            // Add message to cache
            const conv = state.conversations.find(c => c.id === state.activeConversationId);
            if (conv) {
                if (!conv.messages) conv.messages = [];
                conv.messages.push(message);
            }
            
            // Re-render
            renderMessages(conv.messages);
            renderConversationsList();
        }
    } catch (error) {
        alert(`Error uploading file: ${error.message}`);
    } finally {
        inputField.disabled = false;
        inputField.placeholder = originalPlaceholder;
        fileInput.value = "";
    }
}

// Emoji Popover
function toggleEmojiPicker() {
    document.getElementById("emoji-picker").classList.toggle("hidden");
}

function appendEmoji(emoji) {
    const input = document.getElementById("chat-message-input");
    input.value += emoji;
    input.focus();
    toggleEmojiPicker();
}

// New Conversation Modal Handlers
async function openNewChatModal() {
    document.getElementById("new-chat-modal").classList.remove("hidden");
    state.selectedModalUserIds.clear();
    document.getElementById("group-mode-checkbox").checked = false;
    document.getElementById("group-name-container").classList.add("hidden");
    document.getElementById("group-name").value = "";
    document.getElementById("user-search").value = "";
    
    const usersContainer = document.getElementById("modal-users-list");
    usersContainer.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Fetching users...</div>';
    
    try {
        const res = await fetch(`${API_BASE_URL}/users/`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch users list");
        
        state.users = await res.json();
        renderModalUsersList();
    } catch (error) {
        usersContainer.innerHTML = `<div class="empty-list-placeholder"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${error.message}</div>`;
    }
}

function closeNewChatModal() {
    document.getElementById("new-chat-modal").classList.add("hidden");
}

function closeNewChatModalOnOverlay(event) {
    if (event.target === document.getElementById("new-chat-modal")) {
        closeNewChatModal();
    }
}

function toggleGroupMode() {
    const isGroup = document.getElementById("group-mode-checkbox").checked;
    const groupNameContainer = document.getElementById("group-name-container");
    
    if (isGroup) {
        groupNameContainer.classList.remove("hidden");
    } else {
        groupNameContainer.classList.add("hidden");
        document.getElementById("group-name").value = "";
    }
}

function renderModalUsersList(filterQuery = "") {
    const container = document.getElementById("modal-users-list");
    container.innerHTML = "";
    
    const filtered = state.users.filter(u => {
        if (!filterQuery) return true;
        return u.username.toLowerCase().includes(filterQuery.toLowerCase());
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-list-placeholder">No users found.</div>';
        return;
    }
    
    filtered.forEach(u => {
        const isSelected = state.selectedModalUserIds.has(u.id);
        const item = document.createElement("div");
        item.className = `modal-user-item ${isSelected ? 'selected' : ''}`;
        item.onclick = () => selectModalUser(u.id, item);
        item.innerHTML = `
            <div class="modal-user-info">
                <img src="${u.avatar_url}" class="modal-user-avatar" alt="Avatar">
                <span class="modal-user-name">${u.username}</span>
            </div>
            <div class="checkbox-circle"><i class="fa-solid fa-check"></i></div>
        `;
        container.appendChild(item);
    });
}

function selectModalUser(userId, element) {
    const isGroup = document.getElementById("group-mode-checkbox").checked;
    
    if (isGroup) {
        // Toggle selected user
        if (state.selectedModalUserIds.has(userId)) {
            state.selectedModalUserIds.delete(userId);
            element.classList.remove("selected");
        } else {
            state.selectedModalUserIds.add(userId);
            element.classList.add("selected");
        }
    } else {
        // Single user mode: select only this user
        state.selectedModalUserIds.clear();
        state.selectedModalUserIds.add(userId);
        
        document.querySelectorAll(".modal-user-item").forEach(el => el.classList.remove("selected"));
        element.classList.add("selected");
    }
}

function filterUsersList() {
    const query = document.getElementById("user-search").value;
    renderModalUsersList(query);
}

async function createConversationSubmit() {
    if (state.selectedModalUserIds.size === 0) {
        alert("Please select at least one user to chat with.");
        return;
    }
    
    const isGroup = document.getElementById("group-mode-checkbox").checked;
    let groupName = document.getElementById("group-name").value.trim();
    
    if (isGroup && !groupName) {
        groupName = "Group Chat";
    }
    
    const participantIds = Array.from(state.selectedModalUserIds);
    
    try {
        const res = await fetch(`${API_BASE_URL}/conversations/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({
                is_group: isGroup,
                name: isGroup ? groupName : null,
                participant_ids: participantIds
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to create conversation");
        }
        
        const newConversation = await res.json();
        
        // Reload conversations list and select the newly created one
        closeNewChatModal();
        await loadConversations();
        selectConversation(newConversation.id);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Utils
function formatTimeRelative(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    
    const dateGMT7 = date.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayGMT7 = yesterday.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    if (dateGMT7 === yesterdayGMT7) return "Yesterday";
    
    return date.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', month: 'short', day: 'numeric' });
}

// User Profile Tooltip Toggler (Click behavior)
function toggleProfileTooltip(event) {
    event.stopPropagation();
    const tooltip = document.getElementById("profile-tooltip-box");
    if (tooltip) {
        tooltip.classList.toggle("show");
    }
}

// Close tooltip when clicking anywhere else
window.addEventListener("click", () => {
    const tooltip = document.getElementById("profile-tooltip-box");
    if (tooltip) {
        tooltip.classList.remove("show");
    }
});

// Prevent tooltip closure when clicking inside it
document.addEventListener("DOMContentLoaded", () => {
    const tooltip = document.getElementById("profile-tooltip-box");
    if (tooltip) {
        tooltip.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }
});

// Toggle active chat dropdown menu
function toggleChatActionsMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById("chat-actions-menu");
    if (!menu) return;
    
    const conversation = state.conversations.find(c => c.id === state.activeConversationId);
    if (!conversation) return;
    
    // Clear and populate dropdown
    menu.innerHTML = "";
    if (conversation.is_group) {
        menu.innerHTML = `
            <button class="dropdown-item primary" onclick="openAddMemberModal()"><i class="fa-solid fa-user-plus"></i> Add Member</button>
            <button class="dropdown-item danger" onclick="deleteActiveConversation()"><i class="fa-solid fa-trash"></i> Delete Group</button>
        `;
    } else {
        menu.innerHTML = `
            <button class="dropdown-item danger" onclick="deleteActiveConversation()"><i class="fa-solid fa-user-minus"></i> Unfriend</button>
        `;
    }
    
    menu.classList.toggle("hidden");
}

// Close dropdowns on outside click
window.addEventListener("click", () => {
    const chatMenu = document.getElementById("chat-actions-menu");
    if (chatMenu) chatMenu.classList.add("hidden");
});

// Delete Active Conversation
async function deleteActiveConversation() {
    const conversation = state.conversations.find(c => c.id === state.activeConversationId);
    if (!conversation) return;
    
    const confirmMsg = conversation.is_group 
        ? "Are you sure you want to delete this group? All messages and participants will be deleted."
        : `Are you sure you want to unfriend ${getConversationName(conversation)}? Your chat history will be deleted.`;
        
    if (!confirm(confirmMsg)) return;
    
    try {
        const res = await fetch(`${API_BASE_URL}/conversations/${state.activeConversationId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to delete conversation");
        }
        
        // Success
        state.activeConversationId = null;
        if (state.activeSocket) {
            state.activeSocket.close();
            state.activeSocket = null;
        }
        
        // Reset view to empty state
        document.getElementById("chat-active-state").classList.add("hidden");
        document.getElementById("chat-empty-state").classList.remove("hidden");
        
        await loadConversations();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// Add Member Modal Control Flow
let selectedAddMemberUserId = null;
let addMemberUsersList = [];

function openAddMemberModal() {
    document.getElementById("add-member-modal").classList.remove("hidden");
    selectedAddMemberUserId = null;
    document.getElementById("add-member-search").value = "";
    
    const container = document.getElementById("modal-add-member-users-list");
    container.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Fetching users...</div>';
    
    // Get active conversation participants
    const activeConv = state.conversations.find(c => c.id === state.activeConversationId);
    const existingUserIds = activeConv ? activeConv.participants.map(p => p.user_id) : [];
    
    fetch(`${API_BASE_URL}/users/`, {
        headers: { "Authorization": `Bearer ${state.token}` }
    })
    .then(res => res.json())
    .then(users => {
        // Filter out users who are already in the conversation
        addMemberUsersList = users.filter(u => !existingUserIds.includes(u.id));
        renderAddMemberUsersList();
    })
    .catch(err => {
        container.innerHTML = `<div class="empty-list-placeholder"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${err.message}</div>`;
    });
}

function closeAddMemberModal() {
    document.getElementById("add-member-modal").classList.add("hidden");
}

function closeAddMemberModalOnOverlay(event) {
    if (event.target === document.getElementById("add-member-modal")) {
        closeAddMemberModal();
    }
}

function renderAddMemberUsersList(filterQuery = "") {
    const container = document.getElementById("modal-add-member-users-list");
    container.innerHTML = "";
    
    const filtered = addMemberUsersList.filter(u => {
        if (!filterQuery) return true;
        return u.username.toLowerCase().includes(filterQuery.toLowerCase());
    });
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-list-placeholder">No users available to add.</div>';
        return;
    }
    
    filtered.forEach(u => {
        const isSelected = u.id === selectedAddMemberUserId;
        const item = document.createElement("div");
        item.className = `modal-user-item ${isSelected ? 'selected' : ''}`;
        item.onclick = () => selectAddMemberUser(u.id, item);
        item.innerHTML = `
            <div class="modal-user-info">
                <img src="${u.avatar_url}" class="modal-user-avatar" alt="Avatar">
                <span class="modal-user-name">${u.username}</span>
            </div>
            <div class="checkbox-circle"><i class="fa-solid fa-check"></i></div>
        `;
        container.appendChild(item);
    });
}

function selectAddMemberUser(userId, element) {
    selectedAddMemberUserId = userId;
    document.querySelectorAll("#modal-add-member-users-list .modal-user-item").forEach(el => el.classList.remove("selected"));
    element.classList.add("selected");
}

function filterAddMemberUsersList() {
    const query = document.getElementById("add-member-search").value;
    renderAddMemberUsersList(query);
}

async function addMemberSubmit() {
    if (!selectedAddMemberUserId) {
        alert("Please select a user to add.");
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/conversations/${state.activeConversationId}/add-member?user_id=${selectedAddMemberUserId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.token}`
            }
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to add member");
        }
        
        closeAddMemberModal();
        
        // Reload conversations cache
        await loadConversations();
        
        // Reload messages to show system join message
        await loadMessages(state.activeConversationId);
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

// ==========================================
// CLIENT TAB ROUTING SYSTEM
// ==========================================
function switchTab(tabName, btn) {
    // Highlight active nav button
    document.querySelectorAll(".nav-menu .nav-btn").forEach(el => el.classList.remove("active"));
    if (btn) {
        btn.classList.add("active");
    } else if (tabName === 'messages') {
        const msgBtn = document.getElementById("messages-nav-btn");
        if (msgBtn) msgBtn.classList.add("active");
    }
    
    // Get references to panels
    const convPane = document.querySelector(".conversations-pane");
    const chatPane = document.getElementById("chat-pane-container");
    const homePane = document.getElementById("home-pane");
    const contactsPane = document.getElementById("contacts-pane");
    const settingsPane = document.getElementById("settings-pane");
    
    // Hide all panels
    convPane.classList.add("hidden");
    chatPane.classList.add("hidden");
    homePane.classList.add("hidden");
    contactsPane.classList.add("hidden");
    settingsPane.classList.add("hidden");
    
    // Show selected panel
    if (tabName === 'messages') {
        convPane.classList.remove("hidden");
        chatPane.classList.remove("hidden");
    } else if (tabName === 'home') {
        homePane.classList.remove("hidden");
        loadHomeDashboard();
    } else if (tabName === 'contacts') {
        contactsPane.classList.remove("hidden");
        loadContactsTab();
    } else if (tabName === 'settings') {
        settingsPane.classList.remove("hidden");
        loadSettingsTab();
    }
}

// ==========================================
// HOME DASHBOARD CONTROLLERS
// ==========================================
async function loadHomeDashboard() {
    if (!state.currentUser) return;
    
    // Welcome Greeting
    document.getElementById("dashboard-welcome-msg").textContent = `Hello, ${state.currentUser.username}!`;
    document.getElementById("dashboard-date-str").textContent = new Date().toLocaleDateString('en-US', { 
        timeZone: 'Asia/Ho_Chi_Minh',
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Calculate Stats
    const activeChatsCount = state.conversations.length;
    
    let totalUnread = 0;
    state.conversations.forEach(c => {
        if (c.messages) {
            totalUnread += c.messages.filter(m => !m.is_read && m.sender_id !== state.currentUserId).length;
        }
    });
    
    // Fetch users count to count who is online
    let onlineCount = 0;
    try {
        const res = await fetch(`${API_BASE_URL}/users/`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        if (res.ok) {
            const users = await res.json();
            onlineCount = users.filter(u => u.is_online).length;
        }
    } catch (e) {
        console.error("Failed to fetch online counts:", e);
    }
    
    document.getElementById("stat-chats-count").textContent = activeChatsCount;
    document.getElementById("stat-unread-count").textContent = totalUnread;
    document.getElementById("stat-online-count").textContent = onlineCount;
    
    // Load Recent Conversations List
    const recentList = document.getElementById("dashboard-recent-chats-list");
    recentList.innerHTML = "";
    
    // Clone and sort conversations by latest message timestamp
    const sortedConvs = [...state.conversations]
        .filter(c => c.messages && c.messages.length > 0)
        .sort((a, b) => {
            const lastA = new Date(a.messages[a.messages.length - 1].timestamp);
            const lastB = new Date(b.messages[b.messages.length - 1].timestamp);
            return lastB - lastA;
        })
        .slice(0, 3);
        
    if (sortedConvs.length === 0) {
        recentList.innerHTML = '<div class="empty-list-placeholder">No recent messages. Start a new chat!</div>';
    } else {
        sortedConvs.forEach(conv => {
            const name = getConversationName(conv);
            const avatar = getConversationAvatar(conv);
            const lastMsg = conv.messages[conv.messages.length - 1];
            const contentSnippet = lastMsg ? (lastMsg.content.startsWith("/uploads/") ? "Sent an attachment" : lastMsg.content) : "No messages";
            const timeAgo = lastMsg ? formatTimeRelative(lastMsg.timestamp) : "";
            
            const div = document.createElement("div");
            div.className = "recent-chat-item";
            div.innerHTML = `
                <div class="recent-chat-item-left">
                    <img src="${avatar}" class="recent-chat-item-avatar" alt="Avatar">
                    <div class="recent-chat-item-details">
                        <h4>${name}</h4>
                        <p>${contentSnippet}</p>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="openChatFromDashboard(${conv.id})" style="padding: 6px 12px; font-size: 12px;">
                    <i class="fa-solid fa-comment"></i> Chat
                </button>
            `;
            recentList.appendChild(div);
        });
    }
    
    // Generate Activity Logs dynamically
    const activitiesList = document.getElementById("dashboard-activities-list");
    activitiesList.innerHTML = "";
    
    // Gather last 4 messages from all chats
    const allRecentMessages = [];
    state.conversations.forEach(conv => {
        if (conv.messages) {
            conv.messages.forEach(m => {
                allRecentMessages.push({
                    msg: m,
                    convName: getConversationName(conv)
                });
            });
        }
    });
    
    allRecentMessages.sort((a, b) => new Date(b.msg.timestamp) - new Date(a.msg.timestamp));
    const sliceLogs = allRecentMessages.slice(0, 4);
    
    if (sliceLogs.length === 0) {
        activitiesList.innerHTML = '<div class="activity-item"><div class="activity-icon"><i class="fa-solid fa-info-circle"></i></div><div class="activity-details"><p>No recent activity detected.</p></div></div>';
    } else {
        sliceLogs.forEach(log => {
            const isMe = log.msg.sender_id === state.currentUserId;
            const senderName = isMe ? "You" : (log.msg.sender ? log.msg.sender.username : "Someone");
            const actionText = log.msg.content.startsWith("/uploads/") ? "shared a file attachment" : `sent: "${log.msg.content.substring(0, 25)}${log.msg.content.length > 25 ? '...' : ''}"`;
            const timestamp = formatTimeRelative(log.msg.timestamp);
            
            const div = document.createElement("div");
            div.className = "activity-item";
            div.innerHTML = `
                <div class="activity-icon"><i class="fa-solid fa-circle-info"></i></div>
                <div class="activity-details">
                    <p><strong>${senderName}</strong> ${actionText} in <strong>${log.convName}</strong></p>
                    <span>${timestamp} ago</span>
                </div>
            `;
            activitiesList.appendChild(div);
        });
    }
}

function openChatFromDashboard(convId) {
    switchTab('messages', null);
    selectConversation(convId);
}

// ==========================================
// CONTACTS DIRECTORY CONTROLLERS
// ==========================================
let allContactsCache = [];
let selectedContactUserId = null;

async function loadContactsTab() {
    const listContainer = document.getElementById("contacts-list-container");
    listContainer.innerHTML = '<div class="loading-placeholder"><i class="fa-solid fa-spinner fa-spin"></i> Loading contacts...</div>';
    
    // Reset selection details
    document.getElementById("contact-details-container").innerHTML = `
        <div class="empty-state">
            <div class="empty-state-illustration">
                <i class="fa-solid fa-address-book"></i>
            </div>
            <h3>Select a Contact</h3>
            <p>Choose a contact from the left list to view their profile card and start messaging.</p>
        </div>
    `;
    selectedContactUserId = null;
    document.getElementById("contacts-search").value = "";
    
    try {
        const res = await fetch(`${API_BASE_URL}/users/`, {
            headers: { "Authorization": `Bearer ${state.token}` }
        });
        
        if (!res.ok) throw new Error("Failed to load contacts list");
        
        allContactsCache = await res.json();
        renderContactsList();
    } catch (e) {
        listContainer.innerHTML = `<div class="empty-list-placeholder"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${e.message}</div>`;
    }
}

function renderContactsList(filterQuery = "") {
    const listContainer = document.getElementById("contacts-list-container");
    listContainer.innerHTML = "";
    
    const filtered = allContactsCache.filter(u => {
        if (!filterQuery) return true;
        return u.username.toLowerCase().includes(filterQuery.toLowerCase());
    });
    
    if (filtered.length === 0) {
        listContainer.innerHTML = '<div class="empty-list-placeholder">No contacts found.</div>';
        return;
    }
    
    filtered.forEach(u => {
        const isSelected = u.id === selectedContactUserId;
        const item = document.createElement("div");
        item.className = `contact-item ${isSelected ? 'selected' : ''}`;
        item.onclick = () => selectContactDetail(u.id, item);
        
        item.innerHTML = `
            <div class="contact-avatar-wrapper">
                <img src="${u.avatar_url}" class="contact-avatar" alt="Avatar">
                <div class="online-indicator ${u.is_online ? 'active' : 'offline'}"></div>
            </div>
            <div class="contact-info">
                <span class="contact-name">${u.username}</span>
                <span class="contact-status">${u.is_online ? 'Online' : 'Offline'}</span>
            </div>
        `;
        listContainer.appendChild(item);
    });
}

function filterContactsList() {
    const query = document.getElementById("contacts-search").value;
    renderContactsList(query);
}

function selectContactDetail(userId, element) {
    selectedContactUserId = userId;
    
    // Highlight correct item
    document.querySelectorAll("#contacts-list-container .contact-item").forEach(el => el.classList.remove("selected"));
    if (element) element.classList.add("selected");
    
    const user = allContactsCache.find(u => u.id === userId);
    if (!user) return;
    
    const container = document.getElementById("contact-details-container");
    const statusText = user.is_online ? "Online Now" : (user.last_active_at ? `Active ${formatTimeRelative(user.last_active_at)} ago` : "Offline");
    const joinedDate = user.joined_at ? new Date(user.joined_at).toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'long', day: 'numeric' }) : "Recently";
    
    container.innerHTML = `
        <div class="contact-profile-card">
            <img src="${user.avatar_url}" class="contact-card-avatar" alt="Avatar">
            <h2 class="contact-card-name">${user.username}</h2>
            <div class="contact-card-status-badge ${user.is_online ? 'online' : 'offline'}">
                <i class="fa-solid ${user.is_online ? 'fa-circle-dot' : 'fa-circle'}"></i>
                <span>${statusText}</span>
            </div>
            
            <div class="contact-card-meta">
                <div class="meta-row">
                    <span class="label">User ID</span>
                    <span class="value">#${user.id}</span>
                </div>
                <div class="meta-row">
                    <span class="label">Joined</span>
                    <span class="value">${joinedDate}</span>
                </div>
                <div class="meta-row">
                    <span class="label">Account Status</span>
                    <span class="value">${user.is_online ? 'Active' : 'Offline'}</span>
                </div>
            </div>
            
            <button class="btn btn-primary" onclick="chatWithUser(${user.id})" style="width: 100%; padding: 14px; font-weight: 700; font-size: 15px; border-radius: 12px;">
                <i class="fa-solid fa-comment-dots"></i> Send Message
            </button>
        </div>
    `;
}

async function chatWithUser(userId) {
    // 1. Check if 1-on-1 chat exists in state conversations cache
    const existing = state.conversations.find(c => !c.is_group && c.participants.some(p => p.user_id === userId));
    
    if (existing) {
        // Direct route
        switchTab('messages', null);
        selectConversation(existing.id);
    } else {
        // Create new conversation
        try {
            const res = await fetch(`${API_BASE_URL}/conversations/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${state.token}`
                },
                body: JSON.stringify({
                    participant_ids: [userId],
                    is_group: false
                })
            });
            
            if (!res.ok) throw new Error("Failed to create new chat conversation");
            
            const newConv = await res.json();
            
            // Reload conversations cache
            await loadConversations();
            
            // Switch tabs and select
            switchTab('messages', null);
            selectConversation(newConv.id);
        } catch (e) {
            alert(`Error starting chat: ${e.message}`);
        }
    }
}

// ==========================================
// SETTINGS TAB CONTROLLERS
// ==========================================
function loadSettingsTab() {
    if (!state.currentUser) return;
    
    // Display Name
    document.getElementById("settings-username").value = state.currentUser.username;
    
    // Extract Avatar Seed if it's a Dicebear URL, otherwise it's custom
    let seed = "";
    if (state.currentUser.avatar_url && state.currentUser.avatar_url.includes("dicebear.com")) {
        try {
            const urlObj = new URL(state.currentUser.avatar_url);
            seed = urlObj.searchParams.get("seed") || "demo";
        } catch (e) {
            seed = "demo";
        }
        state.uploadedAvatarUrl = null;
    } else {
        state.uploadedAvatarUrl = state.currentUser.avatar_url;
        seed = "";
    }
    
    document.getElementById("settings-avatar-seed").value = seed;
    document.getElementById("settings-avatar-preview").src = state.currentUser.avatar_url || "https://api.dicebear.com/7.x/adventurer/svg?seed=demo";
    
    // Theme toggle checkbox
    document.getElementById("settings-theme-toggle").checked = document.body.classList.contains("light-theme");
    
    // Color dot active highlights
    const savedAccent = localStorage.getItem("accent") || "#0066fe";
    document.querySelectorAll(".accent-color-picker .color-dot").forEach(dot => {
        // Translate rgb background checks to hex
        const bg = dot.style.backgroundColor;
        let isMatch = false;
        if (savedAccent === "#0084ff" && bg.includes("rgb(0, 132, 255)")) isMatch = true;
        else if (savedAccent === "#8b5cf6" && bg.includes("rgb(139, 92, 246)")) isMatch = true;
        else if (savedAccent === "#10b981" && bg.includes("rgb(16, 185, 129)")) isMatch = true;
        else if (savedAccent === "#f43f5e" && bg.includes("rgb(244, 63, 94)")) isMatch = true;
        // Also support exact hex check if set
        if (savedAccent === "#0066fe" && bg.includes("rgb(0, 102, 254)")) isMatch = true;
        
        if (isMatch) {
            document.querySelectorAll(".accent-color-picker .color-dot").forEach(d => d.classList.remove("active"));
            dot.classList.add("active");
        }
    });
}

function previewSettingsAvatar() {
    const seed = document.getElementById("settings-avatar-seed").value.trim() || "demo";
    state.uploadedAvatarUrl = null;
    const previewUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
    document.getElementById("settings-avatar-preview").src = previewUrl;
}

async function handleAvatarUpload(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    const formData = new FormData();
    formData.append("file", file);
    
    const settingsPreview = document.getElementById("settings-avatar-preview");
    const originalSrc = settingsPreview.src;
    settingsPreview.src = "https://api.dicebear.com/7.x/adventurer/svg?seed=loading";
    
    try {
        const res = await fetch(`${API_BASE_URL}/upload`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${state.token}`
            },
            body: formData
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to upload avatar image");
        }
        
        const data = await res.json();
        state.uploadedAvatarUrl = data.url;
        settingsPreview.src = data.url;
        document.getElementById("settings-avatar-seed").value = "";
    } catch (e) {
        settingsPreview.src = originalSrc;
        alert(`Error uploading avatar: ${e.message}`);
    } finally {
        input.value = "";
    }
}

async function updateUserProfile() {
    const newUsername = document.getElementById("settings-username").value.trim();
    
    let newAvatarUrl = "";
    if (state.uploadedAvatarUrl) {
        newAvatarUrl = state.uploadedAvatarUrl;
    } else {
        const seed = document.getElementById("settings-avatar-seed").value.trim() || "demo";
        newAvatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}`;
    }
    
    if (!newUsername) {
        alert("Display name cannot be empty.");
        return;
    }
    
    try {
        const res = await fetch(`${API_BASE_URL}/users/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${state.token}`
            },
            body: JSON.stringify({
                username: newUsername,
                avatar_url: newAvatarUrl
            })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Failed to update profile details");
        }
        
        const updatedUser = await res.json();
        
        // Success: update state cache
        state.currentUser = updatedUser;
        
        // Update elements
        document.getElementById("current-user-name").textContent = updatedUser.username;
        document.getElementById("current-user-avatar").src = updatedUser.avatar_url;
        
        alert("Profile updated successfully!");
    } catch (e) {
        alert(`Error updating profile: ${e.message}`);
    }
}

function toggleTheme(checkbox) {
    if (checkbox.checked) {
        document.body.classList.add("light-theme");
        localStorage.setItem("theme", "light");
    } else {
        document.body.classList.remove("light-theme");
        localStorage.setItem("theme", "dark");
    }
}

function setAccentColor(colorHex, element) {
    document.querySelectorAll(".accent-color-picker .color-dot").forEach(dot => dot.classList.remove("active"));
    if (element) element.classList.add("active");
    
    document.documentElement.style.setProperty("--primary-blue", colorHex);
    localStorage.setItem("accent", colorHex);
}
