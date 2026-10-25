import {readFileSync} from 'node:fs';

export const shellPaths=Object.freeze(['/','/index.html','/clarity-home.html','/services.html','/operations.html','/websites.html','/how-it-works.html','/about.html','/contact.html','/offer.html','/privacy.html','/terms.html','/story.html','/payment-scenes.html','/walk-demo.html']);
export const marketingPaths=shellPaths;
const allowed=new Set(shellPaths);
const headerTemplate=readFileSync(new URL('../public/partials/site-header.html',import.meta.url),'utf8').trim();
const footerTemplate=readFileSync(new URL('../public/partials/site-footer.html',import.meta.url),'utf8').trim();
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

function normalize(path){
 try{return new URL(String(path),'https://solborne.in/').pathname;}catch{return '';}
}
function assetPattern(tag,attribute,path){return new RegExp('<'+tag+'\\b[^>]*\\b'+attribute+'\\s*=\\s*([\"\\\'])'+escaped(path)+'\\1[^>]*>'+(tag==='script'?'[\\s\\S]*?<\\/script\\s*>':''),'gi');}
function once(html,{tag,attribute,path,markup}){
 const pattern=assetPattern(tag,attribute,path);let found=false;
 html=html.replace(pattern,match=>{if(found)return '';found=true;return match;});
 if(found)return html;
 return html.replace(/<\/head\s*>/i,match=>markup+'\n'+match);
}
function foundations(html){
 const paths=['/studio-motion/reboot.css','/studio-motion/design.css'];
 if(assetPattern('link','href','/studio-motion/motion.css').test(html))paths.push('/studio-motion/motion.css');
 paths.push('/studio-motion/footer.css','/site-shell.css');
 for(const path of paths){const link=assetPattern('link','href',path);html=html.replace(new RegExp(link.source+'\\s*','gi'),'');}
 const block=paths.map(path=>'<link rel="stylesheet" href="'+path+'">').join('\n')+'\n';
 const stylesheet=/<link\b[^>]*rel=["']stylesheet["'][^>]*>/i;
 if(stylesheet.test(html))return html.replace(stylesheet,match=>block+match);
 return html.replace(/(<head\b[^>]*>)\s*/i,(_match,head)=>head+'\n'+block);
}
function currentHeader(path){
 let target=path;
 if(['/','/index.html','/clarity-home.html'].includes(path))target='/';
 else if(['/operations.html','/story.html','/payment-scenes.html'].includes(path))target='/services.html';
 else if(path==='/walk-demo.html')target='/how-it-works.html';
 const exact=target===path||target==='/'&&['/','/index.html','/clarity-home.html'].includes(path);
 return headerTemplate.replace(new RegExp('(<a href="'+escaped(target)+'")'),match=>match+' aria-current="'+(exact?'page':'location')+'"');
}

// Pure HTML transformation: no browser fetch, auth calls or runtime component injection.
export function applyShell(html,path){
 const normalized=normalize(path);
 if(typeof html!=='string'||!allowed.has(normalized))return html;
 const header=currentHeader(normalized);
 if(/<header\b[^>]*>[\s\S]*?<\/header>/i.test(html))html=html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i,()=>header);
 else html=html.replace(/<body\b[^>]*>/i,match=>match+'\n'+header);
 let footerAdded=false;
 html=html.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi,()=>{if(footerAdded)return '';footerAdded=true;return footerTemplate;});
 if(!footerAdded)html=html.replace(/<\/body\s*>/i,match=>footerTemplate+'\n'+match);
 html=foundations(html);
 const assets=[
  {tag:'link',attribute:'href',path:'/assets/fonts/public-sans-latin-wght-normal.woff2',markup:'<link rel="preload" href="/assets/fonts/public-sans-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>'},
  {tag:'link',attribute:'href',path:'/assets/fonts/source-serif-4-latin-wght-normal.woff2',markup:'<link rel="preload" href="/assets/fonts/source-serif-4-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>'},
  {tag:'script',attribute:'src',path:'/studio-motion/design.js',markup:'<script src="/studio-motion/design.js" defer></script>'},
  {tag:'script',attribute:'src',path:'/studio-motion/letters.js',markup:'<script type="module" src="/studio-motion/letters.js"></script>'}
 ];
 for(const asset of assets)html=once(html,asset);
 return html;
}
