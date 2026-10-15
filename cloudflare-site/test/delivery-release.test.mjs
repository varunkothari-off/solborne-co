import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { handleRequest } from '../src/worker.mjs';

const origin='https://solborne.in',start=1791360000000;
const sha=value=>createHash('sha256').update(value).digest('hex');
const key=()=>crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
const paths=id=>[`/downloads/website/${id}/index.html`,`/downloads/website/${id}/README.txt`];
const facts=()=>({businessName:'Reviewed Workshop',description:'Useful repairs for local households.',audience:'Local households',services:'Repairs\nAdvice',location:'',callToAction:'Ask about repairs',email:'public@example.test',phone:'',websiteUrl:''});
class D1 {
  constructor(seed){
    this.sql=new DatabaseSync(':memory:');this.sql.exec('PRAGMA foreign_keys=ON');
    const migrations=readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort();
    for(const name of migrations){if(name.startsWith('0002'))seed?.(this.sql);this.sql.exec(readFileSync('drizzle/'+name,'utf8'));}
  }
  prepare(sql){const statement=this.sql.prepare(sql);let values=[];const q={bind(...v){values=v;return q;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},execute(){const r=statement.run(...values);return {success:true,meta:{changes:r.changes}};},async run(){return q.execute();}};return q;}
  async batch(queries){this.sql.exec('BEGIN');try{const results=queries.map(q=>q.execute());this.sql.exec('COMMIT');return results;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
function fixture(t,seed){const db=new D1(seed);t.after(()=>db.sql.close());db.sql.exec('UPDATE solborne_intake_control SET enabled=1');let now=start;return {db,env:{DB:db,SITE_ORIGIN:origin},advance(ms){now+=ms;},call(path,init={}){return handleRequest(new Request(origin+path,init),this.env,{clock:()=>now});},count(table){return db.sql.prepare(`SELECT count(*) n FROM ${table}`).get().n;}};}
const get=(f,s,path,method='GET')=>f.call(path,{method,headers:{Cookie:s.cookie}});
const post=(f,s,input,path)=>f.call(path,{method:'POST',headers:{Origin:origin,Cookie:s.cookie,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.200'},body:JSON.stringify(input)});
async function session(f){const response=await f.call('/api/registration-session');assert.equal(response.status,200);f.advance(1100);return {csrf:(await response.json()).csrf,cookie:response.headers.get('set-cookie').split(';')[0]};}
async function register(f,contact='PRIVATE_EMAIL@example.test'){const s=await session(f);s.registrationInput={csrf:s.csrf,idempotencyKey:key(),name:'PRIVATE_NAME',contact,enquiryType:'website-pilot',permissionToRespond:true,website:''};const response=await post(f,s,s.registrationInput,'/api/registrations');assert.equal(response.status,201);s.cookie+='; '+response.headers.get('set-cookie').split(';')[0];return s;}
const completion=(s,extra={})=>({csrf:s.csrf,idempotencyKey:key(),answers:Array(5).fill('PRIVATE_STORY'),facts:facts(),ownerApproved:true,...extra});
async function save(f,s,input=completion(s),route='/api/walk/complete'){const response=await post(f,s,input,route);assert.equal(response.status,201);return response.json();}
const review=(f,id,status='reviewed')=>f.db.sql.prepare('UPDATE solborne_owner_reviews SET status=?,updated_at=? WHERE completion_id=?').run(status,Date.now(),id);
const release=(f,id,basis='reviewed')=>f.db.sql.prepare('INSERT INTO solborne_website_releases(completion_id,released_at,release_basis) VALUES (?,?,?)').run(id,Date.now(),basis);
async function denied(f,s,id){for(const path of paths(id))for(const method of ['GET','HEAD']){const response=await get(f,s,path,method);assert.equal(response.status,423);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal((await response.json()).code,'delivery_pending');assert.equal(response.headers.get('content-disposition'),null);}}
function seedIdentity(sql){sql.prepare('INSERT INTO solborne_registrations VALUES (?,?,?,?,?,?,?,?,?)').run('SB-existing',sha('existing-key'),sha('existing-payload'),'PRIVATE_OLD_NAME','private-old@example.test','website-pilot',1,'solborne-public-intake-v1',start);sql.prepare('INSERT INTO solborne_access_grants VALUES (?,?,?)').run(sha('b'.repeat(64)),'SB-existing',start+86400000);sql.prepare('INSERT INTO solborne_form_sessions VALUES (?,?,?)').run(sha('a'.repeat(64)),start,start+3600000);}
const existingSession=()=>({csrf:'a'.repeat(64),cookie:'__Host-solborne_form='+'a'.repeat(64)+'; __Host-solborne_access='+'b'.repeat(64)});
function seedCompletion(sql,id,{saved=true,replayKey}={}){sql.prepare('INSERT INTO solborne_walk_completions(id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at,project_id) VALUES (?,?,?,?,?,?,?,?)').run(id,'SB-existing',sha(replayKey?'SB-existing|'+replayKey:id),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',start,id);if(saved){sql.prepare('INSERT INTO solborne_website_artifacts VALUES (?,?,?,?,?,?)').run(id,'Exact previously available HTML','Exact previously available README',sha('Exact previously available HTML'),sha('Exact previously available README'),'solborne-static-v1');sql.prepare("INSERT INTO solborne_owner_reviews VALUES (?,'pending',?)").run(id,start);}}

test('new completed Walks are pending with readable facts and no public file URLs or bytes',async t=>{
  const f=fixture(t),s=await register(f),r=await save(f,s,completion(s,{deliveryState:'released',reviewState:'reviewed'}));
  assert.equal(r.deliveryState,'pending');assert.equal(r.reviewState,'pending');assert.deepEqual(r.downloads,[]);assert.equal(r.releaseBasis,null);assert.equal(r.releasedAt,null);
  assert.match(r.message,/processing/i);assert.doesNotMatch(JSON.stringify(r),/\/downloads\/website|ready to download|PRIVATE_/);
  assert.equal(f.count('solborne_walk_completions'),1);assert.equal(f.count('solborne_website_artifacts'),1);assert.equal(f.count('solborne_owner_reviews'),1);assert.equal(f.count('solborne_website_releases'),0);
  const detail=await (await get(f,s,'/api/walk/versions/'+r.completion)).json();assert.deepEqual(detail.facts,facts());assert.deepEqual(detail.version.downloads,[]);
  const history=await (await get(f,s,'/api/walk/versions')).json();assert.equal(history.versions[0].deliveryState,'pending');assert.doesNotMatch(JSON.stringify(history)+JSON.stringify(detail),/PRIVATE_|registration_id|token_hash|\/downloads\/website/);
  await denied(f,s,r.completion);
  for(const alias of ['/downloads/website/index.html','/downloads/website/README.txt'])assert.equal((await get(f,s,alias)).status,423);
  assert.equal((await get(f,s,'/downloads/canvas.txt')).status,200);
});

test('reviewing and reviewed remain pending until a separate authorized release',async t=>{
  const f=fixture(t),s=await register(f),input=completion(s),r=await save(f,s,input);
  for(const status of ['reviewing','reviewed']){review(f,r.completion,status);const detail=await (await get(f,s,'/api/walk/versions/'+r.completion)).json();assert.equal(detail.version.reviewState,status);assert.equal(detail.version.deliveryState,'pending');assert.deepEqual(detail.version.downloads,[]);await denied(f,s,r.completion);}
  const replay=await post(f,s,input,'/api/walk/complete');assert.equal(replay.status,200);assert.match((await replay.json()).message,/awaiting release/i);
  assert.equal(f.count('solborne_website_releases'),0);
});

test('SQL release guard requires reviewed frozen artifacts and never permits new grandfather injection',async t=>{
  const f=fixture(t),s=await register(f),r=await save(f,s);
  assert.throws(()=>release(f,r.completion),/reviewed.*saved|reviewed.*source/i);
  review(f,r.completion,'reviewing');assert.throws(()=>release(f,r.completion),/reviewed/i);
  review(f,r.completion);assert.throws(()=>release(f,r.completion,'grandfathered'),/grandfather|reviewed/i);
  release(f,r.completion);const row=f.db.sql.prepare('SELECT * FROM solborne_website_releases').get();
  assert.equal(row.release_basis,'reviewed');assert.throws(()=>release(f,r.completion),/immutable|UNIQUE/i);
  assert.throws(()=>f.db.sql.prepare("INSERT OR REPLACE INTO solborne_website_releases VALUES (?,?,'reviewed')").run(r.completion,row.released_at+1),/immutable/i);
  assert.equal(f.db.sql.prepare('SELECT released_at FROM solborne_website_releases WHERE completion_id=?').get(r.completion).released_at,row.released_at);
  assert.throws(()=>f.db.sql.prepare('UPDATE solborne_website_releases SET released_at=? WHERE completion_id=?').run(Date.now()+1,r.completion),/immutable/i);
  // A truthful legacy completion has no frozen artifact, so even reviewed is insufficient.
  const legacy='SW-'+crypto.randomUUID(),registration=f.db.sql.prepare('SELECT registration_id FROM solborne_access_grants').get().registration_id;
  f.db.sql.prepare('INSERT INTO solborne_walk_completions(id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at) VALUES (?,?,?,?,?,?,?)').run(legacy,registration,sha(legacy),sha(JSON.stringify(facts())),JSON.stringify(facts()),'solborne-static-v1',start);
  review(f,legacy);assert.throws(()=>release(f,legacy),/reviewed.*saved|reviewed.*source/i);assert.throws(()=>release(f,legacy,'grandfathered'),/grandfather|reviewed/i);await denied(f,s,legacy);
  assert.equal(f.count('solborne_website_releases'),1);
});

test('released files use frozen exact bytes with matching GET and HEAD gates and no ownership leak',async t=>{
  const f=fixture(t),s=await register(f),r=await save(f,s),foreign=await register(f,'private-foreign@example.test');review(f,r.completion);release(f,r.completion);
  const detail=await (await get(f,s,'/api/walk/versions/'+r.completion)).json();assert.equal(detail.version.deliveryState,'released');assert.equal(detail.version.reviewState,'reviewed');assert.equal(detail.version.releaseBasis,'reviewed');assert.deepEqual(detail.version.downloads,paths(r.completion));assert(detail.version.releasedAt);
  const artifact=f.db.sql.prepare('SELECT * FROM solborne_website_artifacts').get();
  for(const [index,path] of paths(r.completion).entries()){const content=index?artifact.readme_content:artifact.html_content;const response=await get(f,s,path);assert.equal(response.status,200);assert.equal(await response.text(),content);assert.match(response.headers.get('content-disposition'),/attachment/);const head=await get(f,s,path,'HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');assert.equal(head.headers.get('content-length'),String(Buffer.byteLength(content)));assert.equal((await get(f,foreign,path)).status,404);assert.equal((await f.call(path)).status,403);}
  f.db.sql.exec('UPDATE solborne_intake_control SET enabled=0');assert.equal((await get(f,s,paths(r.completion)[0])).status,200);
});

test('migration preserves every existing available completion without inventing human review or frozen legacy bytes',async t=>{
  const modern='SW-'+crypto.randomUUID(),legacy='SW-'+crypto.randomUUID(),replayKey=key();
  const f=fixture(t,sql=>{seedIdentity(sql);seedCompletion(sql,modern,{replayKey});seedCompletion(sql,legacy,{saved:false});}),s=existingSession();
  assert.equal(f.count('solborne_website_releases'),2);
  const {versions}=await (await get(f,s,'/api/walk/versions')).json();for(const v of versions){assert.equal(v.deliveryState,'released');assert.equal(v.releaseBasis,'grandfathered');assert.equal(v.reviewState,'pending');assert.deepEqual(v.downloads,paths(v.completion));}
  const before=await (await get(f,s,paths(modern)[0])).text();assert.equal(before,'Exact previously available HTML');
  const old=versions.find(v=>v.completion===legacy);assert.equal(old.sourceMode,'legacy-rendered');assert.equal(old.sourceHashes,null);assert.equal(old.renderVersion,null);assert.match(await (await get(f,s,paths(legacy)[0])).text(),/Reviewed Workshop/);
  assert.equal(f.db.sql.prepare('SELECT status FROM solborne_owner_reviews WHERE completion_id=?').get(modern).status,'pending','Grandfathering never fabricates a reviewed queue transition');
  const replay=await post(f,s,completion(s,{idempotencyKey:replayKey}),'/api/walk/complete');assert.equal(replay.status,200);const receipt=await replay.json();assert.equal(receipt.deliveryState,'released');assert.equal(receipt.releaseBasis,'grandfathered');assert.match(receipt.message,/existing.*remain available/i);assert.doesNotMatch(receipt.message,/reviewed|have been released/i);
  const pending=await save(f,s,{csrf:s.csrf,idempotencyKey:key(),parentCompletion:modern,facts:{...facts(),businessName:'New pending revision'},ownerApproved:true},'/api/walk/revisions');assert.equal(pending.deliveryState,'pending');assert.deepEqual(pending.downloads,[]);await denied(f,s,pending.completion);
  assert.equal(await (await get(f,s,paths(modern)[0])).text(),before);
});

test('generic aliases retain the latest released files when a newer revision is pending',async t=>{
  const f=fixture(t),s=await register(f),one=await save(f,s);review(f,one.completion);release(f,one.completion);
  const oldHtml=await (await get(f,s,paths(one.completion)[0])).text();
  const input={csrf:s.csrf,idempotencyKey:key(),parentCompletion:one.completion,facts:{...facts(),businessName:'Second pending version'},ownerApproved:true};const two=await save(f,s,input,'/api/walk/revisions');await denied(f,s,two.completion);
  assert.equal(await (await get(f,s,'/downloads/website/index.html')).text(),oldHtml);
  review(f,two.completion);assert.equal(await (await get(f,s,'/downloads/website/index.html')).text(),oldHtml);release(f,two.completion);
  assert.match(await (await get(f,s,'/downloads/website/index.html')).text(),/Second pending version/);assert.equal(await (await get(f,s,paths(one.completion)[0])).text(),oldHtml);
  // Reopening review records a real state change but does not retract an immutable release.
  review(f,two.completion,'reviewing');assert.equal((await get(f,s,paths(two.completion)[0])).status,200);
});

test('lost acknowledgement, expired access recovery and exact replay cannot bypass pending delivery',async t=>{
  const f=fixture(t),s=await register(f),input=completion(s),r=await save(f,s,input);
  const replay=await post(f,s,input,'/api/walk/complete');assert.equal(replay.status,200);assert.deepEqual((await replay.json()).downloads,[]);
  f.advance(86400001);assert.equal((await get(f,s,'/api/walk/versions/'+r.completion)).status,403);assert.equal((await get(f,s,paths(r.completion)[0])).status,403);
  const expectedReceipt=f.db.sql.prepare('SELECT id FROM solborne_registrations').get().id;
  const renewed=await session(f),response=await post(f,renewed,{...s.registrationInput,csrf:renewed.csrf,expectedReceipt},'/api/registrations');assert.equal(response.status,200);assert.equal((await response.json()).receipt,expectedReceipt);renewed.cookie+='; '+response.headers.get('set-cookie').split(';')[0];
  const restored=await (await get(f,renewed,'/api/walk/versions/'+r.completion)).json();assert.equal(restored.version.deliveryState,'pending');await denied(f,renewed,r.completion);
  const retry=await post(f,renewed,{...input,csrf:renewed.csrf},'/api/walk/complete');assert.equal(retry.status,200);assert.equal((await retry.json()).completion,r.completion);assert.equal(f.count('solborne_walk_completions'),1);assert.equal(f.count('solborne_website_releases'),0);
});

test('restore-only expected receipt rejects unknown keys and mismatched files without new rows or grants',async t=>{
  const f=fixture(t),s=await register(f),expectedReceipt=f.db.sql.prepare('SELECT id FROM solborne_registrations').get().id;
  const registrations=f.count('solborne_registrations'),grants=f.count('solborne_access_grants');
  for(const extra of [{idempotencyKey:key(),expectedReceipt},{expectedReceipt:'SB-'+crypto.randomUUID()}]){const response=await post(f,s,{...s.registrationInput,...extra},'/api/registrations');assert.equal(response.status,404);assert.equal((await response.json()).code,'recovery_not_found');assert.equal(response.headers.get('set-cookie'),null);assert.equal(f.count('solborne_registrations'),registrations);assert.equal(f.count('solborne_access_grants'),grants);}
  for(const value of [null,true,{},'SB-invalid','sb-'+crypto.randomUUID(),'SB-'+ '-'.repeat(36)]){const response=await post(f,s,{...s.registrationInput,expectedReceipt:value},'/api/registrations');assert.equal(response.status,422);assert.equal(response.headers.get('set-cookie'),null);}
  const wrongDetails=await post(f,s,{...s.registrationInput,expectedReceipt,contact:'wrong-original@example.test'},'/api/registrations');assert.equal(wrongDetails.status,409);assert.equal((await wrongDetails.json()).code,'idempotency_conflict');assert.equal(wrongDetails.headers.get('set-cookie'),null);
  const correct=await post(f,s,{...s.registrationInput,expectedReceipt},'/api/registrations');assert.equal(correct.status,200);assert.equal((await correct.json()).receipt,expectedReceipt);assert.equal(correct.headers.get('set-cookie'),null,'A valid same-browser recovery reuses its actual existing grant');
  assert.equal(f.count('solborne_registrations'),registrations);assert.equal(f.count('solborne_access_grants'),grants);
});

test('pending versions stay isolated and only private SQL release has a path to delivery',async t=>{
  const f=fixture(t),s=await register(f),r=await save(f,s),other=await register(f,'another-private@example.test');
  for(const method of ['GET','HEAD'])for(const path of paths(r.completion))assert.equal((await get(f,other,path,method)).status,404);
  assert.equal((await get(f,other,'/api/walk/versions/'+r.completion)).status,404);
  for(const path of ['/api/walk/release','/api/walk/releases/'+r.completion,'/api/admin/releases']){const response=await post(f,s,{completion:r.completion,status:'reviewed',release_basis:'reviewed'},path);assert([404,405].includes(response.status));}
  assert.equal(f.count('solborne_website_releases'),0);await denied(f,s,r.completion);
});
