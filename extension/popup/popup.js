// Pure UI — no tabCapture, no WebRTC, no WebSocket.
// All streaming logic lives in src/offscreen.js (survives popup close).

var ipInput   = document.getElementById('ip-input');
var castBtn   = document.getElementById('cast-btn');
var dot       = document.getElementById('dot');
var statusTxt = document.getElementById('status-text');

var casting = false;

function setStatus(state, text) {
  dot.className = 'dot ' + (state || '');
  statusTxt.textContent = text || 'Listo';
}

function applyCastState(isCasting, state, text, ip) {
  casting = isCasting;
  setStatus(state, text);
  castBtn.disabled = false;
  if (isCasting) {
    if (ip) ipInput.value = ip;
    castBtn.textContent = 'Detener Cast';
    castBtn.classList.add('stop');
  } else {
    castBtn.textContent = 'Iniciar Cast';
    castBtn.classList.remove('stop');
  }
}

// Restore saved IP.
chrome.storage.local.get('savedIp', function(result) {
  if (result.savedIp) ipInput.value = result.savedIp;
});

// Sync with whatever is currently happening.
chrome.runtime.sendMessage({ action: 'getStatus' }, function(response) {
  if (chrome.runtime.lastError || !response) return;
  applyCastState(response.casting, response.state, response.text, response.ip);
});

// Live updates while the popup is open.
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.action === 'status') applyCastState(msg.casting, msg.state, msg.text, msg.ip);
});

castBtn.addEventListener('click', function() {
  if (casting) {
    castBtn.disabled = true;
    chrome.runtime.sendMessage({ action: 'stopCast' });
    return;
  }

  var ip = ipInput.value.trim();
  if (!ip) { setStatus('error', 'Ingresa la IP del Fire TV'); return; }

  chrome.storage.local.set({ savedIp: ip });
  castBtn.disabled = true;
  setStatus('connecting', 'Iniciando...');

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs || !tabs[0]) {
      setStatus('error', 'No hay pestaña activa');
      castBtn.disabled = false;
      return;
    }
    chrome.runtime.sendMessage({ action: 'startCast', ip: ip, tabId: tabs[0].id });
  });
});
