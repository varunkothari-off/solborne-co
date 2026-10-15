import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleRequest } from '../src/worker.mjs';
import { createWebsiteFiles, validateWebsiteInterview, websiteFields } from '../src/website.mjs';

// Actual page handlers + actual Worker + in-memory SQL. DOM mechanics and the
// lost transport response are simulated. This is not browser, layout, or CSP QA.
const root = new URL('../', import.meta.url);
const origin = 'https://solborne.in';

class D1 {
  constructor() {
    this.sql = new DatabaseSync(':memory:');
    const directory = new URL('drizzle/', root);
    for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
      this.sql.exec(readFileSync(new URL(file, directory), 'utf8'));
    }
    this.sql.exec('UPDATE solborne_intake_control SET enabled=1');
  }
  prepare(sql) {
    const statement = this.sql.prepare(sql);
    let values = [];
    const query = {
      bind(...next) { values = next; return query; },
      async first() { return statement.get(...values) || null; },
      async all() { return { results: statement.all(...values) }; },
      async run() {
        const result = statement.run(...values);
        return { success: true, meta: { changes: result.changes } };
      },
    };
    return query;
  }
  async batch(queries) {
    this.sql.exec('BEGIN');
    try {
      const results = [];
      for (const query of queries) results.push(await query.run());
      this.sql.exec('COMMIT');
      return results;
    } catch (error) {
      this.sql.exec('ROLLBACK');
      throw error;
    }
  }
}

class Element {
  constructor() {
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.elements = {};
    this.listeners = new Map();
    this.attributes = new Map();
    this.focused = false;
  }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); delete this[name]; }
  reportValidity() { return true; }
  focus() { this.focused = true; }
  fire(type, event = {}) { return this.listeners.get(type)?.(event); }
}

async function fixture(t,{anonymous=false,historyState=null}={}) {
  const db = new D1();
  t.after(() => db.sql.close());
  const env = { DB: db, SITE_ORIGIN: origin };
  let now = 1791360000000;
  const cookies = new Map();
  const requests=[];
  async function request(path, init = {}) {
    requests.push({path,method:init.method||'GET'});
    const response = await handleRequest(new Request(origin + path, {
      ...init,
      headers: {
        Origin: origin, 'Content-Type': 'application/json',
        Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        'CF-Connecting-IP': '192.0.2.100', ...init.headers,
      },
    }), env, { clock: () => now });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const [name, value] = setCookie.split(';')[0].split('=');
      cookies.set(name, value);
    }
    return response;
  }
  const sessionResponse = await request('/api/registration-session');
  assert.equal(sessionResponse.status, 200);
  const session = await sessionResponse.json();
  now += 1500;
  const registration = await request('/api/registrations', {
    method: 'POST', body: JSON.stringify({
      name: 'Synthetic Recovery Test', contact: 'private@example.test',
      enquiryType: 'website-pilot', permissionToRespond: true, website: '',
      csrf: session.csrf, idempotencyKey: 'a'.repeat(64),
    }),
  });
  assert.equal(registration.status, 201);
  if(anonymous)cookies.delete('__Host-solborne_access');

  const elements = new Map();
  const history={state:historyState,replacements:[],replaceState(state){this.state=state;this.replacements.push(state);}};
  function element(id) {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  }
  const form = element('walk-form');
  element('walk-fields').disabled = true;
  element('walk-preview-box').hidden = true;
  element('walk-receipt').hidden = true;
  for (const name of Object.keys(websiteFields)) { form.elements[name] = element(name); form.elements[name].name = name; }
  for (const name of ['planningMaterials','planningOwner','planningGoal']) { form.elements[name]=new Element(); form.elements[name].name=name; }
  for (let i = 0; i < 5; i++) {
    form.elements[`story${i}`] = new Element();
    form.elements[`story${i}`].name = `story${i}`;
    form.elements[`story${i}`].value = `Synthetic public story answer ${i}`;
  }
  for (const [name, value] of Object.entries({
    businessName: 'Original Workshop', description: 'We repair everyday objects.',
    audience: 'Local families', services: 'Repairs\nAdvice',
    callToAction: 'Ask about repairs', email: 'public@example.test',
  })) form.elements[name].value = value;

  let loseNextCompletionResponse = true;
  const metadataOverrides=new Map();
  const completions = [];
  async function fetch(path, init) {
    if(metadataOverrides.has(path)){
      requests.push({path,method:init?.method||'GET'});
      const result=metadataOverrides.get(path);if(result instanceof Error)throw result;
      return new Response(JSON.stringify(result.body||{ok:false,error:'Synthetic metadata request failure'}),{status:result.status,headers:{'Content-Type':'application/json'}});
    }
    const response = await request(path, init);
    if (path === '/api/walk/complete') {
      completions.push({ status: response.status,
        payload: JSON.parse(init.body), response: await response.clone().json() });
      if (loseNextCompletionResponse) {
        loseNextCompletionResponse = false;
        assert.equal(response.status, 201, 'The lost response must follow a durable successful save');
        throw new Error('Synthetic lost completion acknowledgement');
      }
    }
    return response;
  }
  const pageSource = readFileSync(new URL('public/walk.js', root), 'utf8');
  assert.match(pageSource, /^import .* from '\/website-renderer\.js';\r?\n/);
  assert.match(pageSource, /\bprepare\(\);\s*$/);
  // Capture only the existing startup promise so WebCrypto work is awaited.
  // Handlers and their implementation are otherwise evaluated unchanged.
  async function loadPage(){
    const context={document:{getElementById:element},fetch,crypto,history,createWebsiteFiles,validateWebsiteInterview,websiteFields};
    vm.runInNewContext(pageSource
      .replace(/^import .* from '\/website-renderer\.js';\r?\n/, '')
      .replace(/\bprepare\(\);\s*$/, 'globalThis.preparation = prepare();'),context,{filename:'public/walk.js'});
    await context.preparation;
  }
  await loadPage();
  assert.equal(element('walk-fields').disabled, anonymous, element('walk-access').textContent);

  function previewAndApprove() {
    element('walk-preview').fire('click');
    assert.equal(element('walk-preview-box').hidden, false);
    assert.equal(element('walk-submit').disabled, true);
    element('walk-approved').checked = true;
    form.fire('input', { target: element('walk-approved') });
    assert.equal(element('walk-submit').disabled, false);
  }
  async function submit() { await form.fire('submit', { preventDefault() {} }); }
  function change(name, value) {
    form.elements[name].value = value;
    form.fire('input', { target: form.elements[name] });
  }
  async function reload(){
    form.hidden=false;element('walk-receipt').hidden=true;element('walk-preview-box').hidden=true;element('walk-approved').checked=false;element('walk-submit').disabled=true;
    element('walk-delivery-files').hidden=true;element('walk-handover-next').hidden=true;element('walk-html').removeAttribute('href');element('walk-readme').removeAttribute('href');
    for(const field of Object.values(form.elements))field.value='';
    await loadPage();
  }
  async function registerDifferent(){
    const response=await request('/api/registration-session'),next=await response.json();now+=1500;
    const saved=await request('/api/registrations',{method:'POST',body:JSON.stringify({name:'Different Registration',contact:'different@example.test',enquiryType:'website-pilot',permissionToRespond:true,website:'',csrf:next.csrf,idempotencyKey:'b'.repeat(64)})});
    assert.equal(saved.status,201);
  }
  function release(completion){
    // Authorized review/release is exercised only against this test's in-memory DB.
    db.sql.prepare("UPDATE solborne_owner_reviews SET status='reviewed',updated_at=? WHERE completion_id=?").run(now,completion);
    db.sql.prepare("INSERT INTO solborne_website_releases(completion_id,released_at,release_basis) VALUES(?,?,'reviewed')").run(completion,now);
  }
  return { db, request, form, element, completions, previewAndApprove, submit, change,history,requests,metadataOverrides,reload,registerDifferent,release,expireAccess:()=>{now+=25*3600*1000;} };
}

test('actual Walk page recovers a lost response after changed facts are previewed and approved', async t => {
  const f = await fixture(t);
  f.previewAndApprove();
  await f.submit();
  assert.match(f.element('walk-message').textContent, /Synthetic lost completion acknowledgement/);
  assert.equal(f.form.hidden, false);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n, 1);
  f.change('businessName', 'Revised Workshop');
  assert.equal(f.element('walk-preview-box').hidden, true);
  assert.equal(f.element('walk-approved').checked, false);
  f.previewAndApprove();
  await f.submit();
  assert.equal(f.completions[1].status, 201,
    'Explicitly approved changed facts must be saved after a lost acknowledgement; ' + f.element('walk-message').textContent);
  assert.notEqual(f.completions[1].payload.idempotencyKey, f.completions[0].payload.idempotencyKey);
  assert.equal(f.form.hidden, true);
  assert.equal(f.element('walk-receipt').hidden, false);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n, 2);
  assert.deepEqual(f.completions[1].response.downloads,[]);
  assert.equal(f.element('walk-html').href,undefined);
  const changed=f.completions[1].response.completion,originalId=f.completions[0].response.completion;
  assert.equal((await f.request(`/downloads/website/${changed}/index.html`)).status,423);
  f.release(changed);f.release(originalId);await f.element('walk-status-refresh').fire('click');
  const revised = await f.request(f.element('walk-html').href);
  assert.equal(revised.status, 200);
  assert.match(await revised.text(), /Revised Workshop/);
  const original = await f.request(`/downloads/website/${originalId}/index.html`);
  assert.equal(original.status, 200);
  assert.match(await original.text(), /Original Workshop/);
});

test('actual Walk page retries identical facts after a lost response without duplicating completion', async t => {
  const f = await fixture(t);
  f.previewAndApprove();
  await f.submit();
  await f.submit();
  assert.equal(f.completions[1].status, 200);
  assert.equal(f.completions[1].payload.idempotencyKey, f.completions[0].payload.idempotencyKey);
  assert.equal(f.completions[1].response.completion, f.completions[0].response.completion);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n, 1);
  assert.equal(f.element('walk-receipt').hidden, false);
  assert.equal(f.element('walk-html').href,undefined);assert.equal(f.element('walk-delivery-files').hidden,true);
  assert.match(f.element('walk-request-state').textContent,/Pending Solborne processing/);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_website_artifacts').get().n,1);
  assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_owner_reviews').get().n,1);
});

test('verified six-stage flow preserves answers when switching Questions and Canvas', async t => {
  const f=await fixture(t);
  assert.match(f.element('walk-step-status').textContent,/Step 3 of 6/);
  f.element('tab-canvas').fire('click');
  assert.equal(f.element('questions-panel').hidden,true);
  assert.equal(f.element('canvas-panel').hidden,false);
  f.change('businessName','Remember this name');
  f.element('tab-questions').fire('click');
  f.element('tab-canvas').fire('click');
  assert.equal(f.form.elements.businessName.value,'Remember this name');
  assert.equal(f.completions.length,0);
});

test('facts review shows actual visitor content before the preview and never saves automatically', async t => {
  const f=await fixture(t);
  f.element('walk-review').fire('click');
  assert.match(f.element('walk-step-status').textContent,/Step 4 of 6/);
  assert.equal(f.element('fact-businessName').textContent,'Original Workshop');
  assert.equal(f.element('fact-email').textContent,'public@example.test');
  assert.equal(f.completions.length,0);
  f.element('walk-preview').fire('click');
  assert.match(f.element('walk-step-status').textContent,/Step 5 of 6/);
  assert.equal(f.element('walk-submit').disabled,true);
  f.element('walk-edit').fire('click');
  assert.match(f.element('walk-step-status').textContent,/Step 3 of 6/);
  assert.equal(f.form.elements.description.value,'We repair everyday objects.');
});

test('a missing essential fact stays on the editable canvas and shows an honest missing state', async t => {
  const f=await fixture(t);f.change('services','');
  f.element('walk-review').fire('click');
  assert.match(f.element('walk-step-status').textContent,/Step 3 of 6/);
  assert.equal(f.element('canvas-panel').hidden,false);
  assert.match(f.element('canvas-missing').textContent,/1 website detail to check/);
  assert.equal(f.element('services-error').hidden,false);
  assert.match(f.element('services-error').textContent,/Enter your offer and services/);
  assert.equal(f.form.elements.services.getAttribute('aria-invalid'),'true');
  assert.equal(f.form.elements.services.focused,true);
  assert.equal(f.completions.length,0);
});

test('private planning notes never enter the completion payload or generated source',async t=>{
  const f=await fixture(t);f.change('planningOwner','PRIVATE_OPERATOR_731');f.change('planningMaterials','PRIVATE_ASSET_NOTE_732');f.change('planningGoal','PRIVATE_GOAL_733');
  f.previewAndApprove();await f.submit();await f.submit();
  const payload=JSON.stringify(f.completions[1].payload);assert.doesNotMatch(payload,/PRIVATE_OPERATOR|PRIVATE_ASSET|PRIVATE_GOAL|planningOwner/);
  f.release(f.history.state.solborneWalkCompletion);await f.element('walk-status-refresh').fire('click');
  const file=await f.request(f.element('walk-html').href);assert.doesNotMatch(await file.text(),/PRIVATE_OPERATOR|PRIVATE_ASSET|PRIVATE_GOAL/);
});

test('a visitor can reuse their story for an already-covered follow-up without fabricated answers',async t=>{
  const f=await fixture(t);f.change('story1','');f.element('story1-covered').fire('click');
  assert.equal(f.form.elements.story1.value,'Covered in my business story.');
  f.element('use-story').fire('click');assert.equal(f.form.elements.description.value,'Synthetic public story answer 0');
  assert.equal(f.element('walk-approved').checked,false);assert.equal(f.completions.length,0);
});

test('anonymous Walk access points back to Register rather than claiming Story stage progress',async t=>{
  const f=await fixture(t,{anonymous:true});assert.match(f.element('walk-step-status').textContent,/Step 1 of 6/);assert.match(f.element('walk-access').textContent,/Registration access is unavailable/);assert.equal(f.element('walk-stage-3').hidden,true);assert.equal(f.element('walk-fields').disabled,true);assert.equal(f.completions.length,0);
});

test('Continue validates the story and moves focus to website copy only after a real answer or covered follow-up',async t=>{
  const f=await fixture(t);f.change('story2','');
  f.element('questions-continue').fire('click');
  assert.equal(f.element('questions-panel').hidden,false);
  assert.equal(f.element('story2-error').hidden,false);
  assert.equal(f.form.elements.story2.getAttribute('aria-invalid'),'true');
  assert.equal(f.form.elements.story2.focused,true);
  assert.equal(f.completions.length,0);
  f.element('story2-covered').fire('click');
  assert.equal(f.element('story2-error').hidden,true);
  assert.equal(f.form.elements.story2.value,'Covered in my business story.');
  f.element('questions-continue').fire('click');
  assert.equal(f.element('canvas-panel').hidden,false);
  assert.equal(f.element('questions-panel').hidden,true);
  assert.equal(f.element('canvas-heading').focused,true);
  assert.equal(f.form.elements.description.value,'We repair everyday objects.','Continuing must not infer or copy website text');
  assert.equal(f.completions.length,0);
});

test('switching to website copy cannot bypass story validation at facts review',async t=>{
  const f=await fixture(t);f.change('story0','');
  f.element('tab-canvas').fire('click');f.element('walk-review').fire('click');
  assert.equal(f.element('questions-panel').hidden,false);
  assert.equal(f.element('walk-stage-4').hidden,true);
  assert.equal(f.element('story0-error').hidden,false);
  assert.equal(f.form.elements.story0.focused,true);
  assert.equal(f.completions.length,0);
});

test('public contact validation identifies the group and then accepts a chosen business link',async t=>{
  const f=await fixture(t);f.change('email','');f.element('walk-review').fire('click');
  assert.equal(f.element('canvas-panel').hidden,false);
  assert.equal(f.element('contact-error').hidden,false);
  assert.match(f.element('contact-error').textContent,/at least one public business contact/);
  assert.equal(f.form.elements.email.focused,true);
  f.change('websiteUrl','https://business.example.test/contact');
  assert.equal(f.element('contact-error').hidden,true);
  f.element('walk-review').fire('click');
  assert.equal(f.element('walk-stage-4').hidden,false);
  assert.equal(f.element('fact-email').textContent,'Not included');
  assert.equal(f.element('fact-websiteUrl').textContent,'https://business.example.test/contact');
  assert.equal(f.element('walk-heading-4').focused,true);
  assert.equal(f.completions.length,0);
});

test('preview widths change the view without replacing facts, saving or enabling approval',async t=>{
  const f=await fixture(t);f.element('walk-review').fire('click');f.element('walk-preview').fire('click');
  const content=f.element('walk-preview-frame').srcdoc;
  assert.match(content,/Original Workshop/);
  assert.equal(f.element('walk-preview-shell').getAttribute('data-view'),'wide');
  f.element('preview-phone').fire('click');
  assert.equal(f.element('walk-preview-shell').getAttribute('data-view'),'phone');
  assert.equal(f.element('preview-phone').getAttribute('aria-pressed'),'true');
  assert.equal(f.element('preview-wide').getAttribute('aria-pressed'),'false');
  assert.equal(f.element('walk-preview-frame').srcdoc,content);
  assert.equal(f.element('walk-submit').disabled,true);
  f.element('preview-wide').fire('click');
  assert.equal(f.element('walk-preview-shell').getAttribute('data-view'),'wide');
  assert.equal(f.element('walk-heading-5').focused,true);
  assert.equal(f.completions.length,0);
});

test('editing approved website copy clears preview and approval and prevents submission until re-review',async t=>{
  const f=await fixture(t);f.previewAndApprove();
  f.change('description','New public copy');await f.submit();
  assert.equal(f.element('walk-preview-box').hidden,true);
  assert.equal(f.element('walk-preview-frame').srcdoc,undefined);
  assert.equal(f.element('walk-approved').checked,false);
  assert.equal(f.element('walk-submit').disabled,true);
  assert.equal(f.completions.length,0);
});

test('only deliberately reused story text enters the approved public website and README is a separate file',async t=>{
  const f=await fixture(t);f.change('story0','PUBLIC_STORY_COPY_841');f.change('story3','PRIVATE_STORY_NOTE_842');
  f.element('use-story').fire('click');assert.equal(f.form.elements.description.value,'PUBLIC_STORY_COPY_841');
  f.previewAndApprove();await f.submit();await f.submit();
  assert.equal(f.element('walk-html').href,undefined);f.release(f.history.state.solborneWalkCompletion);await f.element('walk-status-refresh').fire('click');
  const htmlResponse=await f.request(f.element('walk-html').href),html=await htmlResponse.text();
  assert.match(html,/PUBLIC_STORY_COPY_841/);assert.doesNotMatch(html,/PRIVATE_STORY_NOTE_842|private@example\.test/);
  assert.equal(f.element('walk-receipt').hidden,false);
  assert.match(f.element('walk-message').textContent,/HTML and README/);
  const readme=await f.request(f.element('walk-readme').href);
  assert.equal(readme.status,200);assert.match(await readme.text(),/Open index\.html in your browser/);
  assert.notEqual(f.element('walk-html').href,f.element('walk-readme').href);
});

test('only an acknowledged durable completion puts its ID, without facts or tokens, in current tab history',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();
  assert.equal(f.history.state,null,'A lost acknowledgement must not manufacture a completion marker');
  await f.submit();
  const state=JSON.parse(JSON.stringify(f.history.state));
  assert.deepEqual(state,{solborneWalkCompletion:f.completions[1].response.completion});
  assert.match(state.solborneWalkCompletion,/^SW-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
  assert.doesNotMatch(JSON.stringify(state),/Original Workshop|public@example|private@example|csrf|idempotency|facts|answers/);
});

test('reload restores the exact pending receipt only after owned metadata passes, without file requests or resubmitting',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  const id=f.history.state.solborneWalkCompletion,offset=f.requests.length;
  await f.reload();
  assert.deepEqual(f.requests.slice(offset),[
    {path:'/api/access/status',method:'GET'},
    {path:`/api/walk/versions/${id}`,method:'GET'},
  ]);
  assert.equal(f.form.hidden,true);assert.equal(f.element('walk-receipt').hidden,false);
  assert.match(f.element('walk-step-status').textContent,/Step 6 of 6/);
  assert.equal(f.element('walk-html').href,undefined);assert.equal(f.element('walk-readme').href,undefined);
  assert.equal(f.element('walk-delivery-files').hidden,true);assert.match(f.element('walk-review-state').textContent,/Awaiting Solborne review/);
  assert.equal(f.completions.length,2);assert.equal(f.db.sql.prepare('SELECT count(*) n FROM solborne_walk_completions').get().n,1);
});

test('a completed receipt can restore while intake is closed, before asking for a fresh form session',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  f.db.sql.exec('UPDATE solborne_intake_control SET enabled=0');
  const offset=f.requests.length;await f.reload();
  assert.equal(f.element('walk-receipt').hidden,false);
  assert.equal(f.requests.slice(offset).some(item=>item.path==='/api/registration-session'),false);
  assert.equal(f.completions.length,2);
});

test('reviewed pending metadata is not a release; manual refresh exposes files only after an explicit release',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  const id=f.history.state.solborneWalkCompletion;
  f.db.sql.prepare("UPDATE solborne_owner_reviews SET status='reviewed' WHERE completion_id=?").run(id);
  await f.element('walk-status-refresh').fire('click');
  assert.match(f.element('walk-review-state').textContent,/Review complete; awaiting file release/);
  assert.equal(f.element('walk-html').href,undefined);assert.equal(f.element('walk-delivery-files').hidden,true);
  assert.equal((await f.request(`/downloads/website/${id}/index.html`)).status,423);
  f.release(id);await f.element('walk-status-refresh').fire('click');
  assert.equal(f.element('walk-html').href,`/downloads/website/${id}/index.html`);
  assert.equal(f.element('walk-readme').href,`/downloads/website/${id}/README.txt`);
  assert.equal(f.element('walk-delivery-files').hidden,false);assert.match(f.element('walk-review-state').textContent,/Solborne review complete/);
  assert.equal(f.completions.length,2);
});

test('an owned released receipt restores exact file links during closed intake using metadata and no new form session',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  const id=f.history.state.solborneWalkCompletion;f.release(id);f.db.sql.exec('UPDATE solborne_intake_control SET enabled=0');
  const offset=f.requests.length;await f.reload();
  assert.deepEqual(f.requests.slice(offset),[{path:'/api/access/status',method:'GET'},{path:`/api/walk/versions/${id}`,method:'GET'}]);
  assert.equal(f.element('walk-receipt').hidden,false);assert.equal(f.element('walk-delivery-files').hidden,false);
  assert.equal(f.element('walk-html').href,`/downloads/website/${id}/index.html`);
  assert.equal((await f.request(f.element('walk-html').href)).status,200);assert.equal(f.completions.length,2);
});

test('unconfirmed delivery metadata cannot claim a receipt or manufacture file links',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  const id=f.history.state.solborneWalkCompletion,data=await (await f.request(`/api/walk/versions/${id}`)).json();
  f.metadataOverrides.set(`/api/walk/versions/${id}`,{status:200,body:{...data,version:{...data.version,deliveryState:'unknown'}}});
  await f.reload();
  assert.equal(f.history.state.solborneWalkCompletion,id);assert.equal(f.element('walk-receipt').hidden,true);
  assert.equal(f.element('walk-html').href,undefined);assert.equal(f.element('walk-readme').href,undefined);
  assert.equal(f.element('walk-refresh').hidden,false);assert.equal(f.element('walk-fields').disabled,true);assert.equal(f.completions.length,2);
});

test('a different saved registration cannot restore another registration receipt and the stale marker is removed',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();await f.registerDifferent();
  await f.reload();
  assert.equal(f.history.state,null);assert.equal(f.form.hidden,false);assert.equal(f.element('walk-receipt').hidden,true);
  assert.equal(f.element('walk-fields').disabled,false);assert.match(f.element('walk-step-status').textContent,/Step 3 of 6/);
  assert.match(f.element('walk-message').textContent,/unavailable for this registration/);
  assert.equal(f.completions.length,2);
});

test('expired registration access retains only the completion marker for recovery and never checks or restores receipt links',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();f.expireAccess();
  const id=f.history.state.solborneWalkCompletion;
  const offset=f.requests.length;await f.reload();
  assert.deepEqual(f.requests.slice(offset),[{path:'/api/access/status',method:'GET'}]);
  assert.deepEqual(JSON.parse(JSON.stringify(f.history.state)),{solborneWalkCompletion:id});assert.equal(f.element('walk-receipt').hidden,true);
  assert.equal(f.element('walk-html').href,undefined);assert.equal(f.element('walk-register-link').hidden,false);assert.match(f.element('walk-access').textContent,/Recover your saved registration/);
  assert.equal(f.element('walk-fields').disabled,true);assert.match(f.element('walk-step-status').textContent,/Step 1 of 6/);
  assert.equal(f.completions.length,2);
});

test('a malformed history ID cannot become a download path or a claimed receipt',async t=>{
  const f=await fixture(t,{historyState:{solborneWalkCompletion:'SW-../../../private-token'}});
  assert.equal(f.history.state,null);assert.equal(f.element('walk-receipt').hidden,true);
  assert.equal(f.requests.some(item=>item.method==='HEAD'||item.path.startsWith('/api/walk/versions/')),false);assert.equal(f.completions.length,0);
});

test('missing owned completion metadata prevents receipt restoration and clears a stale completion marker',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  f.metadataOverrides.set(`/api/walk/versions/${f.history.state.solborneWalkCompletion}`,{status:404});
  await f.reload();
  assert.equal(f.history.state,null);assert.equal(f.element('walk-receipt').hidden,true);assert.equal(f.form.hidden,false);
  assert.equal(f.completions.length,2);
});

test('temporary metadata failure retains only the marker and offers honest retry, without creating a new form or Walk',async t=>{
  const f=await fixture(t);f.previewAndApprove();await f.submit();await f.submit();
  const id=f.history.state.solborneWalkCompletion,offset=f.requests.length;
  f.metadataOverrides.set(`/api/walk/versions/${id}`,{status:503});
  await f.reload();
  assert.equal(f.history.state.solborneWalkCompletion,id);assert.equal(f.element('walk-receipt').hidden,true);assert.equal(f.form.hidden,false);
  assert.equal(f.element('walk-refresh').hidden,false);assert.equal(f.element('walk-fields').disabled,true);
  assert.match(f.element('walk-message').textContent,/could not be checked right now/);
  assert.equal(f.requests.slice(offset).some(item=>item.path==='/api/registration-session'),false);
  assert.equal(f.completions.length,2);
  f.metadataOverrides.set(`/api/walk/versions/${id}`,new Error('Synthetic metadata network failure'));await f.element('walk-refresh').fire('click');
  assert.equal(f.element('walk-receipt').hidden,true);assert.equal(f.element('walk-fields').disabled,true);assert.equal(f.completions.length,2);
  f.metadataOverrides.clear();await f.element('walk-refresh').fire('click');
  assert.equal(f.element('walk-receipt').hidden,false);assert.equal(f.form.hidden,true);
  assert.equal(f.element('walk-refresh').hidden,true);assert.equal(f.completions.length,2);
});
