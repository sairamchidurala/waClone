class SettingsApp {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            window.location.href = '/wa/login';
            return;
        }

        try {
            this.currentUser = await api.getCurrentUser();
            this.setupEventListeners();
            this.loadProfile();
        } catch (error) {
            console.error('Failed to load user:', error);
            localStorage.removeItem('user');
            window.location.href = '/wa/login';
        }
    }

    setupEventListeners() {
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = '/wa/';
        });

        document.getElementById('editProfileBtn').addEventListener('click', this.showEditModal.bind(this));
        document.getElementById('closeEditBtn').addEventListener('click', this.hideEditModal.bind(this));
        document.getElementById('cancelEditBtn').addEventListener('click', this.hideEditModal.bind(this));
        document.getElementById('editProfileForm').addEventListener('submit', this.updateProfile.bind(this));
        document.getElementById('logoutBtn').addEventListener('click', this.logout.bind(this));
        
        // Notification toggles
        document.getElementById('notificationToggle').addEventListener('change', this.toggleNotifications.bind(this));
        document.getElementById('soundToggle').addEventListener('change', this.toggleSound.bind(this));
    }

    loadProfile() {
        document.getElementById('profileName').textContent = this.currentUser.name;
        document.getElementById('profilePhone').textContent = this.currentUser.phone;
        setAvatar(document.getElementById('profileAvatar'), this.currentUser.name, 80);
        
        // Load notification settings
        document.getElementById('notificationToggle').checked = window.notificationManager.notificationEnabled;
        document.getElementById('soundToggle').checked = window.notificationManager.soundEnabled;
    }

    showEditModal() {
        const editName = document.getElementById('editName');
        const editPhone = document.getElementById('editPhone');
        const modal = document.getElementById('editProfileModal');
        
        if (editName && editPhone && modal) {
            editName.value = this.currentUser.name;
            editPhone.value = this.currentUser.phone;
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    hideEditModal() {
        const modal = document.getElementById('editProfileModal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }

    async updateProfile(e) {
        e.preventDefault();
        const name = document.getElementById('editName').value.trim();
        
        if (!name) {
            alert('Name is required');
            return;
        }

        try {
            await api.updateProfile({ name });
            this.currentUser.name = name;
            this.loadProfile();
            this.hideEditModal();
            alert('Profile updated successfully');
        } catch (error) {
            console.error('Failed to update profile:', error);
            this.showErrorMessage('Failed to update profile');
        }
    }

    toggleNotifications() {
        const enabled = window.notificationManager.toggleNotifications();
        document.getElementById('notificationToggle').checked = enabled;
    }
    
    toggleSound() {
        const enabled = window.notificationManager.toggleSound();
        document.getElementById('soundToggle').checked = enabled;
    }

    async logout() {
        if (this.confirmLogout()) {
            try {
                await api.logout();
                localStorage.removeItem('user');
                window.location.href = '/wa/login';
            } catch (error) {
                console.error('Logout failed:', error);
                localStorage.removeItem('user');
                window.location.href = '/wa/login';
            }
        }
    }
    
    confirmLogout() {
        return window.confirm('Are you sure you want to logout?');
    }
    
    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'fixed top-4 right-4 bg-red-500 text-white p-3 rounded shadow-lg z-50';
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SettingsApp();
});