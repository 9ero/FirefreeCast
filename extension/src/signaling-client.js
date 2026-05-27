export class SignalingClient {
  constructor() {
    this._ws       = null;
    this.onAnswer    = null;
    this.onCandidate = null;
    this.onClose     = null;
  }

  connect(ip, port) {
    return new Promise((resolve, reject) => {
      this._ws = new WebSocket(`ws://${ip}:${port}`);

      this._ws.onopen  = () => resolve();
      this._ws.onerror = () => reject(new Error(`No se pudo conectar a ${ip}:${port}`));
      this._ws.onclose = () => this.onClose?.();

      this._ws.onmessage = ({ data }) => {
        const msg = JSON.parse(data);
        if (msg.type === 'answer')    this.onAnswer?.(msg.sdp);
        if (msg.type === 'candidate') this.onCandidate?.(msg);
      };
    });
  }

  sendOffer(sdp) {
    this._send({ type: 'offer', sdp });
  }

  sendCandidate(candidate) {
    this._send({
      type:          'candidate',
      sdpMid:        candidate.sdpMid,
      sdpMLineIndex: candidate.sdpMLineIndex,
      candidate:     candidate.candidate,
    });
  }

  _send(obj) {
    if (this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  close() {
    this._ws?.close();
    this._ws = null;
  }
}
