import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=name=>readFileSync(new URL('../public/'+name,import.meta.url),'utf8');
test('website collection keeps the visitor on the website journey and shows both examples',()=>{
 const html=page('websites.html'),closing=html.match(/<section class="closing container">([\s\S]*?)<\/section>/)?.[1]||'';
 assert.match(closing,/href="\/signin.html\?next=walk"/);
 for(const brand of ['kfs','avasa'])assert.match(html,new RegExp(`data-case="${brand}"`));
});
test('main marketing uses customer language rather than internal processing labels',()=>{
 for(const name of ['index.html','offer.html'])assert.doesNotMatch(page(name),/\bV1\b|brief processing|manual team review and release/);
});
test('privacy describes existing optional uploads without denying the feature',()=>{
 const html=page('privacy.html');assert.doesNotMatch(html,/No document-upload facility is provided/);assert.match(html,/Optional uploads are stored privately in Supabase Storage/);
});
