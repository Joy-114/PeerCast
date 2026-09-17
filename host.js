'use strict';
const shareBtn = UI('shareBtn');
const createOfferBtn = UI('createOfferBtn');
const copyOfferBtn = UI('copyOfferBtn');
const offerText = UI('offerText');
const answerInput = UI('answerInput');
const setAnswerBtn = UI('setAnswerBtn');
const preview = UI('preview');
let localStream = null;
let hostPc = null;
let hostSession = new AbortController();
let busy = false;

function hostButtons() {
  shareBtn.disabled = busy || !!localStream;
  createOfferBtn.disabled = busy || !localStream || !!hostPc;
  setAnswerBtn.disabled = busy || hostPc?.signalingState !== 'have-local-offer' || !offerText.value;
  UI('micOn').disabled = busy;
  UI('micDevice').disabled = busy;
  UI('resolution').disabled = busy || !!localStream; UI('fps').disabled = busy || !!localStream;
  for (const key of ['screen', 'mic']) UI(key + 'Send').disabled = busy;
  UI('applicationList')?.querySelectorAll('input[type=checkbox]').forEach(control=>control.disabled=busy);
}
function resetHost() {
  window.applicationAudio?.reset();
  hostSession.abort();
  hostSession = new AbortController();
  hostPc?.close(); hostPc = null;
  audioSenders.clear(); audioRouter.close(); audioRouter = new AudioRouter();
  UI('micOn').checked = false;
  stopStream(localStream); localStream = null;
  preview.srcObject = null;
  offerText.value = ''; answerInput.value = ''; copyOfferBtn.disabled = true;
  UI('rawSdp').value = ''; UI('compressionStats').textContent = '';
  UI('route').textContent = 'Connection Route: Unknown'; UI('performance').textContent = '等待连接统计';
  busy = false;
  UI('audioStatus').textContent = 'Screen Audio: unavailable';
  describePeer(null, UI('hostStatus')); hostButtons();
  updateAudioStatus();
}
shareBtn.addEventListener('click', async () => {
  if (busy || localStream) return;
  const session = hostSession;
  busy = true; hostButtons();
  try {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('屏幕捕获不可用：请在支持的桌面浏览器中通过 localhost 或 HTTPS 打开 Host。');
    if (!await selectDesktopScreen()) return;
    if (session.signal.aborted) return;
    const stream = await navigator.mediaDevices.getDisplayMedia(captureConstraints());
    if (session.signal.aborted) { stopStream(stream); return; }
    if (!stream.getVideoTracks().length) { stopStream(stream); throw new Error('没有视频轨道'); }
    localStream = stream;
    preview.srcObject = new MediaStream(stream.getVideoTracks());
    stream.getVideoTracks()[0].addEventListener('ended', () => { resetHost(); message('屏幕分享已结束；重新分享需要交换新的 Offer / Answer。'); }, { once: true });
    UI('audioStatus').textContent = stream.getAudioTracks().length ? 'Screen Audio: available' : 'Screen Audio: unavailable — 未捕获共享音频，视频仍可使用';
    const router = audioRouter;
    if (stream.getAudioTracks().length) {
      try {
        await router.input('screen', new MediaStream(stream.getAudioTracks()));
        if (session.signal.aborted) { router.close(); return; }
        await applyAudio('screen');
        stream.getAudioTracks()[0].addEventListener('ended', () => {
          if (session.signal.aborted) return;
          router.off('screen'); applyAudio('screen').catch(error => message(error.message, true));
          UI('audioStatus').textContent = 'Screen Audio: unavailable — 共享音频已结束';
        }, { once: true });
      } catch (error) { if (!session.signal.aborted) UI('audioStatus').textContent = '共享音频处理失败，视频仍可用：' + error.message; }
    }
    if (session.signal.aborted) return;
    updateAudioStatus();
    await preview.play();
    message('屏幕已准备好，可以生成 Offer。');
  } catch (error) { if (!session.signal.aborted) message('分享屏幕失败：' + error.message, true); }
  finally { if (!session.signal.aborted) { busy = false; hostButtons(); } }
});
createOfferBtn.addEventListener('click', async () => {
  if (busy || hostPc || !localStream) return;
  if (UI('applicationList')?.querySelector('input[type=checkbox]:disabled')) {message('请等待应用音频操作完成。',true);return;}
  const session = hostSession;
  busy = true; hostButtons();
  try {
    await settingsReady;
    hostPc = new RTCPeerConnection(PCSettings.iceConfig());
    const pc = hostPc;
    observePeer(pc, UI('hostStatus'), session.signal);
    let disconnectTimer;
    const releaseDisconnected = () => {
      if(session.signal.aborted)return;
      resetHost();message('连接已失效，已释放屏幕、麦克风与应用采集。Direct P2P failed. TURN relay may be required.',true);
    };
    pc.addEventListener('connectionstatechange',()=>{
      clearTimeout(disconnectTimer);
      if(pc.connectionState==='failed')releaseDisconnected();
      else if(pc.connectionState==='disconnected')disconnectTimer=setTimeout(releaseDisconnected,15000);
    },{signal:session.signal});
    session.signal.addEventListener('abort',()=>clearTimeout(disconnectTimer),{once:true});
    monitorPeer(pc, 'host', session.signal, () => localStream?.getVideoTracks()[0]);
    localStream.getVideoTracks().forEach(track => pc.addTrack(track, localStream));
    await addAudioSenders(pc, session.signal);
    if (session.signal.aborted) return;
    await pc.setLocalDescription(await pc.createOffer());
    assertDescription(pc, 'local', 'offer', 'have-local-offer');
    message('正在收集完整 ICE candidates…');
    await waitForIce(pc, session.signal);
    if (session.signal.aborted) return;
    await exportDescription({ type: pc.localDescription.type, sdp: pc.localDescription.sdp, peercast: { version: 2, audio: audioMetadata(), labels: window.applicationAudio?.labels() || {} } }, 'offerText', session.signal);
    if (session.signal.aborted) return;
    copyOfferBtn.disabled = false;
    message('Offer 已准备好，发送给 Viewer，然后粘贴其 Answer。');
  } catch (error) { if (!session.signal.aborted) message('生成 Offer 失败：' + error.message + '。请停止并重新分享。', true); }
  finally { if (!session.signal.aborted) { busy = false; hostButtons(); } }
});
setAnswerBtn.addEventListener('click', async () => {
  if (busy) return;
  const session = hostSession;
  busy = true; hostButtons();
  try {
    const answer = await decodeDescription(answerInput.value, 'answer');
    if (session.signal.aborted) return;
    if (!hostPc || !offerText.value) throw new Error('请先生成完整 Offer');
    assertDescription(hostPc, 'local', 'offer', 'have-local-offer');
    await hostPc.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
    assertDescription(hostPc, 'remote', 'answer', 'stable');
    message('Answer 已设置，等待 P2P 与媒体连接。');
  } catch (error) { if (!session.signal.aborted) message(error.message, true); }
  finally { if (!session.signal.aborted) { busy = false; hostButtons(); } }
});
copyOfferBtn.addEventListener('click', () => copyDescription('offerText'));
UI('stopBtn').addEventListener('click', () => { resetHost(); message('已停止并释放屏幕和连接。'); });
window.addEventListener('pagehide', resetHost);
hostButtons();
let audioRouter = new AudioRouter();
const audioSenders = new Map();
function updateAudioStatus() {
  for (const key of ['screen', 'mic']) {
    const source = audioRouter.sources.get(key);
    const live = audioRouter.live(key);
    UI(key + 'State').textContent = `${live ? 'available / live' : 'unavailable / disabled'}${source?.stream ? ' — ' + source.stream.getAudioTracks()[0].label : ''} | ${UI(key + 'Send').checked ? 'Send ON' : 'Send OFF'} | ${UI(key + 'Mute').checked ? 'muted' : 'unmuted'}`;
  }
  const video = localStream?.getVideoTracks()[0];
  UI('videoState').textContent = `Video Track: ${video?.readyState ?? 'none'}`;
}
async function applyAudio(key) {
  audioRouter.gain(key, UI(key + 'Mute').checked ? 0 : Number(UI(key + 'Gain').value) / 100);
  UI(key + 'Value').textContent = UI(key + 'Gain').value + '%';
  const sender = audioSenders.get(key)?.sender;
  if (sender) await sender.replaceTrack(UI(key + 'Send').checked && audioRouter.live(key) ? audioRouter.track(key) : null);
  updateAudioStatus();
}
async function addAudioSenders(pc, signal) {
  for (const key of ['screen', 'mic', ...(window.applicationAudio?.keys() || [])]) {
    if (signal.aborted) return;
    // Reserve a named m-line, allowing On/Off without renegotiation.
    const transceiver = pc.addTransceiver('audio', { direction: 'sendonly' });
    audioSenders.set(key, transceiver);
    await applyAudio(key);
  }
}
function audioMetadata() {
  return Object.fromEntries([...audioSenders].map(([key, transceiver]) => [key, transceiver.mid]));
}
for (const key of ['screen', 'mic']) {
  UI(key + 'Gain').addEventListener('input', () => {
    audioRouter.gain(key, UI(key + 'Mute').checked ? 0 : Number(UI(key + 'Gain').value) / 100);
    UI(key + 'Value').textContent = UI(key + 'Gain').value + '%';
  });
  UI(key + 'Mute').addEventListener('change', () => {
    audioRouter.gain(key, UI(key + 'Mute').checked ? 0 : Number(UI(key + 'Gain').value) / 100);
    updateAudioStatus();
  });
  UI(key + 'Send').addEventListener('change', async () => {
    const session = hostSession;
    const control = UI(key + 'Send');
    control.disabled = true;
    try { await applyAudio(key); }
    catch (error) { if (!session.signal.aborted) { control.checked = !control.checked; message('更改 Send 失败：' + error.message, true); updateAudioStatus(); } }
    finally { if (!session.signal.aborted) hostButtons(); }
  });
}
async function listMicrophones() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  await settingsReady;
  const selected = UI('micDevice').value || PCSettings.value.microphone;
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audioinput' && device.deviceId);
    UI('micDevice').replaceChildren(new Option('Default Microphone', ''));
    devices.forEach((device, index) => UI('micDevice').add(new Option(device.label || `Microphone ${index + 1}`, device.deviceId)));
    if ([...UI('micDevice').options].some(option => option.value === selected)) UI('micDevice').value = selected;
  } catch (error) { message('麦克风列表不可用：' + error.message, true); }
}
async function changeMicrophone(enable) {
  if (busy) return;
  const session = hostSession;
  const router = audioRouter;
  busy = true; hostButtons();
  let stream;
  try {
    if (enable) {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('麦克风不可用，请使用 localhost 或 HTTPS');
      const deviceId = UI('micDevice').value;
      stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true, video: false });
      if (session.signal.aborted) { stopStream(stream); return; }
      await router.input('mic', stream);
      if (session.signal.aborted) { router.close(); return; }
      stream.getAudioTracks()[0].addEventListener('ended', () => {
        if (session.signal.aborted || router.sources.get('mic')?.stream !== stream) return;
        router.off('mic'); applyAudio('mic').catch(error => message(error.message, true));
        UI('micOn').checked = false;
        message('麦克风已断开，可重新选择设备；视频继续。', true);
      }, { once: true });
    } else router.off('mic');
    await applyAudio('mic');
    if (session.signal.aborted) return;
    UI('micOn').checked = router.live('mic');
    await listMicrophones();
    if (session.signal.aborted) return;
    message(enable ? '麦克风已启用。' : '麦克风已关闭并释放；屏幕音频和视频继续。');
  } catch (error) {
    if (stream && router.sources.get('mic')?.stream !== stream) stopStream(stream);
    if (!session.signal.aborted) { UI('micOn').checked = router.live('mic'); message('麦克风操作失败：' + error.name + ' — ' + error.message, true); }
  } finally { if (!session.signal.aborted) { busy = false; hostButtons(); updateAudioStatus(); } }
}
UI('micOn').addEventListener('change', () => changeMicrophone(UI('micOn').checked));
UI('micDevice').addEventListener('change', () => { if (UI('micOn').checked) changeMicrophone(true); });
UI('refreshMic').addEventListener('click', listMicrophones);
navigator.mediaDevices?.addEventListener('devicechange', listMicrophones);
listMicrophones();
updateAudioStatus();

UI('copyRawBtn').addEventListener('click', () => copyDescription('rawSdp'));

settingsReady.then(settings => { UI('resolution').value=settings.resolution; UI('fps').value=settings.fps; UI('micDevice').value=settings.microphone; });
