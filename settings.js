'use strict';
const SETTINGS_DEFAULTS = Object.freeze({resolution:'auto',fps:30,microphone:'',output:'',role:'home',startup:false,closeBehavior:'exit',stun:'stun:stun.l.google.com:19302',turn:'',turnUser:'',turnPassword:'',relayOnly:false});
const PCSettings = {
  value: {...SETTINGS_DEFAULTS},
  validate(value) {
    const out={...SETTINGS_DEFAULTS,...value};
    if (!['auto','720','1080','native'].includes(out.resolution) || ![30,60].includes(Number(out.fps)) || !['home','host','viewer'].includes(out.role) || !['exit','tray'].includes(out.closeBehavior)) throw new Error('设置值无效');
    out.fps=Number(out.fps);
    for (const key of ['microphone','output','stun','turn','turnUser','turnPassword']) if(typeof out[key]!=='string'||out[key].length>2048) throw new Error('设置字段无效：'+key);
    if (out.stun && !/^stuns?:[^\s]+$/.test(out.stun)) throw new Error('STUN 地址无效');
    if (out.turn && !/^turns?:[^\s]+$/.test(out.turn)) throw new Error('TURN 地址无效');
    if (out.relayOnly && !out.turn) throw new Error('Relay only 需要配置 TURN');
    out.startup=out.startup===true;out.relayOnly=out.relayOnly===true;
    return Object.fromEntries(Object.keys(SETTINGS_DEFAULTS).map(key=>[key,out[key]]));
  },
  async load() {
    try { this.value=this.validate(window.peerCastDesktop ? await window.peerCastDesktop.getSettings() : JSON.parse(localStorage.getItem('peercast.settings')||'{}')); }
    catch(error) {this.value={...SETTINGS_DEFAULTS};if(UI('message')) message('设置读取失败，使用默认值：'+error.message,true);}
    return this.value;
  },
  async save(value) {
    const validated=this.validate(value);
    if (window.peerCastDesktop) await window.peerCastDesktop.saveSettings(validated);
    else localStorage.setItem('peercast.settings',JSON.stringify(validated));
    this.value=validated;
  },
  iceConfig() {
    const servers=[];const s=this.value;
    if(s.stun)servers.push({urls:s.stun});
    if(s.turn)servers.push({urls:s.turn,username:s.turnUser,credential:s.turnPassword});
    return {iceServers:servers,iceTransportPolicy:s.relayOnly?'relay':'all'};
  }
};
const settingsReady=PCSettings.load();
function captureConstraints() {
  const resolution=UI('resolution').value;const fps=Number(UI('fps').value);
  const video={frameRate:{ideal:fps,max:fps}};
  if(resolution==='720'||resolution==='1080') {video.width={ideal:resolution==='720'?1280:1920};video.height={ideal:Number(resolution)};}
  return {video,audio:true};
}
