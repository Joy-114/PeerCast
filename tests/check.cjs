'use strict';
// Optional development check: node tests/check.cjs (no npm or dependencies).
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = [...fs.readdirSync(root).filter(name=>name.endsWith('.js')), ...fs.readdirSync(path.join(root,'desktop')).filter(name=>name.endsWith('.cjs')).map(name=>'desktop/'+name), 'tests/browser.js'];
for (const file of files) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), {filename:file});
for (const role of ['host','viewer']) {
  const html = fs.readFileSync(path.join(root, role+'.html'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'unique IDs');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) assert.ok(fs.existsSync(path.join(root,match[1])), 'reference exists: '+match[1]);
  const js = fs.readFileSync(path.join(root,role+'.js'),'utf8');
  for (const match of js.matchAll(/UI\('([^']+)'\)/g)) assert.ok(ids.includes(match[1]), 'DOM binding exists: '+match[1]);
  assert.equal((js.match(/new RTCPeerConnection/g)||[]).length, 1, 'one peer creation site per role');
  assert.ok(js.includes('PCSettings.iceConfig()'), 'explicit configurable ICE');
  assert.ok(!js.includes(role === 'host' ? 'viewerPc' : 'hostPc'), 'strict role separation');
}
const context = vm.createContext({console, setTimeout, clearTimeout});
vm.runInContext(fs.readFileSync(path.join(root,'common.js'),'utf8'),context);
const {parseDescription,waitForIce} = context;
for (const bad of ['', '{}', 'null', '[]', '{"type":"offer"}', '{"type":"answer","sdp":null}']) {
  assert.throws(() => parseDescription(bad,'answer'));
}
assert.equal(parseDescription(JSON.stringify({type:'answer',sdp:'v=0\r\nm=video'}),'answer').type,'answer');
(async () => {
  const listeners = new Set();
  const peer = { iceGatheringState: 'gathering', addEventListener: (name, fn) => listeners.add(fn), removeEventListener: (name, fn) => listeners.delete(fn) };
  const controller = new AbortController();
  let done = false;
  const pending = waitForIce(peer,controller.signal,200).then(()=>{done=true;});
  await new Promise(resolve=>setTimeout(resolve,10)); assert.equal(done,false);
  peer.iceGatheringState = 'complete'; for (const listener of listeners) listener();
  await pending; assert.equal(done,true);
  await waitForIce(peer,controller.signal,200);
  peer.iceGatheringState = 'gathering';
  await assert.rejects(waitForIce(peer,controller.signal,5), /超时/);
  const aborted = waitForIce(peer,controller.signal,200); controller.abort();
  await assert.rejects(aborted, /取消/);
  console.log('PASS syntax, DOM bindings, local references, peer ownership, SDP validation, ICE completion/timeout/cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
