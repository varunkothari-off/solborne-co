/** Off-host: verify all built catalog pages and linked targets, not only indexability. */
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const base=new URL('../validation/dist/client/',import.meta.url);
const serviceRoot=new URL('services/',base);
const paths=readdirSync(serviceRoot,{withFileTypes:true}).filter(entry=>entry.isDirectory()).map(entry=>`services/${entry.name}/index.html`);
assert.ok(paths.length>10,'Expected item and category routes');
let checked=0;
for(const file of ['services/index.html',...paths]){
  const html=readFileSync(new URL(file,base),'utf8');const dom=new JSDOM(html);const main=dom.window.document.querySelector('main');assert.ok(main);
  const text=main.textContent;
  assert.doesNotMatch(text,/built\s*(?:&|and)?\s*ready to run|delivered by AI|capability is real and ready|complete, deployed website|ready-to-run workflow/i,file);
  for(const link of main.querySelectorAll('a[href^="/services/"]')){
    const path=new URL(link.getAttribute('href'),'https://solborne.in').pathname;
    assert.ok(existsSync(new URL(path.slice(1)+'index.html',base)),`Linked route missing: ${path}`);
  }
  if(file.endsWith('/website-builder/index.html')){
    assert.match(text,/free deliverable is HTML plus an ownership README/);
    assert.match(text,/Hosting, domain registration or renewal, maintenance and future changes require separate arrangements/);
  }
  checked++;dom.window.close();
}
const home=new JSDOM(readFileSync(new URL('index.html',base),'utf8'));assert.doesNotMatch(home.window.document.querySelector('main').textContent,/read that costs nothing|preliminary read/);assert.match(home.window.document.querySelector('main').textContent,/free website source files/);home.window.close();
const contact=new JSDOM(readFileSync(new URL('contact/index.html',base),'utf8'));
assert.match(contact.window.document.querySelector('main').textContent,/temporarily unavailable/);
assert.equal(contact.window.document.querySelectorAll('main form, main a[href^="mailto:"]').length,0);
contact.window.close();
console.log(`PASS: ${checked} built hub/category/item routes contain factual scope and valid links; lead capture remains BLOCKED.`);