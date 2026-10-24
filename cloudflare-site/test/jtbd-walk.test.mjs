import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {validateReply,generateReply,answerDraft,submitBrief} from '../src/ai-walk.mjs';
import {initialState as argonState,applyReply,makePayload} from '../src/argon-walk.mjs';

const journey={intent:'operations',workflow:'payments'};
const facts={businessName:'Synthetic Studio',description:'We create designs for businesses.'};
const businessBrief={customerJourney:'Invoice, reminder, payment',primaryPain:'Owner chases invoices',desiredOutcome:'Know who needs attention',successMeasure:'Track time spent following up',humanApprovals:'Owner handles disputes',confirmedPriority:'Payment follow-ups',currentWorkaround:'Spreadsheet and email'};
const complete={facts,businessBrief,message:'Your workflow brief is ready for review.',question:'',ready:true,missing:[],template:'editorial',stage:'review'};
class D1 {
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('CREATE TABLE solborne_ai_walks(registration_id TEXT PRIMARY KEY,state_json TEXT,revision INTEGER DEFAULT 0,calls INTEGER DEFAULT 0,busy_until INTEGER DEFAULT 0,created_at INTEGER,updated_at INTEGER); CREATE TABLE solborne_rate_limits(key TEXT PRIMARY KEY,count INTEGER,expires_at INTEGER);');}
 prepare(sql){const stmt=this.sql.prepare(sql);let values=[];return {bind(...v){values=v;return this;},async first(){return stmt.get(...values)||null;},async run(){return {meta:{changes:stmt.run(...values).changes}};}};}
 async batch(queries){return Promise.all(queries.map(x=>x.run()));}
}
function fixture(t,state){const db=new D1();t.after(()=>db.sql.close());const env={DB:db,AI_WALK_ENABLED:'true',GEMINI_API_KEY:'SYNTHETIC_KEY_ONLY'};if(state)db.sql.prepare('INSERT INTO solborne_ai_walks(registration_id,state_json,created_at,updated_at) VALUES(?,?,?,?)').run('project',JSON.stringify(state),1,1);return {db,env};}
const fetcher=async()=>Response.json({candidates:[{content:{parts:[{text:JSON.stringify(complete)}]}}]});
test('operations readiness needs its job and process but no website legal, brand or public-contact fields',()=>{
 assert.equal(validateReply(complete,journey).ready,true);
 for(const field of Object.keys(businessBrief))assert.equal(validateReply({...complete,businessBrief:{...businessBrief,[field]:''}},journey).ready,false,field);
 assert.equal(validateReply(complete).ready,false);
 assert.equal(validateReply({...complete,businessBrief:{...businessBrief,currentWorkaround:'Deferred by owner; team to confirm'}},journey).ready,false);
});
test('website visitor can explicitly defer deeper operations without fabricating a priority',()=>{
 const s=argonState();s.facts={businessName:'Synthetic Studio',description:'Design work',audience:'Businesses',services:'Design',callToAction:'Contact us',industry:'Design',legalName:'Synthetic Operator',entityType:'Proprietorship',businessAddress:'Example address',email:'public@example.test'};s.businessBrief={customerJourney:'Deferred by owner',primaryPain:'Deferred by owner',desiredOutcome:'Deferred by owner',successMeasure:'Deferred by owner',humanApprovals:'Deferred by owner',confirmedPriority:'Deferred by owner',freeScope:'One page website'};
 for(const [target,values] of Object.entries({facts:s.facts,businessBrief:s.businessBrief}))for(const [field,value] of Object.entries(values)){s.ownerMessages.push({id:s.ownerMessages.length+1,text:value});s.evidence[target+'.'+field]={kind:value.startsWith('Deferred')?'deferred':'owner_stated',sourceTurn:s.ownerMessages.length,quote:value};}
 const result=applyReply(s,{message:'Ready for review with deferred details visible.',question:'',ready:true,updates:[],unresolved:[],stage:'review',nextTopic:'handoff'}).state;assert.equal(result.ready,true);assert.equal(result.businessBrief.primaryPain,'Deferred by owner');
});
test('both provider paths receive the operations job and override website-only discovery',async()=>{
 let payload;await generateReply({GEMINI_API_KEY:'SYNTHETIC',GEMINI_MODEL:'gemini-2.5-flash-lite'},{journey,messages:[],facts:{},businessBrief:{}},'Help with invoices',{fetcher:async(_,options)=>{payload=JSON.parse(options.body);return fetcher();}});
 assert.match(payload.systemInstruction.parts[0].text,/OPERATIONS JOURNEY/);assert.deepEqual(JSON.parse(payload.contents[0].parts[0].text).journey,journey);
 const p=makePayload({...argonState(),journey},{model:'gemini-4-argon'});assert.match(p.systemInstruction.parts[0].text,/OPERATIONS JOURNEY/);assert.deepEqual(JSON.parse(p.contents[0].parts[0].text).journey,journey);
});
test('Argon readiness uses grounded operational fields and recovery asks current workaround instead of website details',()=>{
 const s={...argonState(),journey,facts:{...facts},businessBrief:{...businessBrief}};
 for(const [target,values] of Object.entries({facts,businessBrief}))for(const [field,value] of Object.entries(values)){s.ownerMessages.push({id:s.ownerMessages.length+1,text:value});s.evidence[target+'.'+field]={kind:'owner_stated',sourceTurn:s.ownerMessages.length,quote:value};}
 const reply={message:'Ready for your review.',question:'',ready:true,updates:[],unresolved:[],stage:'review',nextTopic:'handoff'};
 assert.equal(applyReply(s,reply).state.ready,true);
 delete s.businessBrief.currentWorkaround;const next=applyReply(s,reply).state;assert.equal(next.ready,false);assert.match(next.question,/today|currently|workaround/i);assert.doesNotMatch(next.question,/website|address|legal/i);
});
test('malformed journey is rejected before storage and provider work',async t=>{
 const {db,env}=fixture(t);let calls=0;
 for(const bad of [{intent:'evil',workflow:''},{intent:'operations',workflow:'javascript:bad'},{intent:'operations',workflow:null},[],{intent:'website',workflow:'payments'},{intent:'operations',workflow:'payments',redirect:'https://evil.test'}]){
  const result=await answerDraft(env,'project',{consent:true,revision:0,message:'Hello',journey:bad},100,{fetcher:async()=>{calls++;return fetcher();}});assert.equal(result.status,422);
 }
 assert.equal(calls,0);assert.equal(db.sql.prepare('SELECT count(*) n FROM solborne_ai_walks').get().n,0);
});
test('failed first provider call retains selected journey without fabricating an answer',async t=>{
 const {env}=fixture(t);assert.equal((await answerDraft(env,'project',{consent:true,revision:0,message:'Help with payments',journey},100,{fetcher:async()=>new Response('Unavailable',{status:503})})).status,502);
 const result=await answerDraft(env,'project',{consent:true,revision:0,message:'Help with payments',journey:{intent:'website',workflow:''}},200,{fetcher});assert.equal(result.status,200);assert.deepEqual(result.body.state.journey,journey);assert.equal(result.body.state.messages.filter(x=>x.role==='user').length,1);
});
test('first answer persists journey and saved journey wins over later campaign links',async t=>{
 const {db,env}=fixture(t);const first=await answerDraft(env,'project',{consent:true,revision:0,message:'Help with payment follow-ups',journey},100,{fetcher});assert.equal(first.status,200);assert.deepEqual(first.body.state.journey,journey);
 const second=await answerDraft(env,'project',{consent:true,revision:1,message:'And disputes need me',journey:{intent:'website',workflow:''}},200,{fetcher});assert.equal(second.status,200);assert.deepEqual(second.body.state.journey,journey);
 assert.deepEqual(JSON.parse(db.sql.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json).journey,journey);
});
test('legacy nonempty draft cannot be silently switched into operations',async t=>{
 const s={facts:{businessName:'Existing'},businessBrief:{},messages:[{role:'user',text:'Build my website'}],ready:false};const {env}=fixture(t,s);
 const result=await answerDraft(env,'project',{consent:true,revision:0,message:'Continue',journey},100,{fetcher});assert.equal(result.status,200);assert.equal(result.body.state.journey.intent,'website');
});
test('operations handoff has no website deadline, keeps one receipt and records accountable status',async t=>{
 const {db,env}=fixture(t,{...complete,journey,messages:[]});const first=await submitBrief(env,'project',{confirmed:true,revision:0},1000);assert.equal(first.status,201);const s=first.body.state.submission;
 assert.match(s.id,/^WB-/);assert.equal(s.dueAt,null);assert.equal(s.service,'operations');assert.equal(s.owner,'Solborne team');assert.equal(s.team,'Solborne');assert.equal(s.nextAction,'Team review of your workflow brief');assert.deepEqual(s.history,[{at:1000,status:'awaiting_manual_review',owner:'Solborne team'}]);
 const replay=await submitBrief(env,'project',{confirmed:true,revision:0},2000);assert.equal(replay.status,200);assert.equal(replay.body.state.submission.id,s.id);assert.equal(JSON.parse(db.sql.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json).submission.history.length,1);
});
test('website handoff keeps 24 hour deadline and status history',async t=>{
 const {env}=fixture(t,{ready:true,facts,businessBrief,messages:[]});const saved=await submitBrief(env,'project',{confirmed:true,revision:0},1000);assert.equal(saved.status,201);assert.equal(saved.body.state.submission.dueAt,86401000);assert.equal(saved.body.state.submission.service,'website');
});
