'use strict';
// Bounded, 250 ms stereo PCM queue. Native format: 48 kHz, signed 16-bit LE.
class PeerCastPCM extends AudioWorkletProcessor {
 constructor(){super();this.buffer=new Float32Array(24000);this.read=0;this.write=0;this.count=0;this.phase=0;this.port.onmessage=({data})=>{const bytes=new Uint8Array(data);const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);for(let i=0;i+3<view.byteLength;i+=4){if(this.count>=12000){this.read=(this.read+1)%12000;this.count--;}this.buffer[this.write*2]=view.getInt16(i,true)/32768;this.buffer[this.write*2+1]=view.getInt16(i+2,true)/32768;this.write=(this.write+1)%12000;this.count++;}};}
 process(inputs,outputs){const out=outputs[0];const step=48000/sampleRate;for(let i=0;i<out[0].length;i++){if(this.count>1){const next=(this.read+1)%12000;for(let channel=0;channel<2;channel++)out[channel][i]=this.buffer[this.read*2+channel]*(1-this.phase)+this.buffer[next*2+channel]*this.phase;this.phase+=step;while(this.phase>=1&&this.count>0){this.phase--;this.read=(this.read+1)%12000;this.count--;}}else{out[0][i]=out[1][i]=0;this.phase=0;}}return true;}
}
registerProcessor('peercast-pcm',PeerCastPCM);
