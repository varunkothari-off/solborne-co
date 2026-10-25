import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import worker from '../dist/server/index.js';
import {stagingFetch} from '../staging-worker.mjs';

test('assembled public pages share one full footer and services/navigation remain reachable',async()=>{
 const paths=['/','/clarity-home.html','/services.html','/operations.html','/websites.html','/how-it-works.html','/about.html','/contact.html','/offer.html','/privacy.html','/terms.html','/payment-scenes.html','/story.html','/walk-demo.html'];
 let canonical;
 for(const path of paths){
  const response=await worker.fetch(new Request('https://solborne.in'+path),{},{});assert.equal(response.status,200,path);
  const html=await response.text(),footer=html.match(/<footer\b[^>]*class="labs-footer"[^>]*>[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer,path+' is missing the full stable footer');
  canonical??=footer;assert.equal(footer,canonical,path+' footer differs');
  assert.match(footer,/wordmark-lockup/);assert.match(footer,/href="\/services.html"/);assert.match(footer,/href="\/privacy.html#analytics"/);
 }
});
test('public service schema has matching CSP hashes while staging remains noindex',async()=>{
 const response=await worker.fetch(new Request('https://solborne.in/services.html'),{},{}),html=await response.text();
 const scripts=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>m[1]);
 assert.ok(scripts.length,'Services structured data missing');
 for(const script of scripts){assert.match(response.headers.get('Content-Security-Policy'),new RegExp(createHash('sha256').update(script).digest('base64').replace(/[+]/g,'\\+')));}
 const stage=await stagingFetch(new Request('https://staging.solborne.in/services.html',{method:'HEAD'}),{},{});
 assert.equal(stage.status,200);assert.match(stage.headers.get('X-Robots-Tag'),/noindex/);
});
