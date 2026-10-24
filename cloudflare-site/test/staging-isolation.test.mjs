import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as staging from '../staging-worker.mjs';
const {stagingFetch}=staging;
test('staging configuration has its own exact host and no production data or scheduled bindings',()=>{
 const config=JSON.parse(readFileSync('wrangler.staging.jsonc','utf8'));
 assert.equal(config.name,'solborne-staging');
 assert.deepEqual(config.routes,[{pattern:'staging.solborne.in',custom_domain:true}]);
 for(const key of ['d1_databases','kv_namespaces','r2_buckets','services','triggers'])assert.equal(config[key],undefined);
});
test('staging refuses mutations and production hosts without touching supplied production bindings',async()=>{
 const env=new Proxy({},{get(){throw Error('Production binding accessed');}});
 const rejected=await stagingFetch(new Request('https://staging.solborne.in/api/registrations',{method:'POST',body:'{}'}),env,{});
 assert.equal(rejected.status,503);assert.equal(rejected.headers.get('X-Robots-Tag'),'noindex, nofollow, noarchive');
 assert.equal((await stagingFetch(new Request('https://solborne.in/'),env,{})).status,404);
});
test('staging session reports disconnected auth even when production values are supplied',async()=>{
 const response=await stagingFetch(new Request('https://staging.solborne.in/api/auth/session'),{AUTH_ENABLED:'true',SUPABASE_URL:'https://production.supabase.co'},{});
 const data=await response.json();assert.equal(data.authenticated,false);assert.equal(data.enabled,false);assert.equal(data.configured,false);
 assert.equal(response.headers.get('X-Solborne-Environment'),'staging');
});
test('staging does not fetch live customer metrics',async()=>{
 const response=await stagingFetch(new Request('https://staging.solborne.in/api/public-metrics'),{},{});
 assert.equal(response.status,503);assert.match((await response.json()).error,/staging/i);
});
test('payment scenes are the staging entrance, with a baseline comparison and unchanged private routes',()=>{
 assert.equal(staging.stagingPath(new URL('https://staging.solborne.in/')),'/payment-scenes.html');
 assert.equal(staging.stagingPath(new URL('https://staging.solborne.in/?view=baseline')),'/');
 assert.equal(staging.stagingPath(new URL('https://staging.solborne.in/api/ai-walk')),'/api/ai-walk');
});
