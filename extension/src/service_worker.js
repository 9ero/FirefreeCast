// Coordinates tab capture and offscreen document lifecycle.

var castState = { casting: false, state: '', text: 'Listo', ip: '' };

var OFFSCREEN_URL = chrome.runtime.getURL('src/offscreen.html');

function updateState(casting, state, text, ip) {
  castState = {
    casting: casting,
    state:   state,
    text:    text,
    ip:      ip != null ? ip : castState.ip,
  };
  // Persist across SW restarts (session storage survives SW death but not browser restart).
  chrome.storage.session.set({ castState: castState });
}

function ensureOffscreen() {
  return chrome.offscreen.hasDocument().then(function(exists) {
    if (exists) return;
    return chrome.offscreen.createDocument({
      url:           OFFSCREEN_URL,
      reasons:       ['USER_MEDIA', 'WEB_RTC'],
      justification: 'Tab capture and WebRTC streaming for FireCast',
    }).then(function() {
      // Give the offscreen document time to load its script.
      return new Promise(function(r) { setTimeout(r, 300); });
    });
  });
}

function getTabStreamId(tabId) {
  return new Promise(function(resolve, reject) {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, function(streamId) {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(streamId);
      }
    });
  });
}

function stopOffscreenCapture() {
  // Tell offscreen to stop tracks (releases the tab capture in Chrome).
  // Does NOT close the document — it stays alive for the next cast.
  chrome.runtime.sendMessage({ action: 'stopCapture' }).catch(function() {});
}

function handleStartCast(ip, tabId) {
  updateState(false, 'connecting', 'Iniciando captura...', ip);

  // If an offscreen doc already exists it may hold an active stream.
  // Stop it and wait for Chrome to release the capture before asking for a new stream ID.
  chrome.offscreen.hasDocument().then(function(exists) {
    if (exists) {
      stopOffscreenCapture();
      return new Promise(function(r) { setTimeout(r, 300); });
    }
  })
  .then(function() { return ensureOffscreen(); })
  .then(function() { return getTabStreamId(tabId); })
  .then(function(streamId) {
    chrome.runtime.sendMessage({ action: 'startCapture', streamId: streamId, ip: ip })
      .catch(function() {});
  })
  .catch(function(err) {
    updateState(false, 'error', 'Error: ' + err.message, ip);
    chrome.runtime.sendMessage({
      action: 'status', casting: false, state: 'error',
      text: 'Error: ' + err.message, ip: ip,
    }).catch(function() {});
  });
}

function handleStopCast() {
  stopOffscreenCapture();
  updateState(false, '', 'Listo', '');
  chrome.runtime.sendMessage({ action: 'status', casting: false, state: '', text: 'Listo', ip: '' })
    .catch(function() {});
}

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'getStatus') {
    // Read from session storage so the state survives SW restarts.
    chrome.storage.session.get('castState', function(result) {
      var saved = result.castState;
      if (saved) castState = saved; // re-sync in-memory state
      sendResponse(saved || castState);
    });
    return true; // async response
  }
  if (msg.action === 'startCast') {
    handleStartCast(msg.ip, msg.tabId);
    return false;
  }
  if (msg.action === 'stopCast') {
    handleStopCast();
    return false;
  }
  // Status broadcast from offscreen — track state (popup receives it directly too).
  if (msg.action === 'status') {
    updateState(msg.casting, msg.state, msg.text, msg.ip);
    return false;
  }
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('FireCast v0.2.0 installed');
});
