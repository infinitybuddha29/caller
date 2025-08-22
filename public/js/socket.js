export class SocketManager {
    constructor(caller) {
        this.caller = caller;
        this.socket = null;
    }

    connect(roomId) {
        return new Promise((resolve) => {
            this.socket = io();
            this.socket.on('connect', () => {
                this.socket.emit('join', roomId);
                resolve();
            });

            this.socket.on('ready', (data) => {
                this.caller.webRTC.initPeerConnection();
                if (this.caller.isInitiator) {
                    this.caller.webRTC.createOffer();
                }
            });

            this.socket.on('offer', (data) => this.caller.webRTC.handleOffer(data.sdp));
            this.socket.on('answer', (data) => this.caller.webRTC.handleAnswer(data.sdp));
            this.socket.on('ice-candidate', (data) => this.caller.webRTC.handleIceCandidate(data.candidate));

            this.socket.on('participant-left', () => {
                this.caller.ui.updateStatus('Собеседник покинул комнату. Можете переподключиться');
                this.caller.webRTC.close();
            });

            this.socket.on('full-room', () => {
                this.caller.ui.updateStatus('Комната переполнена');
                this.disconnect();
            });

            this.socket.on('room-not-found', () => {
                this.caller.ui.updateStatus('Комната не найдена');
                this.disconnect();
            });

            this.socket.on('disconnect', () => {
                this.caller.ui.updateStatus('Соединение потеряно');
            });
        });
    }

    sendOffer(offer) {
        this.socket.emit('offer', { sdp: offer });
    }

    sendAnswer(answer) {
        this.socket.emit('answer', { sdp: answer });
    }

    sendIceCandidate(candidate) {
        this.socket.emit('ice-candidate', { candidate });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}
