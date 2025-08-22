class VoiceCaller {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isMuted = false;
        this.isCameraOff = false;
        this.isConnected = false;
        this.isInitiator = false;
        this.pendingIceCandidates = [];
        this.connectionTimeout = null;
        this.makingOffer = false;
        this.polite = false;
        this.currentRoomId = null;
        this.billyImageLoaded = false;
        
        this.iceServers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                // Надёжные TURN серверы (для продакшна - замени на свой coturn)
                { 
                    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443'],
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: ['turn:openrelay.metered.ca:80?transport=tcp', 'turn:openrelay.metered.ca:443?transport=tcp'],
                    username: 'openrelayproject', 
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10
        };
        
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
        
        // Генерируем начальный UUID
        this.generateRoomId();
        
        // Загружаем картинку Билли
        this.loadBillyImage();
    }
    
    loadBillyImage() {
        // Загружаем локальную картинку Билли
        const billyImg = this.billyPlaceholder?.querySelector('.billy-img');
        if (billyImg) {
            billyImg.src = './png-klev-club-9rdu-p-billi-kharrington-png-4.png';
            billyImg.onerror = () => {
                // Fallback если картинка не загрузилась
                billyImg.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyMCIgaGVpZ2h0PSIxMjAiIGZpbGw9IiNGRkY1MDAiLz48dGV4dCB4PSI2MCIgeT0iNjUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI0MCIgZmlsbD0iIzMzMyIgdGV4dC1hbmNob3I9Im1pZGRsZSI+💪</dGV4dD48L3N2Zz4=';
            };
            this.billyImageLoaded = true;
        }
    }
    
    bindEvents() {
        this.joinBtn.addEventListener('click', () => this.joinRoom());
        this.copyBtn.addEventListener('click', () => this.copyRoomId());
        this.generateBtn.addEventListener('click', () => this.generateRoomId());
        this.copyCurrentBtn.addEventListener('click', () => this.copyCurrentRoomId());
        this.muteBtn.addEventListener('click', () => this.toggleMute());
        this.cameraBtn.addEventListener('click', () => this.toggleCamera());
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
            
            // Если уже в комнате, сначала выходим
            if (this.socket && this.socket.connected) {
                this.socket.disconnect();
                this.clearConnectionTimeout();
            }
            
            // Очищаем старое peer connection если есть
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }
            
            await this.initMedia();
            await this.connectWebSocket(roomId);
            
            // Сохраняем ID текущего созвона
            this.currentRoomId = roomId;
            this.updateCurrentRoomDisplay();
            
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
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 360 },
                    frameRate: { ideal: 30, max: 30 }
                }
            });
            console.log('Local stream obtained:', this.localStream);
            console.log('Audio tracks:', this.localStream.getAudioTracks());
            console.log('Video tracks:', this.localStream.getVideoTracks());
            
            // Подключаем локальное видео
            this.localVideo.srcObject = this.localStream;
            
            this.updateStatus('Камера и микрофон подключены...');
        } catch (error) {
            console.error('Media access error:', error);
            throw new Error('Не удалось получить доступ к камере/микрофону');
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
            
            this.socket.on('ready', (data) => {
                console.log('Raw ready data from server:', data);
                // Показываем видео контейнер, но Billy только если еще нет удаленного видео
                this.videoContainer.style.display = 'flex';
                if (!this.remoteVideo.srcObject) {
                    this.showBillyPlaceholder();
                }
                this.handleSocketMessage(data);
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
            
            this.socket.on('participant-left', (data) => {
                console.log('Participant left:', data.userId);
                this.updateStatus('Собеседник покинул комнату. Можете переподключиться');
                
                // Закрываем peer connection, но сохраняем медиа
                if (this.peerConnection) {
                    this.peerConnection.close();
                    this.peerConnection = null;
                }
                
                // Очищаем remote video и показываем Billy в ожидании
                if (this.remoteVideo) {
                    this.remoteVideo.srcObject = null;
                }
                this.showBillyPlaceholder();
                
                // Возвращаем к интерфейсу подключения, но не сбрасываем локальное видео
                this.joinSection.style.display = 'block';
                this.controls.style.display = 'none';
                this.joinBtn.disabled = false;
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
                    this.isInitiator = message.isInitiator ?? false;
                    this.polite = !this.isInitiator; // Не-инициатор = polite
                    await this.initPeerConnection();
                    
                    // Perfect Negotiation: опираемся на onnegotiationneeded
                    this.peerConnection.onnegotiationneeded = async () => {
                        try {
                            this.makingOffer = true;
                            await this.peerConnection.setLocalDescription();
                            this.sendMessage('offer', { offer: this.peerConnection.localDescription });
                        } catch (error) {
                            console.error('Error in negotiationneeded:', error);
                        } finally {
                            this.makingOffer = false;
                        }
                    };
                    
                    // Ограничиваем битрейт для стабильности
                    await this.limitBitrate();
                    break;
                    
                case 'offer':
                    if (!this.peerConnection) {
                        await this.initPeerConnection();
                    }
                    
                    // Perfect Negotiation: обработка glare
                    const offerCollision = this.makingOffer || this.peerConnection.signalingState !== 'stable';
                    const ignoreOffer = !this.polite && offerCollision;
                    
                    if (ignoreOffer) {
                        console.log('Ignoring offer due to collision (not polite)');
                        return;
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
        
        // Создаём transceiver'ы заранее для стабильных m-lines
        this.peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
        this.peerConnection.addTransceiver('video', { direction: 'sendrecv' });
        
        // Добавляем локальные треки
        this.localStream.getTracks().forEach(track => {
            const sender = this.peerConnection.getSenders().find(s => 
                s.track === null && s.track?.kind === track.kind
            );
            if (sender) {
                sender.replaceTrack(track);
            } else {
                this.peerConnection.addTrack(track, this.localStream);
            }
        });
        
        // Обработка входящих медиа потоков
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            const [stream] = event.streams;
            
            // Подключаем remote video
            this.remoteVideo.srcObject = stream;
            
            // Сразу убираем Billy когда получили удаленный поток
            this.hideBillyPlaceholder();
            
            // Попытка воспроизведения с обработкой ошибок
            this.remoteVideo.play().then(() => {
                console.log('Remote video started playing');
                console.log('Remote stream tracks:', stream.getTracks().map(t => t.kind));
                
                // Показываем празднование подключения! 🤣
                this.showBillyCelebration();
                
                this.showControls();
                this.updateCurrentRoomDisplay();
            }).catch(error => {
                console.error('Failed to play remote video:', error);
                // Браузер может блокировать автовоспроизведение
                this.updateStatus('Нажмите для активации видео/звука', 'connected');
                this.showControls();
                
                // Добавляем обработчик клика для запуска медиа
                const startMedia = () => {
                    this.remoteVideo.play().then(() => {
                        this.showBillyCelebration();
                        this.updateStatus('Видеозвонок активен', 'connected');
                    });
                    document.removeEventListener('click', startMedia);
                };
                document.addEventListener('click', startMedia);
            });
        };
        
        // Обработка ICE кандидатов
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                console.log('ICE candidate type:', event.candidate.type, 'protocol:', event.candidate.protocol);
                this.sendMessage('ice-candidate', {
                    candidate: event.candidate
                });
            } else {
                console.log('ICE gathering complete');
            }
        };
        
        // Отслеживание состояния соединения
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'connected' || 
                this.peerConnection.iceConnectionState === 'completed') {
                this.clearConnectionTimeout();
                console.log('ICE connection established successfully');
            } else if (this.peerConnection.iceConnectionState === 'failed') {
                this.clearConnectionTimeout();
                this.updateStatus('Соединение не удалось. Попробуйте еще раз.');
            } else if (this.peerConnection.iceConnectionState === 'disconnected') {
                this.updateStatus('Соединение потеряно, переподключение...');
            }
        };
        
        // Таймаут на установку соединения (30 секунд)
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && 
                this.peerConnection.iceConnectionState !== 'connected' &&
                this.peerConnection.iceConnectionState !== 'completed') {
                console.log('Connection timeout reached');
                this.updateStatus('Таймаут соединения. Попробуйте еще раз.');
                this.leaveRoom();
            }
        }, 30000);
        
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
        };
        
        this.updateStatus('Соединение устанавливается...', 'calling');
    }
    
    // Perfect Negotiation убрал createOffer - теперь через onnegotiationneeded
    
    async handleOffer(message) {
        await this.peerConnection.setRemoteDescription(message.offer);
        
        // Обрабатываем накопленные ICE кандидаты
        await this.processPendingIceCandidates();
        
        // Perfect Negotiation: используем setLocalDescription() без параметров
        await this.peerConnection.setLocalDescription();
        
        this.sendMessage('answer', {
            answer: this.peerConnection.localDescription
        });
    }
    
    async handleAnswer(message) {
        console.log('Handling answer, peer connection state:', this.peerConnection.signalingState);
        if (this.peerConnection.signalingState === 'have-local-offer') {
            await this.peerConnection.setRemoteDescription(message.answer);
            console.log('Answer set successfully');
            
            // Обрабатываем накопленные ICE кандидаты
            await this.processPendingIceCandidates();
        } else {
            console.warn('Received answer in wrong state:', this.peerConnection.signalingState);
        }
    }
    
    async handleIceCandidate(message) {
        if (this.peerConnection && message.candidate) {
            try {
                console.log('Adding ICE candidate:', message.candidate);
                if (this.peerConnection.remoteDescription) {
                    await this.peerConnection.addIceCandidate(message.candidate);
                } else {
                    console.log('Buffering ICE candidate until remote description is set');
                    this.pendingIceCandidates.push(message.candidate);
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }
    
    async processPendingIceCandidates() {
        console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
        while (this.pendingIceCandidates.length > 0) {
            const candidate = this.pendingIceCandidates.shift();
            try {
                await this.peerConnection.addIceCandidate(candidate);
                console.log('Added pending ICE candidate:', candidate);
            } catch (error) {
                console.error('Error adding pending ICE candidate:', error);
            }
        }
    }
    
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }
    
    async limitBitrate() {
        if (!this.peerConnection) return;
        
        try {
            // Ограничиваем битрейт видео до 800 kbps
            const videoSender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            if (videoSender) {
                const params = videoSender.getParameters();
                if (params.encodings && params.encodings.length > 0) {
                    params.encodings[0].maxBitrate = 800_000; // 800 kbps
                    params.encodings[0].maxFramerate = 30;
                    await videoSender.setParameters(params);
                    console.log('Video bitrate limited to 800kbps');
                }
            }
            
            // Ограничиваем битрейт аудио до 128 kbps
            const audioSender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'audio'
            );
            
            if (audioSender) {
                const params = audioSender.getParameters();
                if (params.encodings && params.encodings.length > 0) {
                    params.encodings[0].maxBitrate = 128_000; // 128 kbps
                    await audioSender.setParameters(params);
                    console.log('Audio bitrate limited to 128kbps');
                }
            }
        } catch (error) {
            console.error('Error limiting bitrate:', error);
        }
    }
    
    generateUUID() {
        // Используем crypto.randomUUID() если доступен, иначе fallback
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        
        // Fallback для старых браузеров
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    generateRoomId() {
        const newRoomId = this.generateUUID();
        this.roomIdInput.value = newRoomId;
        console.log('Generated new room ID:', newRoomId);
    }
    
    async copyRoomId() {
        try {
            await navigator.clipboard.writeText(this.roomIdInput.value);
            // Временно меняем иконку
            const originalText = this.copyBtn.textContent;
            this.copyBtn.textContent = '✅';
            setTimeout(() => {
                this.copyBtn.textContent = originalText;
            }, 1000);
        } catch (error) {
            console.error('Failed to copy room ID:', error);
            // Fallback для старых браузеров
            this.roomIdInput.select();
            document.execCommand('copy');
        }
    }
    
    async copyCurrentRoomId() {
        if (!this.currentRoomId) return;
        
        try {
            await navigator.clipboard.writeText(this.currentRoomId);
            // Временно меняем иконку
            const originalText = this.copyCurrentBtn.textContent;
            this.copyCurrentBtn.textContent = '✅';
            setTimeout(() => {
                this.copyCurrentBtn.textContent = originalText;
            }, 1000);
        } catch (error) {
            console.error('Failed to copy current room ID:', error);
        }
    }
    
    updateCurrentRoomDisplay() {
        if (this.currentRoomId && this.currentRoomIdSpan) {
            this.currentRoomIdSpan.textContent = this.currentRoomId;
            this.currentRoomInfo.style.display = 'block';
        } else {
            this.currentRoomInfo.style.display = 'none';
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
    
    toggleCamera() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            this.isCameraOff = !videoTrack.enabled;
            
            this.cameraBtn.textContent = this.isCameraOff ? 'Включить камеру' : 'Выключить камеру';
            this.cameraBtn.classList.toggle('off', this.isCameraOff);
        }
    }
    
    async switchCamera() {
        if (!this.localStream) return;
        
        try {
            const videoTrack = this.localStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );
            
            // Получаем список устройств
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            
            if (videoDevices.length > 1) {
                // Простое переключение между камерами
                const currentDeviceId = videoTrack.getSettings().deviceId;
                const nextDevice = videoDevices.find(d => d.deviceId !== currentDeviceId);
                
                if (nextDevice) {
                    const newStream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: nextDevice.deviceId },
                        audio: false
                    });
                    
                    const newVideoTrack = newStream.getVideoTracks()[0];
                    
                    // Заменяем трек
                    if (sender) {
                        await sender.replaceTrack(newVideoTrack);
                    }
                    
                    // Обновляем локальное видео
                    videoTrack.stop();
                    this.localStream.removeTrack(videoTrack);
                    this.localStream.addTrack(newVideoTrack);
                    this.localVideo.srcObject = this.localStream;
                }
            }
        } catch (error) {
            console.error('Error switching camera:', error);
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
        this.clearConnectionTimeout();
        
        // Очищаем медиа ресурсы
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log(`Stopped ${track.kind} track`);
            });
        }
        
        // Закрываем PeerConnection
        if (this.peerConnection) {
            this.peerConnection.close();
            console.log('PeerConnection closed');
        }
        
        // Очищаем видео элементы
        if (this.localVideo) this.localVideo.srcObject = null;
        if (this.remoteVideo) this.remoteVideo.srcObject = null;
        
        this.socket = null;
        this.peerConnection = null;
        this.localStream = null;
        this.isMuted = false;
        this.isCameraOff = false;
        this.isConnected = false;
        this.isInitiator = false;
        this.makingOffer = false;
        this.polite = false;
        this.pendingIceCandidates = [];
        this.currentRoomId = null;
        
        this.joinBtn.disabled = false;
        this.muteBtn.textContent = 'Выключить микрофон';
        this.muteBtn.classList.remove('muted');
        this.cameraBtn.textContent = 'Выключить камеру';
        this.cameraBtn.classList.remove('off');
        
        this.joinSection.style.display = 'block';
        this.controls.style.display = 'none';
        this.videoContainer.style.display = 'none';
        this.currentRoomInfo.style.display = 'none';
        
        this.updateStatus('Сгенерирован уникальный Room ID. Поделитесь им с собеседником');
    }
    
    showBillyPlaceholder() {
        if (this.billyPlaceholder) {
            this.billyPlaceholder.style.display = 'flex';
        }
    }
    
    hideBillyPlaceholder() {
        if (this.billyPlaceholder) {
            this.billyPlaceholder.style.display = 'none';
        }
    }
    
    showBillyCelebration() {
        // Легендарная цитата Билли появляется в отдельном попапе! 🤣
        const celebration = document.createElement('div');
        celebration.className = 'billy-celebration';
        celebration.innerHTML = `
            <div class="billy-quote">
                <div class="billy-avatar">💪</div>
                <div class="billy-message">Let's celebrate and eat some cakes! 🎉</div>
            </div>
        `;
        
        // Стили для попапа
        celebration.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 1000;
            font-weight: bold;
            animation: slideInRight 0.5s ease-out, fadeOut 0.5s ease-in 2.5s forwards;
            max-width: 300px;
        `;
        
        document.body.appendChild(celebration);
        
        // Убираем через 3 секунды
        setTimeout(() => {
            if (celebration.parentNode) {
                celebration.parentNode.removeChild(celebration);
            }
        }, 3000);
    }
    
    showControls() {
        this.joinSection.style.display = 'none';
        this.controls.style.display = 'block';
        this.videoContainer.style.display = 'flex';
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