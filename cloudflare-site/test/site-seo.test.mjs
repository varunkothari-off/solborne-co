import test from 'node:test';
import assert from 'node:assert/strict';
import {applySeo,marketingPaths,seoConfig} from '../scripts/site-seo.mjs';
import {handleRequest} from '../src/worker.mjs';
import {stagingFetch} from '../staging-worker.mjs';

const fixture='<!doctype html><html><head><title>Old</title><meta content="old description" name="description"><meta name="robots" content="noindex"><link href="https://old.example/" rel="canonical"><meta property="og:title" content="Old"><meta name="twitter:card" content="summary"><script type="application/ld+json">{"old":true}</script><link rel="stylesheet" href="/theme.css"><script src="/analytics.js" data-measurement-id="G-EXISTING" defer></script></head><body><h1>The visible offer stays here</h1></body></html>';
function schema(html){return JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);}
test('public SEO replaces old metadata without changing content, theme or consent loader',()=>{
 const html=applySeo(fixture,'/services.html');
 assert.equal((html.match(/<title>/g)||[]).length,1);assert.doesNotMatch(html,/old description|old\.example|"old":true/);
 assert.match(html,/<link rel="canonical" href="https:\/\/solborne.in\/services.html">/);
 assert.match(html,/<meta name="robots" content="index,follow,max-image-preview:large">/);
 for(const required of ['og:title','og:description','og:url','og:image','og:image:alt','twitter:card'])assert.ok(html.includes(required));
 assert.match(html,/href="\/theme.css"/);assert.match(html,/data-measurement-id="G-EXISTING"/);assert.match(html,/<h1>The visible offer stays here<\/h1>/);
 const graph=schema(html)['@graph'];assert.ok(graph.find(item=>item['@id']==='https://solborne.in/#organization'));assert.ok(graph.find(item=>item['@id']==='https://solborne.in/#website'));
 assert.equal(graph.find(item=>item['@type']==='Organization').legalName,'KISNO PROPTY LLP');
 assert.ok(graph.some(item=>item['@type']==='Service'));assert.ok(graph.some(item=>item['@type']==='OfferCatalog'));
 assert.doesNotMatch(JSON.stringify(graph),/aggregateRating|reviewCount|priceCurrency|"price"|FAQPage|sameAs|telephone/);
});
test('all canonical public pages have distinct titles and descriptions; preview alias cannot become a duplicate indexed home',()=>{
 const titles=new Set(),descriptions=new Set();
 for(const path of marketingPaths){const html=applySeo(fixture,path);titles.add(html.match(/<title>(.*?)<\/title>/)[1]);descriptions.add(html.match(/<meta name="description" content="([^"]+)"/)[1]);assert.ok(seoConfig[path]);}
 assert.equal(titles.size,10);assert.equal(descriptions.size,10);
 assert.match(applySeo(fixture,'/clarity-home.html'),/content="noindex,follow"/);
 assert.match(applySeo(fixture,'/clarity-home.html'),/rel="canonical" href="https:\/\/solborne.in\/"/);
 assert.equal(applySeo(fixture,'/index.html'),applySeo(fixture,'/'));
 assert.equal(applySeo(fixture,'/walk-demo.html'),fixture);
 assert.equal(applySeo(applySeo(fixture,'/services.html'),'/services.html'),applySeo(fixture,'/services.html'));
});
test('source public routes permit indexing while private/examples and staging keep noindex',async()=>{
 for(const path of ['/services.html','/operations.html']){const response=await handleRequest(new Request('https://solborne.in'+path),{});assert.equal(response.status,200);assert.equal(response.headers.get('X-Robots-Tag'),null);}
 for(const path of ['/walk-demo.html','/payment-scenes.html','/clarity-home.html','/signin.html']){const response=await handleRequest(new Request('https://solborne.in'+path),{});assert.equal(response.status,200);assert.match(response.headers.get('X-Robots-Tag'),/noindex/);}
 const staging=await stagingFetch(new Request('https://staging.solborne.in/services.html',{method:'HEAD'}),{},{});assert.equal(staging.status,200);assert.match(staging.headers.get('X-Robots-Tag'),/noindex/);
});
