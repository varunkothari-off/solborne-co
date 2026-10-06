import {writeFileSync,readdirSync} from 'node:fs';
process.env.ASTRO_NODE_AUTOSTART='disabled';
const base=new URL('../validation/',import.meta.url);
const {pageMap}=await import(new URL('dist/server/entry.mjs',base));
const manifestFile=readdirSync(new URL('dist/server/',base)).find(x=>x.startsWith('manifest_'));
const {manifest}=await import(new URL('dist/server/'+manifestFile,base));
const {renderers}=await import(new URL('dist/server/renderers.mjs',base));
const {App}=await import(new URL('node_modules/astro/dist/core/app/index.js',base));
const app=new App({...manifest,pageMap,renderers,serverIslandMap:new Map(),actions:()=>import(new URL('dist/server/noop-entrypoint.mjs',base)),middleware:()=>import(new URL('dist/server/_noop-middleware.mjs',base))});
for (const [name,path] of [['walk','/walk/'],['local-export','/walk/?mode=local-export']]){
const response=await app.render(new Request('https://solborne.in'+path),{clientAddress:'127.0.0.1'});
const html=await response.text();writeFileSync(new URL(name+'.html',import.meta.url),html);console.log(name,response.status,html.length);
}
let forbiddenFetches=0;globalThis.fetch=async()=>{forbiddenFetches++;throw Error('Network forbidden in harness');};
for(const path of ['/api/walks','/api/walks/11111111-1111-1111-1111-111111111111/answers','/api/walks/11111111-1111-1111-1111-111111111111/questions','/api/walks/11111111-1111-1111-1111-111111111111/submit','/api/walks/11111111-1111-1111-1111-111111111111/website-research']){
const response=await app.render(new Request('https://solborne.in'+path,{method:'POST',headers:{'x-solborne-delivery':'website','content-type':'application/json',origin:'https://solborne.in'},body:'{}'}),{clientAddress:'127.0.0.1'});const body=await response.text();if(response.status!==503)throw Error(path+' unexpected '+response.status+' '+body);console.log('PASS disabled gate:',path,response.status);
}
console.log('Forbidden outbound fetch attempts:',forbiddenFetches);if(forbiddenFetches!==0)throw Error('Unexpected network attempt');
