/** Off-host Node24 only; actual Astro render assertions are in qa/offhost/discovery.mjs. */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {publicMetadata,publicOrigin,publicMarketingPaths,publicRobots,publicSitemap} from './publicDiscovery.ts';
test('canonical marketing URLs use approved primary, trailing slash and omit campaign parameters',()=>{
  const result=publicMetadata('/services','?utm_source=outreach','Services','Factual services');
  assert.equal(result.canonical,'https://solborne.in/services/');assert.equal(result.robots,'index,follow');
  assert.throws(()=>publicMetadata('//other.example/','','Title','Description'));
});
test('interactive, account and mode pages do not enter the public index or identity graph',()=>{
  for(const path of ['/walk/','/dashboard/','/login/','/services/not-reviewed/']){
    const result=publicMetadata(path,'','Title','Description');assert.equal(result.robots,'noindex,follow');assert.equal(result.structuredData,null);
  }
  assert.equal(publicMetadata('/','?mode=preview','Title','Description').robots,'noindex,follow');
});
test('identity schema contains only factual identity and safely serializes markup',()=>{
  const title='Title </script><script>unsafe</script>';
  const result=publicMetadata('/','',title,'Business websites and one-workflow discovery');
  assert.ok(result.structuredData);assert.ok(!result.structuredData.includes('<'));
  const data=JSON.parse(result.structuredData);assert.equal(data['@graph'][0].name,'Solborne & Co.');
  assert.equal(data['@graph'][2].name,title);
  assert.doesNotMatch(result.structuredData,/aggregateRating|reviewCount|price|email|telephone|sameAs/);
});
test('sitemap covers only canonical public pages; robots advertises it and preserves crawler defaults',()=>{
  const locations=[...publicSitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
  assert.deepEqual(locations,publicMarketingPaths.map(path=>publicOrigin+path));
  assert.match(publicRobots,/Sitemap: https:\/\/solborne\.in\/sitemap\.xml/);
  assert.match(publicRobots,/User-agent: \*\nAllow: \//);
  assert.doesNotMatch(publicRobots,/GPTBot|OAI-SearchBot|Disallow: \/$/);
});
test('landing scope drops paid screening/readiness claims and contact cannot discard a fake submission',()=>{
  const services=readFileSync(new URL('../pages/services.astro',import.meta.url),'utf8');
  const flow=readFileSync(new URL('../data/flow.ts',import.meta.url),'utf8');
  const contact=readFileSync(new URL('../pages/contact.astro',import.meta.url),'utf8');
  assert.doesNotMatch(services,/each built and ready to run today|preliminary read|screening call/);
  assert.doesNotMatch(flow,/Free ends here|One payment unlocks/);
  assert.doesNotMatch(contact,/<form|hello@solborne\.com/);assert.match(contact,/enquiryContact\.verified/);
});