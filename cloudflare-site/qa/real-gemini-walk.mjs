// Explicit provider smoke test. Synthetic business only, temporary local SQLite.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {setDefaultResultOrder} from 'node:dns';
import assert from 'node:assert/strict';
import {handleRequest} from '../src/worker.mjs';
setDefaultResultOrder('ipv4first');
const raw=readFileSync('.env','utf8'),secret=raw.match(/^\s*GEMINI_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');
if(!secret)throw Error('Private Gemini key missing');
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');for(const p of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+p,'utf8'));sql.exec('UPDATE solborne_intake_control SET enabled=1');
const DB={prepare(q){let values=[];const statement=sql.prepare(q);const p={bind(...v){values=v;return p;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){const r=statement.run(...values);return {meta:{changes:Number(r.changes)}};}};return p;},async batch(q){sql.exec('BEGIN');try{const r=[];for(const p of q)r.push(await p.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB,SITE_ORIGIN:'https://solborne.in',AI_WALK_ENABLED:'true',GEMINI_MODEL:'gemini-3.1-flash-lite',GEMINI_API_KEY:secret};let now=Date.now(),cookie='';
const call=(path,body)=>handleRequest(new Request(env.SITE_ORIGIN+path,{method:body?'POST':'GET',headers:{Origin:env.SITE_ORIGIN,Cookie:cookie,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.61'},...(body?{body:JSON.stringify(body)}:{})}),env,{clock:()=>now});
try{
 const s=await call('/api/registration-session'),{csrf}=await s.json();cookie=s.headers.get('set-cookie').split(';')[0];now+=2000;
 const r=await call('/api/registrations',{csrf,idempotencyKey:crypto.randomUUID().replaceAll('-','').repeat(2),name:'Synthetic Walk QA',contact:'qa@example.test',enquiryType:'website-pilot',permissionToRespond:true,website:''});assert.equal(r.status,201);cookie+='; '+r.headers.get('set-cookie').split(';')[0];
 let res=await call('/api/ai-walk',{csrf,consent:true,revision:0,message:'Synthetic QA business: Example Repair Workshop repairs wooden furniture for local cafes and restaurants in Example Town. Our priority is attracting enquiries. Please ask the next question.'});assert.equal(res.status,200);let data=await res.json();assert.match(data.state.facts.audience,/cafe|restaurant/i);
 const complete='Here are the rest of my confirmed answers. Legal operator Synthetic Workshop Owner, sole proprietorship, public address 1 Example Street, Example Town, India. Public email qa@example.test, no phone. Industry furniture repair. Services wooden table and chair repairs for cafes and restaurants. CTA email for a repair quote. Existing website none. Brand calm green and cream, no logo yet. No testimonials or results claims. Pricing quoted before each repair. Contact email only; no forms or document uploads on the website. Journey: customer emails, I inspect, quote and repair. Biggest pain and my confirmed priority: finding more local cafe customers. Desired outcome more relevant enquiries; success measure five enquiries a month. Current workaround word of mouth. I approve all quotes and all website facts. Free scope services, about, public contact and portfolio. Hosting and automations separate. No additional private information. Deeper operational detail is deferred by me for team review. Everything above is accurate and I confirm it. Summarise this brief for submission.';
 res=await call('/api/ai-walk',{csrf,consent:true,revision:data.revision,message:complete});assert.equal(res.status,200);data=await res.json();
 // One bounded follow-up if the model asks for explicit scope/priority confirmation.
 if(!data.state.ready){res=await call('/api/ai-walk',{csrf,consent:true,revision:data.revision,message:'I confirm the priority and scope in the previous answer. Use the supplied public facts. For any nonessential unknown operations detail, record Deferred by owner; team to confirm. Please mark my complete brief ready for human review.'});assert.equal(res.status,200);data=await res.json();}
 assert.equal(data.state.ready,true,'Synthetic brief must become ready without invented facts');
 const submitted=await call('/api/ai-walk/submit',{csrf,revision:data.revision,confirmed:true});assert.equal(submitted.status,201);const receipt=await submitted.json();assert.equal(receipt.state.submission.dueAt-receipt.state.submission.submittedAt,86400000);
 assert.equal(sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n,0);assert.equal(sql.prepare('SELECT count(*) n FROM solborne_website_releases').get().n,0);
 console.log(JSON.stringify({ok:true,realProvider:true,syntheticOnly:true,localDatabase:true,conversation:true,confirmedHandoff:true,deliveryHours:24,websitesCreated:0,releases:0}));
}catch{console.error('Real-provider journey did not pass. No secret or model text logged.');process.exitCode=1;}finally{sql.close();}
