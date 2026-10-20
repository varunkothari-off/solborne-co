import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function harness({demo=false}={}) {
  let now=0,id=0;const timers=new Map(),events={};
  function node(tag='div') {return {tagName:tag.toUpperCase(),children:[],hidden:false,attributes:{},listeners:{},className:'',textContent:'',append(...items){this.children.push(...items);},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this.listeners[k]=fn;},click(){this.listeners.click?.();}};}
  const body=node('body');body.dataset=demo?{loadingDemo:'true'}:{};
  const document={body,createElement:node,addEventListener(k,fn){events[k]=fn;}};
  const window={addEventListener(k,fn){events[k]=fn;}};
  vm.runInNewContext(readFileSync('public/app-loading.js','utf8'),{window,document,setTimeout(fn,delay){const key=++id;timers.set(key,{at:now+delay,fn});return key;},clearTimeout(key){timers.delete(key);}});
  function tick(ms){const end=now+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=end;}
  const find=(predicate,n=body)=>predicate(n)?n:n.children.map(x=>find(predicate,x)).find(Boolean);
  return {api:window.SolborneLoading,body,timers,tick,events,find};
}

test('a fast session check never flashes a loader',()=>{
  const h=harness();const finish=h.api.begin();h.tick(149);assert.equal(h.body.children.length,0);finish();h.tick(9000);assert.equal(h.body.children.length,0);assert.equal(h.timers.size,0);
});
test('loading is delayed, nonmodal, and reference counted with idempotent completion',()=>{
  const h=harness();const first=h.api.begin(),second=h.api.begin();h.tick(150);const panel=h.find(n=>n.className==='app-loading');assert.equal(panel.hidden,false);assert.equal(panel.attributes['aria-modal'],undefined);assert.equal(h.body.attributes.inert,undefined);first();first();assert.equal(panel.hidden,false);second();assert.equal(panel.hidden,true);assert.equal(h.timers.size,0);
});
test('a slow check fails open after eight seconds with dismissible navigation',()=>{
  const h=harness();const finish=h.api.begin();h.tick(8000);const panel=h.find(n=>n.className==='app-loading');assert.equal(panel.attributes['data-state'],'slow');assert.match(h.find(n=>n.className==='app-loading-copy').textContent,/longer/);const home=h.find(n=>n.href==='/');assert.ok(home);const dismiss=h.find(n=>n.tagName==='BUTTON');dismiss.click();assert.equal(panel.hidden,true);finish();assert.equal(h.timers.size,0);
});
test('a new independent check resets dismissed status and pagehide cleans pending timers',()=>{
  const h=harness();h.api.begin();h.tick(8000);h.find(n=>n.tagName==='BUTTON').click();const finish=h.api.begin();h.tick(150);assert.equal(h.find(n=>n.className==='app-loading').hidden,false);h.events.pagehide();assert.equal(h.timers.size,0);assert.equal(h.find(n=>n.className==='app-loading').hidden,true);finish();
});
test('component is opt in and demo does not make requests or change location',()=>{
  const h=harness();h.tick(10000);assert.equal(h.body.children.length,0);const demo=harness({demo:true});demo.tick(150);assert.equal(demo.find(n=>n.className==='app-loading').hidden,false);
});
