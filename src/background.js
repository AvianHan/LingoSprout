'use strict';
// The content script can contact only this local model gateway, never arbitrary URLs.
const GATEWAY = 'http://127.0.0.1:8765';
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== 'LINGOSPROUT_GATEWAY') return false;
  if (sender.id !== chrome.runtime.id || !['/select', '/chat'].includes(message.path) || message.gatewayUrl !== GATEWAY) {
    respond({ ok: false, error: 'Gateway request rejected. Use the local gateway on 127.0.0.1:8765.' }); return false;
  }
  const body = JSON.stringify(message.payload || {});
  if (body.length > 100000) { respond({ ok: false, error: 'This request is too large.' }); return false; }
  fetch(GATEWAY + message.path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-LingoSprout-Client': 'v4' },
    body, signal: AbortSignal.timeout(45000), credentials: 'omit', redirect: 'error'
  }).then(async response => {
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Gateway returned ${response.status}.`);
    respond({ ok: true, data });
  }).catch(error => respond({ ok: false, error: error.message || 'The local AI gateway is unavailable.' }));
  return true;
});
