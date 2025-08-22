export class UIManager {
    constructor(caller) {
        this.caller = caller;
        this.initElements();
        this.bindEvents();
    }

    initElements() {
        this.roomIdInput = document.getElementById('roomId');
        this.joinBtn = document.getElementById('joinBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.generateBtn = document.getElementById('generateBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.cameraBtn = document.getElementById('cameraBtn');
        this.testBtn = document.getElementById('testBtn');
        this.leaveBtn = document.getElementById('leaveBtn');
        this.status = document.getElementById('status');
        this.joinSection = document.getElementById('joinSection');
        this.controls = document.getElementById('controls');
        this.videoContainer = document.getElementById('videoContainer');
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.billyPlaceholder = document.getElementById('billyPlaceholder');
        this.currentRoomInfo = document.getElementById('currentRoomInfo');
        this.currentRoomIdSpan = document.getElementById('currentRoomId');
        this.copyCurrentBtn = document.getElementById('copyCurrentBtn');

        this.generateRoomId();
        this.loadBillyImage();
    }

    loadBillyImage() {
        const billyImg = this.billyPlaceholder?.querySelector('.billy-img');
        if (billyImg) {
            billyImg.src = './png-klev-club-9rdu-p-billi-kharrington-png-4.png';
            billyImg.onerror = () => {
                billyImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiNGRkY1MDAiLz48dGV4dCB4PSI2MCIgeT0iNjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0MCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+💪</dGV4dD48L3N2Zz4=';
            };
        }
    }

    bindEvents() {
        this.joinBtn.addEventListener('click', () => this.caller.joinRoom());
        this.copyBtn.addEventListener('click', () => this.copyRoomId());
        this.generateBtn.addEventListener('click', () => this.generateRoomId());
        this.copyCurrentBtn.addEventListener('click', () => this.copyCurrentRoomId());
        this.muteBtn.addEventListener('click', () => this.caller.toggleMute());
        this.cameraBtn.addEventListener('click', () => this.caller.toggleCamera());
        this.testBtn.addEventListener('click', () => this.caller.testAudio());
        this.leaveBtn.addEventListener('click', () => this.caller.leaveRoom());
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.caller.joinRoom();
        });
    }

    updateStatus(message, className = '') {
        this.status.textContent = message;
        this.status.className = 'status' + (className ? ' ' + className : '');
    }

    showControls() {
        this.joinSection.style.display = 'none';
        this.controls.style.display = 'block';
        this.videoContainer.style.display = 'flex';
    }

    resetUI() {
        this.joinBtn.disabled = false;
        this.muteBtn.textContent = 'Выключить микрофон';
        this.muteBtn.classList.remove('muted');
        this.cameraBtn.textContent = 'Выключить камеру';
        this.cameraBtn.classList.remove('off');
        this.joinSection.style.display = 'block';
        this.controls.style.display = 'none';
        this.videoContainer.style.display = 'none';
        this.currentRoomInfo.style.display = 'none';
    }

    generateRoomId() {
        const roomId = crypto.randomUUID();
        this.roomIdInput.value = roomId;
        this.updateStatus('Сгенерирован уникальный Room ID. Поделитесь им с собеседником');
    }

    copyRoomId() {
        const roomId = this.roomIdInput.value;
        navigator.clipboard.writeText(roomId);
    }

    copyCurrentRoomId() {
        const roomId = this.currentRoomIdSpan.textContent;
        if (roomId) navigator.clipboard.writeText(roomId);
    }

    toggleMuteUI(isMuted) {
        this.muteBtn.textContent = isMuted ? 'Включить микрофон' : 'Выключить микрофон';
        this.muteBtn.classList.toggle('muted', isMuted);
    }

    toggleCameraUI(isOff) {
        this.cameraBtn.textContent = isOff ? 'Включить камеру' : 'Выключить камеру';
        this.cameraBtn.classList.toggle('off', isOff);
    }

    updateCurrentRoomDisplay(roomId) {
        if (roomId) {
            this.currentRoomIdSpan.textContent = roomId;
            this.currentRoomInfo.style.display = 'block';
        } else {
            this.currentRoomInfo.style.display = 'none';
        }
    }
}
