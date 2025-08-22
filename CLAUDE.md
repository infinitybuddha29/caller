# WebRTC Voice Caller

A simple WebRTC voice calling application with Socket.IO server.

## Development

**Start server:**
```bash
npm start
# or
npm run dev
```

**Test locally:**
Open http://localhost:3000 in two browser tabs to test voice calling

## Project Structure

- `server-socketio.js` - Socket.IO server handling WebRTC signaling
- `public/index.html` - Main HTML page  
- `public/main.js` - Client-side WebRTC logic
- `package.json` - Node.js dependencies (ws, socket.io)

## Features

- WebRTC peer-to-peer voice calling
- Room-based connections (max 2 users per room)
- Socket.IO for signaling
- CORS enabled for development

## Known Issues

- Echo cancellation needs improvement when using speakers
- Consider adding `echoCancellation: true` in audio constraints

## Deployment

Configured for Vercel deployment via `vercel.json`