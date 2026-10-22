const PROJECT='https://jzbbvlmfsatjqgfubhon.supabase.co';
const BUCKET='solborne-walk-files',MAX_BYTES=5*1024*1024;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const KEY=new RegExp('^SB-'+UUID+'/'+UUID+'$');
const TYPES=new Set(['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
const HEADERS={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
const json=(status,body={ok:false})=>Response.json(body,{status,headers:HEADERS});
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
function equal(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
async function boundedBytes(body){
 const reader=body?.getReader();if(!reader)throw Object.assign(Error(),{status:422});let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw Object.assign(Error(),{status:413});}chunks.push(value);}
 if(!size)throw Object.assign(Error(),{status:422});const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export function createFileHandler({supabaseUrl,serviceKey,keyHash,fetcher=fetch}){
 return async request=>{
  try{
   const auth=request.headers.get('Authorization')||'';
   if(!auth.startsWith('Bearer ')||!equal(await sha(new TextEncoder().encode(auth.slice(7))),keyHash))return json(401);
   if(supabaseUrl!==PROJECT||!serviceKey)return json(503);
   const url=new URL(request.url),key=url.searchParams.get('key');
   if(url.searchParams.getAll('key').length!==1||!key||!KEY.test(key)||[...url.searchParams.keys()].some(name=>name!=='key'))return json(422);
   if(!['PUT','GET','DELETE'].includes(request.method))return json(405);
   const objectPath=key.split('/').map(encodeURIComponent).join('/');
   const authHeaders={Authorization:'Bearer '+serviceKey,apikey:serviceKey};
   const upstream=(path,options={})=>fetcher(PROJECT+'/storage/v1/'+path,{...options,headers:{...authHeaders,...options.headers},redirect:'error',signal:AbortSignal.timeout(20000)});
   const download=()=>upstream('object/authenticated/'+BUCKET+'/'+objectPath,{method:'GET'});
   if(request.method==='GET'){
    const response=await download();if(response.status===404)return json(404);if(!response.ok){if(response.status===400){const error=await response.json().catch(()=>null);if(String(error?.statusCode)==='404')return json(404);}return json(502);}
    return new Response(response.body,{headers:{...HEADERS,'Content-Type':response.headers.get('Content-Type')||'application/octet-stream'}});
   }
   if(request.method==='DELETE'){
    const response=await upstream('object/'+BUCKET,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});
    return response.ok?json(200,{ok:true}):json(502);
   }
   const length=request.headers.get('Content-Length');if(length&&(!/^\d+$/.test(length)||Number(length)>MAX_BYTES))return json(413);
   const type=(request.headers.get('Content-Type')||'').split(';')[0].toLowerCase().trim();if(!TYPES.has(type))return json(415);
   const bytes=await boundedBytes(request.body),hash=await sha(bytes),expected=request.headers.get('X-Content-SHA256');
   if(expected&&!equal(expected,hash))return json(422);
   const registrationId=key.split('/')[0];
   const response=await upstream('object/'+BUCKET+'/'+objectPath,{method:'POST',headers:{'Content-Type':type,'cache-control':'no-store','x-upsert':'false','x-metadata':btoa(JSON.stringify({registrationId,sha256:hash}))},body:bytes});
   if(response.ok)return json(201,{ok:true,sha256:hash});
   // Storage has historically returned HTTP 400 with statusCode 409 for duplicates.
   let duplicate=response.status===409;if(response.status===400){const error=await response.json().catch(()=>null);duplicate=String(error?.statusCode)==='409'||error?.error==='Duplicate';}
   if(!duplicate)return json(502);
   const existing=await download();if(!existing.ok)return json(502);
   return equal(await sha(await boundedBytes(existing.body)),hash)?json(200,{ok:true,sha256:hash}):json(409);
  }catch(error){return json(error?.status===413?413:error?.status===422?422:502);}
 };
}
