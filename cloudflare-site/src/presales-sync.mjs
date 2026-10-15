import {first,all,run} from './db.mjs';
export async function flushPresales(env,{fetcher=fetch,limit=10,now=Date.now()}={}){
 if(!env.SOLBORNE_PRESALES_TOKEN)return {connected:false,sent:0};
 const rows=await all(env,'SELECT registration_id,sequence FROM solborne_presales_outbox WHERE synced_sequence<sequence ORDER BY COALESCE(last_attempt_at,0),registration_id LIMIT ?',[limit]);let sent=0;
 for(const row of rows){
  await run(env,'UPDATE solborne_presales_outbox SET attempts=attempts+1,last_attempt_at=? WHERE registration_id=?',[now,row.registration_id]);
  try{
   const registration=await first(env,'SELECT id,name,contact,enquiry_type,permission_to_respond,consent_version,created_at FROM solborne_registrations WHERE id=?',[row.registration_id]);if(!registration)continue;
   const ai=await first(env,'SELECT state_json,revision,updated_at FROM solborne_ai_walks WHERE registration_id=?',[row.registration_id]);
   const versions=await all(env,`SELECT c.id,c.project_id,c.revision_number,c.website_facts_json,c.scope_version,c.created_at,q.status AS review_status,r.released_at FROM solborne_walk_completions c LEFT JOIN solborne_owner_reviews q ON q.completion_id=c.id LEFT JOIN solborne_website_releases r ON r.completion_id=c.id WHERE c.registration_id=? ORDER BY c.created_at,c.id`,[row.registration_id]);
   const payload={project:'solborne',registrationId:row.registration_id,sequence:row.sequence,registration,aiWalk:ai?{state:JSON.parse(ai.state_json),revision:ai.revision,updatedAt:ai.updated_at}:null,versions:versions.map(v=>({...v,website_facts:JSON.parse(v.website_facts_json),website_facts_json:undefined}))};
   const response=await fetcher('https://jzbbvlmfsatjqgfubhon.supabase.co/functions/v1/solborne-presales',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.SOLBORNE_PRESALES_TOKEN},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
   if(!response.ok)continue;const ack=await response.json();if(ack.ok!==true||ack.registrationId!==row.registration_id||ack.sequence!==row.sequence)continue;
   await run(env,'UPDATE solborne_presales_outbox SET synced_sequence=MAX(synced_sequence,?),synced_at=? WHERE registration_id=?',[row.sequence,now,row.registration_id]);sent++;
  }catch{/* Durable retry; no contact or secret logging. */}
 }return {connected:true,sent};
}
