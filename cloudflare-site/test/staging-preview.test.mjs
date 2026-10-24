import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {createPreviewServer} from '../scripts/preview-staging.mjs';

test('loopback preview matches staging entrance, preserves baseline and cannot write or expose parent files',async t=>{
 const folder=await mkdtemp(join(tmpdir(),'solborne-clarity-')),root=join(folder,'public');
 await mkdir(root);await writeFile(join(root,'clarity-home.html'),'<h1>Offer overview</h1><script src="/analytics.js" data-measurement-id="G-TEST"></script>');await writeFile(join(root,'index.html'),'<h1>Retained baseline</h1>');await writeFile(join(folder,'private.txt'),'must not be public');
 const server=createPreviewServer({root});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 t.after(async()=>{await new Promise(done=>server.close(done));const safe=await realpath(folder);assert.ok(safe.startsWith(resolve(tmpdir())+sep));await rm(safe,{recursive:true,force:true});});
 const origin='http://127.0.0.1:'+server.address().port;
 const home=await fetch(origin+'/');assert.equal(home.status,200);const html=await home.text();assert.match(html,/Offer overview/);assert.doesNotMatch(html,/analytics\.js|data-measurement-id/);assert.equal(home.headers.get('X-Solborne-Environment'),'local-staging');
 assert.match(await (await fetch(origin+'/?view=baseline')).text(),/Retained baseline/);
 assert.equal((await fetch(origin+'/api/registrations',{method:'POST',body:'{}'})).status,503);
 assert.equal((await fetch(origin+'/api/auth/session')).status,503);
 const escaped=await fetch(origin+'/%2f..%2fprivate.txt');assert.notEqual(escaped.status,200);assert.doesNotMatch(await escaped.text(),/must not be public/);
 assert.equal(await (await fetch(origin+'/',{method:'HEAD'})).text(),'');
});
