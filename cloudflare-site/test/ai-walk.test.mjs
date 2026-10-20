import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {handleRequest} from '../src/worker.mjs';
import {validateReply,generateReply} from '../src/ai-walk.mjs';
import {renderAIPortfolio} from '../src/ai-portfolio.mjs';
const origin='https://solborne.in',key=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const facts={businessName:'Synthetic Repair Workshop',description:'We repair household objects.',audience:'Local households',services:'Repairs\nMaintenance',location:'Example town',callToAction:'Ask about a repair',email:'public@example.test',phone:'',websiteUrl:'',industry:'Repairs',legalName:'Synthetic Operator',entityType:'Proprietorship',businessAddress:'Example business address',complaintsContact:'public@example.test',feesAndTerms:'Quoted per assignment',dataHandling:'Public contact links only',proofAndPermissions:'No client testimonials supplied',brandDirection:'Simple and practical',currentAndPlanned:'Repairs are current; booking automation is planned'};
const businessBrief={customerJourney:'Enquiry, team review, quote and repair',primaryPain:'Slow manual enquiry handling',desiredOutcome:'Respond promptly',successMeasure:'Measure response time',humanApprovals:'Team approves quotes and release',confirmedPriority:'Owner confirmed enquiry handling',freeScope:'Public services, identity, contact and portfolio'};
const reply={businessBrief,message:'Recorded your repair services.',question:'',facts,missing:[],ready:true,template:'editorial',stage:'review'};
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())this.sql.exec(readFileSync('drizzle/'+name,'utf8'));this.sql.exec('UPDATE solborne_intake_control SET enabled=1');}
 prepare(sql){const database=this.sql;const stmt=this.sql.prepare(sql);let values=[];const q={bind(...v){values=v;return q;},async first(){return stmt.get(...values)||null;},async all(){return {results:stmt.all(...values)};},async run(){const before=database.prepare('SELECT total_changes() AS n').get().n;stmt.run(...values);return {success:true,meta:{changes:database.prepare('SELECT total_changes() AS n').get().n-before}};}};return q;}
 async batch(queries){this.sql.exec('BEGIN');try{const r=[];for(const q of queries)r.push(await q.run());this.sql.exec('COMMIT');return r;}catch(e){this.sql.exec('ROLLBACK');throw e;}}
}
function fixture(t,{enabled=true}={}){const db=new D1();t.after(()=>db.sql.close());let now=1791970000000,fetcher=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}],usageMetadata:{promptTokenCount:100,candidatesTokenCount:50}}));const env={DB:db,SITE_ORIGIN:origin,AI_WALK_ENABLED:enabled?'true':'false',AI_WEBSITE_BUILD_ENABLED:'true',GEMINI_API_KEY:'SYNTHETIC_NOT_A_REAL_KEY'};return {db,env,advance(ms){now+=ms;},setFetch(f){fetcher=f;},call(path,init={}){return handleRequest(new Request(origin+path,init),env,{clock:()=>now,modelFetch:(...args)=>fetcher(...args)});}};}
async function register(f,email='synthetic-one@example.test'){const r=await f.call('/api/registration-session'),{csrf}=await r.json();const s={csrf,cookie:r.headers.get('set-cookie').split(';')[0]};f.advance(1500);const saved=await post(f,s,'/api/registrations',{csrf,idempotencyKey:key(),name:'Synthetic Registration',contact:email,enquiryType:'website-pilot',permissionToRespond:true,website:''});assert.equal(saved.status,201);s.cookie+='; '+saved.headers.get('set-cookie').split(';')[0];return s;}
function post(f,s,path,payload,extra={}){return f.call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:s.cookie,'CF-Connecting-IP':'192.0.2.70',...extra},body:JSON.stringify(payload)});}
function answer(f,s,extra={}){return post(f,s,'/api/ai-walk',{csrf:s.csrf,consent:true,message:'Synthetic repair workshop facts',revision:0,...extra});}
test('AI APIs require registered ownership and do not expose model secrets',async t=>{const f=fixture(t);const status=await f.call('/api/ai-walk/status');assert.deepEqual(await status.json(),{ok:true,enabled:true});assert.equal((await f.call('/api/ai-walk')).status,403);assert.equal((await f.call('/api/ai-walk/preview')).status,403);});

const voiceInput={consent:true,audioConsent:true,audio:btoa('RIFF'+String.fromCharCode(40,0,0,0)+'WAVE'+' '.repeat(48)),mimeType:'audio/wav',durationMs:1000};
test('voice transcription requires ownership, exact origin, CSRF and both consents',async t=>{
 const f=fixture(t),s=await register(f);let calls=0;f.setFetch(async()=>{calls++;throw Error('Must not call');});
 assert.equal((await f.call('/api/ai-walk/transcribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(voiceInput)})).status,403);
 for(const bad of [{csrf:'bad'},{audioConsent:false},{consent:false}])assert.equal((await post(f,s,'/api/ai-walk/transcribe',{csrf:s.csrf,...voiceInput,...bad})).status,bad.csrf?403:422);
 assert.equal((await post(f,s,'/api/ai-walk/transcribe',{csrf:s.csrf,...voiceInput},{Origin:'https://outside.example'})).status,403);assert.equal(calls,0);
});
test('voice transcript is draft input: no saved conversation, submission or audio database record',async t=>{
 const f=fixture(t),s=await register(f);f.setFetch(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"text":"We help local businesses."}'}]}}]})));
 const r=await post(f,s,'/api/ai-walk/transcribe',{csrf:s.csrf,...voiceInput});assert.equal(r.status,200);assert.equal((await r.json()).text,'We help local businesses.');assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_ai_walks').get().n,0);
});
test('microphone permission is limited to the Walk document',async t=>{
 const f=fixture(t);assert.match((await f.call('/ai-walk.html')).headers.get('Permissions-Policy'),/microphone=\(self\)/);assert.match((await f.call('/')).headers.get('Permissions-Policy'),/microphone=\(\)/);
});
test('disabled provider makes no paid call',async t=>{const f=fixture(t,{enabled:false}),s=await register(f);let calls=0;f.setFetch(async()=>{calls++;throw Error();});assert.equal((await answer(f,s)).status,503);assert.equal(calls,0);});
test('explicit model-processing consent, CSRF and exact origin required',async t=>{const f=fixture(t),s=await register(f);assert.equal((await answer(f,s,{consent:false})).status,422);assert.equal((await answer(f,s,{csrf:key()})).status,403);assert.equal((await post(f,s,'/api/ai-walk',{csrf:s.csrf,consent:true,message:'x',revision:0},{Origin:'https://outside.example'})).status,403);});
test('saved draft is isolated from another registration',async t=>{const f=fixture(t),one=await register(f),two=await register(f,'synthetic-two@example.test');assert.equal((await answer(f,one)).status,200);const a=await (await f.call('/api/ai-walk',{headers:{Cookie:one.cookie}})).json(),b=await (await f.call('/api/ai-walk',{headers:{Cookie:two.cookie}})).json();assert.equal(a.state.facts.businessName,facts.businessName);assert.deepEqual(b.state.facts,{});assert.equal(a.state.consentVersion,'solborne-business-walk-v2');});
test('model output schema rejects unexpected fields and missing facts override ready',()=>{assert.throws(()=>validateReply({...reply,facts:{...facts,password:'secret'}}));assert.throws(()=>validateReply({...reply,question:123}));const r=validateReply({...reply,facts:{businessName:'Only a name'}});assert.equal(r.ready,false);assert.ok(r.missing.includes('legalName'));});
test('provider failures preserve saved state and do not leak response content',async t=>{const f=fixture(t),s=await register(f);f.setFetch(async()=>new Response('SECRET_VENDOR_ERROR',{status:401}));const r=await answer(f,s);assert.equal(r.status,502);assert.ok(!(await r.text()).includes('SECRET'));const row=f.db.sql.prepare('SELECT * FROM solborne_ai_walks').get();assert.equal(row.busy_until,0);assert.deepEqual(JSON.parse(row.state_json).facts,{});});

test('Argon retains corrected owner evidence through a failed call without changing the live model default',async t=>{
 const f=fixture(t),s=await register(f);f.env.GEMINI_MODEL='gemini-4-argon';f.setFetch(async()=>new Response('Unavailable',{status:500}));
 assert.equal((await answer(f,s,{message:'Correction: founded in 1998.'})).status,502);let saved=JSON.parse(f.db.sql.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json);assert.equal(saved.ownerMessages.at(-1).text,'Correction: founded in 1998.');
 assert.equal((await answer(f,s,{message:'Correction: founded in 1998.'})).status,502);saved=JSON.parse(f.db.sql.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json);assert.equal(saved.ownerMessages.length,1);
});
test('an unprocessed Argon correction invalidates a previously ready brief and blocks stale submission',async t=>{
 const f=fixture(t),s=await register(f);assert.equal((await answer(f,s)).status,200);f.env.GEMINI_MODEL='gemini-4-argon';f.setFetch(async()=>new Response('Unavailable',{status:500}));
 assert.equal((await answer(f,s,{revision:1,message:'Correction: our address has changed.'})).status,502);
 const saved=JSON.parse(f.db.sql.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json);assert.equal(saved.ready,false);assert.ok(saved.pendingAnswer);
 assert.equal((await post(f,s,'/api/ai-walk/submit',{csrf:s.csrf,revision:1,confirmed:true})).status,422);
});
test('outdated revision and in-flight answers cannot overwrite progress',async t=>{const f=fixture(t),s=await register(f);assert.equal((await answer(f,s)).status,200);assert.equal((await answer(f,s)).status,409);f.db.sql.exec('UPDATE solborne_ai_walks SET busy_until=9999999999999');assert.equal((await answer(f,s,{revision:1})).status,409);});
test('call cap survives an ordinary progress refresh',async t=>{const f=fixture(t),s=await register(f);await answer(f,s);f.db.sql.exec('UPDATE solborne_ai_walks SET calls=40');assert.equal((await answer(f,s,{revision:1})).status,429);});
test('research and marketing run only after public-fact approval, and remain advice',async t=>{const f=fixture(t),s=await register(f);await answer(f,s);let calls=0;f.setFetch(async()=>{calls++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({summary:'Synthetic review',improvements:['Explain services clearly'],unresolved:['Verify asset permission']})}]},groundingMetadata:{groundingChunks:[{web:{uri:'https://example.test/official',title:'Synthetic source'}}]}}]}));});assert.equal((await post(f,s,'/api/ai-walk/review',{csrf:s.csrf,revision:1,ownerApproved:false})).status,422);const r=await post(f,s,'/api/ai-walk/review',{csrf:s.csrf,revision:1,ownerApproved:true});assert.equal(r.status,200);const data=await r.json();assert.equal(calls,2);assert.equal(data.state.review.publishing,'team-review-required');assert.equal(data.state.facts.businessName,facts.businessName);});
test('draft rendering escapes customer text and requires valid contact facts',()=>{const state={ready:true,template:'editorial',review:{},facts:{...facts,businessName:'<script>bad()</script>'}};const html=renderAIPortfolio(state,'');assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('Operated by'));assert.ok(html.includes('Editorial by HTML5 UP'));assert.throws(()=>renderAIPortfolio({...state,facts:{...facts,websiteUrl:'javascript:bad()'}}));assert.ok(renderAIPortfolio({...state,template:'story'}).includes('Story by HTML5 UP'));});
test('AI-approved exact template files enter existing pending queue idempotently',async t=>{const f=fixture(t),s=await register(f);await answer(f,s);const row=f.db.sql.prepare('SELECT * FROM solborne_ai_walks').get(),state=JSON.parse(row.state_json);state.review={research:{summary:'Test',improvements:[],unresolved:[],sources:[]},marketing:{summary:'Test',improvements:[],unresolved:[],sources:[]}};f.db.sql.prepare('UPDATE solborne_ai_walks SET state_json=?').run(JSON.stringify(state));const payload={csrf:s.csrf,revision:1,ownerApproved:true,idempotencyKey:key()};const r=await post(f,s,'/api/ai-walk/complete',payload);assert.ok([200,201].includes(r.status),await r.clone().text());assert.equal((await post(f,s,'/api/ai-walk/complete',payload)).status,200);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n,1);const saved=f.db.sql.prepare('SELECT * FROM solborne_website_artifacts').get();assert.ok(saved.html_content.includes('Editorial by HTML5 UP'));assert.ok(saved.html_content.includes(facts.legalName));assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_website_releases').get().n,0);});
test('deleting an AI draft keeps existing registration, versions and active work safe',async t=>{const f=fixture(t),s=await register(f);await answer(f,s);f.db.sql.exec('UPDATE solborne_ai_walks SET busy_until=9999999999999');const init={method:'DELETE',headers:{Origin:origin,'Content-Type':'application/json',Cookie:s.cookie},body:JSON.stringify({csrf:s.csrf})};assert.equal((await f.call('/api/ai-walk',init)).status,409);f.db.sql.exec('UPDATE solborne_ai_walks SET busy_until=0');assert.equal((await f.call('/api/ai-walk',init)).status,200);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_ai_walks').get().n,0);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_registrations').get().n,1);});

test('full-business brief cannot mark ready without owner-confirmed priority, and private notes never render',()=>{
  assert.equal(validateReply({...reply,businessBrief:{...businessBrief,confirmedPriority:''}}).ready,false);
  assert.throws(()=>validateReply({...reply,businessBrief:{...businessBrief,apiKey:'not-allowed'}}));
  const privateMarker='PRIVATE_INTERNAL_WORKFLOW_NOT_PUBLIC';
  const state=validateReply({...reply,businessBrief:{...businessBrief,currentOperations:privateMarker}});
  assert.equal(state.ready,true);
  assert.equal(renderAIPortfolio({...state,review:{}},'').includes(privateMarker),false);
});
test('runtime carries persistent private discovery separately and uses versioned meta prompt',async()=>{
  let sent;
  const state={facts,businessBrief:{...businessBrief,currentOperations:'PRIVATE_SYNTHETIC_PROCESS'},messages:[],template:'story',review:null};
  const result=await generateReply({GEMINI_API_KEY:'SYNTHETIC',GEMINI_MODEL:'gemini-4-argon'},state,'What happens next?',{fetcher:async(url,options)=>{
    sent={url,payload:JSON.parse(options.body)};
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({message:'We can continue from your existing brief.',question:'Which business outcome matters most?',updates:[],unresolved:[],ready:false,stage:'priority',nextTopic:'priority'})}]}}]}));
  }});
  assert.ok(sent.url.includes('gemini-4-argon:generateContent'));
  assert.match(sent.payload.systemInstruction.parts[0].text,/industry[- ](?:specific|relevant) template comparison/);
  const context=JSON.parse(sent.payload.contents[0].parts[0].text);
  assert.equal(context.currentDraft.businessBrief.currentOperations,'PRIVATE_SYNTHETIC_PROCESS');
  assert.equal(context.currentDraft.facts.currentOperations,undefined);
  assert.ok(result.reply.promptVersion.includes('v6'));
  assert.ok(sent.payload.generationConfig.responseJsonSchema.required.includes('updates'));
});

test('interview-only launch blocks legacy website generation even after reviews',async t=>{const f=fixture(t),s=await register(f);delete f.env.AI_WEBSITE_BUILD_ENABLED;await answer(f,s);let calls=0;f.setFetch(async()=>{calls++;throw Error('must not call');});const preview=await f.call('/api/ai-walk/preview',{headers:{Cookie:s.cookie}});assert.equal(preview.status,503);assert.equal((await preview.json()).code,'manual_design_required');const complete=await post(f,s,'/api/ai-walk/complete',{csrf:s.csrf,revision:1,ownerApproved:true,idempotencyKey:key()});assert.equal(complete.status,503);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n,0);assert.equal(calls,0);});

test('confirmed conversational brief saves a 24-hour handoff without creating or releasing a website',async t=>{
 const f=fixture(t),s=await register(f);delete f.env.AI_WEBSITE_BUILD_ENABLED;await answer(f,s);
 let providerCalls=0;f.setFetch(async()=>{providerCalls++;throw Error('No provider on submission');});
 const payload={csrf:s.csrf,revision:1,confirmed:true};
 const saved=await post(f,s,'/api/ai-walk/submit',payload);assert.equal(saved.status,201);const body=await saved.json();
 assert.equal(body.state.submission.dueAt-body.state.submission.submittedAt,86400000);assert.equal(body.state.submission.status,'awaiting_manual_review');
 assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n,0);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_website_releases').get().n,0);assert.equal(providerCalls,0);
 const replay=await post(f,s,'/api/ai-walk/submit',payload);assert.equal(replay.status,200);assert.equal((await replay.json()).state.submission.id,body.state.submission.id);
 assert.equal((await answer(f,s,{revision:2})).status,409);
 assert(f.db.sql.prepare('SELECT sequence FROM solborne_presales_outbox').get().sequence>1);
});
test('handoff requires owned access, CSRF, confirmation and a current complete brief',async t=>{
 const f=fixture(t),s=await register(f);await answer(f,s);
 assert.equal((await post(f,s,'/api/ai-walk/submit',{csrf:s.csrf,revision:1,confirmed:false})).status,422);
 assert.equal((await post(f,s,'/api/ai-walk/submit',{csrf:'x',revision:1,confirmed:true})).status,403);
 assert.equal((await post(f,s,'/api/ai-walk/submit',{csrf:s.csrf,revision:0,confirmed:true})).status,422);
 const other=await register(f,'synthetic-other@example.test');assert.equal((await post(f,other,'/api/ai-walk/submit',{csrf:other.csrf,revision:1,confirmed:true})).status,422);
});
test('public Walk opens conversation only when enabled, while existing website records remain untouched',async t=>{
 const f=fixture(t);for(const path of ['/walk','/walk/','/walk.html']){const r=await f.call(path);assert.equal(r.status,302);assert.equal(r.headers.get('Location'),'/ai-walk.html');}
 f.env.AI_WALK_ENABLED='false';assert.equal((await f.call('/walk.html')).status,200);
});

test('Live transcription token issuance requires owner, origin, csrf, separate consent and preview flag',async t=>{
 const f=fixture(t),s=await register(f),path='/api/ai-walk/live-token',payload={csrf:s.csrf,consent:true,audioConsent:true};
 f.setFetch(async()=>Response.json({name:'auth_tokens/synthetic-ephemeral'}));
 assert.equal((await post(f,s,path,payload)).status,503);f.env.GEMINI_LIVE_TRANSCRIPTION_ENABLED='true';
 assert.equal((await f.call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(payload)})).status,403);
 assert.equal((await post(f,s,path,{...payload,csrf:key()})).status,403);
 assert.equal((await post(f,s,path,payload,{Origin:'https://outside.example'})).status,403);
 assert.equal((await post(f,s,path,{...payload,audioConsent:false})).status,422);
 const r=await post(f,s,path,payload);assert.equal(r.status,200);const body=await r.json();assert.equal(body.model,'gemini-3.5-transcribe-live');assert.equal(body.token,'auth_tokens/synthetic-ephemeral');assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(JSON.stringify(body).includes(f.env.GEMINI_API_KEY),false);
 assert.equal(f.db.sql.prepare('SELECT count(*) AS n FROM solborne_ai_walks').get().n,0);
 assert.equal((await (await f.call('/api/ai-walk',{headers:{Cookie:s.cookie}})).json()).voiceMode,'live');
 for(let i=0;i<9;i++)assert.equal((await post(f,s,path,payload)).status,200);
 assert.equal((await post(f,s,path,payload)).status,429);
});

test('live websocket permission is limited to the opted-in Walk document',async t=>{
 const f=fixture(t);const normal=await f.call('/ai-walk.html');assert.ok(!normal.headers.get('content-security-policy').includes('wss://'));
 f.env.GEMINI_LIVE_TRANSCRIPTION_ENABLED='true';const walk=await f.call('/ai-walk.html');assert.ok(walk.headers.get('content-security-policy').includes('wss://generativelanguage.googleapis.com'));
 const home=await f.call('/');assert.ok(!home.headers.get('content-security-policy').includes('wss://'));
});

test('invalid, stale and busy AI requests cannot debit the shared daily model allowance',async t=>{
 const f=fixture(t),s=await register(f);let calls=0;f.setFetch(async()=>{calls++;return Response.json({candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}]});});
 for(let i=0;i<3;i++)assert.equal((await post(f,s,'/api/ai-walk/review',{csrf:s.csrf,ownerApproved:true,revision:0})).status,422);
 assert.equal((await answer(f,s,{consent:false})).status,422);
 assert.equal(f.db.sql.prepare("SELECT COALESCE(SUM(count),0) AS n FROM solborne_rate_limits WHERE key LIKE 'ai-walk-global:%'").get().n,0);
 assert.equal(calls,0);assert.equal((await answer(f,s)).status,200);
 assert.equal((await answer(f,s,{revision:0})).status,409);
 assert.equal(f.db.sql.prepare("SELECT SUM(count) AS n FROM solborne_rate_limits WHERE key LIKE 'ai-walk-global:%'").get().n,1);
});
test('two-call review reserves shared units atomically and releases its lease when budget is full',async t=>{
 const f=fixture(t),s=await register(f);assert.equal((await answer(f,s)).status,200);
 f.db.sql.prepare("UPDATE solborne_rate_limits SET count=999 WHERE key LIKE 'ai-walk-global:%'").run();const before=f.db.sql.prepare('SELECT calls FROM solborne_ai_walks').get().calls;
 let provider=0;f.setFetch(async()=>{provider++;throw Error('No budget available');});
 assert.equal((await post(f,s,'/api/ai-walk/review',{csrf:s.csrf,ownerApproved:true,revision:1})).status,429);
 assert.equal(provider,0);assert.equal(f.db.sql.prepare("SELECT count FROM solborne_rate_limits WHERE key LIKE 'ai-walk-global:%'").get().count,999);
 const row=f.db.sql.prepare('SELECT calls,busy_until FROM solborne_ai_walks').get();assert.equal(row.calls,before);assert.equal(row.busy_until,0);
});

test('long owner answers survive intact while oversized transport remains bounded',async t=>{const f=fixture(t),s=await register(f);const message='Detailed business context. '.repeat(500);assert.equal((await answer(f,s,{message})).status,200);const saved=JSON.parse(f.db.sql.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json);assert.equal(saved.messages.find(m=>m.role==='user').text,message);let calls=0;f.setFetch(async()=>{calls++;throw Error('No provider call');});assert.equal((await answer(f,s,{revision:1,message:'x'.repeat(270000)})).status,413);assert.equal(calls,0);});
