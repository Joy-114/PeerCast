'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version='0.2.0-alpha';
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
assert.equal(pkg.version,version);assert.equal(lock.version,version);assert.equal(lock.packages[''].version,version);assert.equal(pkg.license,'MIT');
assert(fs.readFileSync(path.join(root,'native/PeerCast.Audio/PeerCast.Audio.csproj'),'utf8').includes(`<Version>${version}</Version>`));
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 const ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,file+' duplicate ID');
 assert(text.includes(version),file+' version');
 for(const m of text.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^(https?:|data:)/.test(m[1]))assert(fs.existsSync(path.join(root,m[1])),file+' broken reference');
}
function docs(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.isDirectory()&&item.name==='docs'||item.isDirectory()&&dir!==root)docs(path.join(dir,item.name));else if(item.isFile()&&item.name.endsWith('.md')){const file=path.join(dir,item.name),text=fs.readFileSync(file,'utf8');for(const m of text.matchAll(/\]\(([^)]+)\)/g)){const target=m[1].split('#')[0];if(target&&!/^https?:/.test(target))assert(fs.existsSync(path.resolve(dir,target)),path.relative(root,file)+' broken link '+target);}}}}
docs(root);console.log('PASS release versions, HTML references and local documentation links');
