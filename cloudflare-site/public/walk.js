import {createWebsiteFiles,validateWebsiteInterview,websiteFields} from '/website-renderer.js';
const $=id=>document.getElementById(id);
let accountRecovery=null;
const accountRecoveryReady=typeof window!=='undefined'&&typeof window.solborneSession==='function'
  ? Promise.resolve().then(()=>window.solborneSession()).then(session=>{
      accountRecovery=session;
      if(session?.enabled){const link=$('walk-register-link');link.href=session.authenticated?'/canvas.html':'/signin.html';link.textContent=session.authenticated?'Choose your saved business brief':'Sign in to reopen your saved brief';}
    }).catch(()=>{ /* Keep the existing recovery available if account status cannot be checked. */ })
  : Promise.resolve();
function recoveryCopy(legacy){return accountRecovery?.enabled?'Sign in with the same Google account, then choose your saved business brief from Your canvas. Keep any files already downloaded.':legacy;}

const form=$('walk-form'),fields=$('walk-fields'),message=$('walk-message'),previewBox=$('walk-preview-box'),frame=$('walk-preview-frame'),approval=$('walk-approved'),submit=$('walk-submit'),refresh=$('walk-refresh');
const stageNames=['Sign in','Introduction','Your story','Your details','Preview','Review'];
const fieldLabels={businessName:'your business name',description:'your business introduction',audience:'who you work with',services:'your offer and services',callToAction:'the next step for visitors',location:'where you work',email:'your public business email',phone:'your public business phone',websiteUrl:'your public business link',contact:'a public contact option'};
const completionPattern=/^SW-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
let csrf='',busy=false,reviewed=false,stage=3,prepareGeneration=0;
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
let idempotencyKey=key(),attemptFacts=null;
function facts(){return Object.fromEntries(Object.keys(websiteFields).map(k=>[k,form.elements[k].value]));}
function say(text,error=false){message.textContent=text;message.setAttribute('role',error?'alert':'status');}
function focusHere(element,block='center'){element.focus({preventScroll:true});element.scrollIntoView?.({block,behavior:'instant'});}
function setStage(next){
  stage=next;
  for(const n of [3,4,5])$('walk-stage-'+n).hidden=n!==next;
  for(let n=1;n<=6;n++)$('walk-progress-'+n).setAttribute('aria-current',n===next?'step':'false');
  $('walk-step-status').textContent=`Step ${next} of 6 — ${stageNames[next-1]}`;
}
function goToStage(next){setStage(next);focusHere($('walk-heading-'+next));}
function setTab(tab){
  for(const name of ['questions','canvas']){const active=name===tab;$(name+'-panel').hidden=!active;$('tab-'+name).setAttribute('aria-selected',String(active));$('tab-'+name).setAttribute('tabindex',active?'0':'-1');}
}
function fieldError(name,text=''){
  const field=form.elements[name],error=$(name+'-error');
  if(field)field.setAttribute('aria-invalid',String(Boolean(text)));
  if(error){error.textContent=text;error.hidden=!text;}
}
function clearErrors(){for(const name of [...Object.keys(websiteFields),'contact',...Array.from({length:5},(_,i)=>'story'+i)])fieldError(name);}
function updateMissing(){
  const result=validateWebsiteInterview(facts()),count=result.ok?0:Object.keys(result.errors).length;
  $('canvas-missing').textContent=count?`${count} website detail${count===1?'':'s'} to check`:'Website details ready to review';
  $('canvas-missing').className='provenance '+(count?'missing':'from-you');
}
function invalidate(){reviewed=false;approval.checked=false;submit.disabled=true;previewBox.hidden=true;frame.removeAttribute('srcdoc');updateMissing();}
function validStory(){
  let first=null;
  for(let i=0;i<5;i++){
    const name='story'+i,field=form.elements[name],missing=!field.value.trim();
    fieldError(name,missing?(i===0?'Tell your business story in a few words.':'Answer this prompt, or choose “already covered” if your business story covers it.'):'');
    if(missing&&!first)first=field;
  }
  if(first){setStage(3);setTab('questions');focusHere(first);say('Finish the story prompts before reviewing your website. Follow-ups can be marked as already covered.',true);return false;}
  return true;
}
function validBrief(){
  clearErrors();if(!validStory())return null;
  const checked=validateWebsiteInterview(facts());
  if(!checked.ok){
    setStage(3);setTab('canvas');updateMissing();
    for(const [name,error] of Object.entries(checked.errors))fieldError(name,error==='Please answer this question.'?`Enter ${fieldLabels[name]}.`:error);
    const first=Object.keys(checked.errors)[0];focusHere(form.elements[first]||form.elements.email);
    say(`Check ${fieldLabels[first]||'your website details'} before continuing. Your answers are still here.`,true);return null;
  }
  return checked.value;
}
function reviewFacts(){
  if(busy)return;const value=validBrief();if(!value)return;
  for(const name of Object.keys(websiteFields)){const present=Boolean(value[name]);$('fact-'+name).textContent=present?value[name]:'Not included';$('badge-'+name).textContent=present?'From you':'Omitted · optional';$('badge-'+name).className='provenance '+(present?'from-you':'missing');}
  goToStage(4);say('Read the website copy and contact details, then open the preview. Your private registration details are excluded.');
}
function previewWidth(view){
  $('walk-preview-shell').setAttribute('data-view',view);
  for(const name of ['wide','phone'])$('preview-'+name).setAttribute('aria-pressed',String(name===view));
}
function forgetCompletion(){try{history.replaceState(null,'');}catch{}}
function completionInHistory(){
  const completion=history.state?.solborneWalkCompletion;
  if(completion===undefined)return '';
  if(typeof completion!=='string'||!completionPattern.test(completion)){forgetCompletion();return '';}
  return completion;
}
function requestStatus(data){
  if(!data||!completionPattern.test(data.completion)||!['pending','released'].includes(data.deliveryState)||!['pending','reviewing','reviewed'].includes(data.reviewState))throw new Error('Your saved request status could not be confirmed.');
  const paths=[`/downloads/website/${data.completion}/index.html`,`/downloads/website/${data.completion}/README.txt`];
  if(!Array.isArray(data.downloads)||(data.deliveryState==='pending'?data.downloads.length!==0:data.downloads.length!==2||data.downloads.some((path,i)=>path!==paths[i])))throw new Error('Your saved request file availability could not be confirmed.');
  if(data.deliveryState==='released'&&!['grandfathered','reviewed'].includes(data.releaseBasis))throw new Error('Your file availability could not be confirmed.');
  return data;
}
function showReceipt(input){
  const data=requestStatus(input),completion=data.completion,released=data.deliveryState==='released';
  form.hidden=true;const receipt=$('walk-receipt');receipt.hidden=false;
  $('walk-completion').textContent='Saved request reference: '+completion;
  $('walk-receipt-title').textContent=released?'Your website files are available.':'Your website brief is saved.';
  $('walk-request-state').textContent=released?(data.releaseBasis==='grandfathered'?'Files available from an earlier completion':'Files released'):'With our team';
  $('walk-review-state').textContent=released?(data.releaseBasis==='reviewed'?'Solborne review complete':'Earlier files remain available; this status does not confirm a team review'):data.reviewState==='reviewing'?'Being reviewed':data.reviewState==='reviewed'?'Reviewed. Awaiting release.':'Waiting for review';
  $('walk-receipt-note').textContent=released?'Download both files below and keep them together. Opening the HTML on your device does not publish a website.':'Your approved public website facts have been recorded for Solborne processing and review. Files become available here after release. Use Refresh request status to check progress.';
  for(const id of ['walk-html','walk-readme'])$(id).removeAttribute('href');
  $('walk-delivery-files').hidden=!released;$('walk-handover-next').hidden=!released;
  if(released){$('walk-html').href=data.downloads[0];$('walk-readme').href=data.downloads[1];}
  $('walk-versions').href='/versions.html?version='+encodeURIComponent(completion);
  $('walk-access').textContent='Your registration is saved. '+(released?'Your released files are available.':'Your website request is recorded.');$('walk-register-link').hidden=true;$('walk-canvas-links').hidden=false;
  setStage(6);say(released?'Your website files are available. Download the HTML and README to keep them.':'Your brief is saved and pending Solborne processing. Use Refresh request status to check its progress.');focusHere(receipt,'start');
}
async function restoreReceipt(completion,generation){
  try{
    const response=await fetch('/api/walk/versions/'+completion,{credentials:'same-origin',cache:'no-store',redirect:'error'}),data=await response.json();
    if(generation!==prepareGeneration)return 'stale';
    if(response.ok&&data.ok&&data.version?.completion===completion){showReceipt(data.version);return 'restored';}
    if(response.status===403){await accountRecoveryReady;$('walk-register-link').hidden=false;$('walk-receipt').hidden=true;for(const id of ['walk-html','walk-readme'])$(id).removeAttribute('href');say(recoveryCopy('Registration access has expired. Recover your saved registration, then refresh this request.'),true);refresh.hidden=false;return 'retry';}
    if(response.status===404){forgetCompletion();return 'denied';}
  }catch{if(generation!==prepareGeneration)return 'stale';}
  $('walk-access').textContent='Your saved request status could not be checked yet.';
  say('Your saved request could not be checked right now. Use Refresh form connection to retry. No new Walk has been submitted.',true);refresh.hidden=false;return 'retry';
}
async function prepare(){
  if(busy)return;const generation=++prepareGeneration;fields.disabled=true;refresh.hidden=true;
  try{
    const check=await fetch('/api/access/status',{credentials:'same-origin',cache:'no-store'});if(generation!==prepareGeneration)return;
    if(check.status===403){await accountRecoveryReady;form.hidden=false;$('walk-receipt').hidden=true;for(const id of ['walk-html','walk-readme'])$(id).removeAttribute('href');setStage(1);throw new Error(recoveryCopy('Registration access is unavailable. Recover your saved registration using its receipt, or save basic details for a new Walk.'));}
    if(!check.ok)throw new Error('Registration access could not be checked. Please retry.');
    let previousUnavailable=false;
    const completion=completionInHistory();
    if(completion){
      $('walk-access').textContent='Your registration is saved. Checking your saved request.';
      const restored=await restoreReceipt(completion,generation);
      if(restored!=='denied')return;
      previousUnavailable=true;form.hidden=false;$('walk-receipt').hidden=true;
    }
    const r=await fetch('/api/registration-session',{credentials:'same-origin',cache:'no-store'}),data=await r.json();if(generation!==prepareGeneration)return;
    if(!r.ok||!data.ok)throw new Error(data.error||'The form is unavailable.');
    csrf=data.csrf;fields.disabled=false;$('walk-canvas-links').hidden=false;$('walk-register-link').hidden=true;$('walk-access').textContent='Your registration is saved. Your canvas and Walk are open.';
    setStage(stage>=3&&stage<=5?stage:3);updateMissing();say(previousUnavailable?'The previous request is unavailable for this registration. Start with your story to complete a new Walk.':'Start with your story, then choose the website copy. Keep this page open until you finish.');
  }catch(e){if(generation!==prepareGeneration)return;csrf='';$('walk-access').textContent=e.message;$('walk-register-link').hidden=false;$('walk-canvas-links').hidden=true;refresh.hidden=false;}
}
refresh.addEventListener('click',prepare);
$('walk-status-refresh').addEventListener('click',prepare);
for(const tab of ['questions','canvas']){
  $('tab-'+tab).addEventListener('click',()=>{if(!busy)setTab(tab);});
  $('tab-'+tab).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'questions':event.key==='End'?'canvas':tab==='canvas'?'questions':'canvas';setTab(next);$('tab-'+next).focus();}});
}
$('questions-continue').addEventListener('click',()=>{if(busy||!validStory())return;setTab('canvas');focusHere($('canvas-heading'));say('Choose the words and contact details visitors will see. Your story has not been copied automatically.');});
$('canvas-back').addEventListener('click',()=>{if(!busy){setTab('questions');focusHere($('tab-questions'));}});
$('use-story').addEventListener('click',()=>{
  if(busy)return;
  if(!form.elements.story0.value.trim()){setTab('questions');fieldError('story0','Tell your business story before copying it.');focusHere(form.elements.story0);say('Tell your business story first.',true);return;}
  form.elements.description.value=form.elements.story0.value.slice(0,3000);fieldError('description');invalidate();say('Your first story answer was copied unchanged into the introduction. Edit it for your visitors before reviewing.');
});
for(let i=1;i<5;i++)$('story'+i+'-covered').addEventListener('click',()=>{if(busy)return;if(!form.elements.story0.value.trim()){focusHere(form.elements.story0);fieldError('story0','Tell your business story before marking a follow-up as covered.');say('Tell your business story first.',true);return;}form.elements['story'+i].value='Covered in my business story.';fieldError('story'+i);invalidate();});
$('walk-review').addEventListener('click',reviewFacts);
for(const id of ['walk-edit','review-edit'])$(id).addEventListener('click',()=>{if(!busy){invalidate();setStage(3);setTab('canvas');focusHere($('canvas-heading'));say('Edit your website copy, then review and approve the new preview.');}});
for(const view of ['wide','phone'])$('preview-'+view).addEventListener('click',()=>previewWidth(view));
form.addEventListener('input',event=>{
  if(event.target===approval){submit.disabled=!approval.checked||!reviewed;return;}
  if(event.target.name){fieldError(event.target.name);if(['email','phone','websiteUrl'].includes(event.target.name))fieldError('contact');}
  invalidate();
});
$('walk-preview').addEventListener('click',()=>{
  if(busy)return;const value=validBrief();if(!value)return;
  say('Preparing your website preview.');
  try{frame.srcdoc=createWebsiteFiles(value)[0].content;previewWidth('wide');previewBox.hidden=false;reviewed=true;approval.checked=false;submit.disabled=true;goToStage(5);say('Draft preview ready. Check the full page and approve the public facts to submit your brief for Solborne processing.');}
  catch{invalidate();goToStage(4);say('The preview could not be prepared. Your answers are still here; try again.',true);}
});
form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy||!reviewed||!approval.checked||!csrf)return;
  const validated=validateWebsiteInterview(facts());if(!validated.ok){say(Object.values(validated.errors).join(' '),true);return;}
  const serialized=JSON.stringify(validated.value);if(attemptFacts!==null&&attemptFacts!==serialized)idempotencyKey=key();attemptFacts=serialized;
  busy=true;fields.disabled=true;refresh.hidden=true;submit.textContent='Saving your approved brief...';say('Saving your approved public facts for Solborne processing and review.');
  const payload={csrf,idempotencyKey,answers:Array.from({length:5},(_,i)=>form.elements['story'+i].value),facts:validated.value,ownerApproved:true};
  try{
    const r=await fetch('/api/walk/complete',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json();
    if(!r.ok||!data.ok){if(data.code==='session_expired')refresh.hidden=false;if(data.code==='registration_required'){await accountRecoveryReady;$('walk-register-link').hidden=false;throw new Error(recoveryCopy(data.error||'Your registration access needs to be restored.'));}throw new Error(data.error||'Your completion could not be confirmed.');}
    const receipt=requestStatus(data);
    try{history.replaceState({solborneWalkCompletion:receipt.completion},'');}catch{}
    showReceipt(receipt);
  }catch(err){say(err.message+' Your answers are still here. Retrying the same facts will not create another completion.',true);}
  finally{busy=false;fields.disabled=false;submit.textContent='Send for review';}
});
try{
  if(typeof sessionStorage!=='undefined'&&typeof location!=='undefined'&&new URL(location.href).searchParams.get('from')==='ai'){
    const raw=sessionStorage.getItem('solborne-ai-facts');sessionStorage.removeItem('solborne-ai-facts');
    const handoff=raw?JSON.parse(raw):null;
    if(handoff&&Number.isFinite(handoff.savedAt)&&Date.now()-handoff.savedAt>=0&&Date.now()-handoff.savedAt<3600000&&handoff.facts&&typeof handoff.facts==='object'){
      for(const name of Object.keys(websiteFields)){const value=handoff.facts[name];if(typeof value==='string'&&value.length<=websiteFields[name])form.elements[name].value=value;}
      const story=[handoff.facts.description,handoff.facts.brandDirection,handoff.facts.audience,handoff.facts.proofAndPermissions,handoff.facts.callToAction];
      for(let i=0;i<5;i++)form.elements['story'+i].value=typeof story[i]==='string'&&story[i]?story[i]:'Already covered in my AI-guided business brief.';
      updateMissing();setTab('canvas');
    }
  }
}catch{/* A failed handoff never blocks the existing editor. */}
prepare();
