import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stagingPath} from '../staging-routes.mjs';
const defaultRoot=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.woff2':'font/woff2','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
export function createPreviewServer({root=defaultRoot}={}){
 const directory=resolve(root);
 return createServer(async(req,res)=>{
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Solborne-Environment':'local-staging','X-Content-Type-Options':'nosniff'};
  const reply=(status,body='',type='text/plain; charset=utf-8')=>{res.writeHead(status,{...headers,'Content-Type':type});res.end(req.method==='HEAD'?'':body);};
  try{
   const url=new URL(req.url,'http://127.0.0.1');
   if(!['GET','HEAD'].includes(req.method)||url.pathname.startsWith('/api/'))return reply(503,'Local preview: live services and submissions are disconnected.');
   const path=decodeURIComponent(stagingPath(url)),file=resolve(directory,'.'+(path.endsWith('/')?path+'index.html':path));
   if(!file.startsWith(directory+sep)||path.split('/').some(part=>part.startsWith('.')))return reply(404,'Not found');
   let body=await readFile(file);const type=types[extname(file)]||'application/octet-stream';
   if(type.startsWith('text/html'))body=body.toString('utf8').replace(/<script\b(?=[^>]*\bdata-measurement-id\s*=)[^>]*>[\s\S]*?<\/script\s*>/gi,'').replace(/(<body[^>]*>)/i,'$1<aside role="note" aria-label="Local staging preview" style="padding:8px 20px;background:#e7eee7;color:#173e3c;font:12px/1.5 Arial,sans-serif">Local staging · Live services disconnected.</aside>');
   reply(200,body,type);
  }catch{reply(404,'Not found');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.argv[2]||4193);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('Use a port from1 to65535');
 createPreviewServer().listen(port,'127.0.0.1',()=>console.log('Disconnected staging preview: http://127.0.0.1:'+port+'/'));
}
