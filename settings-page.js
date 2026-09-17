'use strict';
(async()=>{
 const settings=await settingsReady;
 for(const key of Object.keys(SETTINGS_DEFAULTS)) {const el=UI(key);if(!el)continue;if(el.type==='checkbox')el.checked=settings[key];else el.value=settings[key];}
 if(!window.peerCastDesktop){UI('startup').disabled=true;UI('closeBehavior').disabled=true;UI('desktopSettingsNote').textContent='开机启动与托盘仅适用于 Windows 桌面版。';}
 UI('saveSettings').addEventListener('click',async()=>{try{const next={};for(const key of Object.keys(SETTINGS_DEFAULTS)){const el=UI(key);next[key]=el.type==='checkbox'?el.checked:el.value;}await PCSettings.save(next);message('设置已保存。质量与网络设置在下次连接时生效。');}catch(error){message('保存失败：'+error.message,true);}});
 for(const [id,kind] of [['microphone','audioinput'],['output','audiooutput']])try{const devices=await navigator.mediaDevices?.enumerateDevices()||[];for(const device of devices.filter(d=>d.kind===kind&&d.deviceId))UI(id).add(new Option(device.label||device.deviceId,device.deviceId));if(settings[id]&&![...UI(id).options].some(o=>o.value===settings[id]))UI(id).add(new Option('已保存设备（当前不可用）',settings[id]));UI(id).value=settings[id];}catch{}
})();
