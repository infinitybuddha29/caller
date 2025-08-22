class VoiceCaller {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isMuted = false;
        this.isConnected = false;
        this.isInitiator = false;
        
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        
        this.initElements();
        this.bindEvents();
    }
    
    initElements() {
        this.roomIdInput = document.getElementById('roomId');
        this.joinBtn = document.getElementById('joinBtn');
        this.muteBtn = document.getElementById('muteBtn');
        this.testBtn = document.getElementById('testBtn');
        this.leaveBtn = document.getElementById('leaveBtn');
        this.status = document.getElementById('status');
        this.joinSection = document.getElementById('joinSection');
        this.controls = document.getElementById('controls');
    }
    
    bindEvents() {
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.testBtn.addEventListener('click', () => this.testAudio());
        this.leaveBtn.addEventListener('click', () => this.leaveRoom());
        
        this.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });
    }
    
    async joinRoom() {
        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            this.updateStatus('Введите Room ID');
            return;
        }
        
        try {
            this.updateStatus('Подключение к серверу...');
            this.joinBtn.disabled = true;
            
            await this.initMedia();
            await this.connectWebSocket(roomId);
            
        } catch (error) {
            console.error('Error joining room:', error);
            this.updateStatus('Ошибка: ' + error.message);
            this.joinBtn.disabled = false;
        }
    }
    
    async initMedia() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            console.log('Local stream obtained:', this.localStream);
            console.log('Audio tracks:', this.localStream.getAudioTracks());
            this.updateStatus('Микрофон подключен...');
        } catch (error) {
            console.error('Media access error:', error);
            throw new Error('Не удалось получить доступ к микрофону');
        }
    }
    
    connectWebSocket(roomId) {
        return new Promise((resolve, reject) => {
            // Всегда используем Socket.IO (локально и на Render)
            this.socket = io();
            
            this.socket.on('connect', () => {
                this.socket.emit('join', roomId);
                this.updateStatus('Ожидание второго участника...');
                resolve();
            });
            
            this.socket.on('ready', () => {
                this.handleSocketMessage({ type: 'ready' });
            });
            
            this.socket.on('offer', (data) => {
                this.handleSocketMessage({ type: 'offer', ...data });
            });
            
            this.socket.on('answer', (data) => {
                this.handleSocketMessage({ type: 'answer', ...data });
            });
            
            this.socket.on('ice-candidate', (data) => {
                this.handleSocketMessage({ type: 'ice-candidate', ...data });
            });
            
            this.socket.on('disconnect', () => {
                this.updateStatus('Соединение с сервером потеряно');
                this.resetUI();
            });
            
            this.socket.on('connect_error', (error) => {
                reject(new Error('Ошибка подключения к серверу'));
            });
        });
    }
    
    async handleSocketMessage(message) {
        try {
            switch (message.type) {
                case 'ready':
                    console.log('Received ready message:', message);
                    this.isInitiator = message.isInitiator;
                    await this.initPeerConnection();
                    if (this.isInitiator) {
                        console.log('Creating offer as initiator');
                        await this.createOffer();
                    } else {
                        console.log('Waiting for offer as non-initiator');
                    }
                    break;
                    
                case 'offer':
                    if (!this.peerConnection) {
                        await this.initPeerConnection();
                    }
                    await this.handleOffer(message);
                    break;
                    
                case 'answer':
                    await this.handleAnswer(message);
                    break;
                    
                case 'ice-candidate':
                    await this.handleIceCandidate(message);
                    break;
            }
        } catch (error) {
            console.error('Error handling socket message:', error);
        }
    }
    
    async initPeerConnection() {
        if (this.peerConnection) return;
        
        this.peerConnection = new RTCPeerConnection(this.iceServers);
        
        // Добавляем локальный аудио поток
        this.localStream.getTracks().forEach(track => {
            this.peerConnection.addTrack(track, this.localStream);
        });
        
        // Обработка входящего аудио потока
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            const remoteAudio = new Audio();
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            remoteAudio.controls = false;
            
            // Добавляем аудио элемент в DOM для лучшей совместимости
            remoteAudio.style.display = 'none';
            document.body.appendChild(remoteAudio);
            
            // Попытка воспроизведения с обработкой ошибок
            remoteAudio.play().then(() => {
                console.log('Remote audio started playing');
                console.log('Remote audio volume:', remoteAudio.volume);
                console.log('Remote stream tracks:', event.streams[0].getTracks());
                this.updateStatus('Звонок активен', 'connected');
                this.showControls();
            }).catch(error => {
                console.error('Failed to play remote audio:', error);
                // Браузер может блокировать автовоспроизведение
                this.updateStatus('Нажмите anywhere для активации звука', 'connected');
                this.showControls();
                
                // Добавляем обработчик клика для запуска звука
                const startAudio = () => {
                    remoteAudio.play();
                    document.removeEventListener('click', startAudio);
                    this.updateStatus('Звонок активен', 'connected');
                };
                document.addEventListener('click', startAudio);
            });
        };
        
        // Обработка ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendMessage('ice-candidate', {
                    candidate: event.candidate
                });
            }
        };
        
        this.updateStatus('Соединение устанавливается...', 'calling');
    }
    
    async createOffer() {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        
        this.sendMessage('offer', {
            offer: offer
        });
    }
    
    async handleOffer(message) {
        await this.peerConnection.setRemoteDescription(message.offer);
        
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        
        this.sendMessage('answer', {
            answer: answer
        });
    }
    
    async handleAnswer(message) {
        console.log('Handling answer, peer connection state:', this.peerConnection.signalingState);
        if (this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(message.answer);
            console.log('Answer set successfully');
        } else {
            console.warn('Received answer in wrong state:', this.peerConnection.signalingState);
        }
    }
    
    async handleIceCandidate(message) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(message.candidate);
        }
    }
    
    sendMessage(type, data) {
        if (this.socket) {
            this.socket.emit(type, data);
        }
    }
    
    toggleMute() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            this.isMuted = !audioTrack.enabled;
            
            this.muteBtn.textContent = this.isMuted ? 'Включить микрофон' : 'Выключить микрофон';
            this.muteBtn.classList.toggle('muted', this.isMuted);
        }
    }
    
    testAudio() {
        // Создаем тестовый звук
        const audioContext = new AudioContext();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        
        oscillator.frequency.value = 440; // Ля первой октавы
        gain.gain.value = 0.1; // Тихий звук
        
        oscillator.start();
        setTimeout(() => {
            oscillator.stop();
            audioContext.close();
        }, 500); // 0.5 секунды
        
        console.log('Test audio played');
    }
    
    leaveRoom() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        this.resetUI();
    }
    
    resetUI() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isMuted = false;
        this.isConnected = false;
        this.isInitiator = false;
        
        this.joinBtn.disabled = false;
        this.muteBtn.textContent = 'Выключить микрофон';
        this.muteBtn.classList.remove('muted');
        
        this.joinSection.style.display = 'block';
        this.controls.style.display = 'none';
        
        this.updateStatus('Введите Room ID и нажмите "Присоединиться"');
    }
    
    showControls() {
        this.joinSection.style.display = 'none';
        this.controls.style.display = 'block';
        this.isConnected = true;
    }
    
    updateStatus(message, className = '') {
        this.status.textContent = message;
        this.status.className = 'status' + (className ? ' ' + className : '');
    }
}

// Запускаем приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new VoiceCaller();
});