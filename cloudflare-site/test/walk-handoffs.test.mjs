import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {parseArguments,listQuery,updateQuery,main} from '../scripts/walk-handoffs.mjs';

const ref='WB-11111111-1111-4111-8111-111111111111',now=1792800000000;
const input={reference:ref,revision:2,expect:'awaiting_manual_review',status:'in_review',owner:'Solborne team',nextAction:'Review agreed workflow scope'};
function fixture(t,submission={id:ref,service:'operations',status:'awaiting_manual_review',submittedAt:1,history:[]}){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 db.exec('CREATE TABLE solborne_ai_walks(registration_id TEXT PRIMARY KEY,state_json TEXT,revision INTEGER,busy_until INTEGER,updated_at INTEGER)');
 db.prepare('INSERT INTO solborne_ai_walks VALUES(?,?,?,?,?)').run('REG-synthetic',JSON.stringify({facts:{businessName:'PRIVATE-NAME'},businessBrief:{primaryPain:'PRIVATE-PAIN'},messages:[{text:'PRIVATE-TRANSCRIPT'}],...(submission?{submission}:{})}),2,0,1);
 return {db,state:()=>JSON.parse(db.prepare('SELECT state_json FROM solborne_ai_walks').get().state_json)};
}

test('operator can explicitly update a submitted WB handoff with revision and expected status',()=>{
 const options=parseArguments(['update','WB-11111111-1111-4111-8111-111111111111','--wrangler','C:/tools/wrangler.js','--revision','2','--expect','awaiting_manual_review','--status','in_review','--owner','Solborne team','--next-action','Review agreed workflow scope']);
 assert.equal(options.action,'update');
});

test('list returns safe metadata without transcript, email, business facts or private notes',t=>{
 const f=fixture(t),row=f.db.prepare(listQuery()).get();assert.equal(row.reference,ref);assert.equal(row.service,'operations');assert.equal(row.revision,2);
 assert(!JSON.stringify(row).includes('PRIVATE'));assert(!('state_json' in row));
});

test('update compares revision and status, preserves source state and appends one event',t=>{
 const f=fixture(t),rows=f.db.prepare(updateQuery(input,now)).all();assert.equal(rows.length,1);assert.equal(rows[0].revision,3);
 const state=f.state();assert.equal(state.submission.id,ref);assert.equal(state.submission.status,'in_review');assert.equal(state.submission.history.length,1);assert.equal(state.submission.history[0].owner,'Solborne team');assert.equal(state.facts.businessName,'PRIVATE-NAME');assert.equal(state.messages[0].text,'PRIVATE-TRANSCRIPT');
 assert.equal(f.db.prepare(updateQuery(input,now)).all().length,0);assert.equal(f.state().submission.history.length,1);
 assert.equal(f.db.prepare(updateQuery({...input,revision:3},now)).all().length,0);
});

test('same-state exact repetition does not create redundant history and busy rows cannot mutate',t=>{
 const f=fixture(t,{id:ref,status:'in_review',owner:input.owner,nextAction:input.nextAction,nextUpdateAt:null,history:[]});
 assert.equal(f.db.prepare(updateQuery({...input,expect:'in_review'},now)).all().length,0);
 f.db.exec(`UPDATE solborne_ai_walks SET busy_until=${now+100}`);
 assert.equal(f.db.prepare(updateQuery({...input,expect:'in_review',status:'proposal_ready'},now)).all().length,0);
});

test('tracking history retains only latest 100 events and preserves chronological order',t=>{
 const history=Array.from({length:103},(_,i)=>({at:i,status:'in_review'})),f=fixture(t,{id:ref,status:'in_review',history});
 f.db.prepare(updateQuery({...input,expect:'in_review',status:'proposal_ready'},now)).run();
 assert.equal(f.state().submission.history.length,100);assert.equal(f.state().submission.history[0].at,4);assert.equal(f.state().submission.history.at(-1).at,now);
});

test('invalid references, transitions, declarations and update times fail before database access',()=>{
 for(const delta of [{reference:'SW-bad'},{revision:-1},{expect:'not-real'},{status:'delivered'},{status:'completed'},{owner:''},{owner:'x\nwrong'},{nextAction:'x'.repeat(501)},{nextUpdateAt:NaN},{nextUpdateAt:now-1}])assert.throws(()=>updateQuery({...input,...delta},now));
 assert.throws(()=>updateQuery({...input,expect:'completed',status:'in_review'},now));
 assert.throws(()=>parseArguments(['update',ref,'--wrangler','C:/tools/wrangler.js']));
});

test('unsubmitted or different references cannot be updated',t=>{
 const f=fixture(t,null);assert.equal(f.db.prepare(updateQuery(input,now)).all().length,0);
});

test('dry-run update never accesses local or remote database and apply returns confirmed receipt',t=>{
 const f=fixture(t),base=['update',ref,'--wrangler','C:/tools/wrangler.js','--revision','2','--expect','awaiting_manual_review','--status','in_review','--owner','Solborne team','--next-action','Review agreed workflow scope'];let calls=0,output;
 main([...base,'--remote'],{clock:()=>now,query:()=>{throw Error('must not query')},write:v=>output=v});assert.equal(output.applied,false);
 main([...base,'--apply'],{clock:()=>now,query:sql=>{calls++;return [{results:f.db.prepare(sql).all()}]},write:v=>output=v});assert.equal(calls,1);assert.equal(output.applied,true);assert.equal(output.handoff.reference,ref);
});

test('ambiguous mutation failure reports uncertainty without retrying',()=>{
 let calls=0;assert.throws(()=>main(['update',ref,'--wrangler','C:/tools/wrangler.js','--revision','2','--expect','awaiting_manual_review','--status','in_review','--owner','Team','--next-action','Review scope','--remote','--apply'],{clock:()=>now,query:()=>{calls++;throw Error('unreadable transport')},write(){}}),/uncertain/);assert.equal(calls,1);
});

test('SQL quoting preserves literal text and malformed rows do not affect other handoffs',t=>{
 const f=fixture(t);f.db.prepare('INSERT INTO solborne_ai_walks VALUES(?,?,?,?,?)').run('REG-damaged','not JSON',0,0,1);
 assert.equal(f.db.prepare(listQuery()).all().length,1);
 f.db.prepare(updateQuery({...input,owner:"O'Brien",nextAction:"Check 'quoted' scope; no SQL execution"},now)).run();
 assert.equal(f.state().submission.owner,"O'Brien");assert.equal(f.state().submission.nextAction,"Check 'quoted' scope; no SQL execution");
});

test('update dates require explicit timezone instead of guessing the execution hosts timezone',()=>{
 const base=['update',ref,'--wrangler','C:/tools/wrangler.js','--revision','2','--expect','awaiting_manual_review','--status','in_review','--owner','Team','--next-action','Review scope'];
 assert.throws(()=>parseArguments([...base,'--next-update','2028-11-01T10:00:00']),/timezone/);
 assert.equal(parseArguments([...base,'--next-update','2028-11-01T10:00:00+05:30']).nextUpdateAt,Date.parse('2028-11-01T10:00:00+05:30'));
});
