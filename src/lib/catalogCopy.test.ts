/** Source guards only; qa/offhost/catalog.mjs verifies every built linked route. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('shared linked-route template does not render unsupported delivery or benchmark data',()=>{
  const route=readFileSync(new URL('../pages/services/[slug].astro',import.meta.url),'utf8');
  assert.doesNotMatch(route,/Built &amp; ready to run|delivered by AI|capability is real and ready|ready-to-run workflow/);
  assert.doesNotMatch(route,/detail!|entry\.blurb|category\.description|item!\.blurb/);
  assert.match(route,/Discovery topic/);assert.match(route,/Hosting, domain registration or renewal, maintenance and future changes require separate arrangements/);
});
test('catalog hub cannot promote raw unverified item descriptions',()=>{
  const hub=readFileSync(new URL('../pages/services.astro',import.meta.url),'utf8');
  assert.doesNotMatch(hub,/\{item\.blurb\}|\{category\.description\}/);
  assert.match(hub,/Free client-owned HTML and README; hosting is separate/);
});
test('Home points to the approved website-source deliverable instead of a free preliminary read',()=>{
  const home=readFileSync(new URL('../pages/index.astro',import.meta.url),'utf8');
  assert.doesNotMatch(home,/read that costs nothing|preliminary read/);
  assert.match(home,/keep your free website source files/);
});