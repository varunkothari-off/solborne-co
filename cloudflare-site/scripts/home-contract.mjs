import {readFileSync, existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Shared by the build and regression suite: stale promotion must fail closed.
export function homepageErrors(html){
 const errors=[];
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]||'';
 const sections=[...main.matchAll(/<section\b([^>]*)>/g)].map(m=>m[1]);
 if((main.match(/<h1\b/g)||[]).length!==1||sections.filter(s=>/class="[^"]*\bhero\b/.test(s)).length!==1)errors.push('exactly one website hero required');
 if(!sections[1]?.includes('canvas-compact')||!sections[1]?.includes('id="canvas"'))errors.push('compact canvas must be second');
 if(!sections[2]?.includes('data-live-metrics'))errors.push('live metrics must be third');
 if((main.match(/class="process-story"/g)||[]).length!==1)errors.push('one unified process required');
 if(/class="(?:scroll-story|process-feature|film-section|container proof-link|container canvas-feature)\b/.test(main))errors.push('obsolete full-size canvas/process/proof sections returned');
 for(const brand of ['kfs','avasa']){
  const card=main.match(new RegExp(`<article[^>]*data-case="${brand}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1]||'';
  if(!card.includes(`href="https://${brand}.solborne.in/"`)||!/<img\b[^>]*alt="[^"]+"/.test(card))errors.push(`${brand} visual linked example required`);
 }
 if(!html.includes('/home-refinement.css')||!html.includes('/home-refinement.js'))errors.push('refinement assets must be loaded');
 if(!main.includes('href="/signin.html?next=walk"'))errors.push('verified Walk entry required');
 return errors;
}
export function assertHomepages(root='public'){
 for(const page of ['index.html','studio-motion/index.html']){
  const html=readFileSync(resolve(root,page),'utf8'),errors=homepageErrors(html);
  for(const asset of ['home-refinement.css','home-refinement.js','assets/kfs-live-showcase.png','assets/avasa-live-showcase.jpg'])if(!existsSync(resolve(root,asset)))errors.push(`missing ${asset}`);
  if(errors.length)throw new Error(`${page}: ${errors.join('; ')}`);
 }
}
