import test from 'node:test';
import assert from 'node:assert/strict';
import {storageFor} from '../src/walk-storage.mjs';
import {createFileHandler} from '../../supabase/functions/solborne-files/handler.mjs';
const project='https://jzbbvlmfsatjqgfubhon.supabase.co';
const key='SB-11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:project,SUPABASE_WALK_FILES_ENABLED:'true',SOLBORNE_PRESALES_TOKEN:'synthetic-token'};
test('configured Supabase provider uploads bytes privately and preserves hash',async()=>{
 const calls=[];const provider=storageFor(env,{fetcher:async(url,options)=>{calls.push({url,options});return Response.json({ok:true});}});
 assert.ok(provider,'configured Supabase storage is available without R2');
 await provider.put(key,new Uint8Array([1,2]),{httpMetadata:{contentType:'application/pdf'},customMetadata:{sha256:'a'.repeat(64)}});
 assert.equal(calls[0].url,project+'/functions/v1/solborne-files?key='+encodeURIComponent(key));
 assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-token');
 assert.equal(calls[0].options.headers['X-Content-SHA256'],'a'.repeat(64));
 assert.deepEqual([...calls[0].options.body],[1,2]);
});
test('reset starts all bounded exact deletes together so it fits within the existing lease',async()=>{
 const releases=[];let starts=0;const provider=storageFor(env,{fetcher:async()=>{starts++;await new Promise(resolve=>releases.push(resolve));return new Response();}});
 const other=key.replace('22222222-2222','33333333-2222');const pending=provider.delete([key,other]);
 assert.equal(starts,2);for(const release of releases)release();await pending;
});
test('configuration fails closed and local synthetic storage remains compatible',()=>{
 for(const change of [{SUPABASE_URL:'https://wrong.supabase.co'},{SUPABASE_WALK_FILES_ENABLED:'false'},{SOLBORNE_PRESALES_TOKEN:''}])assert.equal(storageFor({...env,...change}),null);
 const stub={put(){},get(){},delete(){}};assert.equal(storageFor({WALK_FILES:stub}),stub);
});
test('private reads distinguish not found from storage failures and reset deletes exact keys',async()=>{
 let status=404;const calls=[];const provider=storageFor(env,{fetcher:async(url,options)=>{calls.push({url,options});return new Response(status===200?'bytes':null,{status});}});
 assert.ok(provider);assert.equal(await provider.get(key),null);status=503;await assert.rejects(()=>provider.get(key));
 status=200;const object=await provider.get(key);assert.equal(await new Response(object.body).text(),'bytes');
 await provider.delete([key,key]);assert.equal(calls.filter(call=>call.options.method==='DELETE').length,1);
 await assert.rejects(()=>provider.delete('../other'));await assert.rejects(()=>provider.get('https://attacker.invalid'));
});
test('provider and Edge function round trip private bytes, metadata, duplicates and deletion',async()=>{
 const objects=new Map();const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 const fn=createFileHandler({supabaseUrl:project,serviceKey:'synthetic-service',keyHash:await hash(new TextEncoder().encode(env.SOLBORNE_PRESALES_TOKEN)),fetcher:async(url,options)=>{
  const path=new URL(url).pathname;
  if(options.method==='DELETE'){for(const prefix of JSON.parse(options.body).prefixes)objects.delete(prefix);return Response.json([]);}
  const objectKey=path.split('/').slice(-2).join('/');
  if(options.method==='POST'){if(objects.has(objectKey))return new Response(null,{status:409});objects.set(objectKey,{bytes:new Uint8Array(options.body),metadata:JSON.parse(Buffer.from(options.headers['x-metadata'],'base64').toString())});return Response.json({Key:objectKey});}
  return objects.has(objectKey)?new Response(objects.get(objectKey).bytes):new Response(null,{status:404});
 }});
 const provider=storageFor(env,{fetcher:(url,options)=>fn(new Request(url,options))});const bytes=new TextEncoder().encode('%PDF-private');
 const options={httpMetadata:{contentType:'application/pdf'},customMetadata:{sha256:await hash(bytes)}};
 await provider.put(key,bytes,options);await provider.put(key,bytes,options);assert.equal(objects.size,1);assert.equal(objects.get(key).metadata.sha256,await hash(bytes));
 assert.deepEqual(new Uint8Array(await new Response((await provider.get(key)).body).arrayBuffer()),bytes);
 await assert.rejects(()=>provider.put(key,new TextEncoder().encode('different'),{httpMetadata:{contentType:'application/pdf'}}));
 await provider.delete([key]);assert.equal(await provider.get(key),null);assert.equal(objects.size,0);
});
