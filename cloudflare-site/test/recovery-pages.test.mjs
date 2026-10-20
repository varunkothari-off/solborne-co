import test from 'node:test';import assert from 'node:assert/strict';import {handleRequest} from '../src/worker.mjs';import deployed from '../deployment-worker.mjs';
const origin='https://solborne.in';
test('missing document renders branded404 with true status, no path reflection, and HEAD parity',async()=>{
 const path='/not-found-%3Cscript%3E';const get=await handleRequest(new Request(origin+path,{headers:{Accept:'text/html'}}),{});assert.equal(get.status,404);assert.match(get.headers.get('content-type'),/text\/html/);const body=await get.text();assert.match(body,/Let’s find your way back/);assert.match(body,/solborne-wordmark/);assert.doesNotMatch(body,/not-found|%3Cscript/);const head=await handleRequest(new Request(origin+path,{method:'HEAD',headers:{Accept:'text/html'}}),{});assert.equal(head.status,404);assert.equal(await head.text(),'');assert.equal(head.headers.get('etag'),get.headers.get('etag'));
});
test('missing API and machine requests keep JSON errors rather than an HTML recovery document',async()=>{
 for(const path of ['/api/does-not-exist','/admin','/.env','/missing.js']){const r=await handleRequest(new Request(origin+path),{});assert.match(r.headers.get('content-type'),/application\/json/);assert.equal((await r.json()).ok,false);}
});
test('canonical HTTPS responses advertise HSTS without widening to other subdomains',async()=>{
 const r=await deployed.fetch(new Request(origin+'/'),{});assert.equal(r.headers.get('Strict-Transport-Security'),'max-age=31536000');
});
