import candidate from './dist/server/index.js';
const canonical='https://solborne.in';
const hosts=new Set(['solborne.in','www.solborne.in','getsolborne.com','www.getsolborne.com']);
const boundaryHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Type':'text/plain; charset=utf-8'};
export default {
 scheduled(event,env,ctx){return candidate.scheduled(event,env,ctx);},
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(!hosts.has(url.hostname)||url.port||!['http:','https:'].includes(url.protocol))return new Response('Not found',{status:404,headers:boundaryHeaders});
  if(url.origin!==canonical){
   if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...boundaryHeaders,Allow:'GET, HEAD'}});
   return new Response(null,{status:301,headers:{...boundaryHeaders,Location:canonical+url.pathname+url.search}});
  }
  const response=await candidate.fetch(request,env,ctx);
  if(response.status===200&&/^text\/html(?:;|$)/i.test(response.headers.get('Content-Type')||'')){
   const headers=new Headers(response.headers),cache=headers.get('Cache-Control');
   headers.set('Cache-Control',cache?cache+', no-transform':'no-transform');
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
  return response;
 }
};
