/** Inspect actual production build output. This does not claim live HTTPS or DNS proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../validation/dist/client/',import.meta.url);
for(const [path,file] of [['/','index.html'],['/services/','services/index.html'],['/contact/','contact/index.html']]){
  const html=readFileSync(new URL(file,base),'utf8');
  assert.match(html,/name="robots" content="index,follow"/);
  assert.ok(html.includes(`href="https://solborne.in${path}"`));
  assert.match(html,/type="application\/ld\+json"/);
  assert.doesNotMatch(html,/hello@solborne\.com|each built and ready to run today|Free ends here/);
  if(path==='/contact/'){assert.doesNotMatch(html,/<form|href="mailto:/);assert.match(html,/temporarily unavailable/);}
  console.log('PASS: built public canonical/index/identity/factual scope '+path);
}
const walk=readFileSync(new URL('walk.html',import.meta.url),'utf8');assert.match(walk,/name="robots" content="noindex,follow"/);
const robots=readFileSync(new URL('robots.txt',base),'utf8');assert.match(robots,/Sitemap: https:\/\/solborne\.in\/sitemap\.xml/);
const sitemap=readFileSync(new URL('sitemap.xml',base),'utf8');assert.equal((sitemap.match(/<loc>/g)||[]).length,5);assert.doesNotMatch(sitemap,/dashboard|login|walk|api/);
console.log('PASS: built robots/sitemap and independently rendered non-indexable Walk');