class NotificationManager {
    constructor() {
        this.audioContext = null;
        this.notificationEnabled = true;
        this.soundEnabled = true;
        this.init();
    }

    init() {
        this.requestPermissions();
        this.loadSettings();
    }

    async requestPermissions() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    loadSettings() {
        const settings = localStorage.getItem('notificationSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.notificationEnabled = parsed.notifications !== false;
            this.soundEnabled = parsed.sound !== false;
        }
    }

    saveSettings() {
        localStorage.setItem('notificationSettings', JSON.stringify({
            notifications: this.notificationEnabled,
            sound: this.soundEnabled
        }));
    }

    playNotificationSound() {
        if (!this.soundEnabled) return;

        // Create Web Audio API sound since we don't have MP3 file
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } else if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio not supported');
        }
    }

    showNotification(title, body, icon = '/static/images/logo.png') {
        if (!this.notificationEnabled) return;

        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon,
                badge: icon,
                tag: 'whatsapp-message'
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 5000);
        }

        this.playNotificationSound();
    }

    toggleNotifications() {
        this.notificationEnabled = !this.notificationEnabled;
        this.saveSettings();
        return this.notificationEnabled;
    }

    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.saveSettings();
        return this.soundEnabled;
    }
}

window.notificationManager = new NotificationManager();