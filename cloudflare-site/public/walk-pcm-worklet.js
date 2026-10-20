/* Downsample mono microphone audio to bounded 100ms, 16kHz PCM16 chunks. */
class SolbornePCM extends AudioWorkletProcessor{
 constructor(){super();this.buffer=new Int16Array(1600);this.used=0;this.phase=0;this.sum=0;this.count=0;this.port.onmessage=event=>{if(event.data?.flush){this.send();this.port.postMessage({flushed:true});}};}
 send(){if(!this.used)return;const bytes=new ArrayBuffer(this.used*2),view=new DataView(bytes);for(let i=0;i<this.used;i++)view.setInt16(i*2,this.buffer[i],true);this.port.postMessage(bytes,[bytes]);this.used=0;}
 process(inputs,outputs){const input=inputs[0]?.[0];if(input)for(const sample of input){this.sum+=sample;this.count++;this.phase++;if(this.phase>=sampleRate/16000){this.phase-=sampleRate/16000;const value=Math.max(-1,Math.min(1,this.sum/this.count));this.buffer[this.used++]=Math.round(value*(value<0?32768:32767));this.sum=this.count=0;if(this.used===1600)this.send();}}for(const channel of outputs[0]||[])channel.fill(0);return true;}
}
registerProcessor('solborne-pcm',SolbornePCM);
