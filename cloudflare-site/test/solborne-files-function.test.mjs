import test from 'node:test';
import assert from 'node:assert/strict';
import {createFileHandler} from '../../supabase/functions/solborne-files/handler.mjs';
const key='SB-11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222';
const token='synthetic-only';
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
const keyHash=await sha(new TextEncoder().encode(token));
function request(method,keyValue=key,body,headers={}){return new Request('https://edge.invalid/solborne-files?key='+encodeURIComponent(keyValue),{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/pdf',...headers},...(body?{body}:{} )});}
function handler(fetcher){return createFileHandler({supabaseUrl:'https://jzbbvlmfsatjqgfubhon.supabase.co',serviceKey:'synthetic-service-key',keyHash,fetcher});}
test('file function authenticates and rejects invalid keys without contacting Storage',async()=>{
 let calls=0;const fn=handler(async()=>{calls++;return new Response();});
 assert.equal((await fn(request('GET',key,null,{Authorization:'Bearer wrong'}))).status,401);
 for(const value of ['../other','SB-a/b',key+'/extra','https://attacker.invalid'])assert.equal((await fn(request('GET',value))).status,422);
 assert.equal(calls,0);
});
test('upload is bounded, hashes actual bytes and never upserts',async()=>{
 const calls=[];const fn=handler(async(url,options)=>{calls.push({url,options});return Response.json({Key:key});});const bytes=new TextEncoder().encode('%PDF-1.7');
 assert.equal((await fn(request('PUT',key,bytes,{'X-Content-SHA256':await sha(bytes)}))).status,201);
 assert.match(calls[0].url,/\/storage\/v1\/object\/solborne-walk-files\/SB-/);assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.headers['x-upsert'],'false');assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-service-key');
 const metadata=JSON.parse(Buffer.from(calls[0].options.headers['x-metadata'],'base64').toString());assert.equal(metadata.sha256,await sha(bytes));
 assert.equal((await fn(request('PUT',key,bytes,{'X-Content-SHA256':'0'.repeat(64)}))).status,422);
 assert.equal((await fn(request('PUT',key,new Uint8Array(5*1024*1024+1)))).status,413);
 assert.equal(calls.length,1);
});
test('duplicate uploads compare bytes and preserve distinct content',async()=>{
 let existing='same';const fn=handler(async(url,options)=>options.method==='POST'?Response.json({statusCode:'409'},{status:400}):new Response(existing));
 assert.equal((await fn(request('PUT',key,'same'))).status,200);existing='different';assert.equal((await fn(request('PUT',key,'same'))).status,409);
});
test('private download and exact deletion never expose service credentials',async()=>{
 const calls=[];const fn=handler(async(url,options)=>{calls.push({url,options});return options.method==='DELETE'?Response.json([]):new Response('private bytes',{headers:{'Content-Type':'application/pdf','X-Secret':'never'}});});
 const read=await fn(request('GET'));assert.equal(await read.text(),'private bytes');assert.equal(read.headers.get('X-Secret'),null);assert.equal(read.headers.get('Cache-Control'),'no-store, private');
 assert.equal((await fn(request('DELETE'))).status,200);assert.deepEqual(JSON.parse(calls[1].options.body),{prefixes:[key]});
 assert.equal((await fn(request('PATCH'))).status,405);
});
test('Storage missing-object envelope is a private 404; internal errors remain generic',async()=>{
 let response=Response.json({statusCode:'404',message:'Object not found'},{status:400});const fn=handler(async()=>response);
 assert.equal((await fn(request('GET'))).status,404);
 response=new Response('upstream sensitive details',{status:500});const failed=await fn(request('DELETE'));assert.equal(failed.status,502);assert.equal(await failed.text(),'{"ok":false}');
});
test('upstream exceptions, incorrect project config and malformed content fail closed',async()=>{
 let calls=0;const fn=handler(async()=>{calls++;throw Error('sensitive secret');});
 assert.equal((await fn(request('GET'))).status,502);
 assert.equal((await fn(request('PUT',key,'data',{'Content-Type':'text/html'}))).status,415);
 assert.equal((await fn(request('PUT',key,'data',{'Content-Length':'5242881'}))).status,413);
 assert.equal((await fn(request('PUT'))).status,422);
 assert.equal(calls,1);
 const wrong=createFileHandler({supabaseUrl:'https://wrong.supabase.co',serviceKey:'test',keyHash,fetcher:async()=>{throw Error('Must not call');}});assert.equal((await wrong(request('GET'))).status,503);
});
