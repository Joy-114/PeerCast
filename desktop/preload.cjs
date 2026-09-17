'use strict';
const {contextBridge,ipcRenderer}=require('electron');
const subscribe=(channel,callback)=>{const handler=(_,data)=>{try{callback(data);}finally{if(channel==='native-pcm')ipcRenderer.send('native-ack',data.pid);}};ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
contextBridge.exposeInMainWorld('peerCastDesktop',{
 getSettings:()=>ipcRenderer.invoke('settings-get'),saveSettings:value=>ipcRenderer.invoke('settings-save',value),
 sources:()=>ipcRenderer.invoke('screen-sources'),chooseSource:(id,audio)=>ipcRenderer.invoke('screen-select',id,audio),
 capabilities:()=>ipcRenderer.invoke('native-capabilities'),listAudioApplications:()=>ipcRenderer.invoke('native-list'),
 startApplicationCapture:(pid,identity)=>ipcRenderer.invoke('native-start',pid,identity),stopApplicationCapture:pid=>ipcRenderer.invoke('native-stop',pid),stopAllCapture:()=>ipcRenderer.send('native-stop-all'),
 onPcm:callback=>subscribe('native-pcm',callback),onStatus:callback=>subscribe('native-status',callback),
 version:()=>ipcRenderer.invoke('version')
});
window.addEventListener('beforeunload',()=>ipcRenderer.send('native-stop-all'));
