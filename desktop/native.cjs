'use strict';
const {spawn,execFile}=require('node:child_process');
class NativeAudio {
 constructor(executable,send){this.executable=executable;this.send=send;this.sessions=new Map();}
 query(arg){return new Promise((resolve,reject)=>execFile(this.executable,[arg],{windowsHide:true,timeout:10000,maxBuffer:1024*1024},(error,out,stderr)=>{if(error)return reject(new Error(stderr||error.message));try{resolve(JSON.parse(out));}catch{reject(new Error('Invalid native response'));}}));}
 async start(pid,identity){
  if(!Number.isInteger(pid)||pid<=0||!/^\d{10,20}$/.test(identity))throw Error('Invalid application identity');
  if(this.sessions.has(pid))throw Error('Application already capturing');
  if(this.sessions.size>=8)throw Error('最多同时发送 8 个应用');
  const apps=await this.query('--list');if(!apps.some(a=>a.pid===pid&&a.identity===identity))throw Error('Application session changed; refresh applications');
  const child=spawn(this.executable,['--capture',String(pid),identity],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  const entry={child,inflight:0,remainder:Buffer.alloc(0)};this.sessions.set(pid,entry);
  return new Promise((resolve,reject)=>{
   let ready=false,lines='';const timeout=setTimeout(()=>{reject(Error('Native capture startup timed out'));this.stop(pid);},12000);
   child.stdout.on('data',chunk=>{let data=Buffer.concat([entry.remainder,chunk]);const length=data.length-data.length%4;entry.remainder=data.subarray(length);if(length&&entry.inflight<8){entry.inflight++;this.send('native-pcm',{pid,pcm:data.subarray(0,length)});}});
   child.stderr.on('data',chunk=>{lines+=chunk.toString();if(lines.length>16384)lines=lines.slice(-16384);let index;while((index=lines.indexOf('\n'))>=0){const line=lines.slice(0,index);lines=lines.slice(index+1);try{const status=JSON.parse(line);if(status.status==='ready'){ready=true;clearTimeout(timeout);resolve(status);}this.send('native-status',{pid,...status});}catch{}}});
   child.on('error',error=>{clearTimeout(timeout);reject(error);this.sessions.delete(pid);});
   child.on('exit',code=>{clearTimeout(timeout);if(this.sessions.get(pid)===entry)this.sessions.delete(pid);if(!ready)reject(Error('Native capture failed; inspect source status'));this.send('native-status',{pid,status:'closed',message:'Application closed or capture stopped',code});});
  });
 }
 ack(pid){const entry=this.sessions.get(pid);if(entry)entry.inflight=Math.max(0,entry.inflight-1);}
 stop(pid){const entry=this.sessions.get(pid);if(!entry)return;entry.child.stdin.end('stop\n');const timer=setTimeout(()=>entry.child.kill(),1500);entry.child.once('exit',()=>clearTimeout(timer));}
 stopAll(){for(const pid of this.sessions.keys())this.stop(pid);}
}
module.exports={NativeAudio};
