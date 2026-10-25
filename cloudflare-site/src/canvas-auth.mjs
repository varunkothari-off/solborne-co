import { first, all, run, rateLimit } from './db.mjs';
const SESSION='__Host-solborne_identity', CSRF='__Host-solborne_auth_csrf', FLOW='__Host-solborne_auth_flow';
const hex=/^[a-f0-9]{64}$/;
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
export const authHash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
const cookie=(r,n)=>r.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(n+'='))?.slice(n.length+1)||'';
const setCookie=(n,v,age=600)=>`${n}=${v}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const headers={'Cache-Control':'no-store, private','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Cookie'};
const json=(body,status=200,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,...extra}});
const failure=(status=403)=>json({ok:false,error:'Sign-in could not be completed. Please start again.'},status);
export function authConfigured(env){try {const u=new URL(env.SUPABASE_URL);return u.protocol==='https:'&&u.hostname.endsWith('.supabase.co')&&u.pathname==='/'&&!!env.SUPABASE_PUBLISHABLE_KEY&&!env.SUPABASE_PUBLISHABLE_KEY.startsWith('sb_secret_');}catch{return false;}}
export const authEnabled=env=>env.AUTH_ENABLED==='true';
function origin(env){try{const u=new URL(env.SITE_ORIGIN);return u.protocol==='https:'&&u.pathname==='/'?u.origin:null;}catch{return null;}}
function sameOrigin(r,env){return !!origin(env)&&r.headers.get('Origin')===origin(env)&&!['cross-site','none'].includes(r.headers.get('Sec-Fetch-Site'));}
async function api(env,path,{method='GET',body,access}={},fetcher=fetch){return fetcher(new URL('/auth/v1/'+path,env.SUPABASE_URL),{method,redirect:'manual',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,...(access?{Authorization:'Bearer '+access}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});}
export function verifiedUser(user){return !!user&&typeof user.id==='string'&&/^[a-f0-9-]{36}$/i.test(user.id)&&user.is_anonymous!==true&&typeof user.email==='string'&&user.email.length<=254&&!!user.email_confirmed_at;}
export async function authIdentity(request,env,now,fetcher=fetch){
  if(!authEnabled(env)||!authConfigured(env))return null;
  const value=cookie(request,SESSION);if(!hex.test(value))return null;
  const row=await first(env,'SELECT user_id,access_token,expires_at,active_registration_id FROM solborne_auth_sessions WHERE token_hash=? AND expires_at>?',[await authHash(value),now]);if(!row)return null;
  const result=await api(env,'user',{access:row.access_token},fetcher);if(!result.ok)return null;
  const user=await result.json();if(!verifiedUser(user)||user.id!==row.user_id)return null;
  const linked=row.active_registration_id?await first(env,'SELECT registration_id FROM solborne_auth_registrations WHERE user_id=? AND registration_id=?',[user.id,row.active_registration_id]):null;
  return {sessionHash:await authHash(value),id:user.id,email:user.email.toLowerCase(),name:String(user.user_metadata?.full_name||user.user_metadata?.name||'').slice(0,100),registration_id:linked?.registration_id||null};
}
async function issue(request,env,now,payload,fetcher){
  if(typeof payload?.access_token!=='string'||payload.access_token.length>8192)return failure();
  const check=await api(env,'user',{access:payload.access_token},fetcher);if(!check.ok)return failure();
  const user=await check.json();if(!verifiedUser(user))return failure();
  const seconds=Math.min(3600,Number(payload.expires_in)||0);if(seconds<60)return failure();
  const latest=await first(env,'SELECT registration_id FROM solborne_auth_registrations WHERE user_id=? ORDER BY created_at DESC,registration_id DESC LIMIT 1',[user.id]);
  const opaque=random();await run(env,'INSERT INTO solborne_auth_sessions(token_hash,user_id,access_token,created_at,expires_at,active_registration_id) VALUES(?,?,?,?,?,?)',[await authHash(opaque),user.id,payload.access_token,now,now+seconds*1000,latest?.registration_id||null]);
  const h=new Headers(headers);h.append('Set-Cookie',setCookie(SESSION,opaque,seconds));h.append('Set-Cookie',setCookie(FLOW,'',0));h.append('Set-Cookie',setCookie(CSRF,'',0));
  return new Response(JSON.stringify({ok:true,next:'/canvas.html'}),{headers:h});
}
export async function authRoute(request,env,now,{fetcher=fetch}={}){
  const u=new URL(request.url),path=u.pathname;
  if(!path.startsWith('/api/auth/')&&path!=='/auth/callback')return null;
  if(path==='/api/auth/session'&&request.method==='GET'){
    if(request.headers.get('Sec-Fetch-Site')==='cross-site')return failure();
    const configured=authConfigured(env),enabled=authEnabled(env);const user=await authIdentity(request,env,now,fetcher);
    const rows=user?await all(env,`SELECT a.registration_id AS id,a.created_at AS createdAt,r.enquiry_type AS enquiryType,w.state_json,
      (SELECT c.website_facts_json FROM solborne_walk_completions c WHERE c.registration_id=a.registration_id ORDER BY c.created_at DESC,c.id DESC LIMIT 1) AS latest_facts,
      EXISTS(SELECT 1 FROM solborne_walk_completions c JOIN solborne_website_releases d ON d.completion_id=c.id WHERE c.registration_id=a.registration_id) AS has_release
      FROM solborne_auth_registrations a JOIN solborne_registrations r ON r.id=a.registration_id LEFT JOIN solborne_ai_walks w ON w.registration_id=a.registration_id WHERE a.user_id=? ORDER BY a.created_at DESC,a.registration_id DESC`,[user.id]):[];
    const registrations=rows.map(({state_json,latest_facts,has_release,...item})=>{
      let state={},facts={};try{state=JSON.parse(state_json||'{}');facts=JSON.parse(latest_facts||'{}');}catch{/* A damaged legacy draft must not expose private data or break other projects. */}
      const operations=state?.journey?.intent==='operations'||state?.submission?.service==='operations';
      const journey={intent:operations?'operations':'website',workflow:operations&&['payments','documents','quotes'].includes(state?.journey?.workflow)?state.journey.workflow:''};
      const reviewStatus=['awaiting_manual_review','in_review','awaiting_customer','proposal_ready','completed'].includes(state?.submission?.status)?state.submission.status:'awaiting_manual_review';
      const projectStatus=!operations&&has_release?'delivered':state?.submission?reviewStatus:state?.ready?'brief_ready':'in_progress';
      return {...item,projectName:String(state?.facts?.businessName||facts?.businessName||'Untitled project').slice(0,120),website:String(state?.facts?.websiteUrl||facts?.websiteUrl||'').slice(0,1500),journey,projectStatus,submittedAt:Number.isSafeInteger(state?.submission?.submittedAt)&&state.submission.submittedAt>=0?state.submission.submittedAt:null};
    });
    let csrf=cookie(request,CSRF);if(!hex.test(csrf))csrf=random();
    return json({ok:true,configured,enabled,providers:{google:enabled&&configured&&env.AUTH_GOOGLE_ENABLED==='true',email:enabled&&configured&&env.AUTH_EMAIL_ENABLED==='true'},authenticated:!!user,user:user?{email:user.email,name:user.name}:null,registered:!!user?.registration_id,activeRegistration:user?.registration_id||null,registrations,csrf},200,{'Set-Cookie':setCookie(CSRF,csrf)});
  }
  if(!authEnabled(env)||!authConfigured(env)||!origin(env))return json({ok:false,error:'Verified sign-in is not available yet.'},503);
  if(path==='/auth/callback'&&request.method==='GET'){
    let stage='challenge';try{
    const flow=cookie(request,FLOW),code=u.searchParams.get('code');
    if(!hex.test(flow||'')||!code||code.length>2048)return failure();
    const row=await first(env,"DELETE FROM solborne_auth_challenges WHERE token_hash=? AND kind='google' AND expires_at>? RETURNING verifier",[await authHash(flow),now]);if(!row)return failure();
    stage='exchange';const result=await api(env,'token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:row.verifier}},fetcher);if(!result.ok)return failure();
    stage='session';
    const response=await issue(request,env,now,await result.json(),fetcher);if(response.status!==200)return response;
    const h=new Headers(response.headers);h.set('Location','/canvas.html');h.delete('Content-Type');return new Response(null,{status:303,headers:h});
    }catch(cause){console.error('SOLBORNE_AUTH_FAILURE',stage,String(cause?.name||'Error'));return failure(503);}
  }
  if(request.method!=='POST'||!sameOrigin(request,env))return failure();
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))return failure(415);
  const reader=request.body?.getReader();if(!reader)return failure(400);let size=0;const chunks=[];while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2048){await reader.cancel();return failure(413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return failure(400);}
  const csrf=cookie(request,CSRF);if(!hex.test(csrf)||input?.csrf!==csrf)return failure();
  const ip=await authHash(Math.floor(now/86400000)+'|'+(request.headers.get('CF-Connecting-IP')||'unknown'));
  if(!await rateLimit(env,'auth:'+ip,now,900000,20))return failure(429);
  await run(env,'DELETE FROM solborne_auth_sessions WHERE expires_at<=?',[now]);await run(env,'DELETE FROM solborne_auth_challenges WHERE expires_at<=?',[now]);
  if(path==='/api/auth/select-registration'){
    const user=await authIdentity(request,env,now,fetcher);if(!user)return failure(401);
    const selected=typeof input.registrationId==='string'?await first(env,'SELECT registration_id FROM solborne_auth_registrations WHERE user_id=? AND registration_id=?',[user.id,input.registrationId]):null;if(!selected)return failure(403);
    await run(env,'UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=? AND user_id=?',[selected.registration_id,user.sessionHash,user.id]);return json({ok:true,next:'/walk.html'});
  }
  if(path==='/api/auth/signout'){
    const value=cookie(request,SESSION);if(hex.test(value)){
      const hash=await authHash(value),row=await first(env,'SELECT access_token FROM solborne_auth_sessions WHERE token_hash=?',[hash]);
      await run(env,'DELETE FROM solborne_auth_sessions WHERE token_hash=?',[hash]);
      if(row){try{await api(env,'logout?scope=local',{method:'POST',access:row.access_token},fetcher);}catch{}}
    }
    return json({ok:true},200,{'Set-Cookie':setCookie(SESSION,'',0)});
  }
  if(path==='/api/auth/google'&&env.AUTH_GOOGLE_ENABLED==='true'){
    const flow=random(),verifier=random();const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));const challenge=btoa(String.fromCharCode(...new Uint8Array(digest))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    await run(env,'INSERT INTO solborne_auth_challenges(token_hash,kind,verifier,email,expires_at) VALUES(?,?,?,?,?)',[await authHash(flow),'google',verifier,'',now+600000]);
    const authorize=new URL('/auth/v1/authorize',env.SUPABASE_URL);authorize.searchParams.set('provider','google');authorize.searchParams.set('redirect_to',origin(env)+'/auth/callback');authorize.searchParams.set('code_challenge',challenge);authorize.searchParams.set('code_challenge_method','s256');
    return json({ok:true,url:authorize.href},200,{'Set-Cookie':setCookie(FLOW,flow)});
  }
  if(path==='/api/auth/email'&&env.AUTH_EMAIL_ENABLED==='true'){
    const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';if(email.length>254||!/^\S+@\S+\.\S+$/.test(email))return failure(422);
    if(!await rateLimit(env,'auth-email:'+await authHash(email),now,3600000,3))return failure(429);
    const flow=random();await run(env,'INSERT INTO solborne_auth_challenges(token_hash,kind,verifier,email,expires_at) VALUES(?,?,?,?,?)',[await authHash(flow),'email','',email,now+600000]);
    // Keep account-existence and provider errors out of the public response.
    try{await api(env,'otp',{method:'POST',body:{email,create_user:true}},fetcher);}catch{}
    return json({ok:true,message:'If sign-in is available for this address, a code will arrive shortly.'},200,{'Set-Cookie':setCookie(FLOW,flow)});
  }
  if(path==='/api/auth/verify'&&env.AUTH_EMAIL_ENABLED==='true'){
    const flow=cookie(request,FLOW);if(!hex.test(flow)||typeof input.code!=='string'||!/^\d{6,10}$/.test(input.code))return failure();
    const row=await first(env,"SELECT email FROM solborne_auth_challenges WHERE token_hash=? AND kind='email' AND expires_at>?",[await authHash(flow),now]);if(!row)return failure();
    if(!await rateLimit(env,'auth-code:'+await authHash(flow),now,600000,5))return failure(429);
    const result=await api(env,'verify',{method:'POST',body:{email:row.email,token:input.code,type:'email'}},fetcher);if(!result.ok)return failure();
    await run(env,'DELETE FROM solborne_auth_challenges WHERE token_hash=?',[await authHash(flow)]);return issue(request,env,now,await result.json(),fetcher);
  }
  return failure(404);
}
