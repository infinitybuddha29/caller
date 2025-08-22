const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const http = require('http');

const server = http.createServer((req, res) => {
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

const wss = new WebSocket.Server({ server });

const rooms = new Map();

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'join':
          handleJoin(ws, data.roomId);
          break;
        case 'offer':
        case 'answer':
        case 'ice-candidate':
          handleSignaling(ws, data);
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    handleLeave(ws);
  });
});

function handleJoin(ws, roomId) {
  ws.roomId = roomId;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, []);
  }
  
  const room = rooms.get(roomId);
  room.push(ws);
  
  console.log(`Client joined room ${roomId}. Room size: ${room.length}`);
  
  if (room.length === 2) {
    room[0].send(JSON.stringify({ type: 'ready' }));
    room[1].send(JSON.stringify({ type: 'ready' }));
  }
}

function handleSignaling(ws, data) {
  const roomId = ws.roomId;
  if (!roomId || !rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  const otherClient = room.find(client => client !== ws);
  
  if (otherClient && otherClient.readyState === WebSocket.OPEN) {
    otherClient.send(JSON.stringify(data));
  }
}

function handleLeave(ws) {
  const roomId = ws.roomId;
  if (!roomId || !rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  const index = room.indexOf(ws);
  
  if (index !== -1) {
    room.splice(index, 1);
    console.log(`Client left room ${roomId}. Room size: ${room.length}`);
    
    if (room.length === 0) {
      rooms.delete(roomId);
    }
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://${getLocalIP()}:${PORT}`);
});

function getLocalIP() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}