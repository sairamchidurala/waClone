class WebRTCManager {
    constructor() {
        this.socket = window.api.socket;
        this.localStream = null;
        this.peers = {};
        this.currentCallId = null;
        this.isAudioMuted = false;
        this.isVideoMuted = false;
        this.currentUser = null;
        
        this.setupSocketListeners();
        this.initCurrentUser();
    }
    
    async initCurrentUser() {
        try {
            this.currentUser = await window.api.getCurrentUser();
        } catch (error) {
            console.error('Failed to get current user:', error);
        }
    }

    setupSocketListeners() {
        this.socket.on('webrtc_offer', (data) => this.handleOffer(data));
        this.socket.on('webrtc_answer', (data) => this.handleAnswer(data));
        this.socket.on('webrtc_ice', (data) => this.handleIceCandidate(data));
        this.socket.on('call_signal', (data) => this.handleCallSignal(data));
    }

    async startCall(receiverId, callType = 'video') {
        try {
            if (!this.currentUser) {
                this.currentUser = await window.api.getCurrentUser();
            }
            
            const callResponse = await window.api.initiateCall(receiverId, callType);
            this.currentCallId = callResponse.call_id;
            this.callStartTime = Date.now();
            this.callStatus = 'ringing';
            
            await this.getLocalStream(callType === 'video');
            this.showCallScreen();
            this.updateCallStatus('Ringing...');
            
            // Set timeout for inactive user
            this.inactiveTimeout = setTimeout(() => {
                if (this.callStatus === 'ringing') {
                    this.updateCallStatus('User inactive');
                    setTimeout(() => this.endCall(), 2000);
                }
            }, 30000);
            
            // Join call room
            this.socket.emit('join_room', { room: `call_${this.currentCallId}` });
            
            // Signal call initiation
            this.socket.emit('call_signal', {
                type: 'call_initiated',
                call_id: this.currentCallId,
                receiver_id: receiverId,
                caller: this.currentUser,
                call_type: callType
            });
            
            return this.currentCallId;
        } catch (error) {
            console.error('Failed to start call:', error);
            
            // Clean up on error
            this.cleanup();
            this.hideCallScreen();
            
            // Don't re-throw if it's a session error (already handled)
            if (!error.message.includes('Session expired')) {
                throw error;
            }
        }
    }

    async answerCall(callId, callType = 'video') {
        try {
            this.currentCallId = callId;
            this.callStatus = 'connected';
            this.connectedTime = Date.now();
            
            await window.api.answerCall(callId);
            await this.getLocalStream(callType === 'video');
            
            this.socket.emit('join_room', { room: `call_${callId}` });
            this.socket.emit('call_signal', {
                type: 'call_answered',
                call_id: callId,
                room: `call_${callId}`
            });
            
            this.showCallScreen();
            this.updateCallStatus('Connected');
            this.startCallTimer();
        } catch (error) {
            console.error('Failed to answer call:', error);
            
            // Clean up on error
            this.cleanup();
            this.hideCallScreen();
            
            // Don't re-throw if it's a session error (already handled)
            if (!error.message.includes('Session expired')) {
                throw error;
            }
        }
    }

    async getLocalStream(includeVideo = true) {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: includeVideo,
                audio: true
            });
            
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                localVideo.srcObject = this.localStream;
            }
            
            this.isVideoCall = includeVideo;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            throw error;
        }
    }

    handleCallSignal(data) {
        switch (data.type) {
            case 'call_initiated':
                if (data.receiver_id == this.currentUser?.id) {
                    this.currentCallId = data.call_id;
                    this.showIncomingCallPopup(data);
                }
                break;
            case 'call_answered':
                if (this.inactiveTimeout) {
                    clearTimeout(this.inactiveTimeout);
                }
                this.callStatus = 'connected';
                this.connectedTime = Date.now();
                this.updateCallStatus('Connected');
                this.startCallTimer();
                this.initiateWebRTCConnection(data.call_id);
                break;
            case 'call_ended':
                this.endCall();
                break;
            case 'call_rejected':
                this.cleanup();
                this.hideCallScreen();
                break;
            case 'call_mode_changed':
                if (data.call_id === this.currentCallId) {
                    this.handleCallModeChange(data.new_mode);
                }
                break;
        }
    }
    
    async handleCallModeChange(newMode) {
        try {
            if (newMode === 'audio' && this.isVideoCall) {
                // Other user switched to audio, switch our UI too
                this.isVideoCall = false;
                this.hideCallScreen();
                this.showCallScreen();
            } else if (newMode === 'video' && !this.isVideoCall) {
                // Other user switched to video, switch our UI too
                this.isVideoCall = true;
                this.hideCallScreen();
                this.showCallScreen();
            }
        } catch (error) {
            console.error('Failed to handle call mode change:', error);
        }
    }

    async initiateWebRTCConnection(callId) {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peers[callId] = peerConnection;

        // Add local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc_ice', {
                    candidate: event.candidate,
                    room: `call_${callId}`
                });
            }
        };

        // Create and send offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        this.socket.emit('webrtc_offer', {
            offer: offer,
            room: `call_${callId}`
        });
    }

    async handleOffer(data) {
        const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.peers[this.currentCallId] = peerConnection;

        // Add local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            const remoteVideo = document.getElementById('remote-video');
            if (remoteVideo && event.streams[0]) {
                remoteVideo.srcObject = event.streams[0];
            }
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit('webrtc_ice', {
                    candidate: event.candidate,
                    room: data.room
                });
            }
        };

        // Set remote description and create answer
        await peerConnection.setRemoteDescription(data.offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        this.socket.emit('webrtc_answer', {
            answer: answer,
            room: data.room
        });
    }

    async handleAnswer(data) {
        const peerConnection = this.peers[this.currentCallId];
        if (peerConnection) {
            await peerConnection.setRemoteDescription(data.answer);
        }
    }

    async handleIceCandidate(data) {
        const peerConnection = this.peers[this.currentCallId];
        if (peerConnection && data.candidate) {
            await peerConnection.addIceCandidate(data.candidate);
        }
    }

    toggleAudio() {
        this.isAudioMuted = !this.isAudioMuted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = !this.isAudioMuted;
            });
        }
        
        const btn = document.getElementById('mute-audio-btn') || document.getElementById('audio-mute-btn');
        if (btn) {
            btn.textContent = this.isAudioMuted ? '🔇' : '🎤';
            btn.classList.toggle('muted', this.isAudioMuted);
        }
    }

    toggleVideo() {
        this.isVideoMuted = !this.isVideoMuted;
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = !this.isVideoMuted;
            });
        }
        
        const btn = document.getElementById('mute-video-btn');
        if (btn) {
            btn.textContent = this.isVideoMuted ? '📹❌' : '📹';
            btn.classList.toggle('muted', this.isVideoMuted);
        }
    }

    async endCall() {
        if (this.currentCallId) {
            // Calculate call duration
            let duration = 0;
            if (this.connectedTime) {
                duration = Math.floor((Date.now() - this.connectedTime) / 1000);
            }
            
            await window.api.endCall(this.currentCallId);
            
            this.socket.emit('call_signal', {
                type: 'call_ended',
                call_id: this.currentCallId,
                duration: duration,
                room: `call_${this.currentCallId}`
            });
        }
        
        this.cleanup();
        this.hideCallScreen();
    }

    cleanup() {
        // Clear timers
        if (this.inactiveTimeout) {
            clearTimeout(this.inactiveTimeout);
            this.inactiveTimeout = null;
        }
        if (this.callTimer) {
            clearInterval(this.callTimer);
            this.callTimer = null;
        }
        
        // Stop local stream
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        // Close peer connections
        Object.values(this.peers).forEach(peer => {
            peer.close();
        });
        this.peers = {};

        // Clear video elements
        const localVideo = document.getElementById('local-video');
        const remoteVideo = document.getElementById('remote-video');
        if (localVideo) localVideo.srcObject = null;
        if (remoteVideo) remoteVideo.srcObject = null;

        this.currentCallId = null;
        this.callStatus = null;
        this.callStartTime = null;
        this.connectedTime = null;
    }
    
    handleCallRejection(callId) {
        // Emit rejection signal to all participants
        this.socket.emit('call_signal', {
            type: 'call_rejected',
            call_id: callId,
            room: `call_${callId}`
        });
        
        // Clean up local state
        this.cleanup();
        this.hideCallScreen();
    }
    
    async switchToVideo() {
        try {
            // Get video stream
            const videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: this.currentCamera,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });
            
            // Replace tracks in peer connection
            const peerConnection = this.peers[this.currentCallId];
            if (peerConnection) {
                const videoTrack = videoStream.getVideoTracks()[0];
                const audioTrack = videoStream.getAudioTracks()[0];
                
                // Replace or add video track
                const videoSender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                
                if (videoSender) {
                    await videoSender.replaceTrack(videoTrack);
                } else {
                    peerConnection.addTrack(videoTrack, videoStream);
                }
                
                // Replace audio track
                const audioSender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'audio'
                );
                
                if (audioSender) {
                    await audioSender.replaceTrack(audioTrack);
                }
                
                // Stop old tracks
                if (this.localStream) {
                    this.localStream.getTracks().forEach(track => track.stop());
                }
                
                this.localStream = videoStream;
                
                // Notify other user about call mode change
                console.log('Emitting call mode change to video');
                this.socket.emit('call_signal', {
                    type: 'call_mode_changed',
                    call_id: this.currentCallId,
                    new_mode: 'video',
                    room: `call_${this.currentCallId}`
                });
                
                // Switch to video UI
                this.isVideoCall = true;
                this.hideCallScreen();
                this.showCallScreen();
            }
        } catch (error) {
            console.error('Failed to switch to video:', error);
        }
    }
    
    async switchToAudio() {
        try {
            // Stop video tracks
            if (this.localStream) {
                this.localStream.getVideoTracks().forEach(track => track.stop());
            }
            
            // Get audio-only stream
            const audioStream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true
            });
            
            // Replace tracks in peer connection
            const peerConnection = this.peers[this.currentCallId];
            if (peerConnection) {
                const audioTrack = audioStream.getAudioTracks()[0];
                const sender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'audio'
                );
                
                if (sender) {
                    await sender.replaceTrack(audioTrack);
                }
                
                // Remove video sender
                const videoSender = peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );
                if (videoSender) {
                    peerConnection.removeTrack(videoSender);
                }
                
                this.localStream = audioStream;
                
                // Notify other user about call mode change
                console.log('Emitting call mode change to audio');
                this.socket.emit('call_signal', {
                    type: 'call_mode_changed',
                    call_id: this.currentCallId,
                    new_mode: 'audio',
                    room: `call_${this.currentCallId}`
                });
                
                // Switch to audio UI
                this.isVideoCall = false;
                this.hideCallScreen();
                this.showCallScreen();
            }
        } catch (error) {
            console.error('Failed to switch to audio:', error);
        }
    }

    showCallScreen() {
        if (!this.currentCallId) return;
        
        const callScreen = document.getElementById('call-screen');
        if (callScreen) {
            if (this.isVideoCall) {
                callScreen.classList.remove('hidden');
                if (this.callStatus === 'connected') {
                    this.startCallTimer();
                }
            } else {
                this.showAudioCallOverlay();
            }
        }
    }
    
    async handleCallModeChange(newMode) {
        console.log('Handling call mode change to:', newMode);
        try {
            if (newMode === 'audio' && this.isVideoCall) {
                // Other user switched to audio - clear remote video and switch UI
                const remoteVideo = document.getElementById('remote-video');
                if (remoteVideo) {
                    remoteVideo.srcObject = null;
                }
                
                this.isVideoCall = false;
                this.hideCallScreen();
                this.showCallScreen();
                
            } else if (newMode === 'video' && !this.isVideoCall) {
                // Other user switched to video - switch UI back to video
                this.isVideoCall = true;
                this.hideCallScreen();
                this.showCallScreen();
            }
        } catch (error) {
            console.error('Failed to handle call mode change:', error);
        }
    }
    
    handleCallSignal(data) {
        console.log('Received call signal:', data);
        switch (data.type) {
            case 'call_initiated':
                if (data.receiver_id == this.currentUser?.id) {
                    this.currentCallId = data.call_id;
                    this.showIncomingCallPopup(data);
                }
                break;
            case 'call_answered':
                if (this.inactiveTimeout) {
                    clearTimeout(this.inactiveTimeout);
                }
                this.callStatus = 'connected';
                this.connectedTime = Date.now();
                this.updateCallStatus('Connected');
                this.startCallTimer();
                this.initiateWebRTCConnection(data.call_id);
                break;
            case 'call_ended':
                this.endCall();
                break;
            case 'call_rejected':
                this.cleanup();
                this.hideCallScreen();
                break;
            case 'call_mode_changed':
                console.log('Call mode changed signal received:', data);
                if (data.call_id === this.currentCallId) {
                    this.handleCallModeChange(data.new_mode);
                }
                break;
        }
    }

    hideCallScreen() {
        const callScreen = document.getElementById('call-screen');
        const audioOverlay = document.getElementById('audio-call-overlay');
        
        if (callScreen) {
            callScreen.classList.add('hidden');
        }
        if (audioOverlay) {
            audioOverlay.remove();
        }
    }

    showIncomingCallPopup(data) {
        const popup = document.getElementById('incoming-call-popup');
        const callerName = document.getElementById('caller-name');
        const callTypeIcon = document.getElementById('call-type-icon');
        const callTypeText = document.getElementById('call-type-text');
        
        if (popup && callerName) {
            callerName.textContent = data.caller.name;
            
            // Set call type display
            const isVideo = data.call_type === 'video';
            if (callTypeIcon && callTypeText) {
                callTypeIcon.className = isVideo ? 'fas fa-video text-2xl text-blue-500 mr-2' : 'fas fa-phone text-2xl text-green-500 mr-2';
                callTypeText.textContent = isVideo ? 'Video' : 'Audio';
            }
            
            popup.classList.remove('hidden');
            
            // Store call data for answer/reject
            popup.dataset.callId = data.call_id;
            popup.dataset.callType = data.call_type;
        }
    }
    
    showAudioCallOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'audio-call-overlay';
        overlay.className = 'fixed top-20 right-4 bg-white rounded-lg shadow-2xl p-4 w-64 z-50 border';
        overlay.innerHTML = `
            <div class="text-center">
                <div class="flex items-center justify-center mb-3">
                    <i class="fas fa-phone text-2xl text-green-500 mr-2"></i>
                    <h3 class="text-lg font-semibold">Audio Call</h3>
                </div>
                <p class="text-gray-700 mb-4">${this.callStatus === 'ringing' ? 'Ringing...' : 'Connected'}</p>
                <div class="flex justify-center space-x-2">
                    <button id="audio-mute-btn" class="bg-gray-600 text-white p-2 rounded-full hover:bg-gray-700">
                        🎤
                    </button>
                    <button id="switch-to-video-btn" class="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700">
                        📹
                    </button>
                    <button id="audio-end-btn" class="bg-red-600 text-white p-2 rounded-full hover:bg-red-700">
                        📞
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        
        // Add event listeners
        document.getElementById('audio-mute-btn').onclick = () => this.toggleAudio();
        document.getElementById('switch-to-video-btn').onclick = () => this.switchToVideo();
        document.getElementById('audio-end-btn').onclick = () => this.endCall();
    }
    
    updateCallStatus(status) {
        // Update audio overlay status
        const audioOverlay = document.getElementById('audio-call-overlay');
        if (audioOverlay) {
            const statusElement = audioOverlay.querySelector('p');
            if (statusElement) {
                statusElement.textContent = status;
            }
        }
        
        // Update video call status
        const callScreen = document.getElementById('call-screen');
        if (callScreen && !callScreen.classList.contains('hidden')) {
            let statusElement = document.getElementById('video-call-status');
            if (!statusElement) {
                statusElement = document.createElement('div');
                statusElement.id = 'video-call-status';
                statusElement.className = 'absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded';
                callScreen.querySelector('.flex-1').appendChild(statusElement);
            }
            statusElement.textContent = status;
        }
    }
    
    startCallTimer() {
        this.callTimer = setInterval(() => {
            if (this.connectedTime) {
                const elapsed = Math.floor((Date.now() - this.connectedTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                this.updateCallStatus(`Connected ${timeStr}`);
            }
        }, 1000);
    }
}

// Initialize WebRTC manager
window.webrtc = new WebRTCManager();