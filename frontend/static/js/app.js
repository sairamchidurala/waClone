// Global app utilities and socket connection
class WhatsAppAPI {
    constructor() {
        this.baseURL = '/wa';
        this.socket = io({ path: '/wa/socket.io' });
        this.currentUser = null;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            // Check if response is HTML (login redirect)
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
                // Session expired, redirect to login
                localStorage.removeItem('user');
                window.location.href = '/wa/login';
                throw new Error('Session expired');
            }
            
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            
            // Handle session expiry
            if (error.message.includes('Unexpected token') || error.message.includes('DOCTYPE')) {
                localStorage.removeItem('user');
                window.location.href = '/wa/login';
            }
            
            throw error;
        }
    }

    // Auth methods
    async login(phone, password) {
        const result = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });
        
        // Start session monitoring after successful login
        if (result.user) {
            this.startSessionMonitoring();
        }
        
        return result;
    }
    
    async checkSession() {
        try {
            return await this.request('/api/auth/check-session');
        } catch (error) {
            return { valid: false };
        }
    }
    
    startSessionMonitoring() {
        // Check session validity every 30 seconds
        setInterval(async () => {
            const sessionCheck = await this.checkSession();
            if (!sessionCheck.valid) {
                this.handleForcedLogout();
            }
        }, 30000);
    }
    
    handleForcedLogout() {
        localStorage.removeItem('user');
        window.location.href = '/wa/login';
    }

    async register(name, phone, password) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, phone, password })
        });
    }

    async logout() {
        const result = await this.request('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('user');
        window.location.href = '/wa/login';
        return result;
    }

    async getCurrentUser() {
        return this.request('/api/auth/me');
    }

    // Message methods
    async sendMessage(receiverId, content) {
        const encryptedReceiverId = await this.encryptUserId(receiverId);
        return this.request('/api/messages/send', {
            method: 'POST',
            body: JSON.stringify({ receiver_id: encryptedReceiverId, content })
        });
    }

    async sendMedia(receiverId, file, caption = '') {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('receiver_id', receiverId);
        if (caption) formData.append('caption', caption);

        return this.request('/api/messages/send-media', {
            method: 'POST',
            headers: {},
            body: formData
        });
    }

    async getConversation(userId, page = 1) {
        // Encrypt user ID for API call
        const encryptedUserId = await this.encryptUserId(userId);
        const response = await this.request(`/api/messages/conversation/${encryptedUserId}?page=${page}&limit=50`);
        // Decrypt API response
        if (response.encrypted_data) {
            const decrypted = await this.decryptResponse(response.encrypted_data);
            return decrypted || [];
        }
        return response;
    }

    async encryptUserId(userId) {
        try {
            const response = await fetch(`${this.baseURL}/api/messages/encrypt-id`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            return result.encrypted_id || userId;
        } catch (error) {
            console.error('ID encryption failed:', error);
            return userId; // Fallback to plain ID
        }
    }

    async decryptResponse(encryptedData) {
        try {
            // Simple client-side decryption (in production, use proper crypto library)
            const response = await fetch(`${this.baseURL}/api/messages/decrypt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encrypted_data: encryptedData })
            });
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Decryption failed:', error);
            return null;
        }
    }

    async getContacts() {
        return this.request('/api/messages/contacts');
    }

    // Call methods
    async initiateCall(receiverId, callType) {
        return this.request('/api/calls/initiate', {
            method: 'POST',
            body: JSON.stringify({ receiver_id: receiverId, call_type: callType })
        });
    }

    async answerCall(callId) {
        return this.request(`/api/calls/${callId}/answer`, { method: 'POST' });
    }

    async endCall(callId) {
        return this.request(`/api/calls/${callId}/end`, { method: 'POST' });
    }

    async rejectCall(callId) {
        return this.request(`/api/calls/${callId}/reject`, { method: 'POST' });
    }

    async getCallHistory() {
        return this.request('/api/calls/history');
    }

    // User methods
    async searchUsers(query) {
        return this.request(`/api/users/search?q=${encodeURIComponent(query)}`);
    }

    async getUserByPhone(phone) {
        return this.request(`/api/users/by-phone/${phone}`);
    }

    async updateProfile(data) {
        return this.request('/api/auth/update-profile', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async uploadProfilePicture(file) {
        const formData = new FormData();
        formData.append('avatar', file);
        return this.request('/api/auth/upload-avatar', {
            method: 'POST',
            headers: {},
            body: formData
        });
    }


}

// Utility functions
function formatTime(timestamp) {
    // Convert UTC timestamp to IST (add 5.5 hours)
    const utcDate = new Date(timestamp);
    const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
    const now = new Date();
    const diff = now - istDate;

    if (diff < 24 * 60 * 60 * 1000) {
        return istDate.toLocaleTimeString('en-IN', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true
        });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        return istDate.toLocaleDateString('en-IN', { 
            weekday: 'short'
        });
    } else {
        return istDate.toLocaleDateString('en-IN', { 
            month: 'short', 
            day: 'numeric'
        });
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(title, body, icon = '/wa/static/images/logo.png') {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon });
    }
}

function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Initialize API instance
window.api = new WhatsAppAPI();

// Theme management
class ThemeManager {
    constructor() {
        this.init();
    }
    
    init() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.applyTheme(savedTheme);
        
        // Listen for system theme changes
        if (savedTheme === 'auto') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                if (localStorage.getItem('theme') === 'auto') {
                    this.applyTheme('auto');
                }
            });
        }
    }
    
    applyTheme(theme) {
        const body = document.body;
        
        if (theme === 'dark') {
            body.setAttribute('data-theme', 'dark');
        } else if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            body.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            body.removeAttribute('data-theme');
        }
    }
}

// Initialize theme and API
window.themeManager = new ThemeManager();
window.api = new WhatsAppAPI();

// Request notification permission on load
document.addEventListener('DOMContentLoaded', () => {
    requestNotificationPermission();
});