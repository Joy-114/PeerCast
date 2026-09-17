'use strict';
// Development-only real WebRTC test. Capture is synthetic; this is not LAN/device acceptance.
const results = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const assert = (value, name) => { if (!value) throw new Error(name); results.push('PASS ' + name); };
async function until(test, name, timeout = 15000) {
  const start = Date.now();
  while (!await test()) { if (Date.now() - start > timeout) throw new Error('TIMEOUT ' + name); await pause(80); }
}
(async () => {
  await until(() => ['host', 'viewer'].every(id => {
    const doc = document.getElementById(id).contentDocument;
    return doc.readyState === 'complete' && doc.getElementById(id === 'host' ? 'shareBtn' : 'offerInput');
  }), 'pages load');
  const h = document.getElementById('host').contentWindow;
  const v = document.getElementById('viewer').contentWindow;
  const he = id => h.document.getElementById(id);
  const ve = id => v.document.getElementById(id);
  const errors = [];
  for (const id of ['host', 'viewer']) {
    const frame = document.getElementById(id);
    frame.style.width = '390px';
    assert(frame.contentDocument.documentElement.scrollWidth <= frame.contentWindow.innerWidth, id + ' mobile layout has no horizontal overflow');
    const ids = [...frame.contentDocument.querySelectorAll('[id]')].map(element => element.id);
    assert(new Set(ids).size === ids.length, id + ' has unique element IDs');
  }
  for (const w of [h, v]) {
    w.addEventListener('error', event => errors.push(event.message));
    w.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  }
  let withAudio = true;
  let captureDelay = 0;
  let denyMic = false;
  const contexts = [], tracks = [], timers = [];
  function tone(frequency) {
    const context = new h.AudioContext(); contexts.push(context);
    const oscillator = context.createOscillator(); oscillator.frequency.value = frequency;
    const gain = context.createGain(); gain.gain.value = 0.15;
    const destination = context.createMediaStreamDestination();
    oscillator.connect(gain).connect(destination); oscillator.start(); context.resume();
    tracks.push(...destination.stream.getTracks()); return destination.stream;
  }
  Object.defineProperty(h.navigator.mediaDevices, 'getDisplayMedia', { value: async () => {
    const canvas = h.document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
    let frame = 0; const draw = () => {const c = canvas.getContext('2d');c.fillStyle = frame++ % 2 ? '#237' : '#379';c.fillRect(0,0,640,360);c.fillStyle='white';c.font='40px sans-serif';c.fillText('PeerCast '+frame,30,100);};
    draw(); timers.push(setInterval(draw, 80)); const stream = canvas.captureStream(12);
    if (withAudio) stream.addTrack(tone(330).getAudioTracks()[0]);
    tracks.push(...stream.getTracks()); if (captureDelay) await pause(captureDelay); return stream;
  }});
  Object.defineProperty(h.navigator.mediaDevices, 'getUserMedia', { value: async () => {if (denyMic) throw new DOMException('Permission denied','NotAllowedError'); return tone(660);} });
  Object.defineProperty(h.navigator.mediaDevices, 'enumerateDevices', { value: async () => [{kind:'audioinput',deviceId:'mic-a',label:'Test Mic A'},{kind:'audioinput',deviceId:'mic-b',label:'Test Mic B'}] });
  const click = (element) => element.click();
  const change = (element, value) => {element.value=value;element.dispatchEvent(new Event('change'));};
  const input = (element, value) => {element.value=value;element.dispatchEvent(new Event('input'));};
  const hv = expression => h.eval(expression);
  const vv = expression => v.eval(expression);
  await hv('settingsReady'); await vv('settingsReady'); hv('PCSettings.value.stun = ""'); vv('PCSettings.value.stun = ""');
  async function connect() {
    click(he('createOfferBtn'));
    assert(he('offerText').value === '' && he('copyOfferBtn').disabled, 'Offer hidden during ICE collection');
    await until(() => he('offerText').value, 'Offer complete');
    const hostPc = hv('hostPc');
    assert(hostPc.iceGatheringState === 'complete', 'Host ICE complete before export');
    const offer = await h.decodeDescription(he('offerText').value, 'offer');
    const withoutMetadata = {...offer}; delete withoutMetadata.peercast;
    ve('offerInput').value = JSON.stringify(withoutMetadata); click(ve('createAnswerBtn')); await pause(30);
    assert(vv('viewerPc') === null && ve('message').textContent.includes('映射'), 'Viewer rejects missing audio map before creating peer');
    he('answerInput').value = JSON.stringify(offer); click(he('setAnswerBtn'));
    await until(() => !he('setAnswerBtn').disabled, 'wrong answer rejected');
    assert(hostPc === hv('hostPc') && hostPc.signalingState === 'have-local-offer', 'Host rejects Offer without changing peer');
    assert(he('message').textContent.includes('expected answer'), 'SDP type error visible');
    ve('offerInput').value = JSON.stringify(offer); click(ve('createAnswerBtn'));
    assert(!ve('answerText').value && ve('copyAnswerBtn').disabled, 'Answer hidden during ICE collection');
    await until(() => ve('answerText').value, 'Answer complete');
    assert(vv('viewerPc').iceGatheringState === 'complete', 'Viewer ICE complete before export');
    he('answerInput').value = ve('answerText').value; click(he('setAnswerBtn'));
    await until(() => hostPc.connectionState === 'connected' && vv('viewerPc').connectionState === 'connected', 'P2P connected');
    assert(hostPc === hv('hostPc') && hostPc.signalingState === 'stable' && vv('viewerPc').signalingState === 'stable', 'same peer and stable SDP on both roles');
    assert(['connected','completed'].includes(hostPc.iceConnectionState), 'ICE connected');
    await until(() => ve('remote').videoWidth > 0, 'decoded video');
    assert(ve('remote').srcObject.getAudioTracks().length === 0, 'video element receives video only');
    assert(ve('remote').videoWidth === 640, 'synthetic video decoded at expected width');
    assert(hostPc.getSenders().length === 3, 'exactly video plus two reserved audio senders');
    return hostPc;
  }
  try {
    ve('offerInput').value = '{"type":"answer","sdp":"v=0\\r\\nm=video"}';click(ve('createAnswerBtn'));
    await pause(50);assert(vv('viewerPc') === null, 'Viewer rejects Answer before creating peer');
    click(he('shareBtn'));await until(() => !he('createOfferBtn').disabled, 'capture ready');
    click(he('micOn'));await until(() => !he('micOn').disabled, 'microphone ready');
    let peer = await connect();
    await until(() => ve('screenAudio').srcObject && ve('micAudio').srcObject, 'two named remote audio tracks');
    assert(ve('screenAudio').srcObject.getAudioTracks()[0] !== ve('micAudio').srcObject.getAudioTracks()[0], 'distinct received audio sources');
    const analysis = new v.AudioContext(); contexts.push(analysis); await analysis.resume();
    const analyser = analysis.createAnalyser(); analyser.fftSize = 2048;
    analysis.createMediaStreamSource(ve('screenAudio').srcObject).connect(analyser);
    const rms = () => {const data = new Float32Array(2048);analyser.getFloatTimeDomainData(data);return Math.sqrt(data.reduce((s,n)=>s+n*n,0)/data.length);};
    await until(() => rms() > .01, 'remote audio energy');
    const before = rms(); input(he('screenGain'),'25'); await pause(700);
    assert(rms() < before*.45 && rms() > before*.1, 'Host gain changes actual received audio energy');
    click(he('screenMute'));await pause(700);assert(rms() < .001, 'Host mute silences received source');click(he('screenMute'));
    input(ve('micVolume'),'35');assert(ve('micAudio').volume === .35 && he('micGain').value === '100', 'Viewer volume independent from Host');
    click(he('screenSend')); await until(() => !he('screenSend').disabled, 'screen send off');
    assert(hv("audioSenders.get('screen').sender.track") === null && hv("audioSenders.get('mic').sender.track") !== null, 'Send OFF detaches only selected source');
    click(he('screenSend')); await until(() => !he('screenSend').disabled, 'screen send on');
    await until(() => rms() > .003, 'audio restored without negotiation');
    const oldMic = hv("audioRouter.sources.get('mic').stream.getAudioTracks()[0]");
    change(he('micDevice'),'mic-b');await until(() => !he('micOn').disabled, 'switch microphone');
    assert(oldMic.readyState === 'ended' && peer.getSenders().length === 3, 'mic switch stops old track without extra sender');
    click(he('micOn'));await until(() => !he('micOn').disabled, 'mic off');
    assert(hv("audioSenders.get('mic').sender.track") === null && peer.connectionState === 'connected', 'mic off preserves P2P');
    click(he('micOn'));await until(() => !he('micOn').disabled, 'mic on');
    assert(hv("audioSenders.get('mic').sender.track") !== null, 'mic on reuses negotiated sender');
    click(he('stopBtn'));click(ve('resetBtn'));
    assert(peer.connectionState === 'closed' && tracks.every(track => track.readyState === 'ended'), 'reset closes peer and capture tracks');
    assert(hv('audioRouter.context') === null && vv('statsTimer') === null, 'reset releases audio context and stats timer');
    withAudio = false;
    click(he('shareBtn'));await until(() => !he('createOfferBtn').disabled, 'video-only capture ready');
    assert(he('audioStatus').textContent.includes('未捕获'), 'missing screen audio is nonfatal and visible');
    peer = await connect();
    assert(peer.connectionState === 'connected', 'video-only capture connects successfully');
    denyMic = true;click(he('micOn'));await until(() => !he('micOn').disabled, 'microphone denied');
    assert(!he('micOn').checked && peer.connectionState === 'connected' && he('message').textContent.includes('NotAllowedError'), 'microphone denial leaves video connected');
    denyMic = false;
    click(he('micOn'));await until(() => !he('micOn').disabled, 'late microphone enable');
    assert(hv("audioSenders.get('mic').sender.track") !== null && peer.signalingState === 'stable', 'late microphone starts without renegotiation');
    click(he('stopBtn'));click(ve('resetBtn'));
    // Abort a pending capture: late permission completion must not leak a track.
    captureDelay = 200;click(he('shareBtn'));click(he('stopBtn'));await pause(300);
    assert(tracks.every(track => track.readyState === 'ended') && hv('localStream') === null, 'late capture after reset is stopped');
    assert(he('offerText').value === '' && ve('answerText').value === '', 'reset invalidates exported SDP');
    const failedPlay = {srcObject: {}, play: () => Promise.reject(new DOMException('blocked','NotAllowedError'))};
    await v.playMedia(failedPlay);
    assert(ve('message').textContent.includes('播放失败'), 'autoplay rejection is visible');
    if (typeof ve('screenAudio').setSinkId === 'function') {
      await v.setOutput('');
      assert(ve('outputStatus').textContent.includes('已更新'), 'default setSinkId applies to both audio elements');
      await v.setOutput('invalid-device-for-test');
      assert(ve('outputStatus').textContent.includes('切换失败'), 'invalid output device fails visibly without losing video flow');
    }
    const savedSink = v.HTMLMediaElement.prototype.setSinkId;
    v.HTMLMediaElement.prototype.setSinkId = undefined; await v.listOutputs();
    assert(ve('outputDevice').disabled && ve('outputStatus').textContent.includes('默认'), 'unsupported audio output degrades to default');
    v.HTMLMediaElement.prototype.setSinkId = savedSink;
    assert(errors.length === 0, 'no runtime errors or unhandled promises: '+errors.join(';'));
  } finally {timers.forEach(clearInterval);tracks.forEach(track=>track.stop());await Promise.all(contexts.map(context=>context.close()));}
})().then(() => finish(true)).catch(error => {results.push('FAIL '+error.stack);finish(false);});
async function finish(ok) { document.getElementById('result').textContent = JSON.stringify({ok,results},null,2); await fetch('/__report',{method:'POST',body:JSON.stringify({ok,results})}); }
