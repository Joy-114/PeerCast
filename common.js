'use strict';
// Stateless helpers only: each page owns its own peer and media lifetime.
const UI = id => document.getElementById(id);
function message(text, error = false) {
  UI('message').textContent = text;
  UI('message').dataset.level = error ? 'error' : 'info';
}
function parseDescription(text, expected) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('Invalid SDP: 请粘贴完整的 JSON'); }
  if (!value || value.type !== expected) {
    throw new Error(`Invalid SDP: expected ${expected} but received ${value?.type ?? 'null'}`);
  }
  if (typeof value.sdp !== 'string' || !value.sdp.startsWith('v=0') || !value.sdp.includes('m=video')) {
    throw new Error('Invalid SDP: 缺少完整的视频 SDP');
  }
  return value;
}
function assertDescription(pc, side, type, state) {
  if (pc[side + 'Description']?.type !== type || pc.signalingState !== state) {
    throw new Error(`SDP 状态错误：需要 ${side} ${type} / ${state}`);
  }
}
function waitForIce(pc, signal, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const finish = error => {
      clearTimeout(timer);
      pc.removeEventListener('icegatheringstatechange', check);
      signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve();
    };
    const check = () => { if (pc.iceGatheringState === 'complete') finish(); };
    const abort = () => finish(new Error('操作已取消'));
    const timer = setTimeout(() => finish(new Error('ICE gathering 超时，请重置连接后重试')), timeout);
    pc.addEventListener('icegatheringstatechange', check);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort(); else check();
  });
}
function describePeer(pc, element) {
  if (!pc) { element.textContent = '未连接'; element.dataset.state = ''; return; }
  const connected = pc.connectionState === 'connected' && ['connected', 'completed'].includes(pc.iceConnectionState);
  element.dataset.state = connected ? 'connected' : pc.connectionState;
  element.textContent = [connected ? '网络已连接（媒体状态见下方）' : '网络尚未连接',
    ...['connectionState', 'iceConnectionState', 'iceGatheringState', 'signalingState'].map(key => `${key}: ${pc[key]}`),
    `localDescription.type: ${pc.localDescription?.type ?? 'null'}`,
    `remoteDescription.type: ${pc.remoteDescription?.type ?? 'null'}`,
    `candidate count (local / remote): ${(pc.localDescription?.sdp.match(/^a=candidate:/gm) || []).length} / ${(pc.remoteDescription?.sdp.match(/^a=candidate:/gm) || []).length}`].join('\n');
}
function observePeer(pc, element, signal) {
  const update = () => {
    describePeer(pc, element);
    if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') message('Direct P2P failed. TURN relay may be required. 请检查网络或在 Settings 配置 TURN，再重置交换新连接信息。', true);
    else if (pc.iceConnectionState === 'disconnected') message('连接中断，正在等待网络恢复；持续中断时请重置并交换新 SDP。', true);
  };
  for (const event of ['connectionstatechange', 'iceconnectionstatechange', 'icegatheringstatechange', 'signalingstatechange', 'icecandidate']) {
    pc.addEventListener(event, update, { signal });
  }
  update();
}
async function copyDescription(id) {
  const field = UI(id);
  const select = () => { field.focus(); field.select(); field.setSelectionRange(0, field.value.length); };
  select();
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(field.value);
    message('已复制完整连接信息。');
  } catch {
    select();
    try { if (document.execCommand?.('copy')) { message('已复制完整连接信息。'); return; } } catch { /* manual fallback below */ }
    select();
    const mac = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    message(`Copy failed. Press ${mac ? 'Command + C' : 'Ctrl + C'}. 文本已选中，也可使用系统复制菜单。`, true);
  }
}
function stopStream(stream) { stream?.getTracks().forEach(track => track.stop()); }
