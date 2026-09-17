'use strict';
const {app,BrowserWindow,ipcMain,desktopCapturer,session,dialog,Tray,Menu,nativeImage,safeStorage}=require('electron');
const fs=require('node:fs');const path=require('node:path');const {fileURLToPath}=require('node:url');
const {NativeAudio}=require('./native.cjs');
const root=path.resolve(__dirname,'..');const allowed=new Set(['index.html','host.html','viewer.html','settings.html','about.html']);
let window,tray,quitting=false,choice=null,native;let config={};
const configFile=()=>path.join(app.getPath('userData'),'settings.json');
function trusted(event,hostOnly=false){const frame=event.senderFrame;if(!window||event.sender!==window.webContents||frame!==window.webContents.mainFrame)throw Error('Untrusted IPC');const file=fileURLToPath(frame.url);if(path.dirname(file)!==root||!allowed.has(path.basename(file))||(hostOnly&&path.basename(file)!=='host.html'))throw Error('Invalid IPC page');}
function loadSettings(){try{config=JSON.parse(fs.readFileSync(configFile(),'utf8'));if(config.encryptedTurn){config.turnPassword=safeStorage.decryptString(Buffer.from(config.encryptedTurn,'base64'));delete config.encryptedTurn;}}catch{config={};}return {...config,startup:app.getLoginItemSettings().openAtLogin};}
function validate(value){if(!value||typeof value!=='object')throw Error('Invalid settings');const out={};for(const key of ['resolution','fps','microphone','output','role','startup','closeBehavior','stun','turn','turnUser','turnPassword','relayOnly']){const x=value[key];if(typeof x==='string'&&x.length>2048)throw Error('Setting too long');out[key]=x;}if(!['auto','720','1080','native'].includes(out.resolution)||![30,60].includes(out.fps)||!['home','host','viewer'].includes(out.role)||!['exit','tray'].includes(out.closeBehavior)||typeof out.startup!=='boolean'||typeof out.relayOnly!=='boolean')throw Error('Invalid settings');for(const key of ['microphone','output','stun','turn','turnUser','turnPassword'])if(typeof out[key]!=='string')throw Error('Invalid setting '+key);if(out.stun&&!/^stuns?:[^\s]+$/.test(out.stun))throw Error('Invalid STUN URL');if(out.turn&&!/^turns?:[^\s]+$/.test(out.turn))throw Error('Invalid TURN URL');if(out.relayOnly&&!out.turn)throw Error('TURN required');return out;}
function saveSettings(value){const next=validate(value);const disk={...next};if(disk.turnPassword){if(!safeStorage.isEncryptionAvailable())throw Error('Windows credential encryption unavailable');disk.encryptedTurn=safeStorage.encryptString(disk.turnPassword).toString('base64');}delete disk.turnPassword;fs.mkdirSync(path.dirname(configFile()),{recursive:true});fs.writeFileSync(configFile()+'.tmp',JSON.stringify(disk));fs.renameSync(configFile()+'.tmp',configFile());app.setLoginItemSettings({openAtLogin:next.startup,path:app.getPath('exe'),args:[]});config=next;return true;}
function navigate(page){if(!allowed.has(page))return;native?.stopAll();choice=null;window.show();window.loadFile(path.join(root,page));}
function createWindow(){window=new BrowserWindow({width:1280,height:900,minWidth:420,minHeight:600,backgroundColor:'#0c1017',title:'PeerCast',icon:path.join(__dirname,'icon.ico'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});window.setMenuBarVisibility(false);
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 window.webContents.on('will-navigate',(event,url)=>{try{const p=fileURLToPath(url);if(path.dirname(p)!==root||!allowed.has(path.basename(p)))event.preventDefault();}catch{event.preventDefault();}});
 window.webContents.on('did-start-navigation',(_,url,inPlace,isMain)=>{if(isMain&&!inPlace){native?.stopAll();choice=null;}});
 window.webContents.on('render-process-gone',()=>native?.stopAll());
 window.on('close',event=>{native?.stopAll();if(!quitting&&config.closeBehavior==='tray'&&tray){event.preventDefault();window.loadFile(path.join(root,'index.html'));window.hide();}});
 const icon=nativeImage.createFromPath(path.join(__dirname,'icon.ico'));tray=new Tray(icon);tray.setToolTip('PeerCast');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open PeerCast',click:()=>navigate('index.html')},{label:'Host',click:()=>navigate('host.html')},{label:'Viewer',click:()=>navigate('viewer.html')},{label:'Settings',click:()=>navigate('settings.html')},{type:'separator'},{label:'Quit',click:()=>{quitting=true;app.quit();}}]));tray.on('double-click',()=>window.show());
 const role=config.role;window.loadFile(path.join(root,role==='host'?'host.html':role==='viewer'?'viewer.html':'index.html'));
}
if(!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',()=>{if(window){window.show();window.focus();}});
 app.whenReady().then(()=>{
  app.setAppUserModelId('org.peercast.desktop');loadSettings();
  const executable=app.isPackaged?path.join(process.resourcesPath,'native','PeerCast.Audio.exe'):path.join(root,'native','PeerCast.Audio','bin','Release','net8.0','win-x64','publish','PeerCast.Audio.exe');
  native=new NativeAudio(executable,(channel,data)=>{if(window&&!window.isDestroyed())window.webContents.send(channel,data);});
  const handle=(name,fn,host=false)=>ipcMain.handle(name,(event,...args)=>{trusted(event,host);return fn(...args);});
  handle('settings-get',()=>loadSettings());handle('settings-save',saveSettings);handle('version',()=>app.getVersion());
  handle('screen-sources',async()=>{const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:180,height:100}});return sources.map(s=>({id:s.id,name:s.name,thumbnail:s.thumbnail.toDataURL()}));},true);
  handle('screen-select',async(id,audio)=>{const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});if(!sources.some(s=>s.id===id)||typeof audio!=='boolean')throw Error('Invalid capture source');choice={id,audio,expires:Date.now()+30000};},true);
  session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{const selected=choice;choice=null;try{if(!window||request.frame!==window.webContents.mainFrame||!request.userGesture||!selected||selected.expires<Date.now())return callback({});const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:0,height:0}});const source=sources.find(s=>s.id===selected.id);if(!source)return callback({});callback(selected.audio?{video:source,audio:'loopback'}:{video:source});}catch{callback({});}});
  session.defaultSession.setPermissionCheckHandler((contents,permission)=>contents===window?.webContents&&['media','display-capture','speaker-selection'].includes(permission));
  session.defaultSession.setPermissionRequestHandler(async(contents,permission,callback)=>{if(contents!==window?.webContents)return callback(false);if(permission==='media'){const answer=await dialog.showMessageBox(window,{type:'question',buttons:['拒绝','允许麦克风'],defaultId:0,cancelId:0,message:'允许 PeerCast 使用麦克风？',detail:'仅在你开启 Microphone 时采集；关闭会释放设备。'});return callback(answer.response===1);}callback(['display-capture','speaker-selection'].includes(permission));});
  handle('native-capabilities',()=>native.query('--capabilities'),true);handle('native-list',()=>native.query('--list'),true);handle('native-start',(pid,identity)=>native.start(pid,identity),true);handle('native-stop',pid=>native.stop(pid),true);
  ipcMain.on('native-ack',(event,pid)=>{try{trusted(event,true);native.ack(pid);}catch{}});ipcMain.on('native-stop-all',event=>{try{trusted(event);native.stopAll();}catch{}});
  createWindow();
 });
 app.on('before-quit',()=>{quitting=true;native?.stopAll();});app.on('window-all-closed',()=>app.quit());
}
