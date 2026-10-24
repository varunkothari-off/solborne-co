import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync('public/entry-intent.js','utf8');
function page(path,search='',saved=new Map(),now=1000000){
 const context=vm.createContext({window:{},location:{pathname:path,search},URLSearchParams,Date:{now:()=>now},sessionStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)}});
 vm.runInContext(script,context);return context.window;
}
test('website entry continues through the OAuth canvas callback to enquiry for a new business',()=>{
 const saved=new Map(),signin=page('/signin.html','?next=walk',saved);
 assert.equal(signin.solborneWalkEntry,true);assert.equal(signin.solborneEntryTarget({registered:false}),'/start.html');
 const callback=page('/canvas.html','',saved);
 assert.equal(callback.solborneEntryTarget({registered:false},{consume:true}),'/start.html');
 assert.equal(page('/canvas.html','',saved).solborneEntryTarget({registered:false}),'/canvas.html');
});
test('returning website visitor goes straight to their existing Walk',()=>{
 const entry=page('/signin.html','?next=walk');assert.equal(entry.solborneEntryTarget({registered:true},{consume:true}),'/walk.html');
});
test('canvas entry remains separate and arbitrary return URLs cannot redirect outside the site',()=>{
 for(const search of ['', '?next=https://evil.example', '?next=//evil.example', '?next=/admin']){
  const saved=new Map([['solborne.entry.v1',JSON.stringify({flow:'walk',at:1000000})]]),entry=page('/signin.html',search,saved);
  assert.equal(entry.solborneEntryTarget({registered:true},{consume:true}),'/canvas.html');
 }
});
test('expired or malformed website intent cannot divert a later canvas visit',()=>{
 for(const value of ['bad',JSON.stringify({flow:'walk',at:0}),JSON.stringify({flow:'walk',at:2000000}),JSON.stringify({flow:'other',at:1000000})]){
  const entry=page('/canvas.html','',new Map([['solborne.entry.v1',value]]));assert.equal(entry.solborneEntryTarget({registered:true},{consume:true}),'/canvas.html');
 }
});

test('operations campaign survives OAuth and carries only allowlisted local context',()=>{
 const saved=new Map();page('/signin.html','?next=walk&intent=operations&workflow=payments',saved);
 const callback=page('/canvas.html','',saved);
 assert.equal(callback.solborneEntryTarget({registered:false},{consume:true}),'/start.html?intent=operations&workflow=payments');
 assert.equal(page('/signin.html','?next=walk&intent=operations&workflow=quotes').solborneEntryTarget({registered:true},{consume:true}),'/walk.html?intent=operations&workflow=quotes');
});
test('invalid campaign parameters cannot become arbitrary destinations or workflow text',()=>{
 const entry=page('/signin.html','?next=walk&intent=https://evil.test&workflow=secret');
 assert.equal(entry.solborneEntryTarget({registered:true},{consume:true}),'/walk.html');
});
test('operations entry exposes contextual choice and continues with storage disabled',()=>{
 const context=vm.createContext({window:{},location:{pathname:'/signin.html',search:'?next=walk&intent=operations&workflow=documents'},URLSearchParams,Date:{now:()=>1000},sessionStorage:{getItem(){throw Error('disabled')},setItem(){throw Error('disabled')},removeItem(){throw Error('disabled')}}});
 vm.runInContext(script,context);
 assert.equal(context.window.solborneJourney.intent,'operations');
 assert.equal(context.window.solborneEntryTarget({registered:true}),'/walk.html?intent=operations&workflow=documents');
});

test('OAuth can recover allowlisted journey from a short-lived essential cookie if session storage is blocked',()=>{
 let cookie='';const doc={get cookie(){return cookie;},set cookie(value){cookie=value;}};
 const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')},removeItem(){throw Error('blocked')}};
 const run=(pathname,search)=>{const c=vm.createContext({document:doc,window:{},location:{pathname,search},URLSearchParams,Date:{now:()=>1000000},sessionStorage:storage});vm.runInContext(script,c);return c.window;};
 run('/signin.html','?next=walk&intent=operations&workflow=quotes');
 assert.equal(run('/canvas.html','').solborneEntryTarget({registered:false},{consume:true}),'/start.html?intent=operations&workflow=quotes');
});
