import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,applyReply,makePayload,VERSION,schema,generateGroundedArgonReply} from '../src/argon-walk.mjs';
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

test('legacy Argon replies keep working with no suggested answers',()=>{
 const v=applyReply(initialState(),{...reply(),ready:false,question:'What do you provide?',stage:'offer',nextTopic:'offer'});
 assert.deepEqual(v.state.answerIdeas,[]);
});

test('answer ideas are optional drafts and never become facts or evidence',()=>{
 const s=initialState(),r={...reply(),ready:false,message:'We can begin with your priorities.',question:'Which customers should we attract first?',stage:'audience',nextTopic:'audience',answerIdeas:['Describe the customer you would most like to work with.','Not sure yet — help me explore this.']};
 const v=applyReply(s,r).state;
 assert.deepEqual(v.answerIdeas,r.answerIdeas);assert.deepEqual(v.facts,{});assert.deepEqual(v.businessBrief,{});assert.deepEqual(v.evidence,{});assert.deepEqual(v.ownerMessages,[]);assert.equal(v.ready,false);
});

test('answer ideas reject invalid types, too many items, empty text and oversized drafts',()=>{
 for(const answerIdeas of [null,'draft',[1],[''],['   '],['a','b','c','d'],['x'.repeat(241)]])assert.throws(()=>applyReply(initialState(),{...reply(),answerIdeas}),/answer ideas/i);
 assert.deepEqual(applyReply(initialState(),{...reply(),message:'Let’s explore your offer.',ready:false,question:'What do you offer?',stage:'offer',nextTopic:'offer',answerIdeas:['  A starting point  ']}).state.answerIdeas,['A starting point']);
});

test('recovered or completed questions discard stale answer ideas',()=>{
 const r={...reply(),answerIdeas:['An answer to the old question']};assert.deepEqual(applyReply(initialState(),r).state.answerIdeas,[]);
 const s=initialState();s.messages=[{question:'Why do customers switch?'},{question:'Why do customers switch?'}];
 assert.deepEqual(applyReply(s,{...r,ready:false,message:'Understood.',question:'Why do customers switch?',nextTopic:'customer_trigger',stage:'audience'}).state.answerIdeas,[]);
});

test('provider schema and separate helper preserve a single decision without invented owner facts',()=>{
 const p=makePayload(initialState(),{model:'gemini-4-argon'}),prompt=p.systemInstruction.parts[0].text;
 assert.equal(schema.properties.answerIdeas.maxItems,3);assert.equal(schema.properties.answerIdeas.items.maxLength,240);assert.equal(schema.required.includes('answerIdeas'),false);
 assert.match(prompt,/OPTIONAL ANSWER HELP/);assert.match(prompt,/not owner evidence/i);assert.match(prompt,/ONE unanswered decision/);assert.match(prompt,/Do not invent prices/i);
});

test('runtime adapter returns suggested drafts separately from owner-derived fields',async()=>{
 const r={...reply(),ready:false,message:'Let’s start with what you do.',question:'What do you provide?',stage:'offer',nextTopic:'offer',answerIdeas:['Describe your main service and who it helps.']};
 const {reply:result}=await generateGroundedArgonReply({GEMINI_MODEL:'gemini-4-argon',GEMINI_API_KEY:'synthetic'},initialState(),'We run Example Company.',{fetcher:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(r)}]}}]}))});
 assert.deepEqual(result.answerIdeas,r.answerIdeas);assert.deepEqual(result.facts,{});assert.deepEqual(result.evidence,{});assert.equal(result.ownerMessages.length,1);assert.equal(result.ownerMessages[0].text,'We run Example Company.');
});
