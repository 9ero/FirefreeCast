export class WebRTCSender {
  constructor() {
    this._pc         = null;
    this._stream     = null;
    this.onCandidate = null;
  }

  async start(mediaStream) {
    this._stream = mediaStream;
    this._pc = new RTCPeerConnection({ iceServers: [] }); // LAN only — no STUN needed

    this._pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.onCandidate?.(candidate);
    };

    mediaStream.getTracks().forEach(track => this._pc.addTrack(track, mediaStream));

    const offer = await this._pc.createOffer();
    await this._pc.setLocalDescription(offer);
    return offer.sdp;
  }

  async handleAnswer(sdpString) {
    const answer = new RTCSessionDescription({ type: 'answer', sdp: sdpString });
    await this._pc.setRemoteDescription(answer);
  }

  addRemoteCandidate({ sdpMid, sdpMLineIndex, candidate }) {
    this._pc?.addIceCandidate(new RTCIceCandidate({ sdpMid, sdpMLineIndex, candidate }));
  }

  stop() {
    this._stream?.getTracks().forEach(t => t.stop());
    this._pc?.close();
    this._pc     = null;
    this._stream = null;
  }
}
