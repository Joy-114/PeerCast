'use strict';
function connectionRoute(local,remote) {
  if (!local || !remote) return 'Unknown';
  if ([local.candidateType,remote.candidateType].includes('relay')) return 'TURN Relay';
  if ([local.candidateType,remote.candidateType].some(type=>['srflx','prflx'].includes(type))) return 'Internet Direct P2P';
  const privateAddress=address=> /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|fc|fd|fe80:|::1$)/i.test(address||'') || /\.local$/.test(address||'');
  if(local.candidateType==='host'&&remote.candidateType==='host') return privateAddress(local.address)&&privateAddress(remote.address)?'LAN Direct P2P':'Unknown';
  return 'Unknown';
}
function monitorPeer(pc,role,signal,trackProvider=()=>null) {
  let previous=new Map();let pending=false;
  const timer=setInterval(async()=>{
    if(pending||signal.aborted)return;pending=true;
    try {
      const stats=await pc.getStats();if(signal.aborted)return;
      let pair, outVideo, inVideo, lost=0; let outgoing=0,incoming=0;
      stats.forEach(report=>{if(report.type==='transport'&&report.selectedCandidatePairId)pair=stats.get(report.selectedCandidatePairId);});
      if(!pair)stats.forEach(report=>{if(report.type==='candidate-pair'&&report.nominated&&report.state==='succeeded')pair=report;});
      const local=stats.get(pair?.localCandidateId),remote=stats.get(pair?.remoteCandidateId);
      const route=connectionRoute(local,remote);
      UI('route').textContent='Connection Route: '+route;
      const next=new Map();
      stats.forEach(report=>{
        if(report.type!=='inbound-rtp'&&report.type!=='outbound-rtp')return;
        const prior=previous.get(report.id); const seconds=prior?(report.timestamp-prior.timestamp)/1000:0;
        if(seconds>0) {if(report.bytesSent!==undefined)outgoing+=Math.max(0,(report.bytesSent-prior.bytesSent)*8/seconds);if(report.bytesReceived!==undefined)incoming+=Math.max(0,(report.bytesReceived-prior.bytesReceived)*8/seconds);}
        if(report.kind==='video') {
          const field=report.type==='outbound-rtp'?'framesEncoded':'framesDecoded';
          const measured=report.framesPerSecond ?? (seconds>0&&report[field]!==undefined&&prior[field]!==undefined?(report[field]-prior[field])/seconds:null);
          if(report.type==='outbound-rtp')outVideo=measured;else inVideo=measured;
        }
        if(report.packetsLost!==undefined)lost+=report.packetsLost;
        next.set(report.id,report);
      });previous=next;
      const capture=trackProvider()?.getSettings()||{};const number=value=>Number.isFinite(value)?value.toFixed(1):'unavailable';
      const quality=role==='host'?`Requested Resolution: ${UI('resolution').selectedOptions[0].text}\nRequested FPS: ${UI('fps').value}\nCaptured Resolution: ${capture.width??'?'}×${capture.height??'?'}\nCaptured FPS: ${number(capture.frameRate)}\n`:'';
      UI('performance').textContent=quality+`Sent FPS: ${number(outVideo)}\nReceived FPS: ${number(inVideo)}\nOutgoing Bitrate: ${(outgoing/1000).toFixed(0)} kbps\nIncoming Bitrate: ${(incoming/1000).toFixed(0)} kbps\nPackets Lost (local inbound): ${lost}\nRTT: ${pair?.currentRoundTripTime!==undefined?(pair.currentRoundTripTime*1000).toFixed(1)+' ms':'unavailable'}\nlocalCandidateType: ${local?.candidateType??'unknown'}\nremoteCandidateType: ${remote?.candidateType??'unknown'}\nselected candidate pair: ${pair?.id??'unknown'}\nprotocol: ${local?.protocol??'unknown'}\n${route}`;
    }catch(error){if(!signal.aborted)UI('performance').textContent='统计读取失败：'+error.message;}finally{pending=false;}
  },1000);
  signal.addEventListener('abort',()=>clearInterval(timer),{once:true});
}
