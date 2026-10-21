import postgres from 'npm:postgres@3.4.8';
const connection=Deno.env.get('SUPABASE_DB_URL');
const url=new URL(connection||'https://invalid');
if(url.hostname!=='db.jzbbvlmfsatjqgfubhon.supabase.co'&&!(url.hostname.endsWith('.pooler.supabase.com')&&url.username==='postgres.jzbbvlmfsatjqgfubhon'))throw Error('Unexpected database');
const client=postgres(connection!,{prepare:false,max:2,connect_timeout:5,idle_timeout:20,ssl:true,onnotice:()=>{}});
// An intentionally public, read-only aggregate. This public application key is not a secret.
const applicationKey='sb_publishable_NmJeO2UBhZxIvBGNYv2Q4w_XtEx8ZnO';
Deno.serve(async req=>{
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(req.method!=='GET')return Response.json({ok:false},{status:405,headers});
 if(req.headers.get('apikey')!==applicationKey)return Response.json({ok:false},{status:401,headers});
 try{const result=await client.begin(async sql=>{await sql`set local role solborne_metrics_runtime`;await sql`set local statement_timeout='3000ms'`;return await sql`select public.solborne_public_metrics() as metrics`;});return Response.json(result[0].metrics,{headers});}
 catch{console.error('SOLBORNE_METRICS_UNAVAILABLE');return Response.json({ok:false},{status:503,headers});}
});
