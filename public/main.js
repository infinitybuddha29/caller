class VoiceCaller {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isMuted = false;
        this.isConnected = false;
        
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
        this.leaveBtn = document.getElementById('leaveBtn');
        this.status = document.getElementById('status');
        this.joinSection = document.getElementById('joinSection');
        this.controls = document.getElementById('controls');
    }
    
    bindEvents() {
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
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
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.updateStatus('Микрофон подключен...');
        } catch (error) {
            throw new Error('Не удалось получить доступ к микрофону');
        }
    }
    
    connectWebSocket(roomId) {
        return new Promise((resolve, reject) => {
            // Определяем, где запущено приложение
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const isRender = window.location.hostname.includes('onrender.com');
            
            if (isLocal) {
                // Локально используем Socket.IO
                this.socket = io();
            } else if (isRender) {
                // На Render используем Socket.IO (встроенный сервер)
                this.socket = io();
            } else {
                // На других платформах (Vercel) используем внешний WebSocket
                this.connectWebSocketDirect(roomId, resolve, reject);
                return;
            }
            
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
    
    connectWebSocketDirect(roomId, resolve, reject) {
        // Используем публичный WebSocket сервис или деплойте отдельный сервер
        const wsUrl = 'wss://caller-2j05.onrender.com'; // Замените на ваш URL
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.ws.send(JSON.stringify({ type: 'join', roomId }));
            this.updateStatus('Ожидание второго участника...');
            resolve();
        };
        
        this.ws.onmessage = (event) => {
            this.handleSocketMessage(JSON.parse(event.data));
        };
        
        this.ws.onclose = () => {
            this.updateStatus('Соединение с сервером потеряно');
            this.resetUI();
        };
        
        this.ws.onerror = (error) => {
            reject(new Error('Ошибка подключения к серверу'));
        };
    }
    
    async handleSocketMessage(message) {
        switch (message.type) {
            case 'ready':
                await this.initPeerConnection();
                await this.createOffer();
                break;
                
            case 'offer':
                await this.initPeerConnection();
                await this.handleOffer(message);
                break;
                
            case 'answer':
                await this.handleAnswer(message);
                break;
                
            case 'ice-candidate':
                await this.handleIceCandidate(message);
                break;
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
            const remoteAudio = new Audio();
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.play();
            this.updateStatus('Звонок активен', 'connected');
            this.showControls();
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
        await this.peerConnection.setRemoteDescription(message.answer);
    }
    
    async handleIceCandidate(message) {
        if (this.peerConnection) {
            await this.peerConnection.addIceCandidate(message.candidate);
        }
    }
    
    sendMessage(type, data) {
        if (this.socket) {
            // Socket.IO
            this.socket.emit(type, data);
        } else if (this.ws) {
            // WebSocket
            this.ws.send(JSON.stringify({ type, ...data }));
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
    
    leaveRoom() {
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.ws) {
            this.ws.close();
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
        this.ws = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isMuted = false;
        this.isConnected = false;
        
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