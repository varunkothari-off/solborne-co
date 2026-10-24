import candidate from './dist/server/index.js';
import {stagingPath} from './staging-routes.mjs';
export {stagingPath} from './staging-routes.mjs';

const stagingOrigin='https://staging.solborne.in';
const isolated={SITE_ORIGIN:stagingOrigin,AI_WALK_ENABLED:'true',AI_WEBSITE_BUILD_ENABLED:'false',AUTH_ENABLED:'false',AUTH_GOOGLE_ENABLED:'false',AUTH_EMAIL_ENABLED:'false',SUPABASE_WALK_FILES_ENABLED:'false'};
const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Solborne-Environment':'staging','X-Content-Type-Options':'nosniff'};
export async function stagingFetch(request,_env,ctx){
 const url=new URL(request.url);
 if(url.origin!==stagingOrigin)return new Response('Not found',{status:404,headers});
 if(!['GET','HEAD'].includes(request.method))return Response.json({ok:false,error:'This staging preview does not submit enquiries, contact customers or connect external services.'},{status:503,headers});
 if(url.pathname==='/api/public-metrics'||url.pathname==='/api/registration-session')return Response.json({ok:false,error:'Live customer services are not connected in staging.'},{status:503,headers});
 // Never inherit production bindings, credentials, storage or scheduled work.
 const target=new URL(url);target.pathname=stagingPath(url);
 const response=await candidate.fetch(target.pathname!==url.pathname?new Request(target,request):request,isolated,ctx);
 const nextHeaders=new Headers(response.headers);for(const [key,value] of Object.entries(headers))nextHeaders.set(key,value);
 const copy=new Response(response.body,{status:response.status,statusText:response.statusText,headers:nextHeaders});
 if(request.method==='HEAD'||!nextHeaders.get('Content-Type')?.includes('text/html'))return copy;
 const intent=url.searchParams.get('intent')==='operations'?'operations':'website';
 const workflow=['payments','documents','quotes'].includes(url.searchParams.get('workflow'))?url.searchParams.get('workflow'):'';
 const onward='/ai-walk.html'+(intent==='operations'?'?intent=operations'+(workflow?'&amp;workflow='+workflow:''):'');
 const demo='/walk-demo.html?'+(intent==='website'?'intent=website':'workflow='+(workflow||'payments'));
 const banner='<aside role="note" aria-label="Staging preview" style="position:relative;z-index:30;padding:8px 20px;background:#e7eee7;color:#173e3c;font:12px/1.5 Arial,sans-serif;border-bottom:1px solid #b9cbbc">Staging · Illustrative demos. Live services disconnected.'+(['/signin.html','/ai-walk.html'].includes(url.pathname)?' <a style="color:inherit;text-decoration:underline" href="'+demo+'">Try the example Walk</a> · <a style="color:inherit;text-decoration:underline" href="'+onward+'">Actual Walk introduction</a>':'')+'</aside>';
 return new HTMLRewriter().on('script[data-measurement-id]',{element(element){element.remove();}}).on('body',{element(element){element.prepend(banner,{html:true});}}).transform(copy);
}
export default {fetch:stagingFetch};
