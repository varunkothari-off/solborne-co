import {storageFor} from './walk-storage.mjs';
import {first,run,rateLimit} from './db.mjs';
export const MAX_WALK_FILE_BYTES=5*1024*1024;
const MAX_PROJECT_BYTES=20*1024*1024,MAX_PROJECT_FILES=20;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const extensions={'image/png':['png'],'image/jpeg':['jpg','jpeg'],'image/webp':['webp'],'application/pdf':['pdf'],'text/plain':['txt'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['docx'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':['xlsx'],'application/vnd.openxmlformats-officedocument.presentationml.presentation':['pptx']};
const result=(status,error)=>({status,body:{ok:false,error}});
const metadata=file=>({id:file.id,name:file.name,type:file.type,size:file.size,url:file.url,sha256:file.sha256});
export function resolveAnswerFiles(state,value){
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.length>5||new Set(value).size!==value.length||value.some(id=>typeof id!=='string'||!uuid.test(id)))throw Error('Invalid attachments');
 return value.map(id=>{const file=(state.fileLibrary||[]).find(file=>file.id===id);if(!file)throw Error('Unknown attachment');return metadata(file);});
}
export function answerFileMetadata(state){
 const saved=(state.answerFiles||[]).map(item=>({turn:item.turn,question:item.question,files:item.files.map(metadata)}));
 const pending=state.pendingAnswer;if(pending?.files?.length)saved.push({turn:pending.id,question:pending.question,files:resolveAnswerFiles(state,pending.files)});
 return saved;
}
function fileName(request,type){
 let raw;try{raw=decodeURIComponent(request.headers.get('X-File-Name')||'');}catch{throw Error('Invalid filename');}
 const name=raw.normalize('NFKC').split(/[\\/]/).at(-1).replace(/[<>:"|?*\x00-\x1f\x7f]/g,'_').trim().slice(0,160);
 if(!name||!extensions[type]?.includes(name.split('.').at(-1).toLowerCase()))throw Error('Unsupported file');return name;
}
async function readFileBytes(request){
 const declared=request.headers.get('Content-Length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>MAX_WALK_FILE_BYTES))throw Object.assign(Error('Choose a file under 5 MB.'),{status:413});
 const reader=request.body?.getReader();if(!reader)throw Error('Empty file');let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_WALK_FILE_BYTES){await reader.cancel();throw Object.assign(Error('Choose a file under 5 MB.'),{status:413});}chunks.push(value);}
 if(!size)throw Error('Empty file');const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
function validateBytes(bytes,type){
 const starts=(values,offset=0)=>values.every((v,i)=>bytes[i+offset]===v),ascii=(text,offset=0)=>starts([...text].map(c=>c.charCodeAt(0)),offset);
 if(type==='image/png'&&bytes.length>=24&&starts([137,80,78,71,13,10,26,10])&&ascii('IHDR',12))return;
 if(type==='image/jpeg'&&bytes.length>=4&&starts([255,216,255]))return;
 if(type==='image/webp'&&bytes.length>=12&&ascii('RIFF')&&ascii('WEBP',8))return;
 if(type==='application/pdf'&&bytes.length>=8&&ascii('%PDF-'))return;
 if(type.startsWith('application/vnd.openxmlformats-officedocument.')&&bytes.length>=8&&starts([80,75,3,4]))return;
 if(type==='text/plain'){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)&&!/<(?:!doctype|html|script|svg|\?xml)\b/i.test(text))return;}
 throw Error('The file does not match its type.');
}
export async function uploadWalkFile(request,env,registration,now){
 const storage=storageFor(env);
 if(!storage)return result(503,'File uploads are temporarily unavailable. Your answer is still here.');
 const revisionHeader=request.headers.get('X-Walk-Revision')||'';if(!/^\d+$/.test(revisionHeader)||!Number.isSafeInteger(Number(revisionHeader)))return result(422,'Refresh your Walk before uploading.');const revision=Number(revisionHeader);
 const type=(request.headers.get('Content-Type')||'').toLowerCase().split(';')[0].trim();if(!extensions[type])return result(415,'Use a photo, PDF, plain-text, DOCX, XLSX or PPTX file.');
 let name,bytes;try{name=fileName(request,type);}catch{return result(422,'Choose a file with the correct extension.');}
 if(!await rateLimit(env,'walk-upload:'+registration,now,900000,40)||!await rateLimit(env,'walk-upload-global',now,86400000,1000))return result(429,'Please pause before uploading more files. You can still type.');
 try{bytes=await readFileBytes(request);validateBytes(bytes,type);}catch(error){return result(error.status||422,error.status===413?error.message:'Choose a valid photo, PDF, plain-text, DOCX, XLSX or PPTX file.');}
 await run(env,'INSERT OR IGNORE INTO solborne_ai_walks(registration_id,state_json,created_at,updated_at) VALUES(?,?,?,?)',[registration,JSON.stringify({messages:[],facts:{},businessBrief:{},ready:false}),now,now]);
 const row=await first(env,'SELECT * FROM solborne_ai_walks WHERE registration_id=?',[registration]),state=JSON.parse(row.state_json);
 if(row.revision!==revision||row.busy_until>now||state.pendingAnswer||state.submission)return result(409,'Your Walk changed, is processing or is already submitted. Refresh before uploading.');
 const library=state.fileLibrary||[];if(library.length>=MAX_PROJECT_FILES||library.reduce((n,f)=>n+f.size,0)+bytes.length>MAX_PROJECT_BYTES)return result(422,'This Walk has reached its file allowance. Contact Solborne to share more.');
 const lease=now+120000,claim=await run(env,'UPDATE solborne_ai_walks SET busy_until=? WHERE registration_id=? AND revision=? AND busy_until<=?',[lease,registration,revision,now]);if(!(claim.meta?.changes>=1))return result(409,'Your Walk changed. Refresh before uploading.');
 const id=crypto.randomUUID(),key=registration+'/'+id;let committed=false,attempted=false;
 try{
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  attempted=true;const object=await storage.put(key,bytes,{httpMetadata:{contentType:type},customMetadata:{registrationId:registration,sha256:hash}});if(!object)throw Error('Upload unavailable');
  const file={id,name,type,size:bytes.length,key,url:'/api/ai-walk/files/'+id,sha256:hash},next={...state,fileLibrary:[...library,file]};
  const saved=await run(env,'UPDATE solborne_ai_walks SET state_json=?,revision=revision+1,busy_until=0,updated_at=? WHERE registration_id=? AND revision=? AND busy_until=?',[JSON.stringify(next),now,registration,revision,lease]);
  if(!(saved.meta?.changes>=1))return result(409,'Your Walk changed. The file was not attached; please try again.');committed=true;return {status:201,body:{ok:true,file:metadata(file),state:next,revision:revision+1}};
 }catch{return result(502,'We could not confirm the upload. Refresh your Walk before trying again.');}
 finally{try{if(!committed&&attempted){let unreferenced=false;try{const current=await first(env,'SELECT state_json FROM solborne_ai_walks WHERE registration_id=?',[registration]);unreferenced=!current||!(JSON.parse(current.state_json).fileLibrary||[]).some(file=>file.id===id&&file.key===key);}catch{console.error('WALK_FILE_COMMIT_UNCERTAIN');}if(unreferenced)await storage.delete(key);}}catch{console.error('WALK_FILE_CLEANUP_FAILED');}finally{await run(env,'UPDATE solborne_ai_walks SET busy_until=0 WHERE registration_id=? AND busy_until=?',[registration,lease]);}}
}
export async function downloadWalkFile(env,registration,id){
 if(!uuid.test(id))return new Response(null,{status:404});const row=await first(env,'SELECT state_json FROM solborne_ai_walks WHERE registration_id=?',[registration]);const file=row&&(JSON.parse(row.state_json).fileLibrary||[]).find(file=>file.id===id&&file.key===registration+'/'+id);if(!file)return new Response(null,{status:404,headers:{'Cache-Control':'no-store, private'}});
 const storage=storageFor(env);if(!storage)return new Response(null,{status:503,headers:{'Cache-Control':'no-store, private'}});const object=await storage.get(file.key);if(!object)return new Response(null,{status:404,headers:{'Cache-Control':'no-store, private'}});
 const fallback=file.name.replace(/[^a-zA-Z0-9._ -]/g,'_');return new Response(object.body,{headers:{'Content-Type':file.type,'Content-Length':String(file.size),'Content-Disposition':`attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,'Cache-Control':'no-store, private','Pragma':'no-cache','Vary':'Cookie','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Referrer-Policy':'no-referrer'}});
}

export async function resetWalkWithFiles(env,registration,now){
 const row=await first(env,'SELECT * FROM solborne_ai_walks WHERE registration_id=?',[registration]);if(!row)return {status:200,body:{ok:true,deleted:true,filesDeleted:true}};
 if(row.busy_until>now)return result(409,'Wait for the current operation before deleting this conversation.');
 const state=JSON.parse(row.state_json),keys=[...new Set((state.fileLibrary||[]).filter(file=>uuid.test(file.id||'')&&file.key===registration+'/'+file.id).map(file=>file.key))].slice(0,MAX_PROJECT_FILES);
 const storage=storageFor(env);
 if(keys.length&&!storage)return result(503,'Files could not be removed yet. Your saved Walk has not been reset. Try again shortly.');
 const lease=now+120000,claim=await run(env,'UPDATE solborne_ai_walks SET busy_until=? WHERE registration_id=? AND revision=? AND busy_until<=?',[lease,registration,row.revision,now]);if(!(claim.meta?.changes>=1))return result(409,'Your Walk changed. Refresh before deleting.');
 try{
  if(keys.length)await storage.delete(keys);
  const deleted=await run(env,'DELETE FROM solborne_ai_walks WHERE registration_id=? AND revision=? AND busy_until=?',[registration,row.revision,lease]);
  if(!(deleted.meta?.changes>=1))return result(409,'Some files may have been removed, but your Walk changed before reset. Refresh and retry.');
  return {status:200,body:{ok:true,deleted:true,filesDeleted:true}};
 }catch{console.error('WALK_FILE_RESET_INCOMPLETE');return result(502,'Reset is incomplete. Some files may have been removed; your conversation is still saved. Please retry or contact Solborne.');}
 finally{await run(env,'UPDATE solborne_ai_walks SET busy_until=0 WHERE registration_id=? AND busy_until=?',[registration,lease]);}
}
