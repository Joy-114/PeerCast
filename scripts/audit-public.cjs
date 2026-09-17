'use strict';
// Conservative heuristic audit. Reports locations only, never matched secrets.
const cp=require('node:child_process'),fs=require('node:fs');
const git=(...args)=>cp.execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const patterns=[
 ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
 ['github-token',/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
 ['provider-key',/\b(?:AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9]{30,})\b/],
 ['machine-user-path',/[A-Z]:[\\/]Users[\\/][^\s<>]+|\/Users\/[a-zA-Z0-9._-]+\//],
 ['development-drive',/E:[\\/]PeerCast/i],
 ['old-host-address',/192\.168\.0\.61\b/]
];
const findings=[];
function check(name,bytes){if(bytes.length>1024*1024)findings.push({name,issue:'file over 1 MiB: review before publishing'});if(/\.(?:ico|png|jpg)$/i.test(name))return;const text=bytes.toString('utf8');for(const [issue,regex]of patterns)if(regex.test(text))findings.push({name,issue});}
if(process.argv.includes('--history')){
 const seen=new Set();for(const line of git('rev-list','--objects','HEAD').trim().split('\n')){const [oid,...parts]=line.split(' ');if(!parts.length||seen.has(oid))continue;seen.add(oid);if(git('cat-file','-t',oid).trim()==='blob')check(parts.join(' '),Buffer.from(git('cat-file','blob',oid)));}
}else{
 for(const file of git('ls-files','-z').split('\0').filter(Boolean)){if(/(^|\/)(node_modules|dist|artifacts|\.tools|\.private)\//.test(file)||/\.(exe|msi|pfx|pem|key|log)$/i.test(file))findings.push({name:file,issue:'excluded content tracked'});if(fs.existsSync(file))check(file,fs.readFileSync(file));}
}
console.log(JSON.stringify({ok:!findings.length,scope:process.argv.includes('--history')?'HEAD reachable history':'tracked working tree',findings},null,2));process.exitCode=findings.length?1:0;
