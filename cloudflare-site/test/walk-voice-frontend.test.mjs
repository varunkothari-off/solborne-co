import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const flush=async()=>{for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));};
function harness({getUserMedia,fetcher,recorderSupported=true,withWalk=false}={}){
 const html=readFileSync('public/ai-walk.html','utf8'),source=readFileSync('public/walk-voice.js','utf8');
 const listeners={},requests=[],recorders=[],tracks=[],timers=new Map(),busy=[];let now=1000,nextTimer=0;
 function node(){return {value:'',checked:false,disabled:false,hidden:false,textContent:'',children:[],handlers:{},dataset:{},attributes:{},focusCount:0,
  setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,f){(this.handlers[k]||=[]).push(f);},
  async fire(k){for(const f of this.handlers[k]||[])await f({preventDefault(){}});},dispatchEvent(e){for(const f of this.handlers[e.type]||[])f(e);},
  focus(){this.focusCount++;},append(...v){this.children.push(...v);},replaceChildren(...v){this.children=v;},querySelector(){return this.link ||=node();},scrollIntoView(){}};}
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,node()]));
 nodes.get('ai-consent').checked=true;nodes.get('voice-consent').checked=true;
 const media=async()=>{const track={stopped:false,stop(){this.stopped=true;}};tracks.push(track);return {getTracks:()=>[track]};};
 class Recorder{
  static isTypeSupported(type){return recorderSupported&&type.startsWith('audio/webm');}
  constructor(stream,{mimeType}){this.mimeType=mimeType;this.state='inactive';recorders.push(this);}
  start(){this.state='recording';}
  stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['audio'],{type:this.mimeType})});this.onstop?.();});}
 }
 const fetch=async(url,options)=>{requests.push({url,options});return fetcher?fetcher(url,options):Response.json(url==='/api/ai-walk/transcribe'?{ok:true,text:'मेरा व्यवसाय कोलकाता में है।'}:{ok:true,enabled:true,csrf:'csrf',revision:1,state:{facts:{},messages:[],ready:true}});};
 const window={isSecureContext:true,addEventListener(k,f){(listeners[k]||=[]).push(f);},solborneSession:async()=>({authenticated:true,registered:true,csrf:'csrf'})};
 const document={getElementById:id=>nodes.get(id),createElement:node};
 const context=vm.createContext({window,document,navigator:{mediaDevices:{getUserMedia:getUserMedia||media}},MediaRecorder:Recorder,fetch,Blob,AbortController,Event,Intl,console,matchMedia:()=>({matches:true}),setTimeout:(f,ms)=>{const id=++nextTimer;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++nextTimer,clearInterval(){},Date,btoa:value=>Buffer.from(value,'binary').toString('base64')});
 Object.assign(window,{document,navigator:context.navigator,MediaRecorder:Recorder,fetch,setTimeout:context.setTimeout,clearTimeout:context.clearTimeout,setInterval:context.setInterval,clearInterval:context.clearInterval,btoa:context.btoa});
 vm.runInContext(source,context);
 const ctx={allowed:true,consent:true,csrf:'private-csrf'};
 let voice;
 if(withWalk){vm.runInContext(readFileSync('public/ai-walk.js','utf8'),context);}
 else voice=window.SolborneVoice.create({getContext:()=>ctx,onBusy:value=>busy.push(value),now:()=>now});
 return {voice,ctx,nodes,requests,recorders,tracks,timers,busy,listeners,setNow:value=>now=value,fire:async(id,event='click')=>{await nodes.get(id).fire(event);await flush();}};
}

test('microphone starts only by explicit action with both consents, and denial preserves typing',async()=>{
 const h=harness({getUserMedia:async()=>{throw Object.assign(Error(),{name:'NotAllowedError'});}});
 h.nodes.get('ai-answer').value='An answer in progress';assert.equal(h.recorders.length,0);
 h.nodes.get('voice-consent').checked=false;await h.fire('voice-start');assert.equal(h.voice.phase,'idle');
 h.nodes.get('voice-consent').checked=true;await h.fire('voice-start');assert.equal(h.voice.phase,'error');
 assert.match(h.nodes.get('voice-status').textContent,/not allowed/);assert.equal(h.nodes.get('ai-answer').value,'An answer in progress');assert.equal(h.requests.length,0);assert.deepEqual(h.busy,[true,false]);
});

test('transcription is review-only, preserves language and adds after all current typing without autosend',async()=>{
 const h=harness();h.nodes.get('ai-answer').value='Typed before recording';await h.fire('voice-start');
 assert.equal(h.voice.phase,'recording');assert.equal(h.requests.length,0);h.setNow(8500);await h.fire('voice-stop');
 assert.equal(h.tracks.every(t=>t.stopped),true);assert.equal(h.voice.phase,'review');assert.equal(h.nodes.get('ai-answer').value,'Typed before recording');
 const payload=JSON.parse(h.requests[0].options.body);assert.equal(payload.durationMs,7500);assert.equal(payload.audioConsent,true);assert.equal(payload.consent,true);assert.equal(payload.csrf,'private-csrf');assert.equal(payload.language,undefined);
 assert.equal(h.nodes.get('voice-transcript').value,'मेरा व्यवसाय कोलकाता में है।');
 h.nodes.get('ai-answer').value+=' and edited during transcription';await h.fire('voice-use');
 assert.equal(h.nodes.get('ai-answer').value,'Typed before recording and edited during transcription\nमेरा व्यवसाय कोलकाता में है।');
 assert.equal(h.requests.length,1);assert.equal(h.voice.phase,'idle');assert.match(h.nodes.get('voice-status').textContent,/then choose Send/);
});

test('cancel while recording stops all tracks and never uploads',async()=>{
 const h=harness();await h.fire('voice-start');await h.fire('voice-cancel');assert.equal(h.voice.phase,'idle');assert.equal(h.tracks.every(t=>t.stopped),true);assert.equal(h.requests.length,0);assert.equal(h.timers.size,0);
});

test('cancel during microphone permission request stops a late arriving stream',async()=>{
 let resolve;const track={stopped:false,stop(){this.stopped=true;}};
 const h=harness({getUserMedia:()=>new Promise(r=>resolve=r)});const starting=h.nodes.get('voice-start').fire('click');
 await flush();await h.fire('voice-cancel');resolve({getTracks:()=>[track]});await starting;await flush();
 assert.equal(track.stopped,true);assert.equal(h.requests.length,0);assert.equal(h.recorders.length,0);
});

test('cancel during transcription aborts request and ignores its eventual transcript',async()=>{
 let resolve;const h=harness({fetcher:()=>new Promise(r=>resolve=r)});await h.fire('voice-start');await h.fire('voice-stop');assert.equal(h.voice.phase,'transcribing');
 const signal=h.requests[0].options.signal;await h.fire('voice-cancel');assert.equal(signal.aborted,true);resolve(Response.json({ok:true,text:'Late result'}));await flush();
 assert.equal(h.nodes.get('voice-transcript').value,'');assert.equal(h.voice.phase,'idle');assert.equal(h.nodes.get('ai-answer').value,'');
});

test('one-minute limit stops the microphone; oversized recordings are discarded without upload',async()=>{
 const h=harness();await h.fire('voice-start');const limit=[...h.timers.values()].find(t=>t.ms===60000);assert.ok(limit);h.setNow(61000);limit.f();await flush();
 assert.equal(h.tracks.every(t=>t.stopped),true);assert.equal(JSON.parse(h.requests[0].options.body).durationMs,60000);
 const over=harness();await over.fire('voice-start');over.recorders[0].ondataavailable({data:{size:3*1024*1024+1}});await flush();
 assert.equal(over.tracks.every(t=>t.stopped),true);assert.equal(over.requests.length,0);assert.match(over.nodes.get('voice-status').textContent,/size limit/);
});

test('too-long transcript never truncates or replaces the answer',async()=>{
 const h=harness({fetcher:async()=>Response.json({ok:true,text:'b'.repeat(300)})});h.nodes.get('ai-answer').value='a'.repeat(1800);
 await h.fire('voice-start');await h.fire('voice-stop');await h.fire('voice-use');assert.equal(h.nodes.get('ai-answer').value,'a'.repeat(1800));assert.equal(h.voice.phase,'review');assert.match(h.nodes.get('voice-status').textContent,/2,000/);
 h.nodes.get('voice-transcript').value='shortened';await h.fire('voice-use');assert.equal(h.nodes.get('ai-answer').value,'a'.repeat(1800)+'\nshortened');
});

test('failed transcription can retry the same in-memory recording without reopening microphone',async()=>{
 let count=0;const h=harness({fetcher:async()=>++count===1?Response.json({ok:false},{status:503}):Response.json({ok:true,text:'Recovered words'})});
 await h.fire('voice-start');await h.fire('voice-stop');assert.equal(h.voice.phase,'error');await h.fire('voice-retry');assert.equal(h.voice.phase,'review');assert.equal(h.recorders.length,1);assert.equal(h.requests.length,2);assert.equal(h.nodes.get('ai-answer').value,'');
});

test('revoked consent and page exit stop capture and discard retained audio',async()=>{
 for(const exit of ['audio-consent','gemini-consent','pagehide','beforeunload']){
  const h=harness();await h.fire('voice-start');
  if(exit==='audio-consent'){h.nodes.get('voice-consent').checked=false;await h.fire('voice-consent','change');}
  else if(exit==='gemini-consent'){h.nodes.get('ai-consent').checked=false;await h.fire('ai-consent','change');}
  else {for(const f of h.listeners[exit])f();await flush();}
  assert.equal(h.tracks.every(t=>t.stopped),true,exit);assert.equal(h.requests.length,0,exit);assert.equal(h.voice.phase,'idle',exit);
 }
});

test('unsupported browsers keep typing available and give an honest keyboard microphone fallback',async()=>{
 const h=harness({recorderSupported:false});assert.equal(h.nodes.get('voice-start').disabled,true);assert.equal(h.nodes.get('ai-answer').disabled,false);assert.match(h.nodes.get('voice-status').textContent,/device’s keyboard/);await h.fire('voice-start');assert.equal(h.recorders.length,0);
});

test('actual Walk integration locks answer, refresh and handoff while recording, restores them after discard',async()=>{
 const h=harness({withWalk:true});await flush();h.nodes.get('ai-consent').checked=true;await h.fire('ai-consent','change');h.nodes.get('voice-consent').checked=true;await h.fire('voice-consent','change');
 h.nodes.get('ai-confirm').checked=true;await h.fire('ai-confirm','change');assert.equal(h.nodes.get('ai-send').disabled,false);assert.equal(h.nodes.get('ai-submit-brief').disabled,false);
 await h.fire('voice-start');assert.equal(h.nodes.get('ai-send').disabled,true);assert.equal(h.nodes.get('ai-refresh').disabled,true);assert.equal(h.nodes.get('ai-submit-brief').disabled,true);assert.equal(h.nodes.get('ai-answer').disabled,false);
 await h.fire('ai-answer-form','submit');assert.equal(h.requests.filter(r=>r.url==='/api/ai-walk'&&r.options?.method==='POST').length,0);
 await h.fire('voice-cancel');assert.equal(h.nodes.get('ai-send').disabled,false);assert.equal(h.nodes.get('ai-refresh').disabled,false);assert.equal(h.nodes.get('ai-submit-brief').disabled,false);
});
