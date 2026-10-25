import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const path='public/walk-demo.js';
const scope={window:{}};if(existsSync(path))vm.runInNewContext(readFileSync(path,'utf8'),scope);
const api=scope.window.SolborneWalkDemo;
test('demo stays within four known customer jobs',()=>{
 assert.ok(api,'Inspectable Walk demo required');assert.equal(api.create('evil').route,'payments');assert.equal(api.create('website').route,'website');
});
test('a multi-fact answer advances only to the missing decision',()=>{
 let s=api.create('payments');s=api.choose(s,'situation','email-chase');
 assert.equal(s.answers.method,'email');assert.equal(s.answers.goal,'less-chasing');assert.equal(api.question(s).key,'approval');
});
test('correction replaces the process and preserves supplied goal and human authority',()=>{
 let s=api.choose(api.create('payments'),'situation','email-chase');s=api.choose(s,'approval','exceptions');s=api.choose(s,'method','whatsapp');
 assert.equal(s.answers.method,'whatsapp');assert.equal(s.answers.goal,'less-chasing');assert.equal(s.answers.approval,'exceptions');assert.equal(api.question(s).key,'review');
 assert.equal(api.project(s).method,'WhatsApp reminders');
});
test('dispute pauses routine chasing and brings context to a person without sending anything',()=>{
 const s=api.choose(api.create('payments'),'situation','dispute'),p=api.project(s);
 assert.equal(p.paused,true);assert.match(p.human,/dispute/i);assert.equal(p.submitted,false);assert.equal(s.confirmed,false);
});
test('confirmation is a local illustrative review and never an actual submitted receipt',()=>{
 let s=api.choose(api.create('payments'),'situation','email-chase');s=api.choose(s,'approval','exceptions');s=api.confirm(s);
 assert.equal(s.confirmed,true);assert.equal(api.project(s).submitted,false);assert.equal(api.project(s).reference,null);
 assert.throws(()=>api.choose(s,'method','secret-script'));
});
test('website asks for its own content decision and never forces a payment workflow',()=>{
 let s=api.choose(api.create('website'),'situation','presence');assert.equal(api.question(s).key,'approval');
 s=api.choose(s,'approval','content');assert.equal(api.question(s).key,'review');assert.equal(api.project(s).route,'website');
});
test('a confirmed example can reopen for correction without losing the rest of the brief',()=>{
 let s=api.choose(api.create('payments'),'situation','email-chase');s=api.confirm(api.choose(s,'approval','exceptions'));
 const opened=api.reopen(s);assert.equal(opened.confirmed,false);assert.deepEqual(opened.answers,s.answers);
 const corrected=api.choose(opened,'method','whatsapp');assert.equal(corrected.answers.approval,'exceptions');assert.equal(corrected.confirmed,false);
});
