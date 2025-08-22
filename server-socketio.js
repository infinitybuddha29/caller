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
  room.push(socket.id);
  
  console.log(`Client ${socket.id} joined room ${roomId}. Room size: ${room.length}`);
  
  if (room.length === 2) {
    console.log('Room is full, designating initiator');
    // Только первый клиент становится инициатором
    const initiatorSocket = io.sockets.sockets.get(room[0]);
    if (initiatorSocket) {
      console.log(`Making ${room[0]} the initiator`);
      initiatorSocket.emit('ready', { isInitiator: true });
    }
    // Второй клиент не инициатор
    console.log(`Making ${socket.id} the non-initiator`);
    socket.emit('ready', { isInitiator: false });
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
    
    if (room.length === 0) {
      rooms.delete(roomId);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on http://localhost:${PORT}`);
});