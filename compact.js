'use strict';
const SESSION_LIMIT = 262144;
async function transformSession(bytes, decompress) {
  if (typeof CompressionStream !== 'function' || typeof DecompressionStream !== 'function') throw new Error('此浏览器缺少压缩 API，请使用新版浏览器或高级区域的 Raw SDP。');
  const reader = new Blob([bytes]).stream().pipeThrough(decompress ? new DecompressionStream('gzip') : new CompressionStream('gzip')).getReader();
  const chunks = []; let size = 0;
  try {
    while (true) { const {value,done} = await reader.read(); if (done) break; size += value.length; if (size > SESSION_LIMIT) { await reader.cancel(); throw new Error('连接信息超过大小限制'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let offset=0; for (const chunk of chunks) {result.set(chunk,offset);offset+=chunk.length;} return result;
}
async function encodeDescription(value) {
  const raw = JSON.stringify(value); const bytes = new TextEncoder().encode(raw);
  if (bytes.length > SESSION_LIMIT) throw new Error('SDP 超过大小限制');
  const compressed = await transformSession(bytes,false);
  let binary=''; for (const byte of compressed) binary += String.fromCharCode(byte);
  return 'PC1:' + btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function decodeDescription(text, expected) {
  text = text.trim();
  if (text.length > SESSION_LIMIT*2) throw new Error('连接信息超过大小限制');
  if (text.startsWith('{')) return parseDescription(text,expected);
  if (!text.startsWith('PC1:')) throw new Error('不支持的连接信息版本；需要 PC1: 或 Raw SDP JSON');
  const data = text.slice(4);
  if (!/^[A-Za-z0-9_-]+$/.test(data) || data.length%4===1) throw new Error('Compact SDP 损坏：Base64URL 无效');
  try {
    const binary=atob(data.replace(/-/g,'+').replace(/_/g,'/'));
    const bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));
    const decoded=await transformSession(bytes,true);
    return parseDescription(new TextDecoder('utf-8',{fatal:true}).decode(decoded),expected);
  } catch (error) { throw new Error('Compact SDP 校验失败：'+error.message); }
}
async function exportDescription(value, field, signal) {
  const raw=JSON.stringify(value); UI('rawSdp').value=raw;
  try { const compact=await encodeDescription(value); if (signal.aborted) return; UI(field).value=compact; }
  catch (error) { if (signal.aborted) return; UI(field).value=raw; message(error.message+' 已回退到完整 Raw SDP。',true); }
  const rawSize=new TextEncoder().encode(raw).length; const compactSize=new TextEncoder().encode(UI(field).value).length;
  UI('compressionStats').textContent=`Raw size: ${rawSize} B | Compact size: ${compactSize} B | Compression ratio: ${(compactSize/rawSize*100).toFixed(1)}%`;
}
