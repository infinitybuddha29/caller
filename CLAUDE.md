# WebRTC Video Caller

A modern WebRTC video calling application with robust connection management and professional UI.

## Features

🎥 **Video & Audio Calling**
- HD video calling (640×360@30fps)
- Echo cancellation and noise suppression
- Camera on/off toggle
- Microphone mute/unmute
- Camera switching (front/back)

🔗 **Smart Connection Management**
- UUID-based room system with copy/paste functionality
- Perfect Negotiation pattern prevents connection conflicts
- ICE candidate buffering for faster connections
- Automatic reconnection after temporary disconnects
- 30-second connection timeout with fallback

🛡️ **Stability Features**
- Bitrate limiting (800kbps video, 128kbps audio)
- TURN server support for NAT traversal
- Graceful handling of participant disconnections
- Room persistence for 2 minutes after disconnect

📱 **Cross-Platform**
- iOS Safari support with `playsinline`
- Autoplay handling for all browsers
- Responsive design for mobile/desktop
- Local video mirroring for natural selfie experience

## Development

**Start server:**
```bash
npm start
# or
npm run dev
```

**Test locally:**
Open http://localhost:3000 in two browser tabs/devices

## Project Structure

```
caller/
├── server-socketio.js          # Socket.IO signaling server
├── public/
│   ├── index.html             # Main HTML page with video UI
│   └── main.js                # WebRTC client with Perfect Negotiation
├── package.json               # Dependencies (socket.io, ws)
├── vercel.json               # Deployment configuration
├── CLAUDE.md                 # This file
└── TECHNICAL_OVERVIEW.md     # Detailed technical documentation
```

## How to Use

1. **Create Room**: Generate unique UUID (🔄 button)
2. **Share Room**: Copy ID (📋 button) and send to participant
3. **Join Room**: Paste received ID and click "Присоединиться"
4. **During Call**: 
   - Toggle camera/microphone
   - Copy current room ID to invite others
   - Switch between cameras (if multiple available)

## Technical Highlights

- **Perfect Negotiation**: Eliminates offer/answer race conditions
- **Transceiver Pre-allocation**: Stable SDP m-lines
- **ICE Buffering**: Handles candidates arriving before remote description
- **Robust Reconnection**: Participants can rejoin same room
- **Modern APIs**: Uses `crypto.randomUUID()` with fallback

## Browser Compatibility

- Chrome 88+
- Firefox 84+
- Safari 14+ (iOS 14.3+)
- Edge 88+

## Production Deployment

**TURN Server**: Replace `openrelay.metered.ca` with your own coturn server:
```javascript
{
    urls: ['turn:your-server.com:3478', 'turn:your-server.com:443?transport=tcp'],
    username: 'your-username',
    credential: 'your-password'
}
```

**HTTPS Required**: WebRTC requires secure context for camera/microphone access

## Deployment

Configured for Vercel deployment. Also supports:
- Heroku (uses PORT environment variable)  
- Docker containers
- Traditional Node.js hosting