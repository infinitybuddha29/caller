import { UIManager } from './ui.js';
import { WebRTCManager } from './webRTC.js';
import { SocketManager } from './socket.js';

class VoiceCaller {
    constructor() {
        this.socketManager = new SocketManager(this);
        this.webRTC = new WebRTCManager(this);
        this.ui = new UIManager(this);

        this.localStream = null;
        this.isMuted = false;
        this.isCameraOff = false;
        this.isInitiator = false;
        this.currentRoomId = null;

        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' }
            ]
        };
    }

    async joinRoom() {
        const roomId = this.ui.roomIdInput.value.trim();
        if (!roomId) {
            this.ui.updateStatus('Введите Room ID');
            return;
        }
        this.isInitiator = true;
        try {
            await this.initMedia();
            await this.socketManager.connect(roomId);
            this.currentRoomId = roomId;
            this.ui.updateCurrentRoomDisplay(roomId);
            this.ui.showControls();
            this.ui.updateStatus('Ожидание второго участника...');
        } catch (err) {
            this.ui.updateStatus('Ошибка: ' + err.message);
        }
    }

    async initMedia() {
        this.localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        this.ui.localVideo.srcObject = this.localStream;
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(track => track.enabled = !this.isMuted);
        this.ui.toggleMuteUI(this.isMuted);
    }

    toggleCamera() {
        this.isCameraOff = !this.isCameraOff;
        this.localStream.getVideoTracks().forEach(track => track.enabled = !this.isCameraOff);
        this.ui.toggleCameraUI(this.isCameraOff);
    }

    testAudio() {
        const testTone = new Audio();
        testTone.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
        testTone.play();
    }

    leaveRoom() {
        this.socketManager.disconnect();
        this.webRTC.close();
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        this.ui.updateCurrentRoomDisplay('');
        this.ui.resetUI();
        this.ui.updateStatus('Сгенерирован уникальный Room ID. Поделитесь им с собеседником');
    }
}

export default VoiceCaller;

document.addEventListener('DOMContentLoaded', () => {
    new VoiceCaller();
});
