import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { filesQuery, listQuery, parseArguments, pinnedConfig, queueHtml, reviewQuery, verifyFiles, releaseLookupQuery, releaseQuery, releaseVersion } from '../scripts/owner-queue.mjs';

const completion='SW-12345678-1234-1234-1234-123456789abc';
const hash=value=>createHash('sha256').update(value).digest('hex');
function fixture() {
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort()) db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  db.prepare('INSERT INTO solborne_registrations VALUES (?,?,?,?,?,?,?,?,?)').run('SB-test','idempotency','payload','Owner test','private-owner@example.test','website-pilot',1,'solborne-public-intake-v1',1000);
  db.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at,project_id,revision_number) VALUES (?,?,?,?,?,?,?,?,?)').run(completion,'SB-test','attempt','payload',JSON.stringify({businessName:'Workshop <script>bad()</script>'}),'solborne-static-v1',2000,completion,1);
  const html='<!doctype html><p>Saved workshop source</p>',readme='Saved source instructions';
  db.prepare('INSERT INTO solborne_website_artifacts (completion_id,html_content,readme_content,html_sha256,readme_sha256,render_version) VALUES (?,?,?,?,?,?)').run(completion,html,readme,hash(html),hash(readme),'solborne-static-v1');
  db.prepare('INSERT OR IGNORE INTO solborne_owner_reviews (completion_id,status,updated_at) VALUES (?,?,?)').run(completion,'pending',2000);
  return db;
}

test('owner list uses private registration plus saved version, never reports review performed automatically',()=>{
  const db=fixture();const rows=db.prepare(listQuery()).all();assert.equal(rows.length,1);assert.equal(rows[0].status,'pending');assert.equal(rows[0].contact,'private-owner@example.test');assert.equal(rows[0].source_mode,'saved-files');
  const html=queueHtml(rows,'Local D1 development');assert(!html.includes('<script>bad()'));assert(html.includes('&lt;script&gt;bad()'));assert(html.includes('manual owner records'));assert(html.includes('does not refresh automatically'));db.close();
});

test('status compare-and-set preserves audit history and refuses stale updates',()=>{
  const db=fixture();db.exec(reviewQuery(completion,'reviewing','pending',3000));assert.equal(db.prepare('SELECT changes() n').get().n,1);assert.equal(db.prepare('SELECT status FROM solborne_owner_reviews').get().status,'reviewing');
  db.exec(reviewQuery(completion,'reviewed','pending',4000));assert.equal(db.prepare('SELECT changes() n').get().n,0);assert.equal(db.prepare('SELECT status FROM solborne_owner_reviews').get().status,'reviewing');
  db.exec(reviewQuery(completion,'reviewed','reviewing',5000));assert.equal(db.prepare('SELECT changes() n').get().n,1);
  const events=db.prepare('SELECT status,changed_at FROM solborne_owner_review_events ORDER BY id').all();assert.deepEqual(events.map(x=>({...x})),[{status:'pending',changed_at:2000},{status:'reviewing',changed_at:3000},{status:'reviewed',changed_at:5000}]);db.close();
});

test('source export reads immutable bytes and verifies both hashes',()=>{
  const db=fixture();const row=db.prepare(filesQuery(completion)).get();assert.equal(verifyFiles(row).completion_id,completion);assert.throws(()=>verifyFiles({...row,html_content:row.html_content+'changed'}),/hashes/);assert.throws(()=>verifyFiles({...row,readme_content:'changed'}),/hashes/);assert.throws(()=>verifyFiles(undefined),/missing/);db.close();
});

test('owner view exposes old-worker legacy completion with no fabricated queue or review event',()=>{
  const db=fixture(),legacy='SW-12345678-1234-1234-1234-123456789abd';
  // Arrange an unrecorded historical/anomalous row, rather than disable production behaviour.
  for(const row of db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='solborne_walk_completions' AND sql LIKE '%AFTER INSERT%'").all()) db.exec('DROP TRIGGER "'+row.name.replaceAll('"','""')+'"');
  db.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at) VALUES (?,?,?,?,?,?,?)').run(legacy,'SB-test','legacy-attempt','legacy-payload',JSON.stringify({businessName:'Legacy workshop'}),'solborne-static-v1',1000);
  const row=db.prepare(listQuery()).all().find(row=>row.completion_id===legacy);assert(row);assert.equal(row.status,'legacy-unrecorded');assert.equal(row.source_mode,'legacy-rendered');assert.equal(row.project_id,legacy);assert.equal(row.is_latest,1);
  assert.equal(db.prepare('SELECT count(*) n FROM solborne_owner_reviews WHERE completion_id=?').get(legacy).n,0);assert.equal(db.prepare('SELECT count(*) n FROM solborne_owner_review_events WHERE completion_id=?').get(legacy).n,0);
  const changed=db.prepare(reviewQuery(legacy,'reviewing','pending',6000)).all();assert.deepEqual(changed,[]);assert(queueHtml([row],'Local D1 development').includes('no queue or review status is fabricated'));db.close();
});

test('owner metadata treats a null-project legacy root as earlier after a real saved revision',()=>{
  const db=fixture(),legacy='SW-12345678-1234-1234-1234-123456789abe',revision='SW-12345678-1234-1234-1234-123456789abf';
  db.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at) VALUES (?,?,?,?,?,?,?)').run(legacy,'SB-test','legacy-latest-attempt','legacy-payload',JSON.stringify({businessName:'Legacy root workshop'}),'solborne-static-v1',1000);
  db.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at,project_id,parent_completion_id,revision_number) VALUES (?,?,?,?,?,?,?,?,?,?)').run(revision,'SB-test','revision-latest-attempt','revision-payload',JSON.stringify({businessName:'Legacy revised workshop'}),'solborne-static-v1',3000,legacy,legacy,2);
  db.prepare('INSERT INTO solborne_website_artifacts SELECT ?,html_content,readme_content,html_sha256,readme_sha256,render_version FROM solborne_website_artifacts WHERE completion_id=?').run(revision,completion);
  db.prepare('INSERT INTO solborne_owner_reviews VALUES (?,?,?)').run(revision,'pending',3000);
  const rows=db.prepare(listQuery()).all(),parent=rows.find(row=>row.completion_id===legacy),child=rows.find(row=>row.completion_id===revision);assert.equal(parent.project_id,legacy);assert.equal(parent.is_latest,0);assert.equal(child.project_id,legacy);assert.equal(child.is_latest,1);assert.equal(child.status,'pending');db.close();
});

test('operator tool defaults to local, installs nothing and pins isolated D1',()=>{
  const options=parseArguments(['list','--wrangler','C:\\existing\\wrangler.js']);assert.equal(options.remote,false);assert.equal(parseArguments(['list','--wrangler','C:\\existing\\wrangler.js','--remote']).remote,true);
  const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.doesNotThrow(()=>pinnedConfig(config));assert.throws(()=>pinnedConfig({...config,d1_databases:[{...config.d1_databases[0],database_id:'other-db'}]}),/isolated/);assert.throws(()=>parseArguments(['list','--wrangler','npx']),/existing Wrangler/);
  assert.throws(()=>reviewQuery(completion,"reviewed'; DROP TABLE x;--",'pending'),/valid/);assert.throws(()=>filesQuery('../../public/index.html'),/valid/);assert.throws(()=>reviewQuery(completion,'pending','pending'),/different/);
});

const queryFor=db=>sql=>[{success:true,results:db.prepare(sql).all()}];
function reviewed(db) { db.exec(reviewQuery(completion,'reviewing','pending',3000));db.exec(reviewQuery(completion,'reviewed','reviewing',4000)); }

test('private release requires actual reviewed state and records one immutable release',()=>{
  const db=fixture(),query=queryFor(db);
  assert.throws(()=>releaseVersion(completion,{}, {query,clock:()=>5000}),/No release/);
  db.exec(reviewQuery(completion,'reviewing','pending',3000));
  assert.throws(()=>releaseVersion(completion,{}, {query,clock:()=>5000}),/No release/);
  db.exec(reviewQuery(completion,'reviewed','reviewing',4000));
  const result=releaseVersion(completion,{}, {query,clock:()=>5000});assert.equal(result.replayed,false);assert.equal(result.release.released_at,5000);assert.equal(result.release.release_basis,'reviewed');
  const again=releaseVersion(completion,{}, {query,clock:()=>9999});assert.equal(again.replayed,true);assert.equal(again.release.released_at,5000);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,1);
  const row=db.prepare(listQuery()).get();assert.equal(row.delivery_state,'released');assert.equal(row.release_basis,'reviewed');
  assert.throws(()=>db.exec(`UPDATE solborne_website_releases SET released_at=9999 WHERE completion_id='${completion}'`),/immutable/);db.close();
});

test('release validates exact frozen source before recording a customer delivery',()=>{
  const db=fixture();reviewed(db);const query=sql=>{const reply=queryFor(db)(sql);if(sql===filesQuery(completion))reply[0].results[0].readme_content+='corrupt';return reply;};
  assert.throws(()=>releaseVersion(completion,{}, {query,clock:()=>5000}),/hashes/);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,0);db.close();
});

test('review state changed after source verification prevents private release',()=>{
  const db=fixture();reviewed(db);const query=sql=>{if(sql.startsWith('INSERT INTO solborne_website_releases'))db.exec(reviewQuery(completion,'reviewing','reviewed',4500));return queryFor(db)(sql);};
  assert.throws(()=>releaseVersion(completion,{}, {query,clock:()=>5000}),/No release/);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,0);assert.equal(db.prepare('SELECT status FROM solborne_owner_reviews').get().status,'reviewing');db.close();
});

test('artifact replacement after verification cannot release a different hash pair',()=>{
  const db=fixture();reviewed(db);const query=sql=>{
    if(sql.startsWith('INSERT INTO solborne_website_releases')){
      const html='Changed source after verification',readme='Changed instructions';
      db.prepare('INSERT OR REPLACE INTO solborne_website_artifacts VALUES (?,?,?,?,?,?)').run(completion,html,readme,hash(html),hash(readme),'solborne-static-v1');
    }
    return queryFor(db)(sql);
  };
  assert.throws(()=>releaseVersion(completion,{}, {query,clock:()=>5000}),/No release/);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,0);db.close();
});

test('lost release acknowledgement is recovered from actual immutable release readback',()=>{
  const db=fixture();reviewed(db);const query=sql=>{const replies=queryFor(db)(sql);if(sql.startsWith('INSERT INTO solborne_website_releases'))throw new Error('SIMULATED_LOST_WRANGLER_ACK');return replies;};
  const result=releaseVersion(completion,{}, {query,clock:()=>5000});assert.equal(result.replayed,true);assert.equal(result.release.released_at,5000);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,1);db.close();
});

test('release storage rejection never reports success and a later safe retry creates one row',()=>{
  const db=fixture();reviewed(db);db.exec("CREATE TRIGGER test_release_failure BEFORE INSERT ON solborne_website_releases BEGIN SELECT RAISE(ABORT,'TEST_RELEASE_STORAGE_FAILURE'); END;");
  assert.throws(()=>releaseVersion(completion,{}, {query:queryFor(db),clock:()=>5000}),/TEST_RELEASE_STORAGE_FAILURE/);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,0);
  db.exec('DROP TRIGGER test_release_failure');assert.equal(releaseVersion(completion,{}, {query:queryFor(db),clock:()=>6000}).replayed,false);assert.equal(db.prepare('SELECT COUNT(*) n FROM solborne_website_releases').get().n,1);db.close();
});

test('release CLI accepts only strict references and preserves local default',()=>{
  const parsed=parseArguments(['release',completion,'--wrangler','C:\\existing\\wrangler.js']);assert.equal(parsed.remote,false);assert.equal(parsed.action,'release');
  assert.throws(()=>parseArguments(['release','../../public/index.html','--wrangler','C:\\existing\\wrangler.js']),/valid/);
  assert.throws(()=>parseArguments(['release',completion,'--status','reviewed','--wrangler','C:\\existing\\wrangler.js']),/only apply/);
  assert.throws(()=>releaseQuery(completion,-1),/valid/);assert.throws(()=>releaseLookupQuery('not-a-reference'),/valid/);
});
