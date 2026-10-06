import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {build} from '../validation/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
const base = new URL('../validation/',import.meta.url);
let source=readFileSync(new URL('src/pages/walk/index.astro',base),'utf8').match(/<script>\s*([\s\S]*?)<\/script>/)[1];
source=source.replace('// ---- Boot ----',`globalThis.__controller = { state, begin, resume, showQuestion, showFacts, advance, toPartTwo, replaceApi(fn){api=fn;} };\n// ---- Boot ----`);
const bundled=await build({stdin:{contents:source,resolveDir:new URL('src/pages/walk/',base).pathname,loader:'ts'},bundle:true,write:false,format:'iife'});
const output=[];
function log(x){output.push(x);console.log(x);}
function setup(options={}){
const dom=new JSDOM(readFileSync(new URL('walk.html',import.meta.url),'utf8'),{url:'https://solborne.in/walk/',runScripts:'outside-only'});
const w=dom.window;let mic=0,net=0,stops=0,records=[],timerStarts=0;
const interval=w.setInterval.bind(w);w.setInterval=(fn,ms,...args)=>{if(ms===1000)timerStarts++;return interval(fn,ms,...args);};
w.fetch=async()=>{net++;throw Error('Network forbidden in harness');};
Object.defineProperty(w.navigator,'mediaDevices',{value:{getUserMedia:async()=>{mic++;return {getTracks:()=>[{stop(){stops++;}}]};}}});
class Recorder{static isTypeSupported(){return true}constructor(){records.push(this);this.state='inactive';this.mimeType='audio/webm'}start(){this.state='recording'}stop(){this.state='inactive';if(options.validClip)this.ondataavailable?.({data:new w.Blob([new Uint8Array(2000)],{type:this.mimeType})});this.onstop?.()}}
w.MediaRecorder=Recorder;w.HTMLElement.prototype.scrollIntoView=()=>{};w.eval(bundled.outputFiles[0].text);
return {w,dom,c:w.__controller,timerStarts:()=>timerStarts,metrics:()=>({mic,net,stops,recordings:records.map(x=>x.state)})};
}
const settle=()=>new Promise(r=>setTimeout(r,0));
const click=(w,s)=>w.document.querySelector(s).click();
const val=(w,s,v)=>{w.document.querySelector(s).value=v;};
let ctx=setup();await ctx.c.begin();assert.deepEqual(ctx.metrics(),{mic:0,net:0,stops:0,recordings:[]});assert.match(ctx.w.document.querySelector('[data-error]').textContent,/awaiting activation/);log('PASS: actual false gates block Begin before fetch or microphone request');ctx.dom.window.close();
ctx=setup();let calls=[];ctx.c.replaceApi(async(path,options)=>{calls.push({path,options});const b=JSON.parse(options?.body||'{}');return {transcript:b.manual_transcript};});Object.assign(ctx.c.state,{walkId:'11111111-1111-1111-1111-111111111111',part:'one',qIndex:0});ctx.c.showQuestion();click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Saved original answer');click(ctx.w,'[data-save-edit]');await settle();assert.equal(ctx.c.state.transcripts['one:0'],'Saved original answer');assert.equal(ctx.c.state.qIndex,0);assert.equal(ctx.metrics().mic,0);log('PASS: typed answer save uses manual_transcript, stays for review, does not request microphone');
click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Unsaved important revision');click(ctx.w,'[data-type-answer]');assert.equal(ctx.w.document.querySelector('[data-transcript-edit]').value,'Unsaved important revision');log('PASS: repeated Type preserves unsaved edits');click(ctx.w,'[data-cancel-edit]');
click(ctx.w,'[data-rec]');await settle();assert.equal(ctx.metrics().recordings[0],'recording');click(ctx.w,'[data-accept]');await settle();assert.equal(ctx.c.state.qIndex,0);assert.equal(ctx.metrics().recordings[0],'recording');click(ctx.w,'[data-rec]');await settle();assert.equal(ctx.metrics().recordings[0],'inactive');assert.equal(ctx.metrics().stops,1);log('PASS: active recording blocks advance and stop releases tracks');ctx.dom.window.close();
for(const n of [3,9]){ctx=setup();Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:4});ctx.c.replaceApi(async()=>({questions:Array.from({length:n},(_,i)=>'Generated question '+i),stub:false}));await ctx.c.toPartTwo();assert.equal(ctx.c.state.partTwo.length,n);assert.equal(ctx.c.state.part,'two');assert.equal(ctx.w.document.querySelector('[data-qcount]').textContent,`Question 1 of ${n}`);log('PASS: actual controller accepts '+n+' provider-mocked followups rather than fixed four');ctx.dom.window.close();}
ctx=setup();ctx.c.replaceApi(async()=>({started_at:new Date().toISOString(),status:'complete',questions:['Follow-up'],answers:[{section:'one',index:0,transcript:'Restored opening'},{section:'two',index:0,transcript:'Restored followup'}]}));let detail;ctx.w.document.addEventListener('solborne-website-delivery',e=>{detail=e.detail});await ctx.c.resume('id');assert.equal(detail.answers.length,2);assert.equal(detail.contact && Object.keys(detail.contact).length,0);log('PASS: completed resume dispatches both saved answers; contact is empty and must be re-entered');ctx.dom.window.close();
ctx=setup();Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0});ctx.c.state.answered.one.add(0);ctx.c.state.transcripts['one:0']='Old saved answer';ctx.c.showQuestion();ctx.w.document.querySelector('[data-transcript-text]').textContent='Old saved answer';ctx.w.document.querySelector('[data-transcript]').hidden=false;let resolveSave;ctx.c.replaceApi(async()=>new Promise(resolve=>{resolveSave=resolve}));click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Edited question zero');click(ctx.w,'[data-save-edit]');click(ctx.w,'[data-cancel-edit]');click(ctx.w,'[data-accept]');assert.equal(ctx.c.state.qIndex,0);assert.equal(ctx.w.document.querySelector('[data-transcript-edit]').value,'Edited question zero');resolveSave({transcript:'Edited question zero'});await settle();assert.equal(ctx.c.state.transcripts['one:0'],'Edited question zero');assert.equal(ctx.c.state.transcripts['one:1'],undefined);assert.equal(ctx.c.state.answered.one.has(1),false);log('PASS: pending Save blocks Cancel and advance; Q0 result never marks Q1');ctx.dom.window.close();
ctx=setup();Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0});ctx.c.showQuestion();let lateResolve;ctx.c.replaceApi(async()=>new Promise(resolve=>{lateResolve=resolve}));click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Late Q0');click(ctx.w,'[data-save-edit]');Object.assign(ctx.c.state,{qIndex:1,answerBusy:false});ctx.c.showQuestion();lateResolve({transcript:'Late Q0'});await settle();assert.equal(ctx.c.state.transcripts['one:1'],undefined);assert.equal(ctx.c.state.answered.one.has(1),false);assert.equal(ctx.w.document.querySelector('[data-transcript]').hidden,true);log('PASS: forced later question generation discards stale completion');ctx.dom.window.close();
ctx=setup();Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0});ctx.c.showQuestion();let rejectSave;ctx.c.replaceApi(async()=>new Promise((resolve,reject)=>{rejectSave=reject}));click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Keep after failure');click(ctx.w,'[data-save-edit]');rejectSave(Error('Synthetic save failure'));await settle();assert.equal(ctx.w.document.querySelector('[data-transcript-edit]').value,'Keep after failure');assert.equal(ctx.w.document.querySelector('[data-save-edit]').disabled,false);assert.equal(ctx.c.state.answered.one.has(0),false);log('PASS: failed save retains unsaved text and allows retry');ctx.dom.window.close();ctx=setup();Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0,startedAtMs:Date.now()});ctx.c.showQuestion();const restore=new ctx.w.Event('pageshow');Object.defineProperty(restore,'persisted',{value:true});ctx.w.dispatchEvent(restore);assert.equal(ctx.timerStarts(),1);assert.equal(ctx.metrics().mic,0);assert.equal(ctx.metrics().recordings.length,0);log('PASS: back-cache restore restarts timer without microphone');ctx.dom.window.close();
ctx=setup();Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0});ctx.c.showQuestion();let interruptedResolve;ctx.c.replaceApi(async()=>new Promise(resolve=>{interruptedResolve=resolve}));click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Interrupted text');click(ctx.w,'[data-save-edit]');ctx.w.dispatchEvent(new ctx.w.Event('pagehide'));interruptedResolve({transcript:'Interrupted text'});await settle();assert.equal(ctx.c.state.answered.one.has(0),false);assert.equal(ctx.c.state.transcripts['one:0'],undefined);assert.equal(ctx.c.state.answerBusy,false);log('PASS: pagehide invalidates pending answer completion');ctx.dom.window.close();// Delay real controller FileReader continuation until after page exit and back-cache restoration.
for (const appendToEdit of [false,true]) {
  ctx=setup({validClip:true});let readers=[],audioCalls=[];let fakeNow=1000;
  ctx.w.Date.now=()=>fakeNow;
  ctx.w.FileReader=class {readAsDataURL(blob){this.result='data:audio/webm;base64,AA==';readers.push(this);}};
  Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0});ctx.c.showQuestion();
  ctx.c.replaceApi(async(path,options)=>{audioCalls.push({path,options});return {transcript:'Synthetic audio'};});
  if(appendToEdit){click(ctx.w,'[data-type-answer]');val(ctx.w,'[data-transcript-edit]','Keep draft');}
  click(ctx.w,'[data-rec]');await settle();fakeNow=3000;click(ctx.w,'[data-rec]');await settle();
  assert.equal(readers.length,1);assert.equal(ctx.metrics().stops,1);assert.equal(audioCalls.length,0);
  ctx.w.dispatchEvent(new ctx.w.Event('pagehide'));
  const restore=new ctx.w.Event('pageshow');Object.defineProperty(restore,'persisted',{value:true});ctx.w.dispatchEvent(restore);
  readers[0].onload();await settle();
  assert.equal(audioCalls.length,0);assert.equal(ctx.c.state.answered.one.has(0),false);
  assert.equal(ctx.metrics().mic,1);assert.equal(ctx.metrics().stops,1);
  log(`PASS: delayed FileReader ${appendToEdit?'edit append':'saved answer'} makes zero API calls after pagehide/back-cache invalidation`);
  ctx.dom.window.close();
}
// Positive control: conversion completing for the current question reaches the mocked API exactly once.
ctx=setup({validClip:true});let currentReaders=[],currentAudioCalls=0;let currentNow=1000;
ctx.w.Date.now=()=>currentNow;
ctx.w.FileReader=class {readAsDataURL(blob){this.result='data:audio/webm;base64,AA==';currentReaders.push(this);}};
Object.assign(ctx.c.state,{walkId:'id',part:'one',qIndex:0});ctx.c.showQuestion();
ctx.c.replaceApi(async()=>{currentAudioCalls++;return {transcript:'Current synthetic answer'};});
click(ctx.w,'[data-rec]');await settle();currentNow=3000;click(ctx.w,'[data-rec]');await settle();
assert.equal(currentReaders.length,1);currentReaders[0].onload();await settle();
assert.equal(currentAudioCalls,1);assert.equal(ctx.c.state.transcripts['one:0'],'Current synthetic answer');
assert.equal(ctx.metrics().stops,1);log('PASS: current delayed conversion still saves its own answer exactly once');ctx.dom.window.close();