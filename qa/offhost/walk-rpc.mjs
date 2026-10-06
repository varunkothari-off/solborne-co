/** Off-host only: actual server module, mocked transport, no network or database writes. */
import {build} from '../validation/node_modules/esbuild/lib/main.js';
import assert from 'node:assert/strict';
const probe={env:{SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'anon-test',SUPABASE_SERVICE_ROLE_KEY:'service-test',INTERNAL_API_SECRET:'internal-test'},clients:[],calls:[]};
globalThis.__walkRpcProbe=probe;
const result=await build({entryPoints:[new URL('../validation/src/lib/supabase.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'rpc-probe',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'probe'}));
 b.onResolve({filter:/^\.\/env$/},()=>({path:'env',namespace:'probe'}));
 b.onLoad({filter:/.*/,namespace:'probe'},({path})=>({loader:'js',contents:path==='client'?`export function createClient(url,key,options){const p=globalThis.__walkRpcProbe;p.clients.push({url,key,options});return {rpc:async(fn,args)=>{p.calls.push({fn,args});return {data:{questions:args.p_questions},error:null}}};}`:`export function realEnv(name){return globalThis.__walkRpcProbe.env[name]} export function requireEnv(name){const v=realEnv(name);if(!v)throw new Error('Missing required env var '+name);return v}`}));
}}]});
const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
assert.equal(typeof module.setWalkQuestionsServer,'function');
const questions=['What makes this workflow valuable?'];
assert.deepEqual(await module.setWalkQuestionsServer('walk-test',questions),{questions});
assert.equal(probe.clients[0].key,'service-test');
assert.deepEqual(probe.calls[0],{fn:'set_walk_questions',args:{p_secret:'internal-test',p_walk_id:'walk-test',p_questions:questions}});
assert.equal(probe.clients[0].options.auth.persistSession,false);
assert.equal(probe.clients[0].options.auth.autoRefreshToken,false);
delete probe.env.SUPABASE_SERVICE_ROLE_KEY;
await assert.rejects(()=>module.setWalkQuestionsServer('walk-test',questions),e=>e.status===503);
assert.equal(probe.calls.length,1,'missing service key must not fall back to anonymous');
probe.env.SUPABASE_SERVICE_ROLE_KEY='service-test';delete probe.env.INTERNAL_API_SECRET;
await assert.rejects(()=>module.setWalkQuestionsServer('walk-test',questions),/INTERNAL_API_SECRET/);
assert.equal(probe.calls.length,1,'missing secret must not call RPC');
delete globalThis.__walkRpcProbe;
console.log('PASS: actual Walk question persistence uses service role plus internal secret; missing credentials fail closed. No live RPC called.');
