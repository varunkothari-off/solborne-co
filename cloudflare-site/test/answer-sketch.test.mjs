import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleRequest} from '../src/worker.mjs';
import {authHash} from '../src/canvas-auth.mjs';
import {flushPresales} from '../src/presales-sync.mjs';

const origin='https://solborne.in',now=1792580000000,uid='11111111-1111-4111-8111-111111111111';
const project='SB-11111111-1111-4111-8111-111111111111',other='SB-22222222-2222-4222-8222-222222222222';
const sketch=[[{x:.137,y:.219},{x:.843,y:.724}]],question='How would you like your website to feel?';
class D1{constructor(){this.sql=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())this.sql.exec(readFileSync('drizzle/'+name,'utf8'));}prepare(sql){const stmt=this.sql.prepare(sql);let values=[];const q={bind(...v){values=v;return q;},async first(){return stmt.get(...values)||null;},async all(){return {results:stmt.all(...values)};},async run(){return {meta:{changes:stmt.run(...values).changes}};}};return q;}async batch(queries){this.sql.exec('BEGIN');try{const result=[];for(const q of queries)result.push(await q.run());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}}
async function fixture(t){const db=new D1();t.after(()=>db.sql.close());const form='b'.repeat(64),session='a'.repeat(64);db.sql.prepare('INSERT INTO solborne_auth_sessions(token_hash,user_id,access_token,created_at,expires_at,active_registration_id) VALUES(?,?,?,?,?,?)').run(await authHash(session),uid,'SYNTHETIC',now-2000,now+60000,project);db.sql.prepare('INSERT INTO solborne_form_sessions VALUES(?,?,?)').run(await authHash(form),now-2000,now+60000);db.sql.exec('UPDATE solborne_intake_control SET enabled=1');
for(const [id,owner] of [[project,uid],[other,'22222222-2222-4222-8222-222222222222']]){db.sql.prepare('INSERT INTO solborne_registrations VALUES(?,?,?,?,?,?,?,?,?)').run(id,'key-'+id,'hash-'+id,'Synthetic Owner','owner@example.test','website-pilot',1,'solborne-public-intake-v1',now);db.sql.prepare('INSERT INTO solborne_auth_registrations VALUES(?,?,?)').run(owner,id,now);db.sql.prepare('INSERT INTO solborne_ai_walks(registration_id,state_json,created_at,updated_at) VALUES(?,?,?,?)').run(id,JSON.stringify({facts:{businessName:'Synthetic business'},businessBrief:{},messages:[],question,ready:false}),now,now);}
const env={DB:db,SITE_ORIGIN:origin,AUTH_ENABLED:'true',SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'test',AI_WALK_ENABLED:'true',GEMINI_API_KEY:'SYNTHETIC_NOT_A_KEY',GEMINI_MODEL:'gemini-4-argon'};
const cookie='__Host-solborne_identity='+session+'; __Host-solborne_form='+form,authFetch=async()=>Response.json({id:uid,email:'owner@example.test',email_confirmed_at:'2026-10-16',is_anonymous:false});let failure=false,calls=0,payloads=[];
const modelFetch=async(url,options)=>{calls++;payloads.push(JSON.parse(options.body));if(failure)return new Response('Synthetic provider failure',{status:502});const reply=env.GEMINI_MODEL==='gemini-4-argon'?{message:'We can explore that.',question:'What do you offer?',updates:[],unresolved:[],ready:false,stage:'offer',nextTopic:'offer'}:{message:'We can explore that.',question:'What do you offer?',facts:{businessName:'Synthetic business'},businessBrief:{},missing:[],ready:false,template:'editorial',stage:'offer'};return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}]});};
const f={db,env,form,payloads,calls:()=>calls,fail:value=>failure=value,state(id=project){return JSON.parse(db.sql.prepare('SELECT state_json FROM solborne_ai_walks WHERE registration_id=?').get(id).state_json);},setState(value){db.sql.prepare('UPDATE solborne_ai_walks SET state_json=? WHERE registration_id=?').run(JSON.stringify(value),project);},call(path,init={}){return handleRequest(new Request(origin+path,{...init,headers:{Cookie:cookie,'X-Solborne-Project':project,...init.headers}}),env,{clock:()=>now,authFetch,modelFetch});},post(value={},headers={},path='/api/ai-walk'){return this.call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify({csrf:form,revision:0,consent:true,message:'A welcoming place.',...value})});}};return f;}

test('answer sketch is linked to its originating question and stable owner turn, survives read and next text answer',async t=>{
 const f=await fixture(t);assert.equal((await f.post({sketch})).status,200);let state=f.state();
 assert.deepEqual(state.answerSketches,[{turn:1,question,strokes:sketch}]);assert.equal(state.messages.find(m=>m.role==='user').turn,1);assert.equal(state.ownerMessages[0].id,1);
 const read=await(await f.call('/api/ai-walk')).json();assert.deepEqual(read.state.answerSketches,state.answerSketches);
 assert.equal((await f.post({revision:1,message:'We repair furniture.'})).status,200);state=f.state();assert.equal(state.messages.filter(m=>m.role==='user')[1].turn,2);assert.equal(state.ownerMessages[1].id,2);assert.equal(state.answerSketches.length,1);
});
test('a sketch-only answer uses a literal marker without sending raw drawing coordinates to either model',async t=>{
 for(const model of ['gemini-4-argon','gemini-3.1-flash-lite'])for(const message of ['',undefined]){const f=await fixture(t);f.env.GEMINI_MODEL=model;const result=await f.post({message,sketch});assert.equal(result.status,200);assert.equal(f.state().messages.find(m=>m.role==='user').text,'[Sketch attached]');assert.deepEqual(f.state().answerSketches[0].strokes,sketch);const payload=JSON.stringify(f.payloads);assert.ok(payload.includes('[Sketch attached]'));assert.ok(!payload.includes('0.137'));assert.ok(!payload.includes('0.219'));}
});
test('invalid or oversized sketch is rejected before model calls, answer writes or shared rate-limit writes',async t=>{
 const f=await fixture(t),before=f.state(),bad=[null,'<svg/>',[[]],[[{x:2,y:0}]],[[{x:0,y:null}]],[[{x:0,y:0,script:'bad'}]],Array.from({length:81},()=>[{x:0,y:0}]),[Array.from({length:2001},()=>({x:0,y:0}))]];
 for(const value of bad)assert.equal((await f.post({sketch:value})).status,422);assert.equal(f.calls(),0);assert.deepEqual(f.state(),before);assert.equal(f.db.sql.prepare('SELECT calls FROM solborne_ai_walks WHERE registration_id=?').get(project).calls,0);assert.equal(f.db.sql.prepare('SELECT COUNT(*) n FROM solborne_rate_limits').get().n,0);
});
test('failed Argon answer retains its sketch and question; exact retry succeeds once and edited retry conflicts without a paid call',async t=>{
 const f=await fixture(t);f.fail(true);assert.equal((await f.post({sketch})).status,502);const pending=f.state().pendingAnswer;assert.deepEqual(pending.sketch,sketch);assert.equal(pending.question,question);assert.equal(pending.id,1);
 assert.equal((await f.post({sketch:[[{x:.5,y:.5}]]})).status,409);assert.equal(f.calls(),1);assert.deepEqual(f.state().pendingAnswer,pending);
 f.fail(false);assert.equal((await f.post({sketch})).status,200);const state=f.state();assert.equal(state.ownerMessages.length,1);assert.equal(state.pendingAnswer,null);assert.deepEqual(state.answerSketches,[{turn:1,question,strokes:sketch}]);assert.equal(state.messages.filter(m=>m.role==='user').length,1);
});
test('answer sketches obey project ownership, csrf, origin, revision, lease and submission guards',async t=>{
 const f=await fixture(t);for(const headers of [{'X-Solborne-Project':other},{'X-Solborne-Project':''},{Origin:'https://evil.example'}])assert.equal((await f.post({sketch},headers)).status,403);assert.equal((await f.post({sketch,csrf:'bad'})).status,403);assert.equal((await f.post({sketch,revision:99})).status,409);
 f.db.sql.prepare('UPDATE solborne_ai_walks SET busy_until=? WHERE registration_id=?').run(now+60000,project);assert.equal((await f.post({sketch})).status,409);f.db.sql.prepare('UPDATE solborne_ai_walks SET busy_until=0 WHERE registration_id=?').run(project);f.setState({...f.state(),submission:{id:'WB-test'}});assert.equal((await f.post({sketch})).status,409);assert.equal(f.calls(),0);assert.equal(f.state().answerSketches,undefined);assert.equal(f.state(other).answerSketches,undefined);
});
test('manual-review submission and presales outbox preserve private answer sketches',async t=>{
 const f=await fixture(t);assert.equal((await f.post({sketch})).status,200);f.setState({...f.state(),ready:true});assert.equal((await f.post({revision:1,confirmed:true},{},'/api/ai-walk/submit')).status,201);assert.deepEqual(f.state().answerSketches,[{turn:1,question,strokes:sketch}]);let forwarded;f.env.SOLBORNE_PRESALES_TOKEN='SYNTHETIC';await flushPresales(f.env,{fetcher:async(url,options)=>{const data=JSON.parse(options.body);if(data.registrationId===project)forwarded=data;return Response.json({ok:true,registrationId:data.registrationId,sequence:data.sequence});}});assert.deepEqual(forwarded.aiWalk.state.answerSketches,[{turn:1,question,strokes:sketch}]);assert.equal(forwarded.aiWalk.state.submission.status,'awaiting_manual_review');
});
test('past answer sketch can be added, replaced and cleared without another model call',async t=>{
 const f=await fixture(t);assert.equal((await f.post()).status,200);const originalMessages=f.state().messages,calls=f.calls();
 const save=await f.post({revision:1,turn:1,sketch},{},'/api/ai-walk/sketch');assert.equal(save.status,200);assert.deepEqual(f.state().answerSketches,[{turn:1,question,strokes:sketch}]);assert.deepEqual(f.state().messages,originalMessages);
 const replacement=[[{x:.4,y:.6}]];assert.equal((await f.post({revision:2,turn:1,sketch:replacement},{},'/api/ai-walk/sketch')).status,200);assert.deepEqual(f.state().answerSketches,[{turn:1,question,strokes:replacement}]);
 assert.equal((await f.post({revision:3,turn:1,sketch:[]},{},'/api/ai-walk/sketch')).status,200);assert.deepEqual(f.state().answerSketches,[]);assert.equal(f.calls(),calls);
});
test('past answer sketch rejects invalid turn, project, stale, busy, pending and submitted edits',async t=>{
 const f=await fixture(t);assert.equal((await f.post()).status,200);const path='/api/ai-walk/sketch';
 for(const turn of [0,-1,2,1.5,'1'])assert.equal((await f.post({revision:1,turn,sketch},{},path)).status,422);
 assert.equal((await f.post({revision:1,turn:1,sketch},{'X-Solborne-Project':other},path)).status,403);assert.equal((await f.post({revision:0,turn:1,sketch},{},path)).status,409);
 f.db.sql.prepare('UPDATE solborne_ai_walks SET busy_until=? WHERE registration_id=?').run(now+60000,project);assert.equal((await f.post({revision:1,turn:1,sketch},{},path)).status,409);f.db.sql.prepare('UPDATE solborne_ai_walks SET busy_until=0 WHERE registration_id=?').run(project);
 f.setState({...f.state(),pendingAnswer:{id:2,text:'Pending'}});assert.equal((await f.post({revision:1,turn:1,sketch},{},path)).status,409);f.setState({...f.state(),pendingAnswer:null,submission:{id:'WB-test'}});assert.equal((await f.post({revision:1,turn:1,sketch},{},path)).status,409);assert.equal(f.state().answerSketches.length,0);
});
test('legacy text answers use a stable user index and their preceding assistant question when adding a sketch',async t=>{
 const f=await fixture(t);f.setState({...f.state(),messages:[{role:'assistant',text:'What does the entrance look like?'},{role:'user',text:'I can draw it.'},{role:'assistant',text:'What do customers need next?'},{role:'user',text:'A booking.'}]});
 assert.equal((await f.post({turn:1,sketch},{},'/api/ai-walk/sketch')).status,200);assert.deepEqual(f.state().answerSketches,[{turn:1,question:'What does the entrance look like?',strokes:sketch}]);assert.equal(f.calls(),0);
});
test('aggregate private sketch point budget rejects a new answer or edit before a model call or state write',async t=>{
 const f=await fixture(t),full=Array.from({length:10},(_,i)=>({turn:i+1,question:'Saved question',strokes:[Array.from({length:2000},()=>({x:.2,y:.3}))]}));
 f.setState({...f.state(),answerSketches:full,messages:[{role:'user',turn:11,text:'Can add a drawing later',question}]});const before=f.state();
 assert.equal((await f.post({sketch})).status,422);assert.equal((await f.post({turn:11,sketch},{},'/api/ai-walk/sketch')).status,422);assert.deepEqual(f.state(),before);assert.equal(f.calls(),0);
});
