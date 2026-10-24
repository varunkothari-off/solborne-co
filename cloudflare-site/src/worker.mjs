import {storageFor} from './walk-storage.mjs';
import {uploadWalkFile,downloadWalkFile,resolveAnswerFiles,resetWalkWithFiles} from './walk-files.mjs';
import {createLiveToken} from './walk-live-token.mjs';
import {saveDesignPreferences,saveAnswerSketch,validateSketch} from './walk-design.mjs';
import {publicMetrics} from './public-metrics.mjs';
import { authRoute, authEnabled, authIdentity } from './canvas-auth.mjs';
import {flushPresales} from './presales-sync.mjs';
import { database, first, all, run, rateLimit, cleanup } from './db.mjs';
import { privateAssets } from './private-assets.generated.mjs';
import { validateWebsiteInterview, createWebsiteFiles } from './website.mjs';
import { assets } from './assets.generated.mjs';
import { providerReady, loadDraft, answerDraft, reviewDraft, submitBrief } from './ai-walk.mjs';
import { transcribeAudio, validateAudio, MAX_AUDIO_BODY } from './walk-transcription.mjs';
import { renderAIPortfolio, approvedClassicFacts } from './ai-portfolio.mjs';

const CONSENT_VERSION = 'solborne-public-intake-v1';
import {normalizeJourney} from './walk-journey.mjs';
const TYPES = new Set(['website-pilot','workflow-pilot','general-enquiry','canvas-download']);
const COOKIE = '__Host-solborne_form';
const MAX_BODY = 4096;
const COMPLETION_ID = /^SW-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const REGISTRATION_ID = /^SB-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const RENDER_VERSION = 'solborne-static-v1';
class FormError extends Error { constructor(status,message){super(message);this.status=status;} }
const safeHeaders = {
  'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://*.chatgpt.site"
};
const noStore={'Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Cookie'};
function json(data,status=200,extra={}) { return new Response(JSON.stringify(data),{status,headers:{...safeHeaders,...noStore,'Content-Type':'application/json; charset=utf-8',...extra}}); }
function error(message,status=400,code='invalid_request',extra={}) { return json({ok:false,error:message,code},status,extra); }
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function csvCell(value) {
  let text=String(value ?? '').replace(/\0/g,'');
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
export async function digest(text) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join(''); }
function token() { return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''); }
function trustedOrigin(env) { try { const u=new URL(env.SITE_ORIGIN);return u.protocol==='https:' && u.pathname==='/' && !u.username && !u.password ? u.origin : null; }catch{return null;} }
function validOrigin(request,env) { const origin=trustedOrigin(env);return !!origin && request.headers.get('Origin')===origin && !['cross-site','none'].includes(request.headers.get('Sec-Fetch-Site')); }
function cookie(request) { return request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1) || ''; }
async function ipKey(request,now) {
  // Cloudflare sets CF-Connecting-IP. Store only a time-bucketed digest, never a raw address.
  const ip=request.headers.get('CF-Connecting-IP');
  return digest(`${Math.floor(now/86400000)}|${ip || 'unknown-edge'}`);
}
async function readJson(request,maxBody=MAX_BODY) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new FormError(415,'Use the registration form to submit your enquiry.');
  const reader=request.body?.getReader();if(!reader)throw new FormError(400,'The form was empty. Please try again.');
  let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBody){await reader.cancel();throw new FormError(413,'The submitted form is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new FormError(400,'The form could not be read. Please try again.');}
}
function validate(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) return null;
  if (typeof input.name!=='string' || typeof input.contact!=='string') return null;
  const name=input.name.trim().normalize('NFKC'), contact=input.contact.trim().toLowerCase();
  if(name.length<1||name.length>100||/[\x00-\x1f\x7f]/.test(name)) return null;
  if(contact.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)||/[\x00-\x1f\x7f]/.test(contact)) return null;
  if(!TYPES.has(input.enquiryType)||input.permissionToRespond!==true) return null;
  if(typeof input.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(input.idempotencyKey)) return null;
  if(typeof input.csrf!=='string'||!/^[a-f0-9]{64}$/.test(input.csrf)) return null;
  if(input.website !== undefined && input.website !== '')return null;
  let projectName;
  if(input.projectName!==undefined){if(typeof input.projectName!=='string')return null;projectName=input.projectName.trim().normalize('NFKC');if(projectName.length<1||projectName.length>120||/[\x00-\x1f\x7f]/.test(projectName))return null;}
  let journey;
  if(input.journey!==undefined){try{journey=normalizeJourney(input.journey);}catch{return null;}}
  return {name,contact,enquiryType:input.enquiryType,permissionToRespond:true,...(projectName?{projectName}:{}),...(journey?{journey}:{})};
}
function receipt(row,replayed=false,headers={}) { return json({ok:true,receipt:row.id,submittedAt:new Date(row.created_at).toISOString(),replayed,message:'Your enquiry has been saved for Solborne to review. Continue the Walk to confirm your brief and next step.'},replayed?200:201,headers); }
async function createSession(request,env,now) {
  if(!trustedOrigin(env)||!await intakeReady(env))return error('Registration is temporarily unavailable.',503,'configuration_unavailable');
  if(request.headers.get('Sec-Fetch-Site')==='cross-site')return error('Open the registration page directly to continue.',403,'origin_required');
  const key=await ipKey(request,now);
  if(!await rateLimit(env,'session:'+key,now,900000,30))return error('Too many attempts. Please try again later.',429,'rate_limited',{'Retry-After':'900'});
  await cleanup(env,now);
  const csrf=token();await run(env,'INSERT INTO solborne_form_sessions (token_hash,created_at,expires_at) VALUES (?,?,?)',[await digest(csrf),now,now+3600000]);
  return json({ok:true,csrf},200,{'Set-Cookie':`${COOKIE}=${csrf}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=3600`});
}
async function register(request,env,now,authFetch=fetch) {
  const identity=authEnabled(env)?await authIdentity(request,env,now,authFetch):null;
  if(authEnabled(env)&&!identity)return error('Sign in with a verified email before sending an enquiry.',401,'signin_required');
  if(!validOrigin(request,env))return error('Open the registration page directly and try again.',403,'origin_required');
  if(!await intakeReady(env))return error('Registration is temporarily unavailable.',503,'registration_unavailable');
  const input=await readJson(request);const data=validate(input);
  if(data&&identity&&data.contact!==identity.email)return error('Use your verified sign-in email.',403,'identity_mismatch');
  if(!data)return error('Check your name, email, enquiry type, and permission to respond.',422,'validation_failed');
  if(input.expectedReceipt!==undefined&&(typeof input.expectedReceipt!=='string'||!REGISTRATION_ID.test(input.expectedReceipt)))return error('This recovery reference could not be read.',422,'validation_failed');
  const sessionCookie=cookie(request);
  if(!sessionCookie || sessionCookie!==input.csrf)return error('Your form session needs refreshing. Your entries have been kept.',403,'session_expired');
  const session=await first(env,'SELECT created_at,expires_at FROM solborne_form_sessions WHERE token_hash=?',[await digest(input.csrf)]);
  if(!session||session.expires_at<now)return error('Your form session expired. Your entries have been kept.',403,'session_expired');
  if(now-session.created_at<1000)return error('Please review the form before submitting.',429,'too_fast',{'Retry-After':'2'});
  // Journey is presentation/context, not proof of identity. A recovery file need not
  // reproduce campaign parameters; replay returns the original saved project unchanged.
  const {journey:entryJourney,...identityData}=data;
  const key=await digest(input.idempotencyKey),payloadHash=await digest(JSON.stringify(identityData));
  const existing=await first(env,'SELECT id,payload_hash,created_at FROM solborne_registrations WHERE idempotency_key=?',[key]);
  // Recovery files restore an exact existing enquiry; they cannot create a new one.
  // expectedReceipt stays out of the normalized details and idempotency payload hash.
  if(input.expectedReceipt!==undefined&&(!existing||existing.id!==input.expectedReceipt))return error('We could not match this recovery file to a saved enquiry.',404,'recovery_not_found');
  if(existing&&identity){const owned=await first(env,'SELECT registration_id FROM solborne_auth_registrations WHERE user_id=? AND registration_id=?',[identity.id,existing.id]);if(!owned)return error('This saved enquiry belongs to a different sign-in.',403,'identity_mismatch');await run(env,'UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=? AND user_id=?',[existing.id,identity.sessionHash,identity.id]);}
  if(existing)return existing.payload_hash===payloadHash?await authorizedReceipt(request,env,existing,now,true,authFetch):error('This attempt was already used for different details. Start a new enquiry.',409,'idempotency_conflict');
  if(!await rateLimit(env,'submit:'+await ipKey(request,now),now,900000,5))return error('Too many enquiries were submitted from this connection. Please try again later.',429,'rate_limited',{'Retry-After':'900'});
  const id='SB-'+crypto.randomUUID();
  try{
    // Keep the readiness condition in the insert too, in case configuration changes mid-request.
    const insertSQL="INSERT INTO solborne_registrations (id,idempotency_key,payload_hash,name,contact,enquiry_type,permission_to_respond,consent_version,created_at) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM solborne_intake_control WHERE id=1 AND enabled=1 AND policy_version=?)";
    const values=[id,key,payloadHash,data.name,data.contact,data.enquiryType,1,CONSENT_VERSION,now,CONSENT_VERSION];
    const operations=[database(env).prepare(insertSQL).bind(...values)];
    if(identity){operations.push(database(env).prepare("INSERT INTO solborne_auth_registrations(user_id,registration_id,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM solborne_registrations WHERE id=?)").bind(identity.id,id,now,id),database(env).prepare("UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=? AND user_id=? AND EXISTS(SELECT 1 FROM solborne_auth_registrations WHERE user_id=? AND registration_id=?)").bind(id,identity.sessionHash,identity.id,identity.id,id));}
    if(data.projectName||data.journey)operations.push(database(env).prepare('INSERT INTO solborne_ai_walks(registration_id,state_json,created_at,updated_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM solborne_registrations WHERE id=?)').bind(id,JSON.stringify({messages:[],facts:data.projectName?{businessName:data.projectName}:{},businessBrief:{},...(data.journey?{journey:data.journey}:{}),missing:[],ready:false,template:'editorial',stage:'business',review:null}),now,now,id));
    const saved=(await database(env).batch(operations))[0];
    if(!(saved.meta?.changes>=1))return error('Registration is temporarily unavailable. Please try again later.',503,'registration_unavailable');
  }
  catch(cause){const raced=await first(env,'SELECT id,payload_hash,created_at FROM solborne_registrations WHERE idempotency_key=?',[key]);if(raced){if(identity){const linked=await first(env,'SELECT registration_id FROM solborne_auth_registrations WHERE user_id=? AND registration_id=?',[identity.id,raced.id]);if(!linked)return error('This saved enquiry belongs to a different sign-in.',403,'identity_mismatch');await run(env,'UPDATE solborne_auth_sessions SET active_registration_id=? WHERE token_hash=? AND user_id=?',[raced.id,identity.sessionHash,identity.id]);}return raced.payload_hash===payloadHash?await authorizedReceipt(request,env,raced,now,true,authFetch):error('This attempt was already used for different details.',409,'idempotency_conflict');}throw cause;}
  return await authorizedReceipt(request,env,{id,created_at:now},now,false,authFetch);
}
async function serveAsset(request,path,env={}) {
  const key=path==='/'?'index.html':(path==='/walk'||path==='/walk/'?'walk.html':path==='/studio'||path==='/studio/'?'studio/index.html':path==='/studio-motion'||path==='/studio-motion/'?'studio-motion/index.html':path.replace(/^\//,''));const entry=assets[key];if(!entry){
    if(request.headers.get('Accept')?.includes('text/html')&&assets['404.html']){
      const recovery=await serveAsset(request,'/404.html',env),headers=new Headers(recovery.headers);headers.set('Cache-Control','no-store');headers.set('Vary','Accept');return new Response(recovery.body,{status:404,headers});
    }
    return error('This page was not found.',404,'not_found');
  }
  const bytes=Uint8Array.from(atob(entry.body),c=>c.charCodeAt(0));const headers={...safeHeaders,'Content-Type':entry.type,'Cache-Control':'no-cache','ETag':'"'+entry.etag+'"'};
  if(key==='ai-walk.html'){headers['Permissions-Policy']='camera=(), microphone=(self), geolocation=()';if(env.GEMINI_LIVE_TRANSCRIPTION_ENABLED==='true')headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("connect-src 'self'","connect-src 'self' wss://generativelanguage.googleapis.com");}
  const marketing=new Set(['/','/websites.html','/how-it-works.html','/about.html','/contact.html','/offer.html','/privacy.html','/terms.html']).has(path);
  if(entry.schemaHashes?.length||marketing){
    headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("script-src 'self'",`script-src 'self' ${[...(entry.schemaHashes||[]),...(marketing?['https://www.googletagmanager.com']:[])].join(' ')}`);
    if(marketing)headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("connect-src 'self'","connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com").replace("img-src 'self' data:","img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com");
  }
  if(entry.type.startsWith('text/html')&&(!marketing))headers['X-Robots-Tag']='noindex, follow';
  if(entry.type.startsWith('video/')){headers['Accept-Ranges']='bytes';const range=request.headers.get('Range');if(range){const match=range.match(/^bytes=(\d*)-(\d*)$/);let start=0,end=bytes.length-1;if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});if(!match[1])start=Math.max(0,bytes.length-Number(match[2]));else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=bytes.length)return new Response(null,{status:416,headers:{...headers,'Content-Range':`bytes */${bytes.length}`}});headers['Content-Range']=`bytes ${start}-${end}/${bytes.length}`;headers['Content-Length']=String(end-start+1);return new Response(request.method==='HEAD'?null:bytes.slice(start,end+1),{status:206,headers});}headers['Content-Length']=String(bytes.length);}
  return new Response(request.method==='HEAD'?null:bytes,{status:key==='404.html'?404:200,headers});
}
export async function handleRequest(request,env,{clock=Date.now,modelFetch=fetch,authFetch=fetch}={}) {
  const now=clock(),url=new URL(request.url),path=url.pathname;
  try {
    if(path==='/api/public-metrics'&&request.method==='GET'){
      try{return json({ok:true,...await publicMetrics(env,{fetcher:modelFetch})});}catch{return error('Counts are temporarily unavailable.',503,'metrics_unavailable');}
    }
    const authResponse=await authRoute(request,env,now,{fetcher:authFetch});if(authResponse)return authResponse;
    if(['GET','HEAD'].includes(request.method)&&['/index.html','/improve.html'].includes(path))return new Response(null,{status:301,headers:{...safeHeaders,Location:(path==='/index.html'?'/':'/websites.html')+url.search,'Cache-Control':'no-cache'}});
    if(path==='/api/ai-walk/status'&&request.method==='GET')return json({ok:true,enabled:providerReady(env)});
    if(path==='/api/ai-walk/files'||path.startsWith('/api/ai-walk/files/')){
      if(!await intakeReady(env))return error('The Walk is temporarily unavailable.',503,'registration_unavailable');
      const access=await accessFor(request,env,now,authFetch);if(!access)return error('Sign in and choose your business first.',403,'registration_required');
      if(request.method==='GET'&&path.startsWith('/api/ai-walk/files/'))return await downloadWalkFile(env,access.registration_id,path.slice('/api/ai-walk/files/'.length));
      if(request.method!=='POST'||path!=='/api/ai-walk/files')return error('Use the correct action.',405,'method_not_allowed');
      if(!validOrigin(request,env))return error('Open the Walk directly and try again.',403,'origin_required');
      if(!await validSession(request,env,now,request.headers.get('X-CSRF-Token')))return error('Refresh your form connection before continuing.',403,'session_expired');
      const result=await uploadWalkFile(request,env,access.registration_id,now);return json(result.body,result.status);
    }
    if(['/api/ai-walk','/api/ai-walk/design','/api/ai-walk/sketch','/api/ai-walk/review','/api/ai-walk/preview','/api/ai-walk/complete','/api/ai-walk/submit','/api/ai-walk/transcribe','/api/ai-walk/live-token'].includes(path)&&['GET','POST','DELETE'].includes(request.method)){
      if(!await intakeReady(env))return error('The Walk is temporarily unavailable.',503,'registration_unavailable');
      const access=await accessFor(request,env,now,authFetch);if(!access)return error('Save your basic details first.',403,'registration_required');
      if(['/api/ai-walk/preview','/api/ai-walk/complete'].includes(path)&&env.AI_WEBSITE_BUILD_ENABLED!=='true')return error('Website preparation follows team research and design approval. This Walk saves your business brief only.',503,'manual_design_required');
      if(request.method==='GET'){
        const {row,state}=await loadDraft(env,access.registration_id);
        if(path==='/api/ai-walk/preview'){if(!state.review)return error('Run the reviews before opening a draft.',422,'review_required');return json({ok:true,html:renderAIPortfolio(state,templateCSS(state)),template:state.template});}
        if(path!=='/api/ai-walk')return error('Use the correct action.',405,'method_not_allowed');
        return json({ok:true,enabled:providerReady(env),uploadsEnabled:!!storageFor(env),state,revision:row?.revision||0,...(env.GEMINI_LIVE_TRANSCRIPTION_ENABLED==='true'?{voiceMode:'live'}:{})});
      }
      if(!validOrigin(request,env))return error('Open the Walk directly and try again.',403,'origin_required');
      const input=await readJson(request,path==='/api/ai-walk/transcribe'?MAX_AUDIO_BODY:path==='/api/ai-walk'?262144:['/api/ai-walk/design','/api/ai-walk/sketch'].includes(path)?131072:8192);if(!await validSession(request,env,now,input?.csrf))return error('Refresh your form connection before continuing.',403,'session_expired');
      if(['/api/ai-walk','/api/ai-walk/sketch'].includes(path)&&request.method==='POST'){
        try{validateSketch(input.sketch);}catch{return error('Use a smaller sketch with valid drawing points.',422,'invalid_sketch');}
      }
      if(path==='/api/ai-walk'&&request.method==='POST'){
        const {state}=await loadDraft(env,access.registration_id);try{resolveAnswerFiles(state,input.files);}catch{return error('Choose files uploaded to this business, up to five per answer.',422,'invalid_files');}
      }
      if(path==='/api/ai-walk/sketch'){
        if(request.method!=='POST')return error('Use the correct action.',405,'method_not_allowed');
        if(!await rateLimit(env,'walk-sketch:'+access.registration_id,now,900000,40))return error('Please pause before saving again.',429,'rate_limited');
        const result=await saveAnswerSketch(env,access.registration_id,input,now);return json(result.body,result.status);
      }
      if(path==='/api/ai-walk/design'){
        if(request.method!=='POST')return error('Use the correct action.',405,'method_not_allowed');
        if(!await rateLimit(env,'walk-design:'+access.registration_id,now,900000,40))return error('Please pause before saving again.',429,'rate_limited');
        const result=await saveDesignPreferences(env,access.registration_id,input,now);return json(result.body,result.status);
      }
      if(path==='/api/ai-walk/live-token'){
        if(request.method!=='POST')return error('Use the correct action.',405,'method_not_allowed');
        if(env.GEMINI_LIVE_TRANSCRIPTION_ENABLED!=='true'||!providerReady(env))return error('Live transcription is not enabled.',503,'live_voice_disabled');
        if(input.consent!==true||input.audioConsent!==true)return error('Agree to audio processing first.',422,'audio_consent_required');
        const {state}=await loadDraft(env,access.registration_id);if(state.submission)return error('Your brief is already with our team.',409,'already_submitted');
        if(!await rateLimit(env,'walk-live:'+access.registration_id,now,900000,10)||!await rateLimit(env,'walk-live-global',now,86400000,1000))return error('Please pause before recording another answer. You can still type.',429,'voice_limit');
        try{return json({ok:true,...await createLiveToken(env,{fetcher:modelFetch,now,signal:request.signal})});}
        catch{return error('Live transcription could not connect. Please try again or type your answer.',502,'live_voice_unavailable');}
      }
      if(path==='/api/ai-walk/transcribe'){
        if(request.method!=='POST')return error('Use the correct action.',405,'method_not_allowed');
        if(!providerReady(env))return error('Voice transcription is temporarily unavailable. You can still type your answer.',503,'provider_not_connected');
        try{validateAudio(input);}catch(e){return error(e.message,422,'invalid_audio');}
        const {state}=await loadDraft(env,access.registration_id);if(state.submission)return error('Your brief is already with our team.',409,'already_submitted');
        if(!await rateLimit(env,'walk-voice:'+access.registration_id,now,900000,10)||!await rateLimit(env,'walk-voice-global',now,86400000,1000))return error('Please pause before recording another answer. You can still type.',429,'voice_limit');
        try{const result=await transcribeAudio(env,input,{fetcher:modelFetch,signal:request.signal});return json({ok:true,...result});}
        catch(e){return error(e.message.startsWith('No clear speech')?e.message:'We could not transcribe that recording. Try again or type your answer.',502,'transcription_unavailable');}
      }
      if(request.method==='DELETE'){if(path!=='/api/ai-walk')return error('Use the correct action.',405,'method_not_allowed');const result=await resetWalkWithFiles(env,access.registration_id,now);return json(result.body,result.status);}
      if(path==='/api/ai-walk/submit'){const result=await submitBrief(env,access.registration_id,input,now);return json(result.body,result.status);}
      if(!await rateLimit(env,'ai-walk:'+access.registration_id,now,900000,20))return error('Too many answers at once. Please continue shortly.',429,'rate_limited');
      if(path==='/api/ai-walk/review'){const result=await reviewDraft(env,access.registration_id,input,now,{fetcher:modelFetch});return json(result.body,result.status);}
      if(path==='/api/ai-walk/complete')return await completeAIWalk(env,access.registration_id,input,now);
      if(path!=='/api/ai-walk')return error('Use the correct action.',405,'method_not_allowed');
      const result=await answerDraft(env,access.registration_id,input,now,{fetcher:modelFetch});return json(result.body,result.status);
    }
    if(path==='/api/registration-session'&&request.method==='GET')return await createSession(request,env,now);
    if(path==='/api/registrations'&&request.method==='POST')return await register(request,env,now,authFetch);
    if(path==='/admin'||path.startsWith('/admin/')||path.startsWith('/api/admin/')||path==='/signin-with-chatgpt'||path==='/signout-with-chatgpt')return error('This page was not found.',404,'not_found');
    if(path==='/api/access/status'&&request.method==='GET'){const access=await accessFor(request,env,now,authFetch);return access?json({ok:true,registered:true}):error('Save your basic details first.',403,'registration_required');}
    if(path==='/api/walk/complete'&&request.method==='POST')return await completeWalk(request,env,now);
    if(path==='/api/walk/revisions'&&request.method==='POST')return await reviseWebsite(request,env,now);
    if((path==='/api/walk/versions'||path.startsWith('/api/walk/versions/'))&&request.method==='GET')return await websiteVersions(request,env,now);
    if(path.startsWith('/downloads/')&&(request.method==='GET'||request.method==='HEAD'))return await download(request,env,now,authFetch);
    if(path.startsWith('/api/'))return error('This operation is not supported.',405,'method_not_allowed');
    if(request.method!=='GET'&&request.method!=='HEAD')return error('This operation is not supported.',405,'method_not_allowed',{'Allow':'GET, HEAD'});
    if(env.AI_WALK_ENABLED==='true'&&['/walk','/walk/','/walk.html'].includes(path)){
      const params=new URL(request.url).searchParams;
      const journey=params.get('intent')==='operations'?'?intent=operations'+(['payments','documents','quotes'].includes(params.get('workflow'))?'&workflow='+params.get('workflow'):''):'';
      return new Response(null,{status:302,headers:{...safeHeaders,...noStore,Location:'/ai-walk.html'+journey}});
    }
    return await serveAsset(request,path,env);
  } catch(cause) {
    if(cause instanceof FormError)return error(cause.message,cause.status);
    // Never log request bodies, names, contact details, cookies, or database errors.
    console.error('SOLBORNE_REQUEST_FAILED',path.startsWith('/admin')||path.startsWith('/api/admin')?'owner_route':'public_route');
    return error('We could not save or retrieve the information right now. Please try again. Your form entries have been kept.',503,'temporarily_unavailable');
  }
}
async function completeAIWalk(env,registration,input,now){
  const {row,state}=await loadDraft(env,registration);
  if(!row||!state.ready||!state.review||input.ownerApproved!==true||input.revision!==row.revision||!(/^[a-f0-9]{64}$/).test(input.idempotencyKey||''))return error('Review the draft and approve your public facts before submitting.',422,'review_required');
  const classic=approvedClassicFacts(state.facts),serialized=JSON.stringify(classic),hash=await digest(JSON.stringify({facts:state.facts,revision:row.revision})),key=await digest(registration+'|ai|'+input.idempotencyKey);
  const saved=await completionByKey(env,registration,key);if(saved)return saved.payload_hash===hash?walkReceipt(saved,true):error('Use a new submission for changed facts.',409,'idempotency_conflict');
  const html=renderAIPortfolio(state,templateCSS(state));
  const readme=`${state.facts.businessName} — Solborne AI-guided portfolio draft\n\nActual base: ${state.template} by HTML5 UP, CC BY 3.0. Attribution retained. Public business facts were approved by the owner; model reviews are advice, not a legal certification.\n\nResearch notes: ${JSON.stringify(state.review.research)}\nMarketing notes: ${JSON.stringify(state.review.marketing)}\n\nStitch is not connected. Customer-subdomain publication and legal applicability/asset checks require team review. This draft has no enquiry backend or document upload. The saved source is frozen; a new version is needed for changes.\n`;
  const files={html,readme,htmlHash:await digest(html),readmeHash:await digest(readme)},id='SW-'+crypto.randomUUID();
  try{await saveWebsiteVersion(env,{id,registration,key,hash,serialized,project:id,parent:null,version:1,now},files);}catch(cause){const raced=await completionByKey(env,registration,key);if(raced)return raced.payload_hash===hash?walkReceipt(raced,true):error('This attempt contains changed facts.',409,'idempotency_conflict');throw cause;}
  return walkReceipt(await completionById(env,registration,id),false);
}
function templateCSS(state){const template=state.template==='story'?'story':'editorial';const asset=assets['catalog/'+template+'.css'];if(!asset)throw new Error('TEMPLATE_UNAVAILABLE');return new TextDecoder().decode(Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)));}
export default { async fetch(request,env,ctx){const response=await handleRequest(request,env);if(ctx?.waitUntil&&response.ok&&!['GET','HEAD'].includes(request.method))ctx.waitUntil(flushPresales(env));return response;}, async scheduled(_event,env,ctx){ctx.waitUntil(flushPresales(env));} };

async function intakeReady(env){const row=await first(env,'SELECT enabled,policy_version FROM solborne_intake_control WHERE id=1');return row?.enabled===1&&row.policy_version===CONSENT_VERSION;}
function cookieNamed(request,name){return request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
async function authorizedReceipt(request,env,row,now,replayed=false,authFetch=fetch){
  const current=await accessFor(request,env,now,authFetch);
  if(current?.registration_id===row.id)return receipt(row,replayed);
  if(!await rateLimit(env,'grant:'+row.id,now,900000,10)||!await rateLimit(env,'grant-connection:'+await ipKey(request,now),now,900000,30))return error('Your details are saved, but too many access refreshes were requested. Please try again later.',429,'rate_limited',{'Retry-After':'900'});
  const opaque=token();
  await run(env,'INSERT INTO solborne_access_grants (token_hash,registration_id,expires_at) VALUES (?,?,?)',[await digest(opaque),row.id,now+86400000]);
  return receipt(row,replayed,{'Set-Cookie':`__Host-solborne_access=${opaque}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=86400`});
}
async function accessFor(request,env,now,authFetch=fetch){
  if(authEnabled(env)){
    const user=await authIdentity(request,env,now,authFetch);if(!user)return null;
    const pinned=request.headers.get('X-Solborne-Project');
    if(pinned){if(!REGISTRATION_ID.test(pinned))return null;const owned=await first(env,'SELECT registration_id FROM solborne_auth_registrations WHERE user_id=? AND registration_id=?',[user.id,pinned]);return owned?{registration_id:owned.registration_id}:null;}
    // Old/unbound tabs may read status but cannot submit into another selected project.
    if(!['GET','HEAD'].includes(request.method))return null;
    return user.registration_id?{registration_id:user.registration_id}:null;
  }
  const opaque=cookieNamed(request,'__Host-solborne_access');if(!/^[a-f0-9]{64}$/.test(opaque))return null;
  return await first(env,'SELECT g.registration_id FROM solborne_access_grants g JOIN solborne_registrations r ON r.id=g.registration_id WHERE g.token_hash=? AND g.expires_at>?',[await digest(opaque),now]);
}
async function validSession(request,env,now,csrf){
  if(typeof csrf!=='string'||!/^[a-f0-9]{64}$/.test(csrf)||cookie(request)!==csrf)return false;
  return !!await first(env,'SELECT token_hash FROM solborne_form_sessions WHERE token_hash=? AND expires_at>?',[await digest(csrf),now]);
}
async function completeWalk(request,env,now){
  if(!validOrigin(request,env))return error('Open the Walk of Fame directly and try again.',403,'origin_required');
  if(!await intakeReady(env))return error('The Walk of Fame is temporarily unavailable.',503,'registration_unavailable');
  const access=await accessFor(request,env,now);if(!access)return error('Save your basic details first.',403,'registration_required');
  const input=await readJson(request,131072);
  if(!input||typeof input!=='object'||Array.isArray(input))return error('Review your website facts.',422,'validation_failed');
  if(!await validSession(request,env,now,input.csrf))return error('Refresh your form connection. Your answers have been kept.',403,'session_expired');
  const approved=validateWebsiteInterview(input.facts);
  if(!approved.ok||input.ownerApproved!==true||!Array.isArray(input.answers)||input.answers.length!==5||input.answers.some(x=>typeof x!=='string'||!x.trim()||x.length>3000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(x))||!(/^[a-f0-9]{64}$/).test(input.idempotencyKey||''))return error('Finish the five story questions and review your public website facts.',422,'validation_failed');
  // The story stays out of durable storage; only explicitly reviewed public website facts are kept.
  const serialized=JSON.stringify(approved.value),hash=await digest(serialized),key=await digest(access.registration_id+'|'+input.idempotencyKey);
  const saved=await completionByKey(env,access.registration_id,key);
  if(saved)return saved.payload_hash===hash?walkReceipt(saved,true):error('This completion attempt already contains different facts. Create a new preview.',409,'idempotency_conflict');
  if(!await rateLimit(env,'walk:'+await ipKey(request,now),now,900000,10))return error('Too many attempts. Please try again later.',429,'rate_limited',{'Retry-After':'900'});
  // Freeze the exact approved UTF-8 source, not a later renderer's output.
  const files=await websiteArtifact(approved.value);
  const id='SW-'+crypto.randomUUID();
  try{
    await saveWebsiteVersion(env,{id,registration:access.registration_id,key,hash,serialized,project:id,parent:null,version:1,now},files);
  }catch(cause){const raced=await completionByKey(env,access.registration_id,key);if(raced)return raced.payload_hash===hash?walkReceipt(raced,true):error('This attempt contains different facts.',409,'idempotency_conflict');if(!await intakeReady(env))return error('The Walk of Fame is temporarily unavailable.',503,'registration_unavailable');throw cause;}
  return walkReceipt(await completionById(env,access.registration_id,id),false);
}
const versionQuery=`SELECT c.id,COALESCE(c.project_id,c.id) AS project_id,c.parent_completion_id,c.revision_number,c.created_at,c.payload_hash,c.website_facts_json,
  a.completion_id AS artifact_id,a.html_sha256,a.readme_sha256,a.render_version,
  q.status AS review_status,d.completion_id AS release_id,d.released_at,d.release_basis,
  (SELECT MAX(v.revision_number) FROM solborne_walk_completions v WHERE v.registration_id=c.registration_id AND COALESCE(v.project_id,v.id)=COALESCE(c.project_id,c.id)) AS latest_revision
  FROM solborne_walk_completions c LEFT JOIN solborne_website_artifacts a ON a.completion_id=c.id
  LEFT JOIN solborne_owner_reviews q ON q.completion_id=c.id LEFT JOIN solborne_website_releases d ON d.completion_id=c.id`;
async function completionById(env,registration,id){return first(env,versionQuery+' WHERE c.registration_id=? AND c.id=?',[registration,id]);}
async function completionByKey(env,registration,key){return first(env,versionQuery+' WHERE c.registration_id=? AND c.idempotency_key=?',[registration,key]);}
function versionMetadata(row){
  return {completion:row.id,project:row.project_id,version:row.revision_number,parentCompletion:row.parent_completion_id??null,createdAt:new Date(row.created_at).toISOString(),isLatest:row.revision_number===row.latest_revision,
    deliveryState:row.release_id?'released':'pending',reviewState:row.review_status??'pending',releaseBasis:row.release_basis??null,releasedAt:row.release_id?new Date(row.released_at).toISOString():null,
    downloads:row.release_id?[`/downloads/website/${row.id}/index.html`,`/downloads/website/${row.id}/README.txt`]:[],sourceMode:row.artifact_id?'saved-files':'legacy-rendered',
    sourceHashes:row.artifact_id?{html:row.html_sha256,readme:row.readme_sha256}:null,renderVersion:row.artifact_id?row.render_version:null};
}
function walkReceipt(row,replayed){const message=row.release_id?(row.release_basis==='grandfathered'?'Your existing website and source files remain available to download.':'Your website and source files have been released and are ready to download.'):row.review_status==='reviewed'?'Your website facts have been reviewed and are awaiting release.':'Your Walk of Fame is saved for team processing. Files will appear here after release.';return json({ok:true,...versionMetadata(row),replayed,message},replayed?200:201);}
async function websiteArtifact(facts){
  const files=createWebsiteFiles(facts),html=files.find(file=>file.filename==='index.html').content,readme=files.find(file=>file.filename==='README.txt').content;
  return {html,readme,htmlHash:await digest(html),readmeHash:await digest(readme)};
}
async function saveWebsiteVersion(env,row,files){
  const db=database(env),params=[row.id,row.registration,row.key,row.hash,row.serialized,RENDER_VERSION,row.now,row.project,row.parent,row.version,CONSENT_VERSION];
  let condition='';
  if(row.parent){
    condition=' AND EXISTS (SELECT 1 FROM solborne_walk_completions p WHERE p.id=? AND p.registration_id=? AND COALESCE(p.project_id,p.id)=? AND p.revision_number=?) AND NOT EXISTS (SELECT 1 FROM solborne_walk_completions newer WHERE newer.registration_id=? AND COALESCE(newer.project_id,newer.id)=? AND newer.revision_number>?)';
    params.push(row.parent,row.registration,row.project,row.version-1,row.registration,row.project,row.version-1);
  }
  // D1 batch is a transaction. A missing completion aborts artifact insertion;
  // an artifact/queue/audit failure rolls everything back before any receipt.
  const replies=await db.batch([
    db.prepare('INSERT INTO solborne_walk_completions (id,registration_id,idempotency_key,payload_hash,website_facts_json,scope_version,created_at,project_id,parent_completion_id,revision_number) SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM solborne_intake_control WHERE id=1 AND enabled=1 AND policy_version=?)'+condition).bind(...params),
    db.prepare('INSERT INTO solborne_website_artifacts (completion_id,html_content,readme_content,html_sha256,readme_sha256,render_version) VALUES (?,?,?,?,?,?)').bind(row.id,files.html,files.readme,files.htmlHash,files.readmeHash,RENDER_VERSION),
    db.prepare("INSERT INTO solborne_owner_reviews (completion_id,status,updated_at) VALUES (?,'pending',?)").bind(row.id,row.now)
  ]);
  // Trigger audit writes may be included in an adapter's changes count.
  if(replies.length!==3||replies.some(reply=>reply.success===false||!(reply.meta?.changes>=1)))throw new Error('WEBSITE_SAVE_NOT_CONFIRMED');
}
async function websiteVersions(request,env,now){
  const access=await accessFor(request,env,now);if(!access)return error('Save your basic details first.',403,'registration_required');
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/walk/versions'){
    const before=url.searchParams.get('before');let condition='',params=[access.registration_id];
    if(before!==null){
      if(!COMPLETION_ID.test(before))return error('Use a saved version reference to load older versions.',422,'validation_failed');
      const cursor=await completionById(env,access.registration_id,before);if(!cursor)return error('This version was not found.',404,'not_found');
      condition=' AND (created_at<? OR (created_at=? AND (revision_number<? OR (revision_number=? AND id<?))))';
      params.push(cursor.created_at,cursor.created_at,cursor.revision_number,cursor.revision_number,cursor.id);
    }
    // Limit before computing per-project latest metadata, so history remains
    // bounded even when an established registration has many old versions.
    const rows=await all(env,'WITH selected AS (SELECT * FROM solborne_walk_completions WHERE registration_id=?'+condition+' ORDER BY created_at DESC,revision_number DESC,id DESC LIMIT 201) '+versionQuery.replace('FROM solborne_walk_completions c','FROM selected c')+' ORDER BY c.created_at DESC,c.revision_number DESC,c.id DESC',params);
    const hasMore=rows.length>200,page=rows.slice(0,200);
    return json({ok:true,versions:page.map(versionMetadata),hasMore,nextCursor:hasMore?page.at(-1).id:null});
  }
  const id=path.slice('/api/walk/versions/'.length);if(!COMPLETION_ID.test(id))return error('This version was not found.',404,'not_found');
  const row=await completionById(env,access.registration_id,id);if(!row)return error('This version was not found.',404,'not_found');
  const facts=validateWebsiteInterview(JSON.parse(row.website_facts_json));if(!facts.ok)throw new Error('SAVED_FACTS_INVALID');
  return json({ok:true,version:versionMetadata(row),facts:facts.value});
}
async function reviseWebsite(request,env,now){
  if(!validOrigin(request,env))return error('Open the Walk of Fame directly and try again.',403,'origin_required');
  if(!await intakeReady(env))return error('The Walk of Fame is temporarily unavailable.',503,'registration_unavailable');
  const access=await accessFor(request,env,now);if(!access)return error('Save your basic details first.',403,'registration_required');
  const input=await readJson(request,131072);
  if(!input||typeof input!=='object'||Array.isArray(input))return error('Review your website facts.',422,'validation_failed');
  if(!await validSession(request,env,now,input.csrf))return error('Refresh your form connection. Your answers have been kept.',403,'session_expired');
  const approved=validateWebsiteInterview(input.facts);
  if(!approved.ok||input.ownerApproved!==true||!COMPLETION_ID.test(input.parentCompletion||'')||typeof input.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(input.idempotencyKey)||Object.keys(input).some(name=>!['csrf','idempotencyKey','facts','ownerApproved','parentCompletion'].includes(name)))return error('Review your public website facts and the version being revised.',422,'validation_failed');
  const serialized=JSON.stringify(approved.value),hash=await digest(JSON.stringify({parentCompletion:input.parentCompletion,facts:approved.value})),key=await digest(access.registration_id+'|'+input.idempotencyKey);
  // An exact uncertain-result retry remains valid even after a later revision.
  const saved=await completionByKey(env,access.registration_id,key);
  if(saved)return saved.payload_hash===hash?walkReceipt(saved,true):error('This attempt contains different facts or a different parent version.',409,'idempotency_conflict');
  const parent=await completionById(env,access.registration_id,input.parentCompletion);
  if(!parent)return error('This version was not found.',404,'not_found');
  if(parent.revision_number!==parent.latest_revision)return revisionConflict();
  if(!await rateLimit(env,'walk:'+await ipKey(request,now),now,900000,10))return error('Too many attempts. Please try again later.',429,'rate_limited',{'Retry-After':'900'});
  const files=await websiteArtifact(approved.value),id='SW-'+crypto.randomUUID();
  try{
    await saveWebsiteVersion(env,{id,registration:access.registration_id,key,hash,serialized,project:parent.project_id,parent:parent.id,version:parent.revision_number+1,now},files);
  }catch(cause){
    const raced=await completionByKey(env,access.registration_id,key);if(raced)return raced.payload_hash===hash?walkReceipt(raced,true):error('This attempt contains different facts or a different parent version.',409,'idempotency_conflict');
    if(!await intakeReady(env))return error('The Walk of Fame is temporarily unavailable.',503,'registration_unavailable');
    const current=await completionById(env,access.registration_id,parent.id);if(current&&current.revision_number!==current.latest_revision)return revisionConflict();throw cause;
  }
  return walkReceipt(await completionById(env,access.registration_id,id),false);
}
function revisionConflict(){return error('A newer version already exists. Open and review the latest version before revising.',409,'revision_conflict');}
function deliveryPending(){return error("This version's files are awaiting release.",423,'delivery_pending');}
async function download(request,env,now,authFetch=fetch){
  const path=new URL(request.url).pathname;
  const allowed=new Set(['/downloads/canvas.pdf','/downloads/canvas.txt','/downloads/website/index.html','/downloads/website/README.txt']);
  const versioned=path.match(/^\/downloads\/website\/(SW-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/(index\.html|README\.txt)$/);
  if(!allowed.has(path)&&!versioned)return error('This file was not found.',404,'not_found');
  const canvas=path.startsWith('/downloads/canvas.');
  const identity=canvas&&authEnabled(env)?await authIdentity(request,env,now,authFetch):null;
  const access=identity?{registration_id:identity.registration_id}:await accessFor(request,env,now,authFetch);if(!access)return error('Sign in before downloading.',403,'registration_required');
  let body,type,name;
  if(path.startsWith('/downloads/canvas.')){
    name=path.endsWith('.pdf')?'canvas.pdf':'canvas.txt';const file=privateAssets[name];
    if(!file)return error('This file is temporarily unavailable.',503,'temporarily_unavailable');
    body=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));type=file.type;name='solborne-walk-of-fame-'+name;
  }else{
    const query='SELECT c.website_facts_json,a.completion_id AS artifact_id,a.html_content,a.readme_content,d.completion_id AS release_id FROM solborne_walk_completions c LEFT JOIN solborne_website_artifacts a ON a.completion_id=c.id LEFT JOIN solborne_website_releases d ON d.completion_id=c.id WHERE c.registration_id=?';
    const row=versioned?await first(env,query+' AND c.id=?',[access.registration_id,versioned[1]]):await first(env,query+' AND d.completion_id IS NOT NULL ORDER BY c.created_at DESC,c.revision_number DESC,c.id DESC LIMIT 1',[access.registration_id]);
    if(!row){if(!versioned&&await first(env,'SELECT id FROM solborne_walk_completions WHERE registration_id=? LIMIT 1',[access.registration_id]))return deliveryPending();return error('Complete the Walk of Fame before downloading your website.',404,'walk_incomplete');}
    if(!row.release_id)return deliveryPending();
    name=path.split('/').at(-1);
    if(row.artifact_id){body=name==='index.html'?row.html_content:row.readme_content;type=name==='index.html'?'text/html;charset=utf-8':'text/plain;charset=utf-8';}
    else{const file=createWebsiteFiles(JSON.parse(row.website_facts_json)).find(x=>x.filename===name);body=file.content;type=file.mimeType;}
  }
  const length=typeof body==='string'?new TextEncoder().encode(body).byteLength:body.byteLength;
  return new Response(request.method==='HEAD'?null:body,{headers:{...safeHeaders,...noStore,'Content-Type':type,'Content-Length':String(length),'Content-Disposition':`attachment; filename="${name}"`}});
}
