'use strict';
async function selectDesktopScreen(){
 if(!window.peerCastDesktop)return true;
 const sources=await window.peerCastDesktop.sources();const dialog=UI('screenPicker');const list=UI('screenSources');list.replaceChildren();
 return new Promise(resolve=>{
  let done=false;const finish=value=>{if(done)return;done=true;dialog.removeEventListener('close',cancel);dialog.close();resolve(value);};const cancel=()=>finish(false);
  dialog.addEventListener('close',cancel,{once:true});
  for(const source of sources){const button=document.createElement('button');const img=document.createElement('img');img.src=source.thumbnail;img.alt='';const label=document.createElement('span');label.textContent=source.name;button.append(img,label);button.addEventListener('click',async()=>{try{await window.peerCastDesktop.chooseSource(source.id,UI('desktopSystemAudio').checked);finish(true);}catch(error){message(error.message,true);finish(false);}});list.append(button);}
  UI('cancelScreenPicker').onclick=()=>finish(false);dialog.showModal();
 });
}
const applicationAudio={
 entries:new Map(),generation:0,
 keys(){return [...this.entries.keys()];},
 labels(){return Object.fromEntries([...this.entries].map(([key,entry])=>[key,entry.app.name.slice(0,120)]));},
 reset(){this.generation++;window.peerCastDesktop?.stopAllCapture();for(const [key,entry] of this.entries){entry.node?.port.close();entry.node=null;UI(key+'Send').checked=false;UI(key+'State').textContent='Stopped';}this.entries.clear();UI('applicationList')?.replaceChildren();},
 async toggle(app,key){
  const control=UI(key+'Send');const generation=this.generation;control.disabled=true;
  try{
   if(control.checked){
    if(hostPc&&!audioSenders.has(key))throw new Error('新增应用需要停止当前连接，并在生成 Offer 前选择应用。');
    if(!this.entries.has(key)&&this.entries.size>=8)throw new Error('最多选择 8 个独立应用');
    // Prevent mixed System Audio from leaking an excluded application.
    UI('screenSend').checked=false;await applyAudio('screen');
    const node=await audioRouter.nativeInput(key);if(generation!==this.generation){node.port.close();return;}
    this.entries.set(key,{app,node});
    await window.peerCastDesktop.startApplicationCapture(app.pid,app.identity);
    if(generation!==this.generation){window.peerCastDesktop.stopApplicationCapture(app.pid);return;}
    await applyAudio(key);UI(key+'State').textContent='Native process capture active';message('应用音频正在捕获。System Audio Send 已关闭，避免混入未选择的应用。');
   }else{await applyAudio(key);await window.peerCastDesktop.stopApplicationCapture(app.pid);audioRouter.off(key);this.entries.get(key)?.node?.port.close();UI(key+'State').textContent='Send OFF — capture released';}
  }catch(error){if(generation===this.generation){control.checked=false;audioRouter.off(key);message(error.message,true);UI(key+'State').textContent='Capture failed: '+error.message;}}
  finally{if(generation===this.generation)control.disabled=false;}
 },
 async refresh(){
  if(!window.peerCastDesktop)return;
  if(this.refreshing)return;
  this.refreshing=true;
  const generation=this.generation;
  try{
   const apps=await window.peerCastDesktop.listAudioApplications();const list=UI('applicationList');
   if(generation!==this.generation)return;
   for(const app of apps){const key='app_'+app.pid;let row=UI(key+'Row');if(row){const entry=this.entries.get(key);if(entry&&entry.app.identity!==app.identity){UI(key+'State').textContent='Application restarted — stop/reconnect to select new PID identity';continue;}UI(key+'Activity').textContent=app.active?`Session active · peak ${(app.peak*100).toFixed(1)}%`:'Session inactive';continue;}
    row=document.createElement('fieldset');row.id=key+'Row';row.className='app-source';const title=document.createElement('legend');title.textContent=app.name;const info=document.createElement('p');info.textContent=app.processName;const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Developer';const pid=document.createElement('p');pid.textContent='PID: '+app.pid;details.append(summary,pid);row.append(title,info,details);
    const activity=document.createElement('p');activity.id=key+'Activity';activity.textContent=app.active?'Session active':'Session inactive';row.append(activity);
    for(const name of ['Send','Mute']){const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.id=key+name;label.append(input,document.createTextNode(' '+name));input.addEventListener('change',()=>name==='Send'?this.toggle(app,key):applyAudio(key).catch(error=>message(error.message,true)));row.append(label);}
    const volumeLabel=document.createElement('label');volumeLabel.htmlFor=key+'Gain';volumeLabel.textContent='发送音量 ';const output=document.createElement('output');output.id=key+'Value';output.textContent='100%';volumeLabel.append(output);const gain=document.createElement('input');gain.id=key+'Gain';gain.type='range';gain.min='0';gain.max='100';gain.value='100';gain.addEventListener('input',()=>applyAudio(key).catch(error=>message(error.message,true)));const state=document.createElement('p');state.id=key+'State';state.textContent='Send OFF';row.append(volumeLabel,gain,state);list.append(row);
   }
   for(const [key,entry] of this.entries)if(!apps.some(app=>app.pid===entry.app.pid&&app.identity===entry.app.identity)){await window.peerCastDesktop.stopApplicationCapture(entry.app.pid);audioRouter.off(key);UI(key+'Send').checked=false;await applyAudio(key);UI(key+'State').textContent='Application closed / session ended';}
   UI('applicationStatus').textContent=apps.length?`发现 ${apps.length} 个真实音频会话；生成 Offer 前选择应用。`:'当前没有可用音频应用；先让目标应用播放声音，再刷新。';
  }catch(error){UI('applicationStatus').textContent='应用枚举失败：'+error.message;}
  finally{this.refreshing=false;}
 }
};
window.applicationAudio=applicationAudio;
if(window.peerCastDesktop){
 UI('message').textContent='选择要分享的屏幕或窗口，再选择声音来源。';
 UI('refreshApps').hidden=false;
 window.peerCastDesktop.capabilities().then(capability=>{UI('applicationStatus').textContent=capability.supported?'WASAPI Process Loopback available · Windows process tree capture':'当前 Windows 不支持 Process Loopback；使用 System Audio fallback。';UI('refreshApps').disabled=!capability.supported;}).catch(error=>UI('applicationStatus').textContent='Native module unavailable: '+error.message);
 UI('refreshApps').addEventListener('click',()=>applicationAudio.refresh());
 const refreshTimer=setInterval(()=>{if(applicationAudio.entries.size)applicationAudio.refresh();},3000);
 const offPcm=window.peerCastDesktop.onPcm(({pid,pcm})=>{const entry=applicationAudio.entries.get('app_'+pid);if(entry?.node&&UI('app_'+pid+'Send').checked)entry.node.port.postMessage(pcm);});
 const offStatus=window.peerCastDesktop.onStatus(({pid,status,message:detail})=>{const key='app_'+pid;if(!UI(key+'State'))return;if(['error','closed','stopped'].includes(status)){UI(key+'Send').checked=false;audioRouter.off(key);applyAudio(key).catch(()=>{});UI(key+'State').textContent=detail||status;}});
 window.addEventListener('pagehide',()=>{clearInterval(refreshTimer);applicationAudio.reset();offPcm();offStatus();});
 UI('screenSend').addEventListener('change',()=>{if(UI('screenSend').checked&&applicationAudio.entries.size)message('警告：System Audio 是混音，开启后可能包含你未选择发送的应用。',true);});
}
