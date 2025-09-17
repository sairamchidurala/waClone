class SettingsApp {
    constructor() {
        this.currentUser = null;
        this.cropImage = null;
        this.cropCanvas = null;
        this.cropCtx = null;
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

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
        
        // Avatar upload
        document.getElementById('changeAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });
        document.getElementById('avatarInput').addEventListener('change', this.showCropModal.bind(this));
        
        // Crop modal events
        document.getElementById('closeCropBtn').addEventListener('click', this.hideCropModal.bind(this));
        document.getElementById('cancelCropBtn').addEventListener('click', this.hideCropModal.bind(this));
        document.getElementById('applyCropBtn').addEventListener('click', this.applyCrop.bind(this));
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoom(0.8));
        
        // Profile picture viewer
        document.getElementById('profileAvatar').addEventListener('click', this.viewProfilePicture.bind(this));
        document.getElementById('closeProfileViewBtn').addEventListener('click', this.closeProfileView.bind(this));
        

        
        // Notification toggles
        document.getElementById('notificationToggle').addEventListener('change', this.toggleNotifications.bind(this));
        document.getElementById('soundToggle').addEventListener('change', this.toggleSound.bind(this));
        
        // Privacy toggle
        document.getElementById('privacyToggle').addEventListener('change', this.togglePrivacy.bind(this));
        
        // Theme selector
        document.getElementById('themeSelect').addEventListener('change', this.changeTheme.bind(this));
    }

    loadProfile() {
        document.getElementById('profileName').textContent = this.currentUser.name;
        document.getElementById('profilePhone').textContent = this.currentUser.phone;
        setAvatar(document.getElementById('profileAvatar'), this.currentUser.name, 80);
        
        // Load notification settings
        document.getElementById('notificationToggle').checked = window.notificationManager.notificationEnabled;
        document.getElementById('soundToggle').checked = window.notificationManager.soundEnabled;
        
        // Load privacy setting (toggle ON = public, OFF = private)
        const isPrivate = this.currentUser.is_private ?? true;
        document.getElementById('privacyToggle').checked = !isPrivate;
        this.updatePrivacyDisplay(!isPrivate);
        
        // Load theme setting
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.getElementById('themeSelect').value = savedTheme;
        this.applyTheme(savedTheme);
        
        // Load avatar
        this.updateAvatar();
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
    
    async togglePrivacy() {
        const toggleChecked = document.getElementById('privacyToggle').checked;
        const isPrivate = !toggleChecked; // Toggle ON = public, OFF = private
        
        // Show confirmation dialog
        const message = toggleChecked 
            ? 'Make your profile public? Others will be able to find you in search results.'
            : 'Make your profile private? Others won\'t be able to find you in search results.';
            
        if (!confirm(message)) {
            // Revert toggle if user cancels
            document.getElementById('privacyToggle').checked = !toggleChecked;
            return;
        }
        
        try {
            await api.updateProfile({ 
                name: this.currentUser.name, 
                is_private: isPrivate 
            });
            this.currentUser.is_private = isPrivate;
            this.updatePrivacyDisplay(toggleChecked);
        } catch (error) {
            console.error('Failed to update privacy:', error);
            // Revert toggle on error
            document.getElementById('privacyToggle').checked = !toggleChecked;
            this.showErrorMessage('Failed to update privacy setting');
        }
    }
    
    updatePrivacyDisplay(toggleOn) {
        const label = document.getElementById('privacyLabel');
        
        if (toggleOn) {
            // Toggle ON = Public
            label.textContent = 'Public';
            label.style.color = 'var(--green-primary)';
        } else {
            // Toggle OFF = Private
            label.textContent = 'Private';
            label.style.color = 'var(--text-secondary)';
        }
    }
    
    changeTheme(e) {
        const theme = e.target.value;
        this.applyTheme(theme);
        localStorage.setItem('theme', theme);
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
    
    showCropModal(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            this.cropImage = new Image();
            this.cropImage.onload = () => {
                this.setupCropCanvas();
                document.getElementById('cropModal').classList.remove('hidden');
                document.getElementById('cropModal').classList.add('flex');
            };
            this.cropImage.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    setupCropCanvas() {
        this.cropCanvas = document.getElementById('cropCanvas');
        this.cropCtx = this.cropCanvas.getContext('2d');
        
        // Set fixed canvas size
        this.cropCanvas.width = 300;
        this.cropCanvas.height = 300;
        
        // Reset transform values
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        
        // Calculate initial scale to fit image
        const { width, height } = this.cropImage;
        const minScale = Math.max(300 / width, 300 / height);
        this.scale = minScale;
        
        // Center the image
        this.offsetX = (300 - width * this.scale) / 2;
        this.offsetY = (300 - height * this.scale) / 2;
        
        this.drawImage();
        this.setupCanvasEvents();
        
        // Position crop box in center
        const cropBox = document.getElementById('cropBox');
        cropBox.style.width = '150px';
        cropBox.style.height = '150px';
    }
    
    drawImage() {
        this.cropCtx.clearRect(0, 0, 300, 300);
        this.cropCtx.save();
        this.cropCtx.translate(this.offsetX, this.offsetY);
        this.cropCtx.scale(this.scale, this.scale);
        this.cropCtx.drawImage(this.cropImage, 0, 0);
        this.cropCtx.restore();
    }
    
    setupCanvasEvents() {
        // Mouse events
        this.cropCanvas.addEventListener('mousedown', this.startDrag.bind(this));
        this.cropCanvas.addEventListener('mousemove', this.drag.bind(this));
        this.cropCanvas.addEventListener('mouseup', this.endDrag.bind(this));
        this.cropCanvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Touch events
        this.cropCanvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.cropCanvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.cropCanvas.addEventListener('touchend', this.endDrag.bind(this));
    }
    
    startDrag(e) {
        this.isDragging = true;
        this.cropCanvas.style.cursor = 'grabbing';
        const rect = this.cropCanvas.getBoundingClientRect();
        this.lastX = e.clientX - rect.left;
        this.lastY = e.clientY - rect.top;
    }
    
    drag(e) {
        if (!this.isDragging) return;
        e.preventDefault();
        
        const rect = this.cropCanvas.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        this.offsetX += currentX - this.lastX;
        this.offsetY += currentY - this.lastY;
        
        this.lastX = currentX;
        this.lastY = currentY;
        
        this.drawImage();
    }
    
    endDrag() {
        this.isDragging = false;
        this.cropCanvas.style.cursor = 'grab';
    }
    
    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom(zoomFactor, e.offsetX, e.offsetY);
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.cropCanvas.getBoundingClientRect();
            this.startDrag({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            this.drag({
                clientX: touch.clientX,
                clientY: touch.clientY,
                preventDefault: () => {}
            });
        }
    }
    
    zoom(factor, centerX = 150, centerY = 150) {
        const newScale = this.scale * factor;
        if (newScale < 0.1 || newScale > 5) return;
        
        // Zoom towards the center point
        this.offsetX = centerX - (centerX - this.offsetX) * factor;
        this.offsetY = centerY - (centerY - this.offsetY) * factor;
        this.scale = newScale;
        
        this.drawImage();
    }
    
    hideCropModal() {
        document.getElementById('cropModal').classList.add('hidden');
        document.getElementById('cropModal').classList.remove('flex');
        document.getElementById('avatarInput').value = '';
    }
    
    async applyCrop() {
        // Create cropped canvas
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCanvas.width = 200;
        croppedCanvas.height = 200;
        
        // Calculate crop area (center 150x150 of the 300x300 canvas)
        const cropX = 75; // (300 - 150) / 2
        const cropY = 75;
        const cropSize = 150;
        
        // Draw cropped image
        croppedCtx.drawImage(
            this.cropCanvas,
            cropX, cropY, cropSize, cropSize,
            0, 0, 200, 200
        );
        
        // Convert to blob and upload
        croppedCanvas.toBlob(async (blob) => {
            const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
            await this.uploadAvatar(file);
            this.hideCropModal();
        }, 'image/jpeg', 0.9);
    }
    
    async uploadAvatar(file) {
        // Show loading state
        const avatarBtn = document.getElementById('changeAvatarBtn');
        const originalContent = avatarBtn.innerHTML;
        avatarBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-xs"></i>';
        avatarBtn.disabled = true;
        
        try {
            const result = await api.uploadProfilePicture(file);
            this.currentUser.avatar = result.avatar_url;
            this.updateAvatar();
            this.showSuccessMessage('Profile picture updated successfully!');
        } catch (error) {
            console.error('Avatar upload failed:', error);
            this.showErrorMessage('Failed to update profile picture');
        } finally {
            // Reset button state
            avatarBtn.innerHTML = originalContent;
            avatarBtn.disabled = false;
        }
    }
    
    viewProfilePicture() {
        const profileImg = document.getElementById('profileAvatar');
        const viewImg = document.getElementById('profileViewImage');
        const viewName = document.getElementById('profileViewName');
        
        viewImg.src = profileImg.src;
        viewName.textContent = this.currentUser.name;
        
        document.getElementById('profileViewModal').classList.remove('hidden');
        document.getElementById('profileViewModal').classList.add('flex');
    }
    
    closeProfileView() {
        document.getElementById('profileViewModal').classList.add('hidden');
        document.getElementById('profileViewModal').classList.remove('flex');
    }
    

    
    updateAvatar() {
        const avatarImg = document.getElementById('profileAvatar');
        if (this.currentUser.avatar) {
            avatarImg.src = this.currentUser.avatar;
        } else {
            setAvatar(avatarImg, this.currentUser.name, 80);
        }
    }
    
    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'fixed top-4 right-4 bg-green-500 text-white p-3 rounded shadow-lg z-50';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
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