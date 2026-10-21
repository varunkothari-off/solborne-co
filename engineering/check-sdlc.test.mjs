import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const checker=fileURLToPath(new URL('./check-sdlc.mjs',import.meta.url));
function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'solborne-sdlc-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const put=(name,value)=>{const target=join(root,name);mkdirSync(join(target,'..'),{recursive:true});writeFileSync(target,value);};
  put('specs/001-example/spec.md','# Example\n- AC-01: Save the intended result.\n- AC-02: Reject a foreign owner.\n');
  put('specs/001-example/plan.md','# Technical plan\nUse project-bound storage.\n');
  put('specs/001-example/tasks.md','# Tasks\n- [x] Test, implement and review.\n');
  put('cloudflare-site/test/example.test.mjs','// Synthetic mapped acceptance test fixture.\n');
  put('engineering/example-review.md','# Review\nNo unresolved findings in this synthetic fixture.\n');
  const reuse={components:[{name:'Example reusable part',source:'https://example.test/source',version:'1.0.0',license:'MIT',usage:'Drawing input'}]};
  const evidence={feature:'001-example',spec:'specs/001-example/spec.md',plan:'specs/001-example/plan.md',tasks:'specs/001-example/tasks.md',acceptance:[{id:'AC-01',tests:['cloudflare-site/test/example.test.mjs']},{id:'AC-02',tests:['cloudflare-site/test/example.test.mjs']}],tdd:{red:{commit:'020b1cb',command:'node --test example.test.mjs',result:'failed',reason:'Missing save endpoint returns 405'},green:{command:'node --test example.test.mjs',result:'passed'}},review:{status:'passed',report:'engineering/example-review.md'},reuse:{manifest:'engineering/reuse-registry.json'},limitations:['Synthetic fixture; not a platform test.']};
  const save=()=>{put('engineering/reuse-registry.json',JSON.stringify(reuse));put('specs/001-example/verification.json',JSON.stringify(evidence));};
  const run=()=>spawnSync(process.execPath,[checker,'--root',root],{encoding:'utf8',timeout:10000});
  save();return {root,put,reuse,evidence,save,run};
}
function rejected(f,pattern){const result=f.run();assert.notEqual(result.status,0,result.stdout);assert.match(result.stderr+result.stdout,pattern);}

test('valid mapped spec, red/green evidence, review and licensed reuse pass the gate',t=>{
  const f=fixture(t),result=f.run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/1 feature/);
});
test('a spec without verification evidence is rejected',t=>{
  const f=fixture(t);rmSync(join(f.root,'specs/001-example/verification.json'));rejected(f,/verification\.json/);
});
test('a missing acceptance mapping is rejected',t=>{
  const f=fixture(t);f.evidence.acceptance.pop();f.save();rejected(f,/AC-02/);
});
test('a mapping to an absent test file is rejected',t=>{
  const f=fixture(t);f.evidence.acceptance[0].tests=['cloudflare-site/test/missing.test.mjs'];f.save();rejected(f,/missing\.test/);
});
test('unknown and duplicate acceptance mappings are rejected',t=>{
  const f=fixture(t);f.evidence.acceptance.push({...f.evidence.acceptance[0]});f.save();rejected(f,/duplicate/i);
  f.evidence.acceptance.at(-1).id='AC-99';f.save();rejected(f,/AC-99/);
});
test('missing red evidence or a successful red result is rejected',t=>{
  const f=fixture(t);delete f.evidence.tdd.red;f.save();rejected(f,/red/i);
  f.evidence.tdd.red={commit:'020b1cb',command:'test',result:'passed',reason:'Not a failing test'};f.save();rejected(f,/red.*failed/i);
});
test('red evidence needs a commit, command and intended failure reason',t=>{
  const f=fixture(t);f.evidence.tdd.red.reason='';f.save();rejected(f,/reason/i);
});
test('green evidence must report passed and cannot reuse the red commit',t=>{
  const f=fixture(t);f.evidence.tdd.green.result='failed';f.save();rejected(f,/green.*passed/i);
  f.evidence.tdd.green.result='passed';f.evidence.tdd.green.commit=f.evidence.tdd.red.commit;f.save();rejected(f,/distinct/i);
});
test('an absent or unpassed review is rejected',t=>{
  const f=fixture(t);f.evidence.review.status='pending';f.save();rejected(f,/review/i);
  f.evidence.review.status='passed';rmSync(join(f.root,'engineering/example-review.md'));f.save();rejected(f,/example-review/);
});
test('reuse needs a real manifest with source, version, licence and usage',t=>{
  const f=fixture(t);delete f.reuse.components[0].license;f.save();rejected(f,/licen[cs]e/i);
  f.reuse.components=[];f.save();rejected(f,/non-empty/i);
});
test('evidence cannot refer to files outside the checkout',t=>{
  const f=fixture(t);f.evidence.plan='../private-plan.md';f.save();rejected(f,/repository-relative/i);
});
test('invalid evidence JSON fails explicitly',t=>{
  const f=fixture(t);f.put('specs/001-example/verification.json','{broken');rejected(f,/invalid JSON/i);
});
test('a JSON array cannot masquerade as a verification object',t=>{
  const f=fixture(t);f.put('specs/001-example/verification.json','[]');rejected(f,/verification.*object/i);
});
test('a repository without feature specifications fails instead of silently passing',t=>{
  const f=fixture(t);rmSync(join(f.root,'specs'),{recursive:true});rejected(f,/no feature/i);
});
