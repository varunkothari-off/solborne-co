import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../deployment-worker.mjs';
const env={SITE_ORIGIN:'https://solborne.in',DB:{prepare(){throw new Error('Unexpected database access before canonical host authorization');}}};
test('all existing aliases and HTTP use one canonical destination with exact encoded path/query',async()=>{
 for(const host of ['solborne.in','www.solborne.in','getsolborne.com','www.getsolborne.com'])for(const scheme of ['http','https'])for(const method of ['GET','HEAD']){
  if(host==='solborne.in'&&scheme==='https')continue;
  const response=await worker.fetch(new Request(scheme+'://'+host+'/walk/?x=one%20two&y=%2F',{method}),env);
  assert.equal(response.status,301);assert.equal(response.headers.get('Location'),'https://solborne.in/walk/?x=one%20two&y=%2F');assert.equal(await response.text(),'');
 }
});
test('unrecognized hostname and port cannot route to public content or access D1',async()=>{
 for(const host of ['evil.test','solborne.in.evil.test','solborne.in:8443'])for(const path of ['/','/api/registration-session','/downloads/canvas.pdf']){
  const response=await worker.fetch(new Request('https://'+host+path),env);assert.equal(response.status,404);
 }
});
test('unsafe methods on aliases or HTTP canonical reject without database side effects',async()=>{
 for(const base of ['https://www.solborne.in','https://getsolborne.com','https://www.getsolborne.com','http://solborne.in'])for(const method of ['POST','PUT','DELETE']){
  const response=await worker.fetch(new Request(base+'/api/registrations',{method,body:'synthetic'}),env);assert.equal(response.status,405);assert.equal(response.headers.get('Allow'),'GET, HEAD');
 }
});
test('canonical POST reaches the original server origin/CSRF protections',async()=>{
 const response=await worker.fetch(new Request('https://solborne.in/api/registrations',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{}'}),env);assert.equal(response.status,403);assert.equal((await response.json()).code,'origin_required');
});
test('canonical public HTML keeps the exact reviewed bytes and CSP and blocks edge transformation',async()=>{
 const response=await worker.fetch(new Request('https://solborne.in/'),env);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync('public/index.html'));assert.match(response.headers.get('Cache-Control'),/no-transform/);assert.match(response.headers.get('Content-Security-Policy'),/script-src 'self' /);assert.match(response.headers.get('Content-Security-Policy'),/sha256-/);assert.doesNotMatch(response.headers.get('Content-Security-Policy'),/cloudflareinsights|unsafe-eval/);
});
test('private canvas and native/admin/source paths remain closed with forged identity',async()=>{
 for(const path of ['/downloads/canvas.pdf','/downloads/canvas.txt','/admin','/api/admin/registrations','/signin-with-chatgpt','/private/canvas.pdf','/dist/server/index.js','/assets/solborne-workflow-opportunity-canvas.pdf']){
  const response=await worker.fetch(new Request('https://solborne.in'+path,{headers:{'oai-authenticated-user-id':'owner'}}),env);assert([403,404].includes(response.status));assert.doesNotMatch(await response.text(),/%PDF|export const/);
 }
});
