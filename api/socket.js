const { Server } = require('socket.io');

const rooms = new Map();

let io;

export default function handler(req, res) {
  if (!io) {
    io = new Server(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

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

    res.socket.server.io = io;
  }

  res.end();
}

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
    socket.to(roomId).emit('ready');
    socket.emit('ready');
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