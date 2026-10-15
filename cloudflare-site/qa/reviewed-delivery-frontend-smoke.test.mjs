import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {handleRequest} from '../src/worker.mjs';
import {createWebsiteFiles,validateWebsiteInterview,websiteFields} from '../src/website.mjs';

const root=new URL('../',import.meta.url);
// Mock DOM mechanics; actual frontend handlers, Worker and isolated SQLite.
// Does not assert browser geometry, trusted events, CSP or production delivery.
test('reviewed delivery frontend/API: 11 durable status and original-registration recovery checks', async () => {
const sourceFiles=['public/index.html','public/start.html','public/walk.html','public/walk.js','public/versions.html','public/versions.js','public/versions.css','public/registration.js'];
for(const file of sourceFiles)console.log('SOURCE SHA256 '+file+' '+createHash('sha256').update(fs.readFileSync(new URL(file,root))).digest('hex'));
class D1{
 constructor(){this.sql=new DatabaseSync(':memory:');for(const file of fs.readdirSync(new URL('drizzle/',root)).filter(x=>x.endsWith('.sql')).sort())this.sql.exec(fs.readFileSync(new URL('drizzle/'+file,root),'utf8'));this.sql.exec('UPDATE solborne_intake_control SET enabled=1');}
 prepare(sql){const statement=this.sql.prepare(sql);let values=[];const query={bind(...next){values=next;return query;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){const result=statement.run(...values);return {success:true,meta:{changes:result.changes}};}};return query;}
 async batch(queries){this.sql.exec('BEGIN');try{const result=[];for(const query of queries)result.push(await query.run());this.sql.exec('COMMIT');return result;}catch(error){this.sql.exec('ROLLBACK');throw error;}}
}
class Element{
 constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.elements={};this.listeners=new Map();this.attributes=new Map();this.children=[];this.classList={toggle(){}};}
 addEventListener(type,fn){this.listeners.set(type,fn);}
 setAttribute(name,value){this.attributes.set(name,value);}
 getAttribute(name){return this.attributes.get(name);}
 removeAttribute(name){this.attributes.delete(name);delete this[name];}
 focus(){this.focused=true;}scrollIntoView(){}reportValidity(){return true;}
 append(...elements){this.children.push(...elements);}replaceChildren(...elements){this.children=elements;}remove(){}click(){this.clicked=true;}
 async fire(type,event={}){return await this.listeners.get(type)?.({preventDefault(){},...event});}
 reset(){for(const field of Object.values(this.elements)){field.value='';field.checked=false;}}
}
const db=new D1(),origin='https://solborne.in',env={DB:db,SITE_ORIGIN:origin};let now=1791360000000;const cookies=new Map(),requests=[];
async function serverFetch(path,init={}){
 requests.push({path,method:init.method||'GET',body:init.body});
 const response=await handleRequest(new Request(origin+path,{...init,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.120',Cookie:[...cookies].map(([name,value])=>name+'='+value).join('; '),...init.headers}}),env,{clock:()=>now});
 const setCookie=response.headers.get('set-cookie');if(setCookie){const [name,value]=setCookie.split(';')[0].split('=');cookies.set(name,value);}return response;
}
async function waitFor(condition){const deadline=Date.now()+3000;while(!condition()){assert.ok(Date.now()<deadline,'Frontend handler did not finish');await new Promise(resolve=>setTimeout(resolve,5));}}
function page(name,{historyState=null,search='',fetch=serverFetch}={}){
 const html=fs.readFileSync(new URL('public/'+(name==='registration'?'start':name)+'.html',root),'utf8'),elements=new Map();
 for(const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)){const element=new Element();element.hidden=/\shidden(?:\s|>|$)/.test(match[0]);element.disabled=/\sdisabled(?:\s|>|$)/.test(match[0]);elements.set(match[1],element);}
 const get=id=>{if(!elements.has(id))throw new Error('Missing real HTML id '+id);return elements.get(id);};
 const document={getElementById:get,createElement(){return new Element();},body:new Element()};
 for(const match of html.matchAll(/<(?:input|select|textarea)[^>]*\bid="([^"]+)"[^>]*\bname="([^"]+)"[^>]*>/g)){const form=get(name==='registration'?'pilot-form':name==='walk'?'walk-form':'versions-form');form.elements[match[2]]=get(match[1]);get(match[1]).name=match[2];}
 let blob=null;const testURL=class extends URL{};testURL.createObjectURL=value=>{blob=value;return 'blob:synthetic-receipt';};testURL.revokeObjectURL=()=>{};
 const history={state:historyState,replaceState(state){this.state=state;}};
 const context={document,crypto:globalThis.crypto,fetch,history,location:{search},window:{addEventListener(){}},createWebsiteFiles,validateWebsiteInterview,websiteFields,URL:testURL,URLSearchParams,Blob,setTimeout,Uint8Array,console};vm.createContext(context);
 let source=fs.readFileSync(new URL('public/'+name+'.js',root),'utf8').replace(/^import[^\n]+\n/,'');if(name==='registration')source=source.replace(/\bprepare\(\);\s*\}\)\(\);\s*$/,'globalThis.preparation=prepare();\n})();');
 else if(name==='walk')source=source.replace(/\bprepare\(\);\s*$/,'globalThis.preparation=prepare();');
 else source=source.replace(/loadVersions\(completionPattern\.test\(requestedVersion\|\|''\)\?requestedVersion:''\);\s*$/,"globalThis.preparation=loadVersions(completionPattern.test(requestedVersion||'')?requestedVersion:'');");
 vm.runInContext(source,context);assert.equal(typeof context.preparation?.then,'function','Capture the actual startup promise');
 return {get,history,context,blob:()=>blob};
}
const privateDetails={name:'Synthetic Private Owner',contact:'private@example.test',enquiryType:'website-pilot'};
const publicFacts={businessName:'Repair Workshop',description:'We repair everyday objects.',audience:'Local families',services:'Repairs\nAdvice',location:'',callToAction:'Ask about repairs',email:'public@example.test',phone:'',websiteUrl:''};
function registrationFields(p,details=privateDetails){for(const [name,value]of Object.entries(details))p.get('pilot-form').elements[name].value=value;p.get('pilot-form').elements.permissionToRespond.checked=true;}
let checks=0;function pass(label){checks++;console.log('PASS '+checks+' '+label);}
try{
 const registration=page('registration');await registration.context.preparation;now+=1500;registrationFields(registration);await registration.get('pilot-form').fire('submit');
 assert.equal(registration.get('registration-receipt').hidden,false);const receipt=registration.get('receipt-id').textContent;await registration.get('registration-retry-download').fire('click');
 const retry=JSON.parse(await registration.blob().text());assert.deepEqual(Object.keys(retry).sort(),['idempotencyKey','receipt']);assert.equal(retry.receipt,receipt);assert.match(retry.idempotencyKey,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(retry).includes(privateDetails.contact),false);pass('Acknowledged registration exports only original retry key/reference');
 const walk=page('walk');await walk.context.preparation;now+=1500;for(const [name,value]of Object.entries(publicFacts))walk.get('walk-form').elements[name].value=value;for(let n=0;n<5;n++)walk.get('walk-form').elements['story'+n].value='Synthetic story '+n;
 await walk.get('walk-preview').fire('click');walk.get('walk-approved').checked=true;await walk.get('walk-form').fire('input',{target:walk.get('walk-approved')});await walk.get('walk-form').fire('submit');
 assert.ok(walk.history.state,walk.get('walk-message').textContent);const completion=walk.history.state.solborneWalkCompletion;assert.match(completion,/^SW-/);assert.equal(walk.get('walk-receipt').hidden,false);assert.match(walk.get('walk-request-state').textContent,/Pending/);assert.equal(walk.get('walk-delivery-files').hidden,true);assert.equal(walk.get('walk-html').href,undefined);assert.equal(requests.filter(x=>x.path.startsWith('/downloads/website')).length,0);pass('Durable Walk pending receipt has no file links or file fetch');
 const resumed=page('walk',{historyState:walk.history.state});await resumed.context.preparation;assert.equal(resumed.get('walk-receipt').hidden,false);assert.equal(resumed.get('walk-html').href,undefined);assert.equal(requests.filter(x=>x.path.startsWith('/downloads/website')).length,0);pass('Reload restores exact pending receipt through owned metadata, not file HEAD');
 const versions=page('versions',{search:'?version='+completion});await versions.context.preparation;assert.equal(versions.get('versions-summary').hidden,false,versions.get('versions-message').textContent);assert.equal(versions.get('versions-approved-facts-section').hidden,false);assert.equal(versions.get('versions-released-preview').hidden,true);assert.equal(versions.get('versions-html').href,undefined);assert.equal(versions.get('versions-saved-preview').srcdoc,undefined);assert.equal(versions.get('versions-approved-facts').children.length,Object.keys(websiteFields).length);pass('Pending selected version exposes only approved public facts/status');
 db.sql.prepare("UPDATE solborne_owner_reviews SET status='reviewed',updated_at=? WHERE completion_id=?").run(now,completion);await resumed.get('walk-status-refresh').fire('click');assert.match(resumed.get('walk-review-state').textContent,/awaiting file release/);assert.equal(resumed.get('walk-html').href,undefined);pass('Reviewed without release still has no downloads');
 db.sql.prepare("INSERT INTO solborne_website_releases(completion_id,released_at,release_basis) VALUES(?,?,'reviewed')").run(completion,now);await resumed.get('walk-status-refresh').fire('click');assert.equal(resumed.get('walk-delivery-files').hidden,false);assert.equal(resumed.get('walk-html').href,'/downloads/website/'+completion+'/index.html');await versions.get('versions-refresh').fire('click');await waitFor(()=>vm.runInContext('!loading',versions.context));
 const artifact=db.sql.prepare('SELECT html_content FROM solborne_website_artifacts WHERE completion_id=?').get(completion);assert.equal(versions.get('versions-saved-preview').srcdoc,artifact.html_content);assert.equal(versions.get('versions-released-preview').hidden,false);pass('Manual refresh after authorized local fixture release exposes exact saved source');
 now+=25*3600*1000;assert.equal((await serverFetch('/api/access/status')).status,403);const recovery=page('registration');await recovery.context.preparation;registrationFields(recovery);
 let finishRead;recovery.get('registration-recovery-file').files=[{size:3,text:()=>new Promise(resolve=>finishRead=resolve)}];const importing=recovery.get('registration-recovery-file').fire('change');const before=requests.filter(x=>x.path==='/api/registrations').length;await recovery.get('pilot-form').fire('submit');assert.equal(requests.filter(x=>x.path==='/api/registrations').length,before);assert.equal(recovery.get('pilot-submit').disabled,true);finishRead('{xx');await importing;await recovery.get('pilot-form').fire('submit');assert.equal(recovery.get('pilot-submit').disabled,true);assert.equal(requests.filter(x=>x.path==='/api/registrations').length,before);pass('Delayed file read and malformed receipt both block POST; original fields retained');
 const missingKey={receipt:retry.receipt};recovery.get('registration-recovery-file').files=[{size:100,text:async()=>JSON.stringify(missingKey)}];await recovery.get('registration-recovery-file').fire('change');await recovery.get('pilot-form').fire('submit');assert.equal(requests.filter(x=>x.path==='/api/registrations').length,before);pass('Missing retry key blocks submission without falling back to new enquiry');
 const unknown={...retry,idempotencyKey:'f'.repeat(64)};recovery.get('registration-recovery-file').files=[{size:200,text:async()=>JSON.stringify(unknown)}];await recovery.get('registration-recovery-file').fire('change');now+=1500;await recovery.get('pilot-form').fire('submit');assert.equal(db.sql.prepare('SELECT count(*) count FROM solborne_registrations').get().count,1);assert.equal(recovery.get('registration-receipt').hidden,true);pass('Unknown valid retry key is denied without creating registration');
 recovery.get('registration-recovery-file').files=[{size:200,text:async()=>JSON.stringify(retry)}];await recovery.get('registration-recovery-file').fire('change');now+=1500;recovery.get('pilot-name').value='Wrong Owner';await recovery.get('pilot-form').fire('submit');assert.equal(recovery.get('registration-receipt').hidden,true);assert.equal(recovery.get('pilot-submit').disabled,false);assert.match(recovery.get('form-message').textContent,/do not match/);pass('Wrong original details deny recovery and allow correction on same key');
 registrationFields(recovery);await recovery.get('pilot-form').fire('submit');assert.equal(recovery.get('receipt-id').textContent,receipt);assert.equal(recovery.get('registration-receipt').hidden,false);assert.equal(db.sql.prepare('SELECT count(*) count FROM solborne_registrations').get().count,1);assert.equal((await serverFetch('/api/walk/versions/'+completion)).status,200);pass('Valid private receipt plus corrected original details restores same registration and request');
 console.log(checks+'/'+checks+' focused frontend/API checks passed (mock DOM, actual Worker and SQLite; no browser/layout claim).');
}finally{db.sql.close();}

});

