import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import worker from '../deployment-worker.mjs';
const pages=['index','websites','how-it-works','about','contact','offer','privacy','terms'];
test('all public launch pages have unique metadata, canonical URLs, valid structured data and matching sitemap entries',()=>{
 const titles=new Set(),descriptions=new Set(),sitemap=readFileSync('public/sitemap.xml','utf8');
 for(const name of pages){const html=readFileSync(`public/${name}.html`,'utf8'),url='https://solborne.in/'+(name==='index'?'':name+'.html');
 assert.match(html,/<meta name="robots" content="index,follow/);assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.ok(sitemap.includes(`<loc>${url}</loc>`));
 titles.add(html.match(/<title>(.*?)<\/title>/)[1]);descriptions.add(html.match(/<meta name="description" content="([^"]+)"/)[1]);
 assert.ok(JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].length>=2);
 assert.doesNotMatch(html,/href="\/#register|href="\/#registration-recovery|No marketing analytics/);
 }assert.equal(titles.size,8);assert.equal(descriptions.size,8);
});
test('marketing CSP permits Google and exact schema hashes; private and preserved pages stay nonindexable without analytics',async()=>{
 const home=await worker.fetch(new Request('https://solborne.in/'),{});assert.match(home.headers.get('Content-Security-Policy'),/googletagmanager/);assert.match(home.headers.get('Content-Security-Policy'),/sha256-/);
 for(const path of ['/start.html','/walk','/versions.html','/studio/','/studio-motion/','/previous-site/index.html']){const r=await worker.fetch(new Request('https://solborne.in'+path),{});assert.equal(r.status,200);assert.match(r.headers.get('X-Robots-Tag'),/noindex/);assert.doesNotMatch(await r.text(),/src="\/analytics.js"/);assert.doesNotMatch(r.headers.get('Content-Security-Policy'),/google-analytics/);}
});
test('legacy canonical entry routes preserve query strings',async()=>{for(const [a,b] of [['/index.html','/'],['/improve.html','/websites.html']]){const r=await worker.fetch(new Request('https://solborne.in'+a+'?utm_source=sample'),{});assert.equal(r.status,301);assert.equal(r.headers.get('Location'),b+'?utm_source=sample');}});
function analytics(choice){
 const handlers={},allow={},decline={},scripts=[],settings={},store=new Map(choice?[['solborne.analytics.v1',choice]]:[]);
 const box={hidden:false,setAttribute(){},querySelector:s=>s==='[data-allow]'?allow:decline};for(const el of [allow,decline,settings]){el.addEventListener=(t,fn)=>el[t]=fn;el.focus=()=>{};}
 const document={referrer:'https://example.com/private?email=secret@example.com',cookie:'',querySelector:()=>({dataset:{measurementId:'G-TEST123'}}),querySelectorAll:()=>[settings],createElement:tag=>tag==='section'?box:{},head:{append:s=>scripts.push(s)},body:{append(){}},addEventListener:(t,fn)=>handlers[t]=fn};
 const context={document,location:{origin:'https://solborne.in',pathname:'/websites.html',search:'?email=secret@example.com&receipt=private',reload(){}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},URL,URLSearchParams,Date,window:{}};
 vm.runInNewContext(readFileSync('public/analytics.js','utf8'),context);return {context,allow,decline,settings,scripts,store,handlers};
}
test('no Google script or event exists before consent or after an initial decline',()=>{for(const choice of [null,'denied']){const a=analytics(choice);assert.equal(a.scripts.length,0);assert.equal(a.context.window.dataLayer,undefined);a.decline.click();assert.equal(a.scripts.length,0);assert.equal(a.store.get('solborne.analytics.v1'),'denied');}});
test('opt-in sends only clean public URLs and fixed event categories',()=>{const a=analytics(null);a.allow.click();assert.equal(a.scripts.length,1);assert.match(a.scripts[0].src,/googletagmanager/);a.handlers.click({target:{closest:()=>({href:'https://solborne.in/start.html?email=secret@example.com'})}});const data=JSON.stringify(a.context.window.dataLayer.map(x=>[...x]));assert.match(data,/cta_click/);assert.match(data,/start_website/);assert.doesNotMatch(data,/secret@example|receipt=private|email=/);a.decline.click();assert.equal(a.context.window['ga-disable-G-TEST123'],true);});

test('enhanced preferences link stays on the page while opening consent choices',()=>{const a=analytics('denied');let prevented=false;a.settings.click({preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(a.scripts.length,0);});
