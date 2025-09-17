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
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // Auth methods
    async login(phone, password) {
        return this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phone, password })
        });
    }

    async register(name, phone, password) {
        return this.request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, phone, password })
        });
    }

    async logout() {
        return this.request('/api/auth/logout', { method: 'POST' });
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

    async getConversation(userId) {
        // Encrypt user ID for API call
        const encryptedUserId = await this.encryptUserId(userId);
        const response = await this.request(`/api/messages/conversation/${encryptedUserId}`);
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


}

// Utility functions
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(title, body, icon = '/static/images/logo.png') {
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

// Request notification permission on load
document.addEventListener('DOMContentLoaded', () => {
    requestNotificationPermission();
});