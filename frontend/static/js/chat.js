// Chat functionality
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.selectedContact = null;
        this.contacts = [];
        this.messages = [];
        this.currentCall = null;
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingTimer = null;
        this.recordingStartTime = null;
        
        this.init();
    }

    async init() {
        // Check if user is logged in
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            window.location.href = '/wa/login';
            return;
        }

        try {
            this.currentUser = await api.getCurrentUser();
            this.setupEventListeners();
            this.setupSocketListeners();
            await this.loadContacts();
            this.updateUserInfo();
            
            // Join user room for calls immediately
            const userRoom = `user_${this.currentUser.id}`;
            api.socket.emit('join_room', { room: userRoom });
            console.log('Joining user room:', userRoom);
            
            // Verify room join with a delay
            setTimeout(() => {
                api.socket.emit('test_room', { room: userRoom });
            }, 1000);
        } catch (error) {
            console.error('Initialization failed:', error);
            localStorage.removeItem('user');
            window.location.href = '/wa/login';
        }
    }

    setupEventListeners() {
        // Add null checks for all DOM elements
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) logoutBtn.addEventListener('click', this.logout.bind(this));
        
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) settingsBtn.addEventListener('click', () => {
            window.location.href = '/wa/settings';
        });
        
        const callHistoryBtn = document.getElementById('callHistoryBtn');
        if (callHistoryBtn) callHistoryBtn.addEventListener('click', this.showCallHistory.bind(this));
        
        const backToChatBtn = document.getElementById('backToChatBtn');
        if (backToChatBtn) backToChatBtn.addEventListener('click', this.showChatArea.bind(this));
        
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.addEventListener('click', this.sendMessage.bind(this));
        
        const messageText = document.getElementById('messageText');
        if (messageText) messageText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        
        const attachBtn = document.getElementById('attachBtn');
        const fileInput = document.getElementById('fileInput');
        if (attachBtn && fileInput) {
            attachBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', this.showMediaCaption.bind(this));
        }
        
        const closeCaptionBtn = document.getElementById('closeCaptionBtn');
        const cancelMediaBtn = document.getElementById('cancelMediaBtn');
        const sendMediaBtn = document.getElementById('sendMediaBtn');
        if (closeCaptionBtn) closeCaptionBtn.addEventListener('click', this.hideMediaCaption.bind(this));
        if (cancelMediaBtn) cancelMediaBtn.addEventListener('click', this.hideMediaCaption.bind(this));
        if (sendMediaBtn) sendMediaBtn.addEventListener('click', this.sendMediaWithCaption.bind(this));
        
        const audioCallBtn = document.getElementById('audioCallBtn');
        const videoCallBtn = document.getElementById('videoCallBtn');
        if (audioCallBtn) audioCallBtn.addEventListener('click', () => this.initiateCall('audio'));
        if (videoCallBtn) videoCallBtn.addEventListener('click', () => this.initiateCall('video'));
        
        // WebRTC call controls
        const acceptCallBtn = document.getElementById('accept-call-btn');
        const rejectCallBtn = document.getElementById('reject-call-btn');
        const endCallBtn2 = document.getElementById('end-call-btn');
        const muteAudioBtn = document.getElementById('mute-audio-btn');
        const muteVideoBtn = document.getElementById('mute-video-btn');
        
        if (acceptCallBtn) acceptCallBtn.addEventListener('click', this.answerCall.bind(this));
        if (rejectCallBtn) rejectCallBtn.addEventListener('click', this.rejectCall.bind(this));
        if (endCallBtn2) endCallBtn2.addEventListener('click', this.endCall.bind(this));
        if (muteAudioBtn) muteAudioBtn.addEventListener('click', () => window.webrtc.toggleAudio());
        if (muteVideoBtn) muteVideoBtn.addEventListener('click', () => window.webrtc.toggleVideo());
        
        // Switch call type buttons
        const switchToAudioBtn = document.getElementById('switch-to-audio-btn');
        if (switchToAudioBtn) switchToAudioBtn.addEventListener('click', () => window.webrtc.switchToAudio());
        
        // Back to chat list button
        const backToChatListBtn = document.getElementById('backToChatListBtn');
        if (backToChatListBtn) backToChatListBtn.addEventListener('click', this.closeChat.bind(this));
        
        const endCallBtn = document.getElementById('endCallBtn');
        const answerCallBtn = document.getElementById('answerCallBtn');
        if (endCallBtn) endCallBtn.addEventListener('click', this.endCall.bind(this));
        if (answerCallBtn) answerCallBtn.addEventListener('click', this.answerCall.bind(this));
        
        const searchContacts = document.getElementById('searchContacts');
        if (searchContacts) searchContacts.addEventListener('input', this.filterContacts.bind(this));
        
        const newChatBtn = document.getElementById('newChatBtn');
        const closeNewChatBtn = document.getElementById('closeNewChatBtn');
        const startChatBtn = document.getElementById('startChatBtn');
        const newChatPhone = document.getElementById('newChatPhone');
        if (newChatBtn) newChatBtn.addEventListener('click', this.showNewChatModal.bind(this));
        if (closeNewChatBtn) closeNewChatBtn.addEventListener('click', this.hideNewChatModal.bind(this));
        if (startChatBtn) startChatBtn.addEventListener('click', this.startNewChat.bind(this));
        if (newChatPhone) newChatPhone.addEventListener('input', this.searchUsers.bind(this));
        
        // Voice recording
        const voiceBtn = document.getElementById('voiceBtn');
        const cancelVoiceBtn = document.getElementById('cancelVoiceBtn');
        const recordVoiceBtn = document.getElementById('recordVoiceBtn');
        const sendVoiceBtn = document.getElementById('sendVoiceBtn');
        if (voiceBtn) voiceBtn.addEventListener('click', this.showVoiceModal.bind(this));
        if (cancelVoiceBtn) cancelVoiceBtn.addEventListener('click', this.hideVoiceModal.bind(this));
        if (recordVoiceBtn) recordVoiceBtn.addEventListener('click', this.toggleVoiceRecording.bind(this));
        if (sendVoiceBtn) sendVoiceBtn.addEventListener('click', this.sendVoiceMessage.bind(this));
        
        // ESC key handlers
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const callHistoryArea = document.getElementById('callHistoryArea');
                const incomingCallPopup = document.getElementById('incoming-call-popup');
                
                if (callHistoryArea && !callHistoryArea.classList.contains('hidden')) {
                    this.showChatArea();
                } else if (incomingCallPopup && !incomingCallPopup.classList.contains('hidden')) {
                    this.rejectCall();
                } else if (this.selectedContact) {
                    this.closeChat();
                }
            }
        });
    }

    setupSocketListeners() {
        console.log('Setting up socket listeners');
        
        api.socket.on('receive_message', (data) => {
            this.handleIncomingMessage(data);
        });

        api.socket.on('call_signal', (data) => {
            console.log('Socket received call_signal:', data);
            this.handleCallSignal(data);
        });

        api.socket.on('webrtc_offer', (data) => {
            this.handleWebRTCOffer(data);
        });

        api.socket.on('webrtc_answer', (data) => {
            this.handleWebRTCAnswer(data);
        });

        api.socket.on('webrtc_ice', (data) => {
            this.handleWebRTCIce(data);
        });

        api.socket.on('user_status', (data) => {
            this.updateContactStatus(data.userId, data.isOnline);
        });
        
        api.socket.on('message_status_update', (data) => {
            this.updateMessageStatus(data.message_id, data.status);
        });
        
        api.socket.on('connect', () => {
            console.log('Socket connected');
        });
        
        api.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });
        
        api.socket.on('room_joined', (data) => {
            console.log('Room joined confirmation:', data);
        });
        
        api.socket.on('room_test_result', (data) => {
            console.log('Room test result:', data);
        });
        
        api.socket.on('join_conversation', (data) => {
            console.log('Joining conversation room:', data.room);
            api.socket.emit('join_room', { room: data.room });
        });
    }

    updateUserInfo() {
        document.getElementById('userName').textContent = this.currentUser.name;
        setAvatar(document.getElementById('userAvatar'), this.currentUser.name, 40, this.currentUser.avatar);
    }

    async loadContacts() {
        try {
            this.contacts = await api.getContacts();
            this.renderContacts();
        } catch (error) {
            console.error('Failed to load contacts:', error);
        }
    }

    renderContacts() {
        const contactsList = document.getElementById('contactsList');
        contactsList.innerHTML = '';

        // Contacts are already sorted by latest message from backend
        this.contacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'contact-item flex items-center p-3 hover:bg-gray-100 cursor-pointer';
            contactElement.dataset.userId = contact.id;
            
            const avatarImg = document.createElement('img');
            avatarImg.className = 'w-12 h-12 rounded-full';
            setAvatar(avatarImg, contact.name, 48, contact.avatar);
            
            const avatarContainer = document.createElement('div');
            avatarContainer.className = 'relative';
            avatarContainer.appendChild(avatarImg);
            if (contact.is_online) {
                const indicator = document.createElement('div');
                indicator.className = 'online-indicator';
                avatarContainer.appendChild(indicator);
            }
            
            const infoContainer = document.createElement('div');
            infoContainer.className = 'ml-3 flex-1';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'font-semibold';
            nameDiv.textContent = contact.name;
            
            const phoneDiv = document.createElement('div');
            phoneDiv.className = 'text-sm text-gray-500';
            phoneDiv.textContent = contact.phone;
            
            infoContainer.appendChild(nameDiv);
            infoContainer.appendChild(phoneDiv);
            
            const rightContainer = document.createElement('div');
            rightContainer.className = 'flex flex-col items-end';
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'text-xs text-gray-400';
            timeDiv.textContent = contact.is_online ? 'Online' : formatTime(contact.last_seen);
            
            const unreadCount = this.getUnreadCount(contact.id);
            if (unreadCount > 0) {
                const unreadBadge = document.createElement('div');
                unreadBadge.className = 'unread-badge bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mt-1';
                unreadBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                rightContainer.appendChild(timeDiv);
                rightContainer.appendChild(unreadBadge);
            } else {
                rightContainer.appendChild(timeDiv);
            }
            
            contactElement.appendChild(avatarContainer);
            contactElement.appendChild(infoContainer);
            contactElement.appendChild(rightContainer);
            
            contactElement.addEventListener('click', () => this.selectContact(contact));
            contactsList.appendChild(contactElement);
        });
    }

    filterContacts() {
        const searchTerm = document.getElementById('searchContacts').value.toLowerCase();
        const contactItems = document.querySelectorAll('.contact-item');
        
        contactItems.forEach(item => {
            const name = item.querySelector('.font-semibold').textContent.toLowerCase();
            const phone = item.querySelector('.text-gray-500').textContent.toLowerCase();
            
            if (name.includes(searchTerm) || phone.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    async selectContact(contact) {
        this.selectedContact = contact;
        
        // Close call history if open
        this.showChatArea();
        
        // Mobile: Hide sidebar and show chat
        if (window.innerWidth <= 768) {
            document.body.classList.add('mobile-chat-open');
        }
        
        // Update UI
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-user-id="${contact.id}"]`).classList.add('active');
        
        // Show chat header and input
        document.getElementById('chatHeader').classList.remove('hidden');
        document.getElementById('messageInput').classList.remove('hidden');
        document.getElementById('welcomeMessage').classList.add('hidden');
        document.getElementById('messagesList').classList.remove('hidden');
        
        // Update chat header
        document.getElementById('chatName').textContent = contact.name;
        document.getElementById('chatStatus').textContent = contact.is_online ? 'Online' : `Last seen ${formatTime(contact.last_seen)}`;
        setAvatar(document.getElementById('chatAvatar'), contact.name, 40, contact.avatar);
        
        // Load conversation
        await this.loadConversation(contact.id);
        

        
        // Mark unread messages as read
        this.markUnreadMessagesAsRead();
        
        // Join socket room for real-time messaging
        const chatRoom = `chat_${Math.min(this.currentUser.id, contact.id)}_${Math.max(this.currentUser.id, contact.id)}`;
        
        api.socket.emit('join_room', { room: chatRoom });
        
        // Notify the other user to join the conversation room
        api.socket.emit('join_conversation', {
            room: chatRoom,
            user_id: contact.id
        });
        
        console.log('Joined room:', chatRoom);
    }

    async loadConversation(userId) {
        try {
            this.currentPage = 1;
            this.hasMoreMessages = true;
            const response = await api.getConversation(userId, 1);
            
            if (response.messages) {
                this.messages = response.messages;
                this.hasMoreMessages = response.has_more;
            } else {
                this.messages = response;
            }
            
            this.renderMessages();
            this.setupScrollListener();
            
            // Force scroll to bottom after messages load
            this.scrollToBottom();
        } catch (error) {
            console.error('Failed to load conversation:', error);
        }
    }

    renderMessages() {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;
        
        messagesList.innerHTML = '';

        this.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            messagesList.appendChild(messageElement);
        });

        // Force scroll to bottom immediately
        requestAnimationFrame(() => {
            messagesList.scrollTop = messagesList.scrollHeight;
            requestAnimationFrame(() => {
                messagesList.scrollTop = messagesList.scrollHeight;
            });
        });
    }
    
    scrollToBottom() {
        setTimeout(() => {
            const messagesList = document.getElementById('messagesList');
            if (messagesList) {
                messagesList.scrollTo({
                    top: messagesList.scrollHeight,
                    behavior: 'instant'
                });
            }
        }, 0);
        
        setTimeout(() => {
            const messagesList = document.getElementById('messagesList');
            if (messagesList) {
                messagesList.scrollTo({
                    top: messagesList.scrollHeight,
                    behavior: 'instant'
                });
            }
        }, 50);
    }

    createMessageElement(message) {
        const isOwn = message.sender_id === this.currentUser.id;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-bubble ${isOwn ? 'message-sent' : 'message-received'}`;
        
        let content = '';
        if (message.message_type === 'text') {
            const textDiv = document.createElement('div');
            textDiv.textContent = message.content;
            content = textDiv.outerHTML;
            
            // Add message status for sent messages
            if (message.sender_id === this.currentUser.id) {
                const statusDiv = document.createElement('div');
                statusDiv.className = 'text-xs mt-1 text-right';
                let statusIcon, statusColor;
                
                console.log('Message status:', message.id, 'delivered:', message.is_delivered, 'read:', message.is_read);
                
                if (message.is_read) {
                    statusIcon = '✓✓';
                    statusColor = 'text-blue-500';
                } else if (message.is_delivered) {
                    statusIcon = '✓✓';
                    statusColor = 'text-gray-400';
                } else {
                    statusIcon = '✓';
                    statusColor = 'text-gray-400';
                }
                
                statusDiv.innerHTML = `<span class="${statusColor}">${statusIcon}</span>`;
                content += statusDiv.outerHTML;
            }
        } else if (message.message_type === 'image') {
            const secureUrl = `/wa/api/messages/media/${message.secure_file_id || message.id}`;
            const mediaDiv = document.createElement('div');
            mediaDiv.className = 'media-message';
            const img = document.createElement('img');
            img.src = secureUrl;
            img.alt = 'Image';
            img.className = 'rounded max-w-xs';
            mediaDiv.appendChild(img);
            if (message.content && !message.content.startsWith('Sent a')) {
                const captionDiv = document.createElement('div');
                captionDiv.className = 'mt-2 text-sm';
                captionDiv.textContent = message.content;
                mediaDiv.appendChild(captionDiv);
            }
            content = mediaDiv.outerHTML;
        } else if (message.message_type === 'video') {
            const secureUrl = `/wa/api/messages/media/${message.secure_file_id || message.id}`;
            const mediaDiv = document.createElement('div');
            mediaDiv.className = 'media-message';
            const video = document.createElement('video');
            video.controls = true;
            video.className = 'rounded max-w-xs';
            video.preload = 'none';
            const source = document.createElement('source');
            source.src = secureUrl;
            source.type = 'video/mp4';
            video.appendChild(source);
            mediaDiv.appendChild(video);
            if (message.content && !message.content.startsWith('Sent a')) {
                const captionDiv = document.createElement('div');
                captionDiv.className = 'mt-2 text-sm';
                captionDiv.textContent = message.content;
                mediaDiv.appendChild(captionDiv);
            }
            content = mediaDiv.outerHTML;
        } else if (message.message_type === 'audio') {
            const secureUrl = `/wa/api/messages/media/${message.secure_file_id || message.id}`;
            const audioDiv = document.createElement('div');
            audioDiv.className = 'audio-message';
            
            // Voice message indicator
            const voiceIcon = document.createElement('div');
            voiceIcon.className = 'flex items-center mr-2';
            voiceIcon.innerHTML = '<i class="fas fa-microphone text-green-600 mr-2"></i>';
            
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.preload = 'none';
            audio.className = 'flex-1';
            
            // Support multiple audio formats
            const webmSource = document.createElement('source');
            webmSource.src = secureUrl;
            webmSource.type = 'audio/webm';
            audio.appendChild(webmSource);
            
            const mp3Source = document.createElement('source');
            mp3Source.src = secureUrl;
            mp3Source.type = 'audio/mpeg';
            audio.appendChild(mp3Source);
            
            audioDiv.appendChild(voiceIcon);
            audioDiv.appendChild(audio);
            
            if (message.content && !message.content.startsWith('Sent a')) {
                const captionDiv = document.createElement('div');
                captionDiv.className = 'mt-2 text-sm';
                captionDiv.textContent = message.content;
                audioDiv.appendChild(captionDiv);
            }
            content = audioDiv.outerHTML;
        }
        
        messageDiv.innerHTML = `
            ${content}
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
        
        return messageDiv;
    }

    async sendMessage() {
        const messageText = document.getElementById('messageText');
        const content = messageText.value.trim();
        
        if (!content || !this.selectedContact) return;
        
        try {
            const message = await api.sendMessage(this.selectedContact.id, content);
            
            // Add to local messages immediately for instant feedback
            const localMessage = {
                ...message,
                sender_id: this.currentUser.id,
                message_type: 'text'
            };
            this.messages.push(localMessage);
            this.renderMessages();
            this.scrollToBottom();
            
            // Move contact to top locally
            this.moveContactToTop(this.selectedContact.id);
            this.renderContacts();
            
            // Join conversation room to receive delivery confirmations
            const roomId = `chat_${Math.min(this.currentUser.id, this.selectedContact.id)}_${Math.max(this.currentUser.id, this.selectedContact.id)}`;
            api.socket.emit('join_room', { room: roomId });
            
            // Emit to socket for real-time delivery
            const messageData = {
                room: roomId,
                message: {
                    ...message,
                    sender_id: this.currentUser.id,
                    message_type: 'text'
                },
                sender: this.currentUser
            };
            
            api.socket.emit('send_message', messageData);
            
            // Also emit to receiver's room
            api.socket.emit('send_message', {
                room: `user_${this.selectedContact.id}`,
                ...messageData
            });
            
            messageText.value = '';
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    showMediaCaption(event) {
        const file = event.target.files[0];
        if (!file || !this.selectedContact) return;
        
        this.selectedFile = file;
        const modal = document.getElementById('mediaCaptionModal');
        const preview = document.getElementById('mediaPreview');
        
        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            if (file.type.startsWith('image/')) {
                preview.innerHTML = `<img src="data:image/png;base64,${btoa(e.target.result)}" class="max-w-full h-auto rounded">`;
            } else if (file.type.startsWith('video/')) {
                preview.innerHTML = `<video class="max-w-full h-auto rounded" controls><source src="data:video/mp4;base64,${btoa(e.target.result)}" type="${file.type}"></video>`;
            } else {
                preview.innerHTML = `<div class="p-4 bg-gray-100 rounded text-center">${file.name}</div>`;
            }
        };
        reader.readAsBinaryString(file);
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    hideMediaCaption() {
        const modal = document.getElementById('mediaCaptionModal');
        const caption = document.getElementById('mediaCaption');
        const fileInput = document.getElementById('fileInput');
        
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        caption.value = '';
        fileInput.value = '';
        this.selectedFile = null;
    }
    
    async sendMediaWithCaption() {
        if (!this.selectedFile || !this.selectedContact) return;
        
        const caption = document.getElementById('mediaCaption').value.trim();
        
        try {
            const message = await api.sendMedia(this.selectedContact.id, this.selectedFile, caption);
            
            this.messages.push({
                ...message,
                sender_id: this.currentUser.id
            });
            this.renderMessages();
            this.scrollToBottom();
            
            // Join conversation room to receive delivery confirmations
            const roomId = `chat_${Math.min(this.currentUser.id, this.selectedContact.id)}_${Math.max(this.currentUser.id, this.selectedContact.id)}`;
            api.socket.emit('join_room', { room: roomId });
            
            api.socket.emit('send_message', {
                room: roomId,
                message: message,
                sender: this.currentUser
            });
            
            this.hideMediaCaption();
            
        } catch (error) {
            console.error('Failed to send media:', error);
        }
    }

    handleIncomingMessage(data) {
        console.log('Incoming message:', data);
        
        // Mark message as delivered if it's for current user
        if (data.message.receiver_id === this.currentUser.id) {
            api.socket.emit('message_delivered', { message_id: data.message.id });
            
            // Add sender to contacts if not exists, then move to top
            this.addOrMoveContactToTop(data.message.sender_id, data.sender);
            // Force DOM update with a small delay
            setTimeout(() => {
                this.renderContacts();
            }, 10);
            
            // Join conversation room to receive future messages
            const roomId = `chat_${Math.min(this.currentUser.id, data.message.sender_id)}_${Math.max(this.currentUser.id, data.message.sender_id)}`;
            api.socket.emit('join_room', { room: roomId });
        }
        
        // Add message to conversation if it's for current chat
        if (this.selectedContact && 
            (data.message.sender_id === this.selectedContact.id || 
             (data.message.sender_id === this.currentUser.id && data.message.receiver_id === this.selectedContact.id))) {
            
            // Check if message already exists to avoid duplicates
            const exists = this.messages.find(m => m.id === data.message.id);
            if (!exists) {
                this.messages.push(data.message);
                this.renderMessages();
                this.scrollToBottom();
                
                // Mark as read if chat is open and message is for current user
                if (data.message.receiver_id === this.currentUser.id) {
                    api.socket.emit('message_read', { message_id: data.message.id });
                }
            }
        }
        
        // Show notification if message is from someone else
        if (data.message.sender_id !== this.currentUser.id && data.sender) {
            if (window.notificationManager) {
                window.notificationManager.showNotification(
                    data.sender.name, 
                    data.message.content || 'Sent a file'
                );
            }
        }
    }

    async initiateCall(callType) {
        if (!this.selectedContact) return;
        
        try {
            await window.webrtc.startCall(this.selectedContact.id, callType);
        } catch (error) {
            console.error('Failed to initiate call:', error);
            this.showErrorMessage('Call failed: ' + error.message);
        }
    }

    showCallModal(call, direction) {
        console.log('showCallModal called with:', call, direction);
        
        const modal = document.getElementById('callModal');
        const calleeName = document.getElementById('calleeName');
        const calleeAvatar = document.getElementById('calleeAvatar');
        const callStatus = document.getElementById('callStatus');
        const answerBtn = document.getElementById('answerCallBtn');
        
        if (!modal || !calleeName || !calleeAvatar || !callStatus || !answerBtn) {
            console.error('Call modal elements not found');
            return;
        }
        
        const contactName = this.getContactNameForCall(call, direction);
        
        calleeName.textContent = contactName;
        setAvatar(calleeAvatar, contactName, 80);
        
        if (direction === 'incoming') {
            callStatus.textContent = `Incoming ${call.call_type} call...`;
            answerBtn.classList.remove('hidden');
        } else {
            callStatus.textContent = 'Calling...';
            answerBtn.classList.add('hidden');
        }
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    
    getContactNameForCall(call, direction) {
        if (direction === 'incoming') {
            return call.caller?.name || call.caller_name || 'Unknown Caller';
        } else {
            return call.receiver?.name || this.selectedContact?.name || 'Unknown';
        }
    }

    hideCallModal() {
        const modal = document.getElementById('callModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        this.currentCall = null;
    }

    async answerCall() {
        const popup = document.getElementById('incoming-call-popup');
        const callId = popup?.dataset.callId;
        const callType = popup?.dataset.callType || 'video';
        
        if (callId) {
            try {
                await window.webrtc.answerCall(callId, callType);
                this.hideIncomingCallPopup();
            } catch (error) {
                console.error('Failed to answer call:', error);
                this.showErrorMessage('Failed to answer call: ' + error.message);
            }
        }
    }

    async endCall() {
        try {
            await window.webrtc.endCall();
        } catch (error) {
            console.error('Failed to end call:', error);
        }
    }

    handleCallSignal(data) {
        switch (data.type) {
            case 'call_rejected':
                this.showCallStatus('User is busy');
                break;
            case 'call_ended':
                this.showCallStatus('Call ended');
                break;
        }
    }

    async setupPeerConnection() {
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };
        
        try {
            this.peerConnection = new RTCPeerConnection(config);
        } catch (error) {
            console.error('Failed to create RTCPeerConnection:', error);
            throw error;
        }
        
        // Add local stream
        if (this.localStream) {
            try {
                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });
            } catch (error) {
                console.error('Failed to add tracks:', error);
            }
            
            // Show local video
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
        }
        
        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            const remoteVideo = document.getElementById('remoteVideo');
            if (remoteVideo) {
                remoteVideo.srcObject = this.remoteStream;
            }
        };
        
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                api.socket.emit('webrtc_ice', {
                    candidate: event.candidate,
                    callId: this.currentCall.call_id,
                    room: `user_${this.selectedContact.id}`
                });
            }
        };
    }
    
    async handleWebRTCOffer(data) {
        if (!this.currentCall || data.callId !== this.currentCall.call_id) return;
        
        await this.peerConnection.setRemoteDescription(data.offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        api.socket.emit('webrtc_answer', {
            answer: answer,
            callId: data.callId,
            room: `user_${this.currentCall.caller.id}`
        });
    }
    
    async handleWebRTCAnswer(data) {
        if (!this.currentCall || data.callId !== this.currentCall.call_id) return;
        
        await this.peerConnection.setRemoteDescription(data.answer);
    }
    
    async handleWebRTCIce(data) {
        if (!this.currentCall || data.callId !== this.currentCall.call_id) return;
        
        await this.peerConnection.addIceCandidate(data.candidate);
    }
    
    toggleMute() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const muteBtn = document.getElementById('muteBtn');
                muteBtn.innerHTML = audioTrack.enabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
            }
        }
    }
    
    toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const videoBtn = document.getElementById('videoToggleBtn');
                videoBtn.innerHTML = videoTrack.enabled ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
            }
        }
    }
    
    cleanupCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.remoteStream = null;
        
        // Clear video elements
        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;
    }

    updateContactStatus(userId, isOnline) {
        const contactElement = document.querySelector(`[data-user-id="${userId}"]`);
        if (contactElement) {
            const indicator = contactElement.querySelector('.online-indicator');
            if (isOnline && !indicator) {
                const avatarContainer = contactElement.querySelector('.relative');
                avatarContainer.innerHTML += '<div class="online-indicator"></div>';
            } else if (!isOnline && indicator) {
                indicator.remove();
            }
        }
        
        // Update selected contact status
        if (this.selectedContact && this.selectedContact.id === userId) {
            this.selectedContact.is_online = isOnline;
            document.getElementById('chatStatus').textContent = isOnline ? 'Online' : 'Offline';
        }
    }

    showNewChatModal() {
        document.getElementById('newChatModal').classList.remove('hidden');
        document.getElementById('newChatModal').classList.add('flex');
        document.getElementById('newChatPhone').focus();
    }

    hideNewChatModal() {
        document.getElementById('newChatModal').classList.add('hidden');
        document.getElementById('newChatModal').classList.remove('flex');
        document.getElementById('newChatPhone').value = '';
        document.getElementById('userSearchResults').innerHTML = '';
    }

    async searchUsers() {
        const query = document.getElementById('newChatPhone').value.trim();
        const resultsDiv = document.getElementById('userSearchResults');
        
        if (query.length < 3) {
            resultsDiv.innerHTML = '';
            return;
        }
        
        try {
            const users = await api.searchUsers(query);
            resultsDiv.innerHTML = '';
            
            users.forEach(user => {
                const userDiv = document.createElement('div');
                userDiv.className = 'flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded';
                const userAvatar = document.createElement('img');
                userAvatar.className = 'w-8 h-8 rounded-full mr-3';
                setAvatar(userAvatar, user.name, 32, user.avatar);
                
                const userInfo = document.createElement('div');
                
                const userName = document.createElement('div');
                userName.className = 'font-medium';
                userName.textContent = user.name;
                
                const userPhone = document.createElement('div');
                userPhone.className = 'text-sm text-gray-500';
                userPhone.textContent = user.phone;
                
                userInfo.appendChild(userName);
                userInfo.appendChild(userPhone);
                
                userDiv.appendChild(userAvatar);
                userDiv.appendChild(userInfo);
                userDiv.addEventListener('click', () => {
                    this.startChatWithUser(user);
                });
                resultsDiv.appendChild(userDiv);
            });
        } catch (error) {
            console.error('User search failed:', error);
            resultsDiv.innerHTML = '<div class="text-red-500 p-2">Search failed. Please try again.</div>';
        }
    }

    async startNewChat() {
        const phone = document.getElementById('newChatPhone').value.trim();
        if (!phone) return;
        
        try {
            const user = await api.getUserByPhone(phone);
            this.startChatWithUser(user);
        } catch (error) {
            alert('User not found');
        }
    }

    startChatWithUser(user) {
        // Add to contacts if not already there
        if (!this.contacts.find(c => c.id === user.id)) {
            this.contacts.unshift(user);
            this.renderContacts();
        }
        
        // Select the contact
        this.selectContact(user);
        this.hideNewChatModal();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    updateMessageStatus(messageId, status) {
        const message = this.messages.find(m => m.id === messageId);
        if (message) {
            if (status === 'delivered') {
                message.is_delivered = true;
            } else if (status === 'read') {
                message.is_delivered = true;
                message.is_read = true;
            }
            this.renderMessages();
        }
    }
    
    getUnreadCount(contactId) {
        if (!this.unreadMessages) this.unreadMessages = {};
        return this.unreadMessages[contactId] ? this.unreadMessages[contactId].length : 0;
    }
    
    addUnreadMessage(senderId, message) {
        if (!this.unreadMessages) this.unreadMessages = {};
        if (!this.unreadMessages[senderId]) this.unreadMessages[senderId] = [];
        this.unreadMessages[senderId].push(message);
    }
    
    clearUnreadMessages(contactId) {
        if (this.unreadMessages && this.unreadMessages[contactId]) {
            delete this.unreadMessages[contactId];
        }
    }
    
    moveContactToTop(contactId) {
        const contactIndex = this.contacts.findIndex(c => c.id === contactId);
        if (contactIndex > 0) {
            const contact = this.contacts.splice(contactIndex, 1)[0];
            this.contacts.unshift(contact);
        } else if (contactIndex === -1) {
            // Contact not in list, reload contacts
            this.loadContacts();
        }
    }
    
    addOrMoveContactToTop(contactId, senderData) {
        const contactIndex = this.contacts.findIndex(c => c.id === contactId);
        if (contactIndex > 0) {
            // Contact exists, move to top
            const contact = this.contacts.splice(contactIndex, 1)[0];
            this.contacts.unshift(contact);
        } else if (contactIndex === -1 && senderData) {
            // New contact, add to top of list
            console.log('Adding new contact:', senderData.name);
            const newContact = {
                id: senderData.id,
                name: senderData.name,
                phone: senderData.phone,
                avatar: senderData.avatar,
                is_online: senderData.is_online || false,
                last_seen: new Date().toISOString()
            };
            this.contacts.unshift(newContact);
            console.log('Contacts after adding:', this.contacts.length);
        }
        // If contactIndex === 0, contact is already at top
    }
    
    setupScrollListener() {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;
        
        // Remove existing listener to avoid duplicates
        messagesList.removeEventListener('scroll', this.scrollHandler);
        
        this.scrollHandler = async () => {
            if (messagesList.scrollTop <= 10 && this.selectedContact && this.hasMoreMessages) {
                await this.loadMoreMessages();
            }
        };
        
        messagesList.addEventListener('scroll', this.scrollHandler);
    }
    
    async loadMoreMessages() {
        if (this.loadingMore || !this.selectedContact || !this.hasMoreMessages) return;
        
        this.loadingMore = true;
        const messagesList = document.getElementById('messagesList');
        const scrollHeight = messagesList.scrollHeight;
        
        try {
            const nextPage = this.currentPage + 1;
            const response = await api.getConversation(this.selectedContact.id, nextPage);
            
            let olderMessages = [];
            if (response.messages) {
                olderMessages = response.messages;
                this.hasMoreMessages = response.has_more;
            } else {
                olderMessages = response;
                this.hasMoreMessages = olderMessages.length === 50;
            }
            
            if (olderMessages.length > 0) {
                this.messages = [...olderMessages, ...this.messages];
                this.currentPage = nextPage;
                this.renderMessages();
                
                // Maintain scroll position
                setTimeout(() => {
                    const newScrollHeight = messagesList.scrollHeight;
                    messagesList.scrollTop = newScrollHeight - scrollHeight;
                }, 50);
            } else {
                this.hasMoreMessages = false;
            }
        } catch (error) {
            console.error('Failed to load more messages:', error);
        } finally {
            this.loadingMore = false;
        }
    }
    
    isScrolledToBottom() {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return true;
        
        return messagesList.scrollTop + messagesList.clientHeight >= messagesList.scrollHeight - 10;
    }
    
    markUnreadMessagesAsRead() {
        if (!this.selectedContact) return;
        
        const unreadMessages = this.messages.filter(msg => 
            msg.receiver_id === this.currentUser.id && 
            msg.sender_id === this.selectedContact.id && 
            !msg.is_read
        );
        
        unreadMessages.forEach(msg => {
            api.socket.emit('message_read', { message_id: msg.id });
            msg.is_read = true;
        });
        
        if (unreadMessages.length > 0) {
            this.renderMessages();
        }
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
    
    showCallHistory() {
        const mainChatArea = document.querySelector('.flex-1.flex.flex-col');
        const callHistoryArea = document.getElementById('callHistoryArea');
        
        if (mainChatArea) mainChatArea.classList.add('hidden');
        if (callHistoryArea) {
            callHistoryArea.classList.remove('hidden');
            callHistoryArea.classList.add('flex');
        }
        this.loadCallHistory();
    }
    
    showChatArea() {
        const callHistoryArea = document.getElementById('callHistoryArea');
        const mainChatArea = document.querySelector('.flex-1.flex.flex-col');
        
        if (callHistoryArea) {
            callHistoryArea.classList.add('hidden');
            callHistoryArea.classList.remove('flex');
        }
        if (mainChatArea) mainChatArea.classList.remove('hidden');
    }
    
    async loadCallHistory() {
        try {
            const calls = await api.getCallHistory();
            this.renderCallHistory(calls);
        } catch (error) {
            console.error('Failed to load call history:', error);
        }
    }
    

    
    renderCallHistory(calls) {
        const historyList = document.getElementById('callHistoryList');
        if (!historyList) return;
        
        historyList.innerHTML = '';
        
        calls.forEach(call => {
            const callDiv = document.createElement('div');
            callDiv.className = 'flex items-center p-3 transition-colors';
            callDiv.style.borderBottom = '1px solid var(--border-color)';
            callDiv.style.color = 'var(--text-primary)';
            callDiv.onmouseover = () => callDiv.style.backgroundColor = 'var(--bg-tertiary)';
            callDiv.onmouseout = () => callDiv.style.backgroundColor = 'transparent';
            
            const isIncoming = call.receiver.id === this.currentUser.id;
            const contact = isIncoming ? call.caller : call.receiver;
            const statusIcon = call.status === 'missed' ? 'fas fa-phone-slash text-red-500' : 
                              call.status === 'answered' ? 'fas fa-phone text-green-500' : 'fas fa-phone text-gray-500';
            
            const avatarImg = document.createElement('img');
            avatarImg.className = 'w-12 h-12 rounded-full mr-3';
            setAvatar(avatarImg, contact.name, 48);
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex-1';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'font-semibold';
            nameDiv.textContent = contact.name;
            nameDiv.style.color = 'var(--text-primary)';
            
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'text-sm';
            detailsDiv.style.color = 'var(--text-secondary)';
            detailsDiv.innerHTML = `
                <i class="${statusIcon} mr-1"></i>
                ${isIncoming ? 'Incoming' : 'Outgoing'} ${call.call_type} call
            `;
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'text-xs';
            timeDiv.style.color = 'var(--text-secondary)';
            timeDiv.textContent = formatTime(call.started_at);
            
            const callBtn = document.createElement('button');
            callBtn.className = 'p-2 rounded transition-colors';
            callBtn.style.color = 'var(--green-primary)';
            callBtn.onmouseover = () => callBtn.style.backgroundColor = 'var(--bg-primary)';
            callBtn.onmouseout = () => callBtn.style.backgroundColor = 'transparent';
            callBtn.innerHTML = '<i class="fas fa-phone"></i>';
            callBtn.onclick = () => this.callFromHistory(contact);
            
            infoDiv.appendChild(nameDiv);
            infoDiv.appendChild(detailsDiv);
            
            callDiv.appendChild(avatarImg);
            callDiv.appendChild(infoDiv);
            callDiv.appendChild(timeDiv);
            callDiv.appendChild(callBtn);
            
            historyList.appendChild(callDiv);
        });
    }
    
    async callFromHistory(contact) {
        this.selectedContact = contact;
        this.initiateCall('audio');
        this.showChatArea();
    }
    
    hideIncomingCallPopup() {
        const popup = document.getElementById('incoming-call-popup');
        if (popup) {
            popup.classList.add('hidden');
        }
    }
    
    async rejectCall() {
        const popup = document.getElementById('incoming-call-popup');
        const callId = popup?.dataset.callId;
        
        if (callId) {
            try {
                await api.rejectCall(callId);
                this.hideIncomingCallPopup();
                
                // Notify caller that call was rejected via WebRTC manager
                if (window.webrtc) {
                    window.webrtc.handleCallRejection(callId);
                }
            } catch (error) {
                console.error('Failed to reject call:', error);
            }
        }
    }
    
    closeChat() {
        this.selectedContact = null;
        
        // Mobile: Show sidebar and hide chat
        if (window.innerWidth <= 768) {
            document.body.classList.remove('mobile-chat-open');
        }
        
        // Hide chat elements
        document.getElementById('chatHeader').classList.add('hidden');
        document.getElementById('messageInput').classList.add('hidden');
        document.getElementById('messagesList').classList.add('hidden');
        document.getElementById('welcomeMessage').classList.remove('hidden');
        
        // Remove active state from contacts
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
    }
    
    showCallStatus(message) {
        // Voice announcement
        this.speakMessage(message);
        
        const statusDiv = document.createElement('div');
        statusDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg z-50';
        statusDiv.textContent = message;
        document.body.appendChild(statusDiv);
        
        setTimeout(() => {
            if (statusDiv.parentNode) {
                statusDiv.remove();
            }
        }, 3000);
    }
    
    speakMessage(message) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 1;
            utterance.pitch = 1;
            utterance.volume = 0.8;
            speechSynthesis.speak(utterance);
        }
    }

    showVoiceModal() {
        if (!this.selectedContact) return;
        document.getElementById('voiceRecordModal').classList.remove('hidden');
        document.getElementById('voiceRecordModal').classList.add('flex');
    }
    
    hideVoiceModal() {
        document.getElementById('voiceRecordModal').classList.add('hidden');
        document.getElementById('voiceRecordModal').classList.remove('flex');
        this.stopRecording();
    }
    
    async toggleVoiceRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.stopRecording();
        } else {
            await this.startRecording();
        }
    }
    
    async startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.start();
            this.recordingStartTime = Date.now();
            
            // Update UI
            document.getElementById('recordVoiceBtn').innerHTML = '<i class="fas fa-stop"></i> Stop';
            document.getElementById('recordingStatus').textContent = 'Recording...';
            document.getElementById('recordingIndicator').style.animation = 'pulse 1s infinite';
            
            // Start timer
            this.recordingTimer = setInterval(() => {
                const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                document.getElementById('recordingTime').textContent = `${minutes}:${seconds}`;
            }, 1000);
            
        } catch (error) {
            console.error('Failed to start recording:', error);
            alert('Microphone access denied');
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
            
            // Update UI
            document.getElementById('recordVoiceBtn').innerHTML = '<i class="fas fa-circle"></i> Record';
            document.getElementById('recordVoiceBtn').classList.add('hidden');
            document.getElementById('sendVoiceBtn').classList.remove('hidden');
            document.getElementById('recordingStatus').textContent = 'Recording complete';
            document.getElementById('recordingIndicator').style.animation = 'none';
            
            // Clear timer
            if (this.recordingTimer) {
                clearInterval(this.recordingTimer);
                this.recordingTimer = null;
            }
        }
    }
    
    async sendVoiceMessage() {
        if (this.recordedChunks.length === 0 || !this.selectedContact) return;
        
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice_message.webm', { type: 'audio/webm' });
        
        try {
            await api.sendMedia(this.selectedContact.id, audioFile, '');
            this.hideVoiceModal();
            
            // Reset recording state
            this.recordedChunks = [];
            document.getElementById('recordVoiceBtn').classList.remove('hidden');
            document.getElementById('sendVoiceBtn').classList.add('hidden');
            document.getElementById('recordingTime').textContent = '00:00';
            document.getElementById('recordingStatus').textContent = 'Tap to start recording';
            
            // Reload conversation to show new message
            await this.loadConversation(this.selectedContact.id);
            
        } catch (error) {
            console.error('Failed to send voice message:', error);
            alert('Failed to send voice message');
        }
    }

    async logout() {
        try {
            await api.logout();
        } catch (error) {
            console.error('Logout failed:', error);
        }
        localStorage.removeItem('user');
        window.location.href = '/wa/login';
    }
}

// Initialize chat app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});