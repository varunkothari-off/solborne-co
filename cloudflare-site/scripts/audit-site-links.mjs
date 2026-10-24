import {readFile,access} from 'node:fs/promises';

import {resolve} from 'node:path';

const pages=['operations.html','index.html','websites.html','how-it-works.html','about.html','contact.html','offer.html','privacy.html','terms.html','start.html','signin.html','canvas.html','walk.html','versions.html','ai-walk.html','example-workshop.html','example-advisory.html','example-studio.html'];

const failures=[],external=new Set();let links=0,assets=0;

for(const page of pages){

 const html=await readFile('public/'+page,'utf8');

 for(const match of html.matchAll(/\b(href|src)="([^"]+)"/g)){

  const [,attribute,raw]=match;

  if(/^(mailto:|tel:|data:|blob:)/.test(raw))continue;

  const url=new URL(raw.replaceAll('&amp;','&'),'https://solborne.in/'+page);

  if(url.origin!=='https://solborne.in'){external.add(url.href);continue;}

  if(attribute==='href')links++;else assets++;

  if(url.pathname.startsWith('/downloads/')||url.pathname.startsWith('/api/'))continue;

  let path=url.pathname;

  if(path==='/walk'||path==='/walk/')path='/walk.html';

  if(path==='/improve.html')path='/websites.html';

  if(path.endsWith('/'))path+='index.html';

  try{

   const target=resolve('public','.'+path);await access(target);

   if(url.hash&&path.endsWith('.html')){

    const content=await readFile(target,'utf8'),id=decodeURIComponent(url.hash.slice(1));

    if(!content.includes('id="'+id+'"')&&!content.includes("id='"+id+"'"))failures.push(page+': missing anchor '+raw);

   }

  }catch{failures.push(page+': missing destination '+raw);}

 }

}

console.log(JSON.stringify({pages:pages.length,links,assets,external:[...external],failures},null,2));

if(failures.length)process.exitCode=1;
