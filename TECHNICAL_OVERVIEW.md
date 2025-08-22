# WebRTC Video Caller - Техническое описание

## Архитектура приложения

### Компоненты системы

1. **Socket.IO сервер** (`server-socketio.js`) - сигналинг сервер
2. **WebRTC клиент** (`main.js`) - браузерное приложение
3. **HTML интерфейс** (`index.html`) - пользовательский интерфейс

---

## Как работает сигналинг

### Socket.IO сервер
```javascript
// Управляет комнатами и маршрутизацией сообщений
const rooms = new Map();

// События:
// - join: подключение к комнате
// - offer/answer/ice-candidate: WebRTC сигналинг
```

### Процесс подключения
1. **Клиент присоединяется к комнате** → `socket.emit('join', roomId)`
2. **Когда второй клиент присоединяется:**
   - Первый клиент получает `{ type: 'ready', isInitiator: true }`
   - Второй клиент получает `{ type: 'ready', isInitiator: false }`
3. **Сервер пересылает сигналинг** между участниками

---

## WebRTC Peer Connection

### Perfect Negotiation Pattern
```javascript
// Флаги для предотвращения состояния гонки
this.makingOffer = false;    // Создаём ли offer сейчас
this.polite = !isInitiator;  // "Вежливый" участник (не инициатор)

// Автоматическое создание offer при изменениях
peerConnection.onnegotiationneeded = async () => {
    this.makingOffer = true;
    await peerConnection.setLocalDescription();
    sendMessage('offer', { offer: peerConnection.localDescription });
    this.makingOffer = false;
};

// Обработка collision (одновременных offer'ов)
const offerCollision = this.makingOffer || peerConnection.signalingState !== 'stable';
const ignoreOffer = !this.polite && offerCollision;
```

### Transceiver'ы для стабильности
```javascript
// Создаём медиа-слоты заранее
peerConnection.addTransceiver('audio', { direction: 'sendrecv' });
peerConnection.addTransceiver('video', { direction: 'sendrecv' });

// Это стабилизирует m-lines в SDP и предотвращает проблемы с порядком треков
```

---

## ICE Connectivity

### STUN/TURN серверы
```javascript
iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },     // Обнаружение внешнего IP
    { 
        urls: ['turn:openrelay.metered.ca:80'],   // Ретрансляция через TURN
        username: 'openrelayproject',
        credential: 'openrelayproject'
    }
]
```

### Буферизация ICE кандидатов
```javascript
// Проблема: ICE кандидаты могут прийти до setRemoteDescription
this.pendingIceCandidates = [];

// Решение: буферизуем кандидаты
if (peerConnection.remoteDescription) {
    await peerConnection.addIceCandidate(candidate);
} else {
    this.pendingIceCandidates.push(candidate);
}

// Обрабатываем после setRemoteDescription
async processPendingIceCandidates() {
    while (this.pendingIceCandidates.length > 0) {
        const candidate = this.pendingIceCandidates.shift();
        await this.peerConnection.addIceCandidate(candidate);
    }
}
```

---

## Медиа-поток

### Запрос устройств
```javascript
const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: true,    // Подавление эха
        noiseSuppression: true,    // Шумоподавление
        autoGainControl: true      // Автоматическая регулировка громкости
    },
    video: {
        width: { ideal: 640 },     // Оптимальное разрешение
        height: { ideal: 360 },
        frameRate: { ideal: 30, max: 30 }
    }
});

// Подключение к HTML video элементам
localVideo.srcObject = stream;                    // Локальное (с зеркалированием)
remoteVideo.srcObject = event.streams[0];         // Удалённое
```

### Ограничение битрейта
```javascript
// Для стабильности соединения
const videoSender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
const params = videoSender.getParameters();
params.encodings[0].maxBitrate = 800_000;  // 800 kbps видео
params.encodings[0].maxFramerate = 30;
await videoSender.setParameters(params);
```

---

## Обработка медиа-событий

### Входящий поток
```javascript
peerConnection.ontrack = (event) => {
    const [stream] = event.streams;
    remoteVideo.srcObject = stream;  // Подключаем к HTML video элементу
    
    // Обработка автоплея (браузеры блокируют автовоспроизведение)
    remoteVideo.play().catch(() => {
        // Показываем "нажмите для активации"
        document.addEventListener('click', () => remoteVideo.play());
    });
};
```

### Контроль устройств
```javascript
// Выключение камеры
videoTrack.enabled = false;

// Переключение камеры
const devices = await navigator.mediaDevices.enumerateDevices();
const newStream = await navigator.mediaDevices.getUserMedia({
    video: { deviceId: nextDevice.deviceId }
});
await sender.replaceTrack(newStream.getVideoTracks()[0]);
```

---

## Жизненный цикл соединения

### 1. Инициализация
```
Клиент 1: joinRoom() → getUserMedia() → socket.connect()
Клиент 2: joinRoom() → getUserMedia() → socket.connect()
```

### 2. Сигналинг
```
Сервер: room full → ready(isInitiator: true/false)
Клиенты: initPeerConnection() → addTransceivers()
```

### 3. WebRTC Negotiation
```
Инициатор: onnegotiationneeded → createOffer → setLocalDescription → send offer
Получатель: receive offer → setRemoteDescription → setLocalDescription → send answer
Инициатор: receive answer → setRemoteDescription
```

### 4. ICE Exchange
```
Оба клиента: onicecandidate → send candidate
Получатель: addIceCandidate (или буферизует)
```

### 5. Медиа-поток
```
ontrack → remoteVideo.srcObject = stream → play()
Соединение установлено!
```

---

## Обработка ошибок и восстановление

### Таймауты
```javascript
// 30-секундный таймаут на установку соединения
this.connectionTimeout = setTimeout(() => {
    if (iceConnectionState !== 'connected') {
        this.leaveRoom(); // Сброс и повтор
    }
}, 30000);
```

### Состояния ICE
```javascript
oniceconnectionstatechange = () => {
    switch (iceConnectionState) {
        case 'connected': 
        case 'completed': // Успех
            break;
        case 'failed': // Сбой - нужно переподключение
            break;
        case 'disconnected': // Временная потеря
            break;
    }
};
```

### Очистка ресурсов
```javascript
resetUI() {
    // Останавливаем все медиа-треки
    localStream?.getTracks().forEach(track => track.stop());
    
    // Закрываем PeerConnection
    peerConnection?.close();
    
    // Очищаем DOM
    localVideo.srcObject = null;
    remoteVideo.srcObject = null;
}
```

---

## Особенности браузеров

### iOS Safari
- Требует `playsinline` на video элементах
- Автоплей заблокирован без пользовательского взаимодействия
- H.264 кодек предпочтительнее VP8

### Chrome/Firefox
- VP8 кодек работает лучше
- Более агрессивное подавление эха
- Лучшая поддержка новых WebRTC API

### Мобильные браузеры
- Ограниченная пропускная способность → важно ограничение битрейта
- Переключение сетей (WiFi ↔ LTE) → нужна обработка `oniceconnectionstatechange`

---

## Масштабирование и продакшн

### TURN сервер
```bash
# Собственный coturn вместо openrelay
docker run -d --network=host \
  -v $(pwd)/turnserver.conf:/etc/coturn/turnserver.conf \
  coturn/coturn
```

### Мониторинг
```javascript
// Статистика соединения
const stats = await peerConnection.getStats();
stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
        console.log('Video bitrate:', report.bytesReceived);
    }
});
```

### Безопасность
- HTTPS обязательно для getUserMedia
- Валидация Room ID на сервере
- Rate limiting для сигналинг сообщений

---

## Диагностика проблем

### Логирование
```javascript
// ICE кандидаты
console.log('ICE candidate type:', candidate.type, 'protocol:', candidate.protocol);

// Состояния соединения
console.log('ICE:', iceConnectionState, 'Signaling:', signalingState);

// Медиа статистика
console.log('Tracks:', stream.getTracks().map(t => t.kind));
```

### Частые проблемы
1. **Не работает за NAT** → проверить TURN сервер
2. **Эхо при использовании динамиков** → включить echoCancellation
3. **Медленное соединение** → проверить ICE кандидаты, добавить STUN серверы
4. **Зависает на connecting** → таймауты и переподключение
5. **Нет видео на мобильном** → playsinline и обработка автоплея

---

## Новые возможности (последнее обновление)

### UUID система комнат
```javascript
// Генерация уникального ID комнаты
generateUUID() {
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

// Копирование в буфер обмена
async copyRoomId() {
    await navigator.clipboard.writeText(this.roomIdInput.value);
    // Визуальная обратная связь
    this.copyBtn.textContent = '✅';
    setTimeout(() => this.copyBtn.textContent = '📋', 1000);
}
```

### Улучшенное переподключение
```javascript
// Сервер: graceful cleanup с таймаутом
function handleLeave(socket) {
    // Уведомляем участников
    socket.to(roomId).emit('participant-left', { userId: socket.id });
    
    // Даём время на переподключение
    if (room.length === 0) {
        setTimeout(() => {
            if (rooms.has(roomId) && rooms.get(roomId).length === 0) {
                rooms.delete(roomId);
            }
        }, 2 * 60 * 1000); // 2 минуты
    }
}

// Клиент: мягкая обработка выхода собеседника  
socket.on('participant-left', () => {
    this.updateStatus('Собеседник покинул комнату. Можете переподключиться');
    // Не сбрасываем UI полностью
    this.peerConnection.close();
    this.remoteVideo.srcObject = null;
    this.joinSection.style.display = 'block';
});
```

### Отображение ID текущего созвона
```javascript
// Во время активного звонка показываем ID комнаты
updateCurrentRoomDisplay() {
    if (this.currentRoomId) {
        this.currentRoomIdSpan.textContent = this.currentRoomId;
        this.currentRoomInfo.style.display = 'block';
    }
}

// Копирование ID прямо из интерфейса звонка
async copyCurrentRoomId() {
    await navigator.clipboard.writeText(this.currentRoomId);
    this.copyCurrentBtn.textContent = '✅';
}
```

### Видео интерфейс
```javascript
// Зеркалирование локального видео (CSS)
#localVideo {
    transform: scaleX(-1); /* Естественное отражение для селфи */
}

// Адаптивные размеры видео
.video-wrapper video {
    width: 480px;     // Desktop
    height: 360px;
    object-fit: cover;
}

@media (max-width: 1000px) {
    .video-wrapper video {
        width: 360px;  // Tablet  
        height: 270px;
    }
}
```

---

*Приложение использует современные веб-стандарты WebRTC, Socket.IO и следует best practices для производительности и стабильности P2P видеосвязи.*