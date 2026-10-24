import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {authRoute,authIdentity,authHash} from '../src/canvas-auth.mjs';
import {handleRequest} from '../src/worker.mjs';
import {publicMetrics} from '../src/public-metrics.mjs';
import vm from 'node:vm';
const origin='https://solborne.in',now=1792100000000,uid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user={id:uid,email:'owner@example.test',email_confirmed_at:'2026-10-16T00:00:00Z',is_anonymous:false};
const json=value=>Response.json(value),authFetch=async()=>json(user);
class D1{constructor(){this.sql=new DatabaseSync(':memory:');for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())this.sql.exec(readFileSync('drizzle/'+name,'utf8'));}prepare(sql){const statement=this.sql.prepare(sql);let values=[];const q={bind(...v){values=v;return q;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){return {meta:{changes:statement.run(...values).changes}};}};return q;}async batch(items){this.sql.exec('BEGIN');try{const result=[];for(const item of items)result.push(await item.run());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}}
async function fixture(t){const db=new D1();t.after(()=>db.sql.close());const opaque='a'.repeat(64),form='b'.repeat(64),hash=await authHash(opaque);db.sql.prepare('INSERT INTO solborne_auth_sessions(token_hash,user_id,access_token,created_at,expires_at) VALUES(?,?,?,?,?)').run(hash,uid,'SYNTHETIC',now,now+60000);db.sql.prepare('INSERT INTO solborne_form_sessions VALUES(?,?,?)').run(await authHash(form),now-2000,now+60000);db.sql.exec('UPDATE solborne_intake_control SET enabled=1');const env={DB:db,SITE_ORIGIN:origin,AUTH_ENABLED:'true',SUPABASE_URL:'https://testproject.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};const cookie='__Host-solborne_identity='+opaque+'; __Host-solborne_form='+form;
 return {db,env,hash,cookie,form,async register(projectName,key='c'.repeat(64)){return handleRequest(new Request(origin+'/api/registrations',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({name:'Owner',contact:user.email,enquiryType:'website-pilot',permissionToRespond:true,projectName,csrf:form,idempotencyKey:key,website:''})}),env,{clock:()=>now,authFetch});},async session(){const response=await authRoute(new Request(origin+'/api/auth/session',{headers:{Cookie:cookie}}),env,now,{fetcher:authFetch});return {response,body:await response.json()};}};
}
function seedProject(f,{id,name,status={},owner=uid,at=now}){f.db.sql.prepare('INSERT INTO solborne_registrations VALUES(?,?,?,?,?,?,?,?,?)').run(id,'key-'+id,'hash-'+id,'Owner',user.email,'website-pilot',1,'solborne-public-intake-v1',at);f.db.sql.prepare('INSERT INTO solborne_auth_registrations VALUES(?,?,?)').run(owner,id,at);f.db.sql.prepare('INSERT INTO solborne_ai_walks(registration_id,state_json,created_at,updated_at) VALUES(?,?,?,?)').run(id,JSON.stringify({facts:{businessName:name,websiteUrl:'https://'+id+'.example.test'},businessBrief:{privateNotes:'PRIVATE-'+id},messages:[{role:'user',text:'SECRET-'+id}],...status}),at,at);}

test('project summaries expose safe saved journey and actual allowlisted operations review status',async t=>{
 const f=await fixture(t);const statuses=['awaiting_manual_review','in_review','awaiting_customer','proposal_ready','completed','PRIVATE_BAD_STATUS'];
 for(const [i,status] of statuses.entries())seedProject(f,{id:'ops-'+i,name:'Operations '+i,status:{journey:{intent:'operations',workflow:'documents',private:'PRIVATE_CAMPAIGN'},submission:{status,submittedAt:now-100,owner:'PRIVATE_OWNER',nextAction:'PRIVATE_NEXT',history:['PRIVATE_HISTORY']}}});
 const {body}=await f.session();for(const [i,status] of statuses.entries()){const item=body.registrations.find(x=>x.id==='ops-'+i);assert.deepEqual(item.journey,{intent:'operations',workflow:'documents'});assert.equal(item.projectStatus,status==='PRIVATE_BAD_STATUS'?'awaiting_manual_review':status);}
 assert.doesNotMatch(JSON.stringify(body),/PRIVATE_|privateNotes|SECRET-|businessBrief|history/);
});

test('a legacy website release cannot label an operations review as website delivered',async t=>{
 const f=await fixture(t);seedProject(f,{id:'ops-review',name:'Operations',status:{journey:{intent:'operations',workflow:'payments'},submission:{status:'completed',submittedAt:now-1}}});
 seedProject(f,{id:'old-website',name:'Website'});
 // Represent pre-existing grandfathered releases; this test is not exercising release authorisation.
 f.db.sql.exec('DROP TRIGGER solborne_release_requires_review');
 for(const id of ['ops-review','old-website']){
  f.db.sql.prepare('INSERT INTO solborne_walk_completions(id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at) VALUES(?,?,?,?,?,?,?)').run('completion-'+id,id,'completion-key-'+id,'payload-'+id,'{}','scope',now);
  f.db.sql.prepare('INSERT INTO solborne_website_releases(completion_id,released_at,release_basis) VALUES(?,?,?)').run('completion-'+id,now,'grandfathered');
 }
 const {body}=await f.session();assert.equal(body.registrations.find(x=>x.id==='ops-review').projectStatus,'completed');assert.equal(body.registrations.find(x=>x.id==='old-website').projectStatus,'delivered');
});

test('operations project cards show review completion and open their saved journey rather than stale campaign context',async()=>{
 const element=tag=>({tag,children:[],events:{},classList:{add(){}},append(...items){this.children.push(...items);},setAttribute(){},addEventListener(name,fn){this.events[name]=fn;}});
 const locations=[],calls=[],scope={document:{querySelector:()=>element('status'),querySelectorAll:()=>[],createElement:element},window:{solborneJourney:{intent:'operations',workflow:'quotes'}},URL,location:{assign:url=>locations.push(url)},fetch:async(url,options)=>{calls.push({url,options});return {ok:true};}};
 const code=readFileSync('public/canvas.js','utf8');vm.runInNewContext(code.slice(0,code.lastIndexOf('(async()=>')),scope);
 const card=scope.projectCard({id:'owned',projectName:'Own review',journey:{intent:'operations',workflow:'payments'},projectStatus:'completed',submittedAt:now},false).children[0];assert.equal(card.children[0].children[1].textContent,'Review completed');
 const button=card.children.at(-1);await button.events.click();assert.equal(locations[0],'/walk.html?intent=operations&workflow=payments');assert.equal(JSON.parse(calls[0].options.body).registrationId,'owned');
});

test('same account receives two separately named projects and independent progress without draft contents',async t=>{const f=await fixture(t);seedProject(f,{id:'brand-one',name:'Brand One'});seedProject(f,{id:'brand-two',name:'Brand Two',status:{submission:{submittedAt:now-1000}},at:now+1});f.db.sql.prepare('UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=?').run('brand-two',f.hash);const {body}=await f.session();assert.equal(body.activeRegistration,'brand-two');assert.equal(body.registrations.length,2);assert.deepEqual(body.registrations.map(p=>({name:p.projectName,status:p.projectStatus})),[{name:'Brand Two',status:'awaiting_manual_review'},{name:'Brand One',status:'in_progress'}]);assert.equal(body.registrations[0].submittedAt,now-1000);assert.equal(body.registrations[1].website,'https://brand-one.example.test');assert.doesNotMatch(JSON.stringify(body),/PRIVATE-|SECRET-|state_json|access_token|businessBrief/);});

test('foreign projects remain unreadable and unselectable even when active ID is tampered',async t=>{const f=await fixture(t);seedProject(f,{id:'own-project',name:'Own Project'});seedProject(f,{id:'foreign-project',name:'Foreign Project',owner:other});f.db.sql.prepare('UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=?').run('foreign-project',f.hash);const identity=await authIdentity(new Request(origin,{headers:{Cookie:f.cookie}}),f.env,now,authFetch);assert.equal(identity.registration_id,null);const {response,body}=await f.session();assert.equal(body.registered,false);assert.equal(body.activeRegistration,null);assert.deepEqual(body.registrations.map(x=>x.id),['own-project']);assert.doesNotMatch(JSON.stringify(body),/Foreign Project|foreign-project/);const csrfCookie=response.headers.get('set-cookie').split(';')[0];const result=await authRoute(new Request(origin+'/api/auth/select-registration',{method:'POST',headers:{Origin:origin,Cookie:f.cookie+'; '+csrfCookie,'Content-Type':'application/json'},body:JSON.stringify({csrf:body.csrf,registrationId:'foreign-project'})}),f.env,now,{fetcher:authFetch});assert.equal(result.status,403);});

test('project name seeds its own Walk and idempotent replay does not create a duplicate',async t=>{const f=await fixture(t);const one=await f.register('  Example Cycle Repairs  ');assert.equal(one.status,201);const first=await one.json(),draft=JSON.parse(f.db.sql.prepare('SELECT state_json FROM solborne_ai_walks WHERE registration_id=?').get(first.receipt).state_json);assert.equal(draft.facts.businessName,'Example Cycle Repairs');assert.equal(draft.ready,false);const replay=await f.register('  Example Cycle Repairs  ');assert.equal(replay.status,200);const second=await replay.json();assert.equal(second.receipt,first.receipt);assert.equal(second.replayed,true);assert.equal(f.db.sql.prepare('SELECT COUNT(*) n FROM solborne_registrations').get().n,1);assert.equal(f.db.sql.prepare('SELECT COUNT(*) n FROM solborne_auth_registrations').get().n,1);assert.equal(f.db.sql.prepare('SELECT COUNT(*) n FROM solborne_ai_walks').get().n,1);assert.equal((await f.session()).body.registrations[0].projectName,'Example Cycle Repairs');});

test('invalid project names cannot create project records',async t=>{const f=await fixture(t);for(const value of ['', ' '.repeat(5),'x'.repeat(121),'Bad\nName',17]){const response=await f.register(value);assert.equal(response.status,422);}assert.equal(f.db.sql.prepare('SELECT COUNT(*) n FROM solborne_registrations').get().n,0);});

test('public metrics exports only two validated aggregate numbers and sends no customer or secret data',async()=>{let call;const response=await handleRequest(new Request(origin+'/api/public-metrics'),{SUPABASE_URL:'https://testproject.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},{clock:()=>now,modelFetch:async(url,options)=>{call={url,options};return json({businessesHelped:12,freeWebsitesDelivered:4,customers:['PRIVATE'],internalRevenue:999});}});assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,businessesHelped:12,freeWebsitesDelivered:4});assert.equal(call.url.pathname,'/functions/v1/solborne-metrics');assert.equal(call.options.method,'GET');assert.equal(call.options.body,undefined);assert.equal(call.options.redirect,'manual');assert.equal(call.options.headers.apikey,'sb_publishable_test');assert.equal(call.options.headers.Authorization,undefined);});

test('public metrics rejects invalid aggregates and exposes a neutral outage response',async()=>{const env={SUPABASE_URL:'https://testproject.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};for(const value of [{businessesHelped:-1,freeWebsitesDelivered:0},{businessesHelped:'4',freeWebsitesDelivered:2},{businessesHelped:2,freeWebsitesDelivered:1.5},{businessesHelped:2,freeWebsitesDelivered:Number.MAX_SAFE_INTEGER+1},{}])await assert.rejects(()=>publicMetrics(env,{fetcher:async()=>json(value)}),/Invalid metrics/);for(const fetcher of [async()=>new Response('private database error',{status:503}),async()=>{throw Error('private upstream detail');}]){const response=await handleRequest(new Request(origin+'/api/public-metrics'),env,{clock:()=>now,modelFetch:fetcher});assert.equal(response.status,503);const body=await response.json();assert.equal(body.code,'metrics_unavailable');assert.doesNotMatch(JSON.stringify(body),/private|upstream|database/);assert.equal(body.businessesHelped,undefined);}});


test('a project pinned in an older tab stays separate after another tab selects a different project',async t=>{
 const f=await fixture(t),a='SB-11111111-1111-4111-8111-111111111111',b='SB-22222222-2222-4222-8222-222222222222',foreign='SB-33333333-3333-4333-8333-333333333333';
 seedProject(f,{id:a,name:'Project A'});seedProject(f,{id:b,name:'Project B'});seedProject(f,{id:foreign,name:'Private foreign project',owner:other});
 f.db.sql.prepare('UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=?').run(b,f.hash);
 const read=async pinned=>handleRequest(new Request(origin+'/api/ai-walk',{headers:{Cookie:f.cookie,...(pinned?{'X-Solborne-Project':pinned}:{})}}),f.env,{clock:()=>now,authFetch});
 const older=await read(a);assert.equal(older.status,200);assert.equal((await older.json()).state.facts.businessName,'Project A');
 const current=await read(b);assert.equal(current.status,200);assert.equal((await current.json()).state.facts.businessName,'Project B');
 const denied=await read(foreign);assert.equal(denied.status,403);assert.doesNotMatch(await denied.text(),/Private foreign project/);
 const unbound=await handleRequest(new Request(origin+'/api/ai-walk',{method:'POST',headers:{Cookie:f.cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({csrf:f.form,consent:true,message:'A stale unbound answer',revision:0})}),f.env,{clock:()=>now,authFetch});assert.equal(unbound.status,403);
 assert.equal(JSON.parse(f.db.sql.prepare('SELECT state_json FROM solborne_ai_walks WHERE registration_id=?').get(b).state_json).messages.length,1);
});

test('page fetch wrapper retains its first project binding without leaking it cross-origin',async()=>{
 const a='SB-11111111-1111-4111-8111-111111111111',calls=[];let current=a;
 const win={fetch:async(input,options={})=>{calls.push({input,options});return Response.json({authenticated:true,activeRegistration:current});}};
 const scope={window:win,location:{origin},URL,Headers,Request,fetch:(...args)=>win.fetch(...args)};
 vm.runInNewContext(readFileSync('public/auth-session.js','utf8'),scope);
 await win.solborneSession();current='SB-22222222-2222-4222-8222-222222222222';
 await win.fetch('/api/ai-walk',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 await win.fetch(new Request(origin+'/api/walk/status',{headers:{Accept:'application/json'}}));
 await win.fetch('https://elsewhere.example/api/ai-walk',{method:'POST'});
 await win.fetch('/api/public-metrics');
 assert.equal(calls.filter(x=>x.input==='/api/auth/session').length,1);
 assert.equal(calls[1].options.headers.get('X-Solborne-Project'),a);assert.equal(calls[1].options.headers.get('Content-Type'),'application/json');
 assert.equal(calls[2].options.headers.get('X-Solborne-Project'),a);assert.equal(calls[2].options.headers.get('Accept'),'application/json');
 assert.equal(calls[3].options.headers,undefined);assert.equal(calls[4].options.headers,undefined);
});


test('project-name seed failure rolls registration, ownership and active selection back together',async t=>{
 const f=await fixture(t);f.db.sql.exec("CREATE TRIGGER fail_project_seed BEFORE INSERT ON solborne_ai_walks BEGIN SELECT RAISE(ABORT,'synthetic seed failure');END;");
 const response=await f.register('Must stay atomic');assert.equal(response.status,503);
 for(const table of ['solborne_registrations','solborne_auth_registrations','solborne_ai_walks'])assert.equal(f.db.sql.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);
 assert.equal(f.db.sql.prepare('SELECT active_registration_id FROM solborne_auth_sessions WHERE token_hash=?').get(f.hash).active_registration_id,null);
});
