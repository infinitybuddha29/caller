export class WebRTCManager {
    constructor(caller) {
        this.caller = caller;
        this.peerConnection = null;
        this.pendingIceCandidates = [];
    }

    async initPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.caller.iceServers);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.caller.socketManager.sendIceCandidate(event.candidate);
            }
        };

        this.peerConnection.ontrack = (event) => {
            if (this.caller.ui.remoteVideo.srcObject !== event.streams[0]) {
                this.caller.ui.remoteVideo.srcObject = event.streams[0];
                this.caller.ui.billyPlaceholder?.style.setProperty('display', 'none');
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
        };

        if (this.caller.localStream) {
            this.caller.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.caller.localStream);
            });
        }
    }

    async createOffer() {
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        this.caller.socketManager.sendOffer(offer);
    }

    async handleOffer(offer) {
        if (!this.peerConnection) await this.initPeerConnection();
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        this.caller.socketManager.sendAnswer(answer);
    }

    async handleAnswer(answer) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        this.processPendingIce();
    }

    async handleIceCandidate(candidate) {
        if (this.peerConnection.remoteDescription) {
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                console.error('Error adding received ice candidate', err);
            }
        } else {
            this.pendingIceCandidates.push(candidate);
        }
    }

    async processPendingIce() {
        while (this.pendingIceCandidates.length) {
            const candidate = this.pendingIceCandidates.shift();
            try {
                await this.peerConnection.addIceCandidate(candidate);
            } catch (err) {
                console.error('Error adding stored ice candidate', err);
            }
        }
    }

    close() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
    }
}
