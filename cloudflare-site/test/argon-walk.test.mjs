import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyReply,makePayload,VERSION} from '../src/argon-walk.mjs';
const reply=()=>({message:'Your brief is ready.',question:'',updates:[],unresolved:[],ready:true,stage:'review',nextTopic:'handoff'});
const u=(field,value,quote)=>({target:'facts',field,value,quote,sourceTurn:1,kind:'owner_stated'});
test('Argon normalizes an owner-supplied LLP without adding an entity',()=>{
 const s=initialState();s.ownerMessages=[{id:1,text:'Operator: KISNO PROPTY LLP, LLPIN ACK-0281.'}];const r=reply();r.updates=[u('legalName','KISNO PROPTY LLP (LLPIN ACK-0281)','KISNO PROPTY LLP, LLPIN ACK-0281'),u('entityType','Limited Liability Partnership','KISNO PROPTY LLP')];const v=applyReply(s,r);assert.equal(v.state.facts.legalName,'KISNO PROPTY LLP');assert.equal(v.state.facts.entityType,'LLP');
});
test('proprietor identity stays distinct from the trading brand',()=>{
 const s=initialState();s.ownerMessages=[{id:1,text:'KFS is a proprietorship. The proprietor is Varun Kothari.'}];const r=reply();r.updates=[u('legalName','KFS','KFS is a proprietorship. The proprietor is Varun Kothari.'),u('entityType','Proprietorship','KFS is a proprietorship.')];const v=applyReply(s,r);assert.equal(v.state.facts.legalName,'Varun Kothari');assert.equal(v.state.facts.entityType,'Proprietorship');
});
test('customer-visible completion cannot contradict missing saved facts',()=>{
 const s=initialState();s.ownerMessages=[{id:1,text:'Business is KFS.'}];const v=applyReply(s,reply());assert.equal(v.state.ready,false);assert.doesNotMatch(v.state.message,/is ready|all set|completed/i);assert.ok(v.state.question);assert.notEqual(v.state.nextTopic,'handoff');
});
test('repeated question gets a different useful next gap instead of looping',()=>{
 const s=initialState();s.ownerMessages=[{id:1,text:'The business is KFS.'}];s.messages=[{question:'Why do customers switch?',nextTopic:'customer_trigger'},{question:'Why do customers switch?',nextTopic:'customer_trigger'}];const r={...reply(),ready:false,stage:'audience',nextTopic:'customer_trigger',message:'Understood.',question:'Why do customers switch?'};const v=applyReply(s,r);assert.notEqual(v.state.question,r.question);assert.equal(v.state.questionRecovery,true);
});
test('Argon coach uses original owner messages and voice correction examples',()=>{
 const s=initialState();s.ownerMessages=[{id:1,text:'Started in 2004, sorry, 1998.'}];const p=makePayload(s,{model:'gemini-4-argon'});assert.ok(p.systemInstruction.parts[0].text.includes('NEXT DECISION'));assert.ok(p.systemInstruction.parts[0].text.includes('negations'));assert.ok(JSON.stringify(p.contents).includes('1998'));assert.ok(VERSION.includes('v6'));
});
