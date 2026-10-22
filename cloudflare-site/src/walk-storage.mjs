const PROJECT='https://jzbbvlmfsatjqgfubhon.supabase.co';
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const KEY=new RegExp('^SB-'+UUID+'/'+UUID+'$');
export function storageFor(env,{fetcher=fetch}={}){
 // Dependency-injected local object storage remains available for synthetic tests.
 if(env.WALK_FILES?.put&&env.WALK_FILES?.get&&env.WALK_FILES?.delete)return env.WALK_FILES;
 if(env.SUPABASE_WALK_FILES_ENABLED!=='true'||env.SUPABASE_URL!==PROJECT||!env.SOLBORNE_PRESALES_TOKEN)return null;
 async function call(method,key,body,extra={}){
  if(typeof key!=='string'||!KEY.test(key))throw Error('Invalid private object key');
  const response=await fetcher(PROJECT+'/functions/v1/solborne-files?key='+encodeURIComponent(key),{method,headers:{Authorization:'Bearer '+env.SOLBORNE_PRESALES_TOKEN,...extra},...(body?{body}:{}),redirect:'manual',signal:AbortSignal.timeout(25000)});
  if(method==='GET'&&response.status===404)return null;
  if(!response.ok)throw Error('Private file storage unavailable');
  return response;
 }
 return {
  async put(key,bytes,options={}){
   await call('PUT',key,bytes,{'Content-Type':options.httpMetadata?.contentType||'application/octet-stream','X-Content-SHA256':options.customMetadata?.sha256||''});return {key};
  },
  async get(key){const response=await call('GET',key);return response?{body:response.body}:null;},
  async delete(value){const keys=[...new Set(Array.isArray(value)?value:[value])];if(keys.length>20||keys.some(key=>typeof key!=='string'||!KEY.test(key)))throw Error('Invalid private object keys');await Promise.all(keys.map(key=>call('DELETE',key)));}
 };
}
