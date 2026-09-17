'use strict';
// Isolated test-only server: eval introspection in browser.js requires removal
// of the production CSP. Desktop smoke separately exercises the exact CSP.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const browser=process.env.PEERCAST_BROWSER || path.join(process.env['ProgramFiles(x86)']||'', 'Microsoft/Edge/Application/msedge.exe');
if(!fs.existsSync(browser))throw Error('Install Microsoft Edge or set PEERCAST_BROWSER to a Chromium executable.');
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'peercast-browser-'));
let child,finished=false;
const finish=(result)=>{if(finished)return;finished=true;clearTimeout(timer);fs.writeFileSync(path.join(root,'artifacts/browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=result.ok?0:1;child?.kill();server.close();};
const server=http.createServer((req,res)=>{
 if(req.method==='POST'&&req.url==='/__report'){let body='';req.on('data',data=>{body+=data;if(body.length>100000)req.destroy();});req.on('end',()=>{try{const result=JSON.parse(body);res.end('ok');finish(result);}catch{res.writeHead(400).end();}});return;}
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep)||!['.html','.js','.css'].includes(path.extname(file)))throw Error('denied');let data=fs.readFileSync(file,'utf8');if(file.endsWith('.html'))data=data.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/g,'');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html; charset=utf-8');res.end(data);}catch{res.writeHead(404).end();}
});
const timer=setTimeout(()=>finish({ok:false,error:'Browser regression timed out'}),60000);
server.listen(0,'127.0.0.1',()=>{child=spawn(browser,['--headless=new','--no-first-run','--disable-background-timer-throttling','--autoplay-policy=no-user-gesture-required','--user-data-dir='+profile,`http://127.0.0.1:${server.address().port}/tests/browser.html`],{windowsHide:true,stdio:'ignore'});child.on('error',error=>finish({ok:false,error:error.message}));});
