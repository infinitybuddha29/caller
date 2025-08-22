const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const server = createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  } else if (req.url === '/main.js') {
    const filePath = path.join(__dirname, 'public', 'main.js');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (roomId) => {
    handleJoin(socket, roomId);
  });

  socket.on('offer', (data) => {
    handleSignaling(socket, { type: 'offer', ...data });
  });

  socket.on('answer', (data) => {
    handleSignaling(socket, { type: 'answer', ...data });
  });

  socket.on('ice-candidate', (data) => {
    handleSignaling(socket, { type: 'ice-candidate', ...data });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    handleLeave(socket);
  });
});

function handleJoin(socket, roomId) {
  socket.roomId = roomId;
  socket.join(roomId);
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }
  
  const room = rooms.get(roomId);
  
  // Проверяем, не подключен ли уже этот сокет к комнате
  if (!room.includes(socket.id)) {
    room.push(socket.id);
  }
  
  console.log(`Client ${socket.id} joined room ${roomId}. Room size: ${room.length}`);
  
  // Разрешаем переподключение, даже если в комнате уже есть участники
  if (room.length >= 2) {
    console.log('Room has participants, starting peer connection');
    
    // Берём первых двух активных участников
    const activeParticipants = [];
    for (const participantId of room) {
      const participantSocket = io.sockets.sockets.get(participantId);
      if (participantSocket) {
        activeParticipants.push(participantId);
        if (activeParticipants.length === 2) break;
      }
    }
    
    if (activeParticipants.length === 2) {
      const [initiatorId, nonInitiatorId] = activeParticipants;
      
      const initiatorSocket = io.sockets.sockets.get(initiatorId);
      const nonInitiatorSocket = io.sockets.sockets.get(nonInitiatorId);
      
      if (initiatorSocket) {
        console.log(`Making ${initiatorId} the initiator`);
        initiatorSocket.emit('ready', { type: 'ready', isInitiator: true });
      }
      
      if (nonInitiatorSocket) {
        console.log(`Making ${nonInitiatorId} the non-initiator`);
        nonInitiatorSocket.emit('ready', { type: 'ready', isInitiator: false });
      }
    }
  }
}

function handleSignaling(socket, data) {
  const roomId = socket.roomId;
  if (!roomId) return;
  
  socket.to(roomId).emit(data.type, data);
}

function handleLeave(socket) {
  const roomId = socket.roomId;
  if (!roomId || !rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  const index = room.indexOf(socket.id);
  
  if (index !== -1) {
    room.splice(index, 1);
    console.log(`Client ${socket.id} left room ${roomId}. Room size: ${room.length}`);
    
    // Уведомляем оставшихся участников о выходе
    socket.to(roomId).emit('participant-left', { userId: socket.id });
    
    // Очищаем неактивные сокеты из комнаты
    cleanupRoom(roomId);
    
    if (room.length === 0) {
      console.log(`Room ${roomId} is empty, will be deleted in 2 minutes if no one rejoins`);
      // Даём 2 минуты на переподключение (сократил с 5 для тестирования)
      setTimeout(() => {
        if (rooms.has(roomId) && rooms.get(roomId).length === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted after timeout`);
        }
      }, 2 * 60 * 1000); // 2 минуты
    }
  }
}

function cleanupRoom(roomId) {
  if (!rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  const activeParticipants = [];
  
  // Оставляем только активные соединения
  for (const participantId of room) {
    const participantSocket = io.sockets.sockets.get(participantId);
    if (participantSocket && participantSocket.connected) {
      activeParticipants.push(participantId);
    }
  }
  
  // Обновляем список участников
  rooms.set(roomId, activeParticipants);
  console.log(`Room ${roomId} cleaned up. Active participants: ${activeParticipants.length}`);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});