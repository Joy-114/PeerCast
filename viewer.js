'use strict';
const offerInput = UI('offerInput');
const createAnswerBtn = UI('createAnswerBtn');
const copyAnswerBtn = UI('copyAnswerBtn');
const answerText = UI('answerText');
const remote = UI('remote');
let viewerPc = null;
let viewerSession = new AbortController();
let statsTimer = null;
let busy = false;
async function playMedia(element) {
  if (!element.srcObject) return;
  const session = viewerSession;
  try { await element.play(); }
  catch (error) { if (!session.signal.aborted) message(`播放失败 (${error.name})：请点击“播放 / 启用声音”。`, true); }
}
function resetViewer() {
  viewerSession.abort(); viewerSession = new AbortController();
  clearInterval(statsTimer); statsTimer = null;
  viewerPc?.close(); viewerPc = null;
  stopStream(remote.srcObject); remote.srcObject = null;
  for (const key of ['screen', 'mic', ...receivedApps]) {
    const element = UI(key + 'Audio');
    element.pause(); stopStream(element.srcObject); element.srcObject = null;
    UI(key + 'State').textContent = '尚未收到音轨';
  }
  for (const key of receivedApps) UI(key+'Row')?.remove();
  receivedApps.clear();audioElements.splice(2);
  answerText.value = ''; copyAnswerBtn.disabled = true;
  UI('rawSdp').value = ''; UI('compressionStats').textContent = '';
  UI('route').textContent = 'Connection Route: Unknown'; UI('performance').textContent = '等待连接统计';
  busy = false; createAnswerBtn.disabled = false;
  describePeer(null, UI('status'));
  UI('mediaStatus').textContent = 'Video Track: none — 尚未收到画面';
}
createAnswerBtn.addEventListener('click', async () => {
  if (busy || viewerPc) return;
  const session = viewerSession;
  busy = true; createAnswerBtn.disabled = true;
  try {
    await settingsReady;
    const offer = await decodeDescription(offerInput.value, 'offer');
    if (session.signal.aborted) return;
    const audioMap = validateAudioMap(offer);
    await prepareApplicationSources(offer,audioMap);
    if (session.signal.aborted) return;
    viewerPc = new RTCPeerConnection(PCSettings.iceConfig());
    const pc = viewerPc;
    observePeer(pc, UI('status'), session.signal);
    monitorPeer(pc, 'viewer', session.signal);
    pc.ontrack = event => {
      if (session.signal.aborted) return;
      if (event.track.kind === 'video') {
        remote.srcObject = new MediaStream([event.track]);
        playMedia(remote);
      } else {
        const key = Object.keys(audioMap).find(name => audioMap[name] === event.transceiver.mid);
        if (!key) { message('收到无法识别来源的音轨，已停止播放该轨道。请使用本版本 Host 的完整 Offer JSON。', true); return; }
        const element = UI(key + 'Audio');
        element.srcObject = new MediaStream([event.track]);
        const update = () => { UI(key + 'State').textContent = `Track: ${event.track.readyState} | ${event.track.muted ? '等待音频数据' : '已接收音轨（不代表有声）'}`; };
        for (const name of ['mute', 'unmute', 'ended']) event.track.addEventListener(name, update, { signal: session.signal });
        update(); playMedia(element);
      }
    };
    await pc.setRemoteDescription({ type: offer.type, sdp: offer.sdp });
    assertDescription(pc, 'remote', 'offer', 'have-remote-offer');
    await pc.setLocalDescription(await pc.createAnswer());
    assertDescription(pc, 'local', 'answer', 'stable');
    message('正在收集完整 ICE candidates…');
    await waitForIce(pc, session.signal);
    if (session.signal.aborted) return;
    await exportDescription({type:pc.localDescription.type,sdp:pc.localDescription.sdp}, 'answerText', session.signal);
    if (session.signal.aborted) return;
    copyAnswerBtn.disabled = false;
    message('Answer 已准备好，请复制给 Host。');
    statsTimer = setInterval(async () => {
      try {
        const stats = await pc.getStats();
        if (session.signal.aborted) return;
        let video;
        stats.forEach(report => { if (report.type === 'inbound-rtp' && report.kind === 'video') video = report; });
        const track = remote.srcObject?.getVideoTracks()[0];
        UI('mediaStatus').textContent = `Video Track: ${track?.readyState ?? 'none'} | muted: ${track?.muted ?? '-'} | bytes: ${video?.bytesReceived ?? 0} | framesDecoded: ${video?.framesDecoded ?? 0} | ${remote.videoWidth}×${remote.videoHeight} | ${remote.paused ? '暂停' : '播放中'}${!video?.framesDecoded ? ' — 尚未解码画面，请检查 Host 分享和网络' : ''}`;
      } catch (error) { if (!session.signal.aborted) UI('mediaStatus').textContent = '媒体诊断失败：' + error.message; }
    }, 1000);
  } catch (error) { if (!session.signal.aborted) message('生成 Answer 失败：' + error.message + (viewerPc ? '。请重置后重试。' : ''), true); }
  finally { if (!session.signal.aborted) { busy = false; createAnswerBtn.disabled = !!viewerPc; } }
});
copyAnswerBtn.addEventListener('click', () => copyDescription('answerText'));
UI('resetBtn').addEventListener('click', () => { resetViewer(); message('已重置；请粘贴 Host 新生成的 Offer。'); });
UI('playBtn').addEventListener('click', () => {
  message('正在尝试播放视频与音频。');
  for (const element of [remote, ...audioElements]) playMedia(element);
});
remote.addEventListener('error', () => message('视频播放失败：' + (remote.error?.message || '未知媒体错误'), true));
window.addEventListener('pagehide', resetViewer);

function validateAudioMap(offer) {
  const sections = offer.sdp.split(/\r?\nm=/).slice(1);
  const audioMids = sections.filter(section => section.startsWith('audio ')).map(section => section.match(/(?:^|\r?\n)a=mid:([^\r\n]+)/)?.[1]);
  if (!audioMids.length) return {};
  const map = offer.peercast?.audio;
  if (![1,2].includes(offer.peercast?.version) || !map || typeof map !== 'object' || Array.isArray(map) ||
      Object.keys(map).length>10 || Object.keys(map).some(key => !['screen', 'mic'].includes(key) && !/^app_[1-9][0-9]{0,9}$/.test(key)) ||
      Object.values(map).some(mid => typeof mid !== 'string' || !audioMids.includes(mid)) ||
      new Set(Object.values(map)).size !== Object.values(map).length ||
      audioMids.some(mid => !Object.values(map).includes(mid))) {
    throw new Error('音轨来源映射缺失或无效，请复制本版本 Host 的完整 Offer JSON（含 peercast 字段）');
  }
  return map;
}
const audioElements = [UI('screenAudio'), UI('micAudio')];
for (const key of ['screen', 'mic']) {
  UI(key + 'Volume').addEventListener('input', () => {
    UI(key + 'Audio').volume = Number(UI(key + 'Volume').value) / 100;
    UI(key + 'Value').textContent = UI(key + 'Volume').value + '%';
  });
  UI(key + 'Audio').addEventListener('error', () => message(key + ' 音频播放失败，请检查输出设备并点击播放。', true));
}
let sinkId = '';
async function listOutputs() {
  if (!window.isSecureContext || !audioElements.every(element => typeof element.setSinkId === 'function') || !navigator.mediaDevices?.enumerateDevices) {
    UI('outputDevice').disabled = true; UI('chooseOutput').disabled = true;
    UI('outputStatus').textContent = '当前浏览器或页面不支持选择输出设备；使用系统默认输出。设备选择需要安全上下文。';
    return;
  }
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'audiooutput' && device.deviceId);
    UI('outputDevice').replaceChildren(new Option('Default — 系统默认输出', ''));
    devices.forEach((device, index) => UI('outputDevice').add(new Option(device.label || `Output ${index + 1}`, device.deviceId)));
    UI('outputDevice').value = sinkId;
    UI('outputStatus').textContent = '仅列出浏览器允许访问的设备；更多设备可使用系统声音设置。';
  } catch (error) { UI('outputStatus').textContent = '无法列出输出设备，默认播放仍可用：' + error.message; }
}
async function setOutput(id) {
  UI('outputDevice').disabled = true; UI('chooseOutput').disabled = true;
  const previous = sinkId;
  const results = await Promise.allSettled(audioElements.map(element => element.setSinkId(id)));
  if (results.some(result => result.status === 'rejected')) {
    const rollback = await Promise.allSettled(audioElements.map(element => element.setSinkId(previous)));
    UI('outputStatus').textContent = '输出设备切换失败：' + results.find(result => result.status === 'rejected').reason.message + (rollback.some(result => result.status === 'rejected') ? '；恢复旧设备失败，请选择 Default。' : '；已恢复原输出。');
  } else { sinkId = id; UI('outputStatus').textContent = '两路音频输出设备已更新。'; }
  UI('outputDevice').value = sinkId;
  UI('outputDevice').disabled = false; UI('chooseOutput').disabled = false;
}
UI('outputDevice').addEventListener('change', () => setOutput(UI('outputDevice').value));
UI('chooseOutput').addEventListener('click', async () => {
  try {
    if (navigator.mediaDevices.selectAudioOutput) {
      const device = await navigator.mediaDevices.selectAudioOutput();
      if (![...UI('outputDevice').options].some(option => option.value === device.deviceId)) UI('outputDevice').add(new Option(device.label || 'Selected output', device.deviceId));
      await setOutput(device.deviceId);
    } else await listOutputs();
  } catch (error) { UI('outputStatus').textContent = '输出设备选择已取消或未授权：' + error.message; }
});
navigator.mediaDevices?.addEventListener('devicechange', listOutputs);
listOutputs();

UI('copyRawBtn').addEventListener('click', () => copyDescription('rawSdp'));

const receivedApps=new Set();
async function prepareApplicationSources(offer,map){
 const keys=Object.keys(map).filter(key=>key.startsWith('app_'));
 for(const key of keys){const name=offer.peercast?.labels?.[key];if(typeof name!=='string'||!name.trim()||name.length>120)throw Error('Application audio label missing or invalid');}
 for(const key of keys){
  const name=offer.peercast?.labels?.[key];if(typeof name!=='string'||name.length>120)throw Error('Application audio label missing or invalid');
  const row=document.createElement('fieldset');row.id=key+'Row';const title=document.createElement('legend');title.textContent=name;const state=document.createElement('p');state.id=key+'State';state.textContent='等待音轨';const label=document.createElement('label');label.textContent='本地音量 ';label.htmlFor=key+'Volume';const value=document.createElement('output');value.textContent='100%';label.append(value);const slider=document.createElement('input');slider.id=key+'Volume';slider.type='range';slider.min='0';slider.max='100';slider.value='100';const audio=document.createElement('audio');audio.id=key+'Audio';audio.autoplay=true;slider.addEventListener('input',()=>{audio.volume=Number(slider.value)/100;value.textContent=slider.value+'%';});audio.addEventListener('error',()=>message(name+' 播放失败',true));row.append(title,state,label,slider,audio);UI('receivedApplications').append(row);receivedApps.add(key);audioElements.push(audio);
  if(sinkId&&typeof audio.setSinkId==='function')try{await audio.setSinkId(sinkId);}catch(error){message('应用音频输出设备失败，使用默认输出：'+error.message,true);}
 }
}
settingsReady.then(async settings=>{await listOutputs();if(settings.output&&typeof audioElements[0].setSinkId==='function')await setOutput(settings.output);});
