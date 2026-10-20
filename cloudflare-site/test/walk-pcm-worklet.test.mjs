import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
test('microphone worklet produces 16kHz little-endian PCM chunks and silent output',()=>{
 let Class;const sent=[];class Processor{constructor(){this.port={postMessage:value=>sent.push(value)};}}
 vm.runInNewContext(readFileSync('public/walk-pcm-worklet.js','utf8'),{AudioWorkletProcessor:Processor,Int16Array,DataView,ArrayBuffer,sampleRate:48000,registerProcessor:(name,value)=>Class=value});const worklet=new Class();
 const out=[new Float32Array(480).fill(1)];for(let i=0;i<100;i++)worklet.process([[new Float32Array(480).fill(.5)]],[out]);
 assert.equal(sent.length,10);assert.equal(sent.every(b=>b.byteLength===3200),true);assert.equal(sent.reduce((n,b)=>n+b.byteLength,0),32000);assert.equal(new DataView(sent[0]).getInt16(0,true),16384);assert.equal(out[0].every(x=>x===0),true);
 worklet.process([[new Float32Array(300).fill(-2)]],[out]);worklet.port.onmessage({data:{flush:true}});assert.equal(sent[10].byteLength,200);assert.equal(new DataView(sent[10]).getInt16(0,true),-32768);assert.equal(sent[11].flushed,true);
});
