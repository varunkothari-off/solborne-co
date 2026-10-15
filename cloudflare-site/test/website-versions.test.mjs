import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { handleRequest } from '../src/worker.mjs';

const origin='https://solborne.in';
const uuid='SW-11111111-1111-4111-8111-111111111111';
const sha=text=>createHash('sha256').update(text).digest('hex');
const key=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const facts=()=>({businessName:'Version Workshop',description:'We repair useful everyday objects.',audience:'Local households',services:'Repairs\nAdvice',location:'',callToAction:'Ask about a repair',email:'public@example.test',phone:'',websiteUrl:''});

class D1 {
  constructor({legacy=false}={}){
    this.sql=new DatabaseSync(':memory:');
    this.sql.exec('PRAGMA foreign_keys=ON');
    const migrations=readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort();
    this.sql.exec(readFileSync('drizzle/'+migrations[0],'utf8'));
    if(legacy){
      this.sql.prepare('INSERT INTO solborne_registrations VALUES (?,?,?,?,?,?,?,?,?)').run('SB-legacy',sha('legacy-key'),sha('legacy-payload'),'PRIVATE_LEGACY_NAME','private-legacy@example.test','website-pilot',1,'solborne-public-intake-v1',1791360000000);
      this.sql.prepare('INSERT INTO solborne_walk_completions VALUES (?,?,?,?,?,?,?)').run(uuid,'SB-legacy',sha('legacy-completion-key'),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',1791360000000);
    }
    for(const name of migrations.slice(1))this.sql.exec(readFileSync('drizzle/'+name,'utf8'));
    this.beforeBatch=null;
  }
  prepare(sql){
    const statement=this.sql.prepare(sql);let values=[];
    const query={bind(...next){values=next;return query;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},execute(){const result=statement.run(...values);return {success:true,meta:{changes:result.changes}};},async run(){return query.execute();}};
    return query;
  }
  async batch(queries){
    this.beforeBatch?.();
    this.sql.exec('BEGIN');
    try{const result=queries.map(query=>query.execute());this.sql.exec('COMMIT');return result;}
    catch(error){this.sql.exec('ROLLBACK');throw error;}
  }
}
function fixture(t,options={}){
  const db=new D1(options);t.after(()=>db.sql.close());
  db.sql.exec('UPDATE solborne_intake_control SET enabled=1');
  let now=1791360000000000/1000;
  const env={DB:db,SITE_ORIGIN:origin};
  const f={db,env,advance(ms){now+=ms;},call(path,init={}){return handleRequest(new Request(origin+path,init),env,{clock:()=>now});},count(table){return db.sql.prepare(`SELECT count(*) n FROM ${table}`).get().n;}};
  return f;
}
async function register(f,contact='PRIVATE_REGISTRATION_EMAIL@example.test'){
  const session=await f.call('/api/registration-session');assert.equal(session.status,200);
  const {csrf}=await session.json(),s={csrf,cookie:session.headers.get('set-cookie').split(';')[0]};f.advance(1500);
  const response=await post(f,s,{csrf,idempotencyKey:key(),name:'PRIVATE_REGISTRATION_NAME',contact,enquiryType:'website-pilot',permissionToRespond:true,website:''},'/api/registrations');
  assert.equal(response.status,201);s.cookie+='; '+response.headers.get('set-cookie').split(';')[0];return s;
}
function post(f,s,p,path='/api/walk/complete',headers={}){return f.call(path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:s.cookie,'CF-Connecting-IP':'192.0.2.90',...headers},body:JSON.stringify(p)});}
function completeInput(s,extra={}){return {csrf:s.csrf,idempotencyKey:key(),answers:['PRIVATE_STORY_0','PRIVATE_STORY_1','PRIVATE_STORY_2','PRIVATE_STORY_3','PRIVATE_STORY_4'],facts:facts(),ownerApproved:true,...extra};}
function revisionInput(s,parentCompletion,extra={}){return {csrf:s.csrf,idempotencyKey:key(),parentCompletion,facts:{...facts(),businessName:'Revised Workshop'},ownerApproved:true,...extra};}
async function complete(f,s,p=completeInput(s)){const response=await post(f,s,p);assert.equal(response.status,201);return response.json();}
const get=(f,s,path)=>f.call(path,{headers:{Cookie:s.cookie}});
const filePaths=id=>[`/downloads/website/${id}/index.html`,`/downloads/website/${id}/README.txt`];
async function released(f,s,row){f.db.sql.prepare("UPDATE solborne_owner_reviews SET status='reviewed',updated_at=? WHERE completion_id=?").run(Date.now(),row.completion);f.db.sql.prepare("INSERT INTO solborne_website_releases(completion_id,released_at,release_basis) VALUES (?,?,'reviewed')").run(row.completion,Date.now());const {version}=await (await get(f,s,'/api/walk/versions/'+row.completion)).json();return {...row,...version};}

test('a durable completion creates one exact saved artifact, one pending queue entry and one audit event',async t=>{
  const f=fixture(t),s=await register(f),receipt=await complete(f,s);
  const list=await get(f,s,'/api/walk/versions');assert.equal(list.status,200);
  const {versions}=await list.json();assert.equal(versions.length,1);
  assert.equal(versions[0].completion,receipt.completion);assert.equal(versions[0].project,receipt.completion);
  assert.equal(versions[0].version,1);assert.equal(versions[0].parentCompletion,null);assert.equal(versions[0].isLatest,true);assert.equal(versions[0].sourceMode,'saved-files');
  const artifact=f.db.sql.prepare('SELECT * FROM solborne_website_artifacts').get();
  assert.equal(receipt.deliveryState,'pending');assert.deepEqual(receipt.downloads,[]);assert.equal(f.count('solborne_website_releases'),0);
  const html=artifact.html_content,readme=artifact.readme_content;
  assert.match(html,/Version Workshop/);assert.match(readme,/Open index\.html/);
  assert.equal(artifact.html_content,html);assert.equal(artifact.readme_content,readme);
  assert.equal(artifact.html_sha256,sha(html));assert.equal(artifact.readme_sha256,sha(readme));assert.equal(artifact.render_version,'solborne-static-v1');
  assert.deepEqual(versions[0].sourceHashes,{html:sha(html),readme:sha(readme)});
  assert.equal(f.count('solborne_owner_reviews'),1);assert.equal(f.count('solborne_owner_review_events'),1);
  assert.equal(f.db.sql.prepare('SELECT status FROM solborne_owner_reviews').get().status,'pending');
  assert.doesNotMatch(JSON.stringify(versions),/PRIVATE_|private_|registration_id|token|payload_hash/);
  assert.doesNotMatch(html+readme,/PRIVATE_/);
});

test('versions and approved public facts are registration gated and remain readable without intake or CSRF',async t=>{
  const f=fixture(t),s=await register(f),r=await complete(f,s),other=await register(f,'different-private@example.test');
  f.db.sql.exec('UPDATE solborne_intake_control SET enabled=0');f.advance(3600001);
  for(const path of ['/api/walk/versions','/api/walk/versions/'+r.completion]){
    assert.equal((await f.call(path)).status,403);assert.equal((await f.call(path,{headers:{Cookie:'__Host-solborne_access=forged'}})).status,403);
    const response=await get(f,s,path);assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);
    assert.doesNotMatch(await response.clone().text(),/PRIVATE_|private_|csrf|token_hash|registration_id/);
  }
  const detail=await (await get(f,s,'/api/walk/versions/'+r.completion)).json();assert.deepEqual(detail.facts,facts());
  assert.equal((await get(f,other,'/api/walk/versions/'+r.completion)).status,404);
  assert.deepEqual((await (await get(f,other,'/api/walk/versions')).json()).versions,[]);
  for(const id of ['SW-../../private','SW-'+ '-'.repeat(36),'SW-1111','sw-11111111-1111-4111-8111-111111111111'])assert.equal((await get(f,s,'/api/walk/versions/'+id)).status,404);
});

test('a reviewed revision appends version two while version one files and facts stay exact',async t=>{
  const f=fixture(t),s=await register(f),root=await released(f,s,await complete(f,s)),oldHtml=await (await get(f,s,root.downloads[0])).text();
  const p=revisionInput(s,root.completion),response=await post(f,s,p,'/api/walk/revisions');assert.equal(response.status,201);const pending=await response.json();assert.deepEqual(pending.downloads,[]);const r=await released(f,s,pending);
  assert.notEqual(r.completion,root.completion);assert.equal(r.version,2);assert.equal(r.project,root.completion);
  const list=await (await get(f,s,'/api/walk/versions')).json();assert.equal(list.versions.length,2);
  assert.equal(list.versions[0].completion,r.completion);assert.equal(list.versions[0].isLatest,true);assert.equal(list.versions[1].isLatest,false);
  assert.equal(list.versions[0].parentCompletion,root.completion);
  assert.equal(await (await get(f,s,root.downloads[0])).text(),oldHtml);
  assert.match(await (await get(f,s,r.downloads[0])).text(),/Revised Workshop/);
  assert.deepEqual((await (await get(f,s,'/api/walk/versions/'+root.completion)).json()).facts,facts());
  assert.equal(f.count('solborne_walk_completions'),2);assert.equal(f.count('solborne_website_artifacts'),2);assert.equal(f.count('solborne_owner_reviews'),2);
});

test('lost acknowledgement replay returns the same revision even after a later revision exists',async t=>{
  const f=fixture(t),s=await register(f),root=await complete(f,s),p=revisionInput(s,root.completion);
  const first=await (await post(f,s,p,'/api/walk/revisions')).json();
  assert.equal((await post(f,s,revisionInput(s,first.completion,{facts:{...facts(),businessName:'Version Three'}}),'/api/walk/revisions')).status,201);
  const replay=await post(f,s,p,'/api/walk/revisions');assert.equal(replay.status,200);assert.equal((await replay.json()).completion,first.completion);
  assert.equal(f.count('solborne_walk_completions'),3);assert.equal(f.count('solborne_website_artifacts'),3);assert.equal(f.count('solborne_owner_reviews'),3);assert.equal(f.count('solborne_owner_review_events'),3);
  for(const change of [{facts:{...p.facts,description:'Different'}},{parentCompletion:first.completion}]){
    const conflict=await post(f,s,{...p,...change},'/api/walk/revisions');assert.equal(conflict.status,409);assert.equal((await conflict.json()).code,'idempotency_conflict');
  }
});

test('stale parents and concurrent competing revisions allow only one next version',async t=>{
  const f=fixture(t),s=await register(f),root=await complete(f,s),a=revisionInput(s,root.completion),b=revisionInput(s,root.completion,{facts:{...facts(),businessName:'Other Revision'}});
  const replies=await Promise.all([post(f,s,a,'/api/walk/revisions'),post(f,s,b,'/api/walk/revisions')]);
  assert.deepEqual(replies.map(r=>r.status).sort(),[201,409]);const conflict=await replies.find(r=>r.status===409).json();assert.equal(conflict.code,'revision_conflict');
  const stale=await post(f,s,revisionInput(s,root.completion),'/api/walk/revisions');assert.equal(stale.status,409);assert.equal((await stale.json()).code,'revision_conflict');
  assert.equal(f.count('solborne_walk_completions'),2);assert.equal(f.count('solborne_website_artifacts'),2);assert.equal(f.count('solborne_owner_reviews'),2);
});

test('concurrent identical revision attempts store one version and one queue item',async t=>{
  const f=fixture(t),s=await register(f),root=await complete(f,s),p=revisionInput(s,root.completion);
  const replies=await Promise.all([post(f,s,p,'/api/walk/revisions'),post(f,s,p,'/api/walk/revisions')]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,201]);
  const receipts=await Promise.all(replies.map(r=>r.json()));assert.equal(receipts[0].completion,receipts[1].completion);
  assert.equal(f.count('solborne_walk_completions'),2);assert.equal(f.count('solborne_owner_reviews'),2);assert.equal(f.count('solborne_owner_review_events'),2);
});

test('invalid revisions and foreign parents cannot create artifacts or pending work',async t=>{
  const f=fixture(t),s=await register(f),r=await complete(f,s),other=await register(f,'foreign@example.test');
  assert.equal((await post(f,other,revisionInput(other,r.completion),'/api/walk/revisions')).status,404);
  for(const extra of [{ownerApproved:false},{parentCompletion:'SW-../../private'},{idempotencyKey:'bad'},{facts:{...facts(),email:''}},{facts:{...facts(),websiteUrl:'javascript:alert(1)'}},{facts:{...facts(),unexpected:'private'}}])assert.equal((await post(f,s,revisionInput(s,r.completion,extra),'/api/walk/revisions')).status,422);
  assert.equal((await post(f,s,revisionInput(s,r.completion),'/api/walk/revisions',{Origin:'https://evil.test'})).status,403);
  assert.equal((await post(f,s,revisionInput(s,r.completion,{csrf:'0'.repeat(64)}),'/api/walk/revisions')).status,403);
  assert.equal((await post(f,s,revisionInput(s,r.completion,{facts:{...facts(),description:'x'.repeat(140000)}}),'/api/walk/revisions')).status,413);
  f.advance(3600001);assert.equal((await post(f,s,revisionInput(s,r.completion),'/api/walk/revisions')).status,403);
  assert.equal(f.count('solborne_walk_completions'),1);assert.equal(f.count('solborne_owner_reviews'),1);
});

test('artifact failure rolls back completion, queue and audit and permits a safe same-key retry',async t=>{
  const f=fixture(t),s=await register(f),p=completeInput(s);
  f.db.sql.exec("CREATE TRIGGER injected_artifact_failure BEFORE INSERT ON solborne_website_artifacts BEGIN SELECT RAISE(ABORT,'Synthetic artifact failure'); END");
  const failure=await post(f,s,p);assert.equal(failure.status,503);assert.doesNotMatch(await failure.text(),/Synthetic|receipt|PRIVATE_/);
  for(const table of ['solborne_walk_completions','solborne_website_artifacts','solborne_owner_reviews','solborne_owner_review_events'])assert.equal(f.count(table),0);
  f.db.sql.exec('DROP TRIGGER injected_artifact_failure');assert.equal((await post(f,s,p)).status,201);
  for(const table of ['solborne_walk_completions','solborne_website_artifacts','solborne_owner_reviews','solborne_owner_review_events'])assert.equal(f.count(table),1);
});

test('queue failure also rolls back the saved source and revision number',async t=>{
  const f=fixture(t),s=await register(f),root=await complete(f,s),p=revisionInput(s,root.completion);
  f.db.sql.exec("CREATE TRIGGER injected_queue_failure BEFORE INSERT ON solborne_owner_reviews BEGIN SELECT RAISE(ABORT,'Synthetic queue failure'); END");
  assert.equal((await post(f,s,p,'/api/walk/revisions')).status,503);
  for(const table of ['solborne_walk_completions','solborne_website_artifacts','solborne_owner_reviews','solborne_owner_review_events'])assert.equal(f.count(table),1);
  f.db.sql.exec('DROP TRIGGER injected_queue_failure');const saved=await post(f,s,p,'/api/walk/revisions');assert.equal(saved.status,201);assert.equal((await saved.json()).version,2);
});

test('intake closure after readiness blocks every atomic root or revision write including retries',async t=>{
  const f=fixture(t),s=await register(f),root=await complete(f,s),p=revisionInput(s,root.completion);
  f.db.beforeBatch=()=>f.db.sql.exec('UPDATE solborne_intake_control SET enabled=0');
  assert.equal((await post(f,s,p,'/api/walk/revisions')).status,503);
  assert.equal(f.count('solborne_walk_completions'),1);assert.equal(f.count('solborne_website_artifacts'),1);assert.equal(f.count('solborne_owner_reviews'),1);
  assert.equal((await post(f,s,completeInput(s))).status,503);
});

test('legacy migration creates independent roots and pending audit without claiming saved source bytes',async t=>{
  const migrationStart=Date.now(),f=fixture(t,{legacy:true}),migrationEnd=Date.now(),s=await register(f);
  // An existing opaque grant, not an API-supplied registration ID, selects legacy ownership.
  const registration=f.db.sql.prepare('SELECT registration_id FROM solborne_access_grants ORDER BY rowid DESC LIMIT 1').get().registration_id;
  f.db.sql.prepare('UPDATE solborne_access_grants SET registration_id=? WHERE registration_id=?').run('SB-legacy',registration);
  f.db.sql.exec('UPDATE solborne_intake_control SET enabled=0');
  const response=await get(f,s,'/api/walk/versions');assert.equal(response.status,200);const [v]=(await response.json()).versions;
  assert.equal(v.completion,uuid);assert.equal(v.project,uuid);assert.equal(v.version,1);assert.equal(v.sourceMode,'legacy-rendered');assert.equal(v.sourceHashes,null);
  assert.equal(f.count('solborne_website_artifacts'),0);assert.equal(f.count('solborne_owner_reviews'),1);assert.equal(f.count('solborne_owner_review_events'),1);
  const queuedAt=f.db.sql.prepare('SELECT updated_at FROM solborne_owner_reviews').get().updated_at;
  assert(queuedAt>=migrationStart-1000&&queuedAt<=migrationEnd+1000,'Legacy pending audit must date the queue migration, not pretend review status was recorded at the older completion time');
  assert.equal(f.db.sql.prepare('SELECT changed_at FROM solborne_owner_review_events').get().changed_at,queuedAt);
  assert.match(await (await get(f,s,v.downloads[0])).text(),/Version Workshop/);
});

test('an old Worker completion written after migration remains an owned legacy root and supports safe revisions',async t=>{
  const f=fixture(t),s=await register(f),other=await register(f,'rollback-foreign@example.test');
  const registration=f.db.sql.prepare('SELECT registration_id FROM solborne_access_grants ORDER BY rowid LIMIT 1').get().registration_id;
  // A rolled-back Worker uses only its original columns after the additive migration.
  const insertedAt=Date.now();
  f.db.sql.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at) VALUES (?,?,?,?,?,?,?)').run(uuid,registration,sha('post-migration-old-worker'),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',1791360000000);
  const insertedEnd=Date.now();
  assert.equal(f.db.sql.prepare('SELECT project_id FROM solborne_walk_completions WHERE id=?').get(uuid).project_id,null);
  assert.equal(f.count('solborne_website_artifacts'),0);
  for(const table of ['solborne_owner_reviews','solborne_owner_review_events'])assert.equal(f.count(table),1);
  const pending=f.db.sql.prepare('SELECT * FROM solborne_owner_reviews WHERE completion_id=?').get(uuid),event=f.db.sql.prepare('SELECT * FROM solborne_owner_review_events WHERE completion_id=?').get(uuid);
  assert.equal(pending.status,'pending');assert.equal(event.status,'pending');assert.equal(event.changed_at,pending.updated_at);
  assert(pending.updated_at>=insertedAt-1000&&pending.updated_at<=insertedEnd+1000,'The pending review is recorded at the actual legacy insert, without fabricating older status history');
  const list=await (await get(f,s,'/api/walk/versions')).json(),legacy=list.versions[0];
  assert.equal(list.versions.length,1);assert.equal(legacy.completion,uuid);assert.equal(legacy.project,uuid);assert.equal(legacy.version,1);assert.equal(legacy.isLatest,true);
  assert.equal(legacy.sourceMode,'legacy-rendered');assert.equal(legacy.sourceHashes,null);assert.equal(legacy.renderVersion,null);
  const detail=await get(f,s,'/api/walk/versions/'+uuid);assert.equal(detail.status,200);assert.deepEqual((await detail.json()).facts,facts());
  assert.equal(legacy.deliveryState,'pending');assert.deepEqual(legacy.downloads,[]);
  for(const path of filePaths(uuid)){const response=await get(f,s,path);assert.equal(response.status,423);assert.equal((await response.json()).code,'delivery_pending');assert.equal((await get(f,other,path)).status,404);}
  assert.equal((await get(f,other,'/api/walk/versions/'+uuid)).status,404);
  assert.equal((await post(f,other,revisionInput(other,uuid),'/api/walk/revisions')).status,404);
  const attempts=[revisionInput(s,uuid),revisionInput(s,uuid,{facts:{...facts(),businessName:'Competing Rollforward'}})];
  const replies=await Promise.all(attempts.map(input=>post(f,s,input,'/api/walk/revisions')));
  assert.deepEqual(replies.map(response=>response.status).sort(),[201,409]);
  const winner=replies.findIndex(response=>response.status===201),receipt=await replies[winner].json();
  assert.equal((await replies[1-winner].json()).code,'revision_conflict');
  assert.equal(receipt.project,uuid);assert.equal(receipt.parentCompletion,uuid);assert.equal(receipt.version,2);assert.equal(receipt.sourceMode,'saved-files');
  const replay=await post(f,s,attempts[winner],'/api/walk/revisions');assert.equal(replay.status,200);assert.equal((await replay.json()).completion,receipt.completion);
  const stale=await post(f,s,revisionInput(s,uuid),'/api/walk/revisions');assert.equal(stale.status,409);assert.equal((await stale.json()).code,'revision_conflict');
  assert.equal(f.count('solborne_walk_completions'),2);
  assert.equal(f.count('solborne_website_artifacts'),1);
  for(const table of ['solborne_owner_reviews','solborne_owner_review_events'])assert.equal(f.count(table),2);
  const artifact=f.db.sql.prepare('SELECT * FROM solborne_website_artifacts WHERE completion_id=?').get(receipt.completion);
  assert.deepEqual(receipt.downloads,[]);const delivery=await released(f,s,receipt);
  for(const [index,path] of delivery.downloads.entries()){const response=await get(f,s,path);assert.equal(response.status,200);assert.equal(await response.text(),index===0?artifact.html_content:artifact.readme_content);assert.equal((await get(f,other,path)).status,404);}
  assert.equal(artifact.html_sha256,sha(artifact.html_content));assert.equal(artifact.readme_sha256,sha(artifact.readme_content));
  const after=await (await get(f,s,'/api/walk/versions')).json();assert.equal(after.versions.length,2);assert.equal(after.versions.find(version=>version.completion===uuid).isLatest,false);
  for(const path of filePaths(uuid))assert.equal((await get(f,s,path)).status,423,'A postmigration old-format root cannot obtain grandfathered access');
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_owner_reviews WHERE completion_id=?').get(uuid).n,1,'The migration trigger tracks legacy delivery once without claiming saved files');
});

test('legacy queue exception keeps modern unsaved versions blocked and legacy audit insertion atomic',async t=>{
  const f=fixture(t),s=await register(f),registration=f.db.sql.prepare('SELECT registration_id FROM solborne_access_grants').get().registration_id;
  const modern='SW-'+crypto.randomUUID();
  f.db.sql.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at,project_id) VALUES (?,?,?,?,?,?,?,?)').run(modern,registration,sha('unsaved-modern'),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',1791360000000,modern);
  assert.throws(()=>f.db.sql.prepare("INSERT INTO solborne_owner_reviews (completion_id,status,updated_at) VALUES (?,'pending',?)").run(modern,Date.now()),/Review requires saved source files/);
  assert.equal(f.count('solborne_owner_reviews'),0);assert.equal(f.count('solborne_owner_review_events'),0);
  f.db.sql.exec("CREATE TRIGGER injected_legacy_audit_failure BEFORE INSERT ON solborne_owner_review_events BEGIN SELECT RAISE(ABORT,'Synthetic legacy audit failure'); END");
  const insertLegacy=f.db.sql.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at) VALUES (?,?,?,?,?,?,?)');
  assert.throws(()=>insertLegacy.run(uuid,registration,sha('legacy-atomic'),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',1791360000000),/Synthetic legacy audit failure/);
  assert.equal(f.count('solborne_walk_completions'),1);assert.equal(f.count('solborne_owner_reviews'),0);assert.equal(f.count('solborne_owner_review_events'),0);
  f.db.sql.exec('DROP TRIGGER injected_legacy_audit_failure');
  insertLegacy.run(uuid,registration,sha('legacy-atomic'),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',1791360000000);
  assert.equal(f.count('solborne_walk_completions'),2);assert.equal(f.count('solborne_owner_reviews'),1);assert.equal(f.count('solborne_owner_review_events'),1);assert.equal(f.count('solborne_website_artifacts'),0);
});

test('queue audit records only actual status changes and stale compare-and-set updates change nothing',async t=>{
  const f=fixture(t),s=await register(f),r=await complete(f,s);
  const update=f.db.sql.prepare('UPDATE solborne_owner_reviews SET status=?,updated_at=? WHERE completion_id=? AND status=?');
  assert.equal(update.run('reviewing',1791360005000,r.completion,'pending').changes,1);
  assert.equal(update.run('reviewed',1791360006000,r.completion,'pending').changes,0);
  assert.equal(update.run('reviewed',1791360006000,r.completion,'reviewing').changes,1);
  assert.equal(update.run('reviewed',1791360007000,r.completion,'reviewed').changes,1);
  assert.equal(update.run('reviewing',1791360008000,r.completion,'reviewed').changes,1);
  assert.deepEqual(f.db.sql.prepare('SELECT status FROM solborne_owner_review_events ORDER BY id').all().map(row=>row.status),['pending','reviewing','reviewed','reviewing']);
  assert.throws(()=>update.run('invalid',1791360009000,r.completion,'reviewing'),/CHECK/);
});

test('saved downloads serve stored content and expose correct private HEAD lengths',async t=>{
  const f=fixture(t),s=await register(f),r=await released(f,s,await complete(f,s));
  // Stored bytes, rather than the current renderer output, are the download authority.
  f.db.sql.exec('DROP TRIGGER IF EXISTS solborne_artifacts_immutable');
  f.db.sql.prepare('UPDATE solborne_website_artifacts SET html_content=?,html_sha256=? WHERE completion_id=?').run('Frozen source sentinel',sha('Frozen source sentinel'),r.completion);
  const download=await get(f,s,r.downloads[0]);assert.equal(await download.text(),'Frozen source sentinel');
  const head=await f.call(r.downloads[0],{method:'HEAD',headers:{Cookie:s.cookie}});assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),'22');assert.match(head.headers.get('cache-control'),/no-store/);assert.match(head.headers.get('content-disposition'),/filename="index.html"/);
});

test('version listing reports latest independently for each root project',async t=>{
  const f=fixture(t),s=await register(f),one=await complete(f,s),two=await complete(f,s);
  const revised=await (await post(f,s,revisionInput(s,one.completion),'/api/walk/revisions')).json();
  const {versions}=await (await get(f,s,'/api/walk/versions')).json();assert.equal(versions.length,3);
  assert.equal(versions.find(v=>v.completion===one.completion).isLatest,false);assert.equal(versions.find(v=>v.completion===two.completion).isLatest,true);assert.equal(versions.find(v=>v.completion===revised.completion).isLatest,true);
});

test('history reads have bounded owned pages while every older exact version stays accessible',async t=>{
  const f=fixture(t),s=await register(f);
  const registration=f.db.sql.prepare('SELECT registration_id FROM solborne_access_grants').get().registration_id;
  const insert=f.db.sql.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at,project_id,revision_number) VALUES (?,?,?,?,?,?,?,?,1)');
  let oldest;
  for(let i=0;i<205;i++){
    const id='SW-'+crypto.randomUUID();if(i===0)oldest=id;
    insert.run(id,registration,sha('seed-'+i),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',1791360000000+i,id);
  }
  const first=await (await get(f,s,'/api/walk/versions')).json();
  assert.equal(first.versions.length,200);assert.equal(first.hasMore,true);assert.equal(first.nextCursor,first.versions.at(-1).completion);
  const second=await (await get(f,s,'/api/walk/versions?before='+first.nextCursor)).json();
  assert.equal(second.versions.length,5);assert.equal(second.hasMore,false);assert.equal(second.nextCursor,null);
  assert.equal(new Set([...first.versions,...second.versions].map(v=>v.completion)).size,205);
  assert.equal((await get(f,s,'/api/walk/versions/'+oldest)).status,200);
  assert.equal((await get(f,s,'/api/walk/versions?before=SW-invalid')).status,422);
  const other=await register(f,'other-pages@example.test');assert.equal((await get(f,other,'/api/walk/versions?before='+first.nextCursor)).status,404);
});
