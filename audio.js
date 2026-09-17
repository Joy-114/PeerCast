'use strict';
// One context, separate destinations: sources are never mixed together.
class AudioRouter {
  constructor() { this.context = null; this.sources = new Map(); }
  async input(key, stream) {
    if (!this.context) this.context = new AudioContext({sampleRate:48000});
    await this.context.resume();
    let source = this.sources.get(key);
    if (!source) {
      const gain = this.context.createGain();
      gain.channelCount = 2; gain.channelCountMode = 'explicit';
      const destination = this.context.createMediaStreamDestination();
      gain.connect(destination);
      source = { gain, destination, input: null, stream: null };
      this.sources.set(key, source);
    }
    source.input?.disconnect();
    stopStream(source.stream);
    source.stream = stream;
    source.input = this.context.createMediaStreamSource(stream);
    source.input.connect(source.gain);
  }
  off(key) {
    const source = this.sources.get(key);
    if (!source) return;
    source.input?.disconnect(); source.input = null;
    source.native = false;
    stopStream(source.stream); source.stream = null;
  }
  track(key) { return this.sources.get(key)?.destination.stream.getAudioTracks()[0] ?? null; }
  live(key) { return this.sources.get(key)?.native || (this.sources.get(key)?.stream?.getAudioTracks().some(track => track.readyState === 'live') ?? false); }
  async nativeInput(key) {
    if (!this.context) this.context = new AudioContext({sampleRate:48000});
    const context=this.context; await context.resume();
    if(!this.workletReady)this.workletReady=context.audioWorklet.addModule('pcm-worklet.js');
    await this.workletReady;
    if(this.context!==context)throw new Error('Audio initialization cancelled');
    let source=this.sources.get(key);
    if(!source){const gain=context.createGain();gain.channelCount=2;gain.channelCountMode='explicit';const destination=context.createMediaStreamDestination();gain.connect(destination);source={gain,destination,input:null,stream:null};this.sources.set(key,source);}
    source.input?.disconnect();
    const node=new AudioWorkletNode(context,'peercast-pcm',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
    node.connect(source.gain);source.input=node;source.native=true;
    return node;
  }
  gain(key, value) { const source = this.sources.get(key); if (source) source.gain.gain.value = value; }
  close() {
    for (const [key, source] of this.sources) {
      this.off(key); source.gain.disconnect(); stopStream(source.destination.stream);
    }
    this.sources.clear();
    if (this.context) this.context.close().catch(() => {});
    this.context = null;
  }
}
