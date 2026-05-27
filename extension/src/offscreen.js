// Runs in the offscreen document — survives popup close.
// Receives startCapture / stopCapture from the service worker.

const PORT        = 8765;
const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

// --- SignalingClient ---
class SignalingClient {
  constructor() {
    this._ws         = null;
    this.onAnswer    = null;
    this.onCandidate = null;
    this.onClose     = null;
  }

  connect(ip, port) {
    return new Promise(function(resolve, reject) {
      this._ws = new WebSocket('ws://' + ip + ':' + port);
      this._ws.onopen    = function()     { resolve(); };
      this._ws.onerror   = function()     { reject(new Error('No se pudo conectar a ' + ip + ':' + port)); };
      this._ws.onclose   = function()     { this.onClose && this.onClose(); }.bind(this);
      this._ws.onmessage = function({ data }) {
        let msg;
        try { msg = JSON.parse(data); } catch(e) { return; }
        if (msg.type === 'answer')    this.onAnswer    && this.onAnswer(msg.sdp);
        if (msg.type === 'candidate') this.onCandidate && this.onCandidate(msg);
      }.bind(this);
    }.bind(this));
  }

  sendOffer(sdp) { this._send({ type: 'offer', sdp }); }

  sendCandidate(c) {
    this._send({
      type:          'candidate',
      sdpMid:        c.sdpMid,
      sdpMLineIndex: c.sdpMLineIndex,
      candidate:     c.candidate,
    });
  }

  _send(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN)
      this._ws.send(JSON.stringify(obj));
  }

  close() { this._ws && this._ws.close(); this._ws = null; }
}

// --- WebRTCSender ---
class WebRTCSender {
  constructor() {
    this._pc         = null;
    this._stream     = null;
    this.onCandidate = null;
  }

  start(mediaStream) {
    this._stream = mediaStream;
    this._pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._pc.onicecandidate = function({ candidate }) {
      if (candidate) this.onCandidate && this.onCandidate(candidate);
    }.bind(this);
    mediaStream.getTracks().forEach(function(track) { this._pc.addTrack(track, mediaStream); }.bind(this));
    return this._pc.createOffer()
      .then(function(offer) { return this._pc.setLocalDescription(offer).then(function() { return offer.sdp; }); }.bind(this));
  }

  handleAnswer(sdpString) {
    return this._pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: sdpString })
    );
  }

  addRemoteCandidate(c) {
    this._pc && this._pc.addIceCandidate(
      new RTCIceCandidate({ sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex, candidate: c.candidate })
    );
  }

  stop() {
    this._stream && this._stream.getTracks().forEach(function(t) { t.stop(); });
    this._pc && this._pc.close();
    this._pc = this._stream = null;
  }
}

// --- State ---
var sender    = null;
var signaling = null;

function sendStatus(casting, state, text, ip) {
  chrome.runtime.sendMessage({ action: 'status', casting: casting, state: state, text: text, ip: ip || '' })
    .catch(function() {});
}

function stopCapture() {
  sender    && sender.stop();
  signaling && signaling.close();
  sender    = null;
  signaling = null;
}

function startCapture(streamId, ip) {
  stopCapture();

  var currentIp = ip;

  navigator.mediaDevices.getUserMedia({
    video: {
      mandatory: {
        chromeMediaSource:   'tab',
        chromeMediaSourceId: streamId,
        maxWidth:            1920,
        maxHeight:           1080,
        maxFrameRate:        30,
      }
    },
    audio: {
      mandatory: {
        chromeMediaSource:   'tab',
        chromeMediaSourceId: streamId,
      }
    }
  }).then(function(stream) {
    signaling = new SignalingClient();
    sender    = new WebRTCSender();

    // If the captured tab navigates or reloads, the track ends externally.
    stream.getTracks().forEach(function(track) {
      track.onended = function() { stopCapture(); sendStatus(false, '', 'Listo', ''); };
    });

    signaling.onAnswer    = function(sdp) { sender.handleAnswer(sdp); };
    signaling.onCandidate = function(c)   { sender.addRemoteCandidate(c); };
    signaling.onClose     = function()    { stopCapture(); sendStatus(false, '', 'Listo', currentIp); };
    sender.onCandidate    = function(c)   { signaling.sendCandidate(c); };

    sendStatus(false, 'connecting', 'Conectando con el TV...', ip);

    return signaling.connect(ip, PORT)
      .then(function() {
        sendStatus(false, 'connecting', 'Negociando WebRTC...', ip);
        return sender.start(stream);
      })
      .then(function(offerSdp) {
        signaling.sendOffer(offerSdp);
        sendStatus(true, 'connected', 'Transmitiendo a ' + ip, ip);
      });
  }).catch(function(err) {
    console.error('[FireCast Offscreen]', err);
    sendStatus(false, 'error', 'Error: ' + err.message, ip);
    stopCapture();
  });
}

// --- Message handler ---
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.action === 'startCapture') startCapture(msg.streamId, msg.ip);
  if (msg.action === 'stopCapture')  { stopCapture(); sendStatus(false, '', 'Listo', ''); }
});
