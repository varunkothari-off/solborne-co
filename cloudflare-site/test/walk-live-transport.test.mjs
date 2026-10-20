import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const flush=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
function harness({pendingMic=false}={}){
 const sockets=[],audios=[],nodes=[],sent=[],tracks=[],finals=[],partials=[];let micResolve;
 const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);const stream={getTracks:()=>[track]};
 class Audio{constructor(){this.closed=false;this.audioWorklet={addModule:async()=>{}};audios.push(this);}resume(){return Promise.resolve();}suspend(){return Promise.resolve();}close(){this.closed=true;return Promise.resolve();}createMediaStreamSource(){return {connect(){},disconnect(){}};}}
 class Node{constructor(){this.port={postMessage:()=>queueMicrotask(()=>this.port.onmessage({data:{flushed:true}}))};nodes.push(this);}connect(){}disconnect(){}}
 class Socket{constructor(){this.readyState=1;this.bufferedAmount=0;sockets.push(this);queueMicrotask(()=>this.onopen());}send(text){const d=JSON.parse(text);sent.push(d);if(d.setup)queueMicrotask(()=>this.onmessage({data:JSON.stringify({setupComplete:{}})}));}close(){this.readyState=3;}event(value){return this.onmessage({data:JSON.stringify(value)});}}
 const win={AudioContext:Audio,AudioWorkletNode:Node,WebSocket:Socket,navigator:{mediaDevices:{getUserMedia:()=>pendingMic?new Promise(r=>micResolve=r):Promise.resolve(stream)}},fetch:async()=>Response.json({ok:true,token:'auth_tokens/synthetic-test-token',model:'gemini-3.5-transcribe-live'}),setTimeout,clearTimeout,btoa:v=>Buffer.from(v,'binary').toString('base64')};
 vm.runInNewContext(readFileSync('public/walk-live-voice.js','utf8'),{window:win,AbortSignal,AbortController,Uint8Array,TextDecoder,Event,console});const abort=new AbortController();
 const connect=()=>win.SolborneLiveVoice.connect({csrf:'synthetic',signal:abort.signal,onFinal:s=>finals.push(s),onPartial:s=>partials.push(s),onError(){}});
 return {connect,abort,sockets,audios,nodes,sent,tracks,finals,partials,releaseMic(){micResolve(stream);}};
}
test('real browser transport uses manual turn boundaries, streams PCM, and waits for activity end',async()=>{
 const h=harness(),session=await h.connect(),socket=h.sockets[0];assert.equal(h.sent[0].setup.realtimeInputConfig.automaticActivityDetection.disabled,true);assert.deepEqual(h.sent[1],{realtimeInput:{activityStart:{}}});
 h.nodes[0].port.onmessage({data:new Uint8Array([0,1,2,3]).buffer});assert.equal(h.sent[2].realtimeInput.audio.mimeType,'audio/pcm;rate=16000');
 await socket.event({serverContent:{interimInputTranscription:{text:'five lock'}}});await socket.event({serverContent:{inputTranscription:{text:'5 lakh'}}});
 let done=false;const stopping=session.stop().then(()=>{done=true;});await flush();assert.equal(h.tracks[0].stopped,true);assert.equal(h.sent.at(-1).realtimeInput.activityEnd!==undefined,true);
 await socket.event({serverContent:{generationComplete:true}});assert.equal(done,false);await socket.event({voiceActivity:{type:'ACTIVITY_END',audioOffset:'1s'},serverContent:{}});await stopping;assert.equal(done,true);assert.equal(h.audios[0].closed,true);assert.deepEqual(h.finals,['5 lakh']);
});
test('cancel during a microphone permission wait closes a late arriving stream',async()=>{const h=harness({pendingMic:true}),p=h.connect();h.abort.abort();h.releaseMic();await assert.rejects(p,/Cancelled/);assert.equal(h.tracks[0].stopped,true);assert.equal(h.audios[0].closed,true);assert.equal(h.sockets.length,0);});
test('disconnect while finalizing rejects rather than silently accepting an incomplete tail',async()=>{const h=harness(),session=await h.connect();const p=session.stop();await flush();h.sockets[0].onclose();await assert.rejects(p,/interrupted/);session.close();assert.equal(h.tracks[0].stopped,true);});
