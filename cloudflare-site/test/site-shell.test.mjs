import test from 'node:test';
import assert from 'node:assert/strict';
import {applyShell,shellPaths} from '../scripts/site-shell.mjs';

const page=footer=>`<!doctype html><html><head><title>Service information</title></head><body><header class="old-header"><a href="/">Old home</a></header><main><h1>What you receive</h1><p>One agreed workflow. You approve exceptions.</p></main><footer class="${footer}">Old footer</footer></body></html>`;
const footerOf=html=>html.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/)[0];
const headerOf=html=>html.match(/<header\b[^>]*>[\s\S]*?<\/header>/)[0];
test('public pages share the complete stable footer and retain their substantive content',()=>{
 const variants=['clarity-footer','labs-footer','story-footer','company-footer','demo-footer'].map((name,i)=>applyShell(page(name),['/services.html','/index.html','/story.html','/payment-scenes.html','/walk-demo.html'][i]));
 for(const html of variants){
  assert.equal(footerOf(html),footerOf(variants[0]));
  assert.match(html,/<h1>What you receive<\/h1>/);assert.match(html,/One agreed workflow\. You approve exceptions\./);
  assert.match(footerOf(html),/wordmark-lockup/);assert.match(footerOf(html),/Solborne/);assert.match(footerOf(html),/KISNO PROPTY LLP/);assert.match(footerOf(html),/ACK-0281/);
  assert.match(footerOf(html),/href="\/services\.html"/);assert.match(footerOf(html),/href="\/privacy\.html#analytics" data-analytics-settings/);
  assert.match(footerOf(html),/href="https:\/\/storyset\.com\/"[^>]*>Selected illustrations by Storyset<\/a>/);
  assert.equal((html.match(/<footer\b/g)||[]).length,1);
 }
});
test('shell application is idempotent and loads each existing shared dependency once',()=>{
 const first=applyShell(page('demo-footer'),'/walk-demo.html'),second=applyShell(first,'/walk-demo.html');
 assert.equal(second,first);
 for(const asset of ['/studio-motion/reboot.css','/studio-motion/design.css','/studio-motion/footer.css','/studio-motion/design.js','/studio-motion/letters.js','/assets/fonts/public-sans-latin-wght-normal.woff2','/assets/fonts/source-serif-4-latin-wght-normal.woff2'])assert.equal(first.split('"'+asset+'"').length-1,1,asset);
 assert.ok(first.indexOf('href="/studio-motion/reboot.css"')<first.indexOf('href="/studio-motion/design.css"'));
 assert.equal((first.match(/<header\b/g)||[]).length,1);
 assert.doesNotMatch(first,/src="\/auth-session\.js"|src="\/analytics\.js"/);
});
test('stable foundation styles precede local page CSS and retain existing motion without adding it elsewhere',()=>{
 const input=page('labs-footer').replace('</head>','<link rel="stylesheet" href="/clarity.css"><link rel="stylesheet" href="/studio-motion/footer.css"><link rel="stylesheet" href="/studio-motion/motion.css"></head>');
 const html=applyShell(input,'/services.html');
 const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(styles,['/studio-motion/reboot.css','/studio-motion/design.css','/studio-motion/motion.css','/studio-motion/footer.css','/site-shell.css','/clarity.css']);
 assert.equal(applyShell(html,'/services.html'),html);
 assert.doesNotMatch(applyShell(page('company-footer'),'/payment-scenes.html'),/href="\/studio-motion\/motion\.css"/);
});
test('private workspaces, sign-in and customer examples are not transformed',()=>{
 for(const path of ['/signin.html','/ai-walk.html','/canvas.html','/versions.html','/example-workshop.html','/api/registrations','/studio-motion/index.html'])assert.equal(applyShell(page('private-footer'),path),page('private-footer'));
 assert.ok(shellPaths.includes('/services.html'));
});
test('current navigation identifies Services while preserving existing account and analytics loaders',()=>{
 const input=page('clarity-footer').replace('</head>','<script src="/account-nav.js" defer></script><script src="/analytics.js" data-measurement-id="G-TEST" defer></script></head>');
 const html=applyShell(input,'services.html?source=test'),header=headerOf(html);
 assert.match(header,/<a href="\/services\.html" aria-current="page">Services<\/a>/);
 assert.equal((header.match(/aria-current="page"/g)||[]).length,1);
 assert.match(header,/id="site-nav"/);assert.match(header,/aria-controls="site-nav"/);
 assert.match(header,/href="\/signin\.html\?next=walk"/);
 assert.equal(html.split('src="/account-nav.js"').length-1,1);assert.equal(html.split('src="/analytics.js"').length-1,1);
});
