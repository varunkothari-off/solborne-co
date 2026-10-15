import {createWebsiteFiles,validateWebsiteInterview,websiteFields} from '/website-renderer.js';
const $=id=>document.getElementById(id);
const form=$('versions-form'),fields=$('versions-fields'),select=$('versions-select'),approval=$('versions-approved');
const completionPattern=/^SW-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const labels={businessName:'Business name',description:'Business introduction',audience:'Who you work with',services:'Your offer and services',location:'Where you work',callToAction:'Visitor next step',email:'Public business email',phone:'Public business phone',websiteUrl:'Public business link',contact:'Public contact option'};
let versions=[],selected=null,mode='browse',loading=false,hasMore=null,nextCursor='',readGeneration=0,csrf='',reviewed=false,conflicted=false,ownershipLost=false,lastAttempt=null,pendingAttempt=null,navigation=null,savedCompletion='';
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const facts=()=>Object.fromEntries(Object.keys(websiteFields).map(name=>[name,form.elements[name].value]));
function say(text,error=false){$('versions-message').textContent=text;$('versions-message').setAttribute('role',error?'alert':'status');}
function focus(element,block='center'){element.focus({preventScroll:true});element.scrollIntoView?.({block,behavior:'instant'});}
function editing(){return ['edit','review','preview','saving','pending'].includes(mode);}
function dirty(){return selected&&editing()&&JSON.stringify(facts())!==JSON.stringify(selected.facts);}
function setMode(next){
  mode=next;const locked=['saving','pending'].includes(mode);
  form.hidden=!editing();fields.disabled=locked;
  $('versions-inputs').hidden=mode!=='edit';$('versions-facts-review').hidden=mode!=='review';$('versions-draft').hidden=!['preview','saving','pending'].includes(mode);
  $('versions-retry').hidden=mode!=='pending';$('versions-retry').disabled=mode==='saving';
  select.disabled=loading||locked;$('versions-refresh').disabled=loading||editing();
  $('versions-older').disabled=loading||locked;$('versions-older').hidden=hasMore!==true;
  $('versions-edit').disabled=loading||editing()||ownershipLost||!selected?.meta.isLatest;
  $('versions-latest').disabled=loading||locked;$('versions-conflict-latest').disabled=locked;
  $('versions-save').disabled=loading||locked||!reviewed||!approval.checked||conflicted||ownershipLost||!csrf;
  $('versions-save').textContent=mode==='saving'?'Saving your revision brief...':'Submit my revision brief';
  $('versions-draft-state').textContent=mode==='pending'?'3 / SAVE RESULT UNCONFIRMED':mode==='saving'?'3 / SAVING APPROVED PREVIEW':'3 / UNSAVED REVISION PREVIEW';
  $('versions-draft-note').textContent=mode==='pending'?'This is the local draft for a save whose result is unconfirmed. No saved processing status has been confirmed yet. Retry the same save; any earlier released files remain separate.':mode==='saving'?'This local draft is being submitted. Wait for its saved request receipt before treating the brief as recorded. Any earlier released files remain separate.':'This local draft uses your edited website facts. It has not been submitted, delivered or published. Any earlier released files remain separate.';
}
function metadata(input){
  if(!input||typeof input!=='object'||!completionPattern.test(input.completion)||typeof input.project!=='string'||input.project.length>160||!Number.isSafeInteger(input.version)||input.version<1||typeof input.isLatest!=='boolean'||!(input.parentCompletion===null||completionPattern.test(input.parentCompletion)))throw new Error('Saved version details could not be confirmed.');
  const downloads=[`/downloads/website/${input.completion}/index.html`,`/downloads/website/${input.completion}/README.txt`];
  if(!['pending','released'].includes(input.deliveryState)||!['pending','reviewing','reviewed'].includes(input.reviewState))throw new Error('The saved request status could not be confirmed.');
  if(!Array.isArray(input.downloads)||(input.deliveryState==='pending'?input.downloads.length!==0:input.downloads.length!==2||input.downloads.some((path,i)=>path!==downloads[i])))throw new Error('Saved file availability could not be confirmed.');
  if(input.deliveryState==='released'&&!['grandfathered','reviewed'].includes(input.releaseBasis))throw new Error('File release details could not be confirmed.');
  return {...input,downloads:input.deliveryState==='released'?downloads:[]};
}
function deliveryLabel(meta){return meta.deliveryState==='released'?(meta.releaseBasis==='grandfathered'?'Files available from an earlier completion':'Files released'):'Pending Solborne processing';}
function reviewLabel(meta){return meta.deliveryState==='released'?(meta.releaseBasis==='reviewed'?'Solborne review complete':'Earlier file access preserved; this does not confirm a team review'):meta.reviewState==='reviewing'?'Solborne review in progress':meta.reviewState==='reviewed'?'Review complete; awaiting file release':'Awaiting Solborne review';}
function renderFacts(container,value){
  container.replaceChildren();
  for(const name of Object.keys(websiteFields)){
    const item=document.createElement('div');item.className='review-fact';const label=document.createElement('dt'),text=document.createElement('dd');label.textContent=labels[name];text.textContent=value[name]||'Not included';item.append(label,text);container.append(item);
  }
}
function dateLabel(value){const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Date unavailable';}
function versionPage(data){
  if(!Array.isArray(data.versions)||typeof data.hasMore!=='boolean'||(data.hasMore&&!completionPattern.test(data.nextCursor)))throw new Error('The saved version page could not be confirmed.');
  return {versions:data.versions.map(metadata),hasMore:data.hasMore,nextCursor:data.hasMore?data.nextCursor:''};
}
function pageNote(){
  $('versions-page-note').textContent=hasMore?`${versions.length} saved versions loaded. Older versions are available below.`:`${versions.length} saved version${versions.length===1?'':'s'} loaded. This list has reached its oldest available version.`;
}
function width(kind,view){
  const shell=kind==='saved'?'versions-preview-shell':'versions-draft-shell',prefix=kind==='saved'?'saved-':'revision-view-';
  $(shell).setAttribute('data-view',view);for(const name of ['wide','phone'])$(prefix+name).setAttribute('aria-pressed',String(view===name));
}
function links(htmlId,readmeId,completion){$(htmlId).href=`/downloads/website/${completion}/index.html`;$(readmeId).href=`/downloads/website/${completion}/README.txt`;}
function accessLost(){ownershipLost=true;csrf='';$('versions-register').hidden=false;$('versions-refresh-session').hidden=true;}
function fillPicker(){
  select.replaceChildren();const groups=new Map();
  for(const version of versions){if(!groups.has(version.project))groups.set(version.project,[]);groups.get(version.project).push(version);}
  let number=0;
  for(const groupVersions of groups.values()){
    const group=document.createElement('optgroup');group.label=`Website ${++number}`;
    for(const version of groupVersions.sort((a,b)=>b.version-a.version)){
      const option=document.createElement('option');option.value=version.completion;option.textContent=`Version ${version.version} - ${dateLabel(version.createdAt)}${version.isLatest?' - latest':''} - ${version.deliveryState==='released'?'files available':'processing'}`;group.append(option);
    }
    select.append(group);
  }
}
async function jsonRead(path){
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',redirect:'error'}),data=await response.json();
  if(!response.ok||!data.ok){if(response.status===403)accessLost();throw new Error(response.status===403?'This browser no longer has access to these saved versions. Use your private registration retry receipt and re-enter the original details to recover access. Keep any files already downloaded.':data.error||'Saved versions are temporarily unavailable.');}
  return data;
}
async function openVersion(completion){
  if(!completionPattern.test(completion))return;const generation=++readGeneration;loading=true;setMode('browse');
  say('Loading the selected saved version.');
  try{
    const data=await jsonRead('/api/walk/versions/'+completion);if(generation!==readGeneration)return;
    const meta=metadata(data.version),checked=validateWebsiteInterview(data.facts);
    if(meta.completion!==completion||!checked.ok)throw new Error('The saved public website facts could not be confirmed.');
    const released=meta.deliveryState==='released';let html='';
    if(released){
      const file=await fetch(meta.downloads[0],{credentials:'same-origin',cache:'no-store',redirect:'error'});if(generation!==readGeneration)return;
      if(file.status===403){accessLost();throw new Error('This browser no longer has access to the selected saved files. Recover your saved registration, then refresh. Keep any files already downloaded.');}
      if(file.status!==200||!file.headers.get('content-type')?.startsWith('text/html'))throw new Error('The selected released website preview could not be loaded.');
      html=await file.text();if(generation!==readGeneration)return;
    }
    selected={meta,facts:checked.value};
    const listed=versions.findIndex(item=>item.completion===completion);if(listed<0)versions.push(meta);else versions[listed]=meta;
    fillPicker();pageNote();select.value=completion;
    $('versions-title').textContent=`${checked.value.businessName} - version ${meta.version}`;
    $('versions-meta').textContent=`Saved ${dateLabel(meta.createdAt)}. Reference: ${meta.completion}`;
    $('versions-delivery-status').textContent=deliveryLabel(meta);$('versions-review-status').textContent=reviewLabel(meta);
    $('versions-source-note').textContent=!released?'These are the public facts you approved and saved. No delivered website preview or file download is available until this version is released. Refresh saved versions to check its status.':meta.sourceMode==='saved-files'?'This released version has its saved website source files. Download the HTML and README for this exact version.':meta.sourceMode==='legacy-rendered'?'This earlier completion generates its available files from the approved public facts saved at completion. Its files may change if the website renderer changes. Newly saved revisions preserve their source files.':'Download this selected released version to check its website source and handover notes.';
    $('versions-latest-status').textContent=meta.isLatest?'Latest version':'Earlier saved version';$('versions-latest-status').className='provenance '+(meta.isLatest?'confirmed':'from-you');
    $('versions-saved-preview').removeAttribute('srcdoc');for(const id of ['versions-html','versions-readme'])$(id).removeAttribute('href');
    $('versions-released-preview').hidden=!released;$('versions-downloads').hidden=!released;$('versions-file-notes').hidden=!released;$('versions-approved-facts-section').hidden=released;
    if(released){$('versions-saved-preview').srcdoc=html;width('saved','wide');links('versions-html','versions-readme',completion);}
    else renderFacts($('versions-approved-facts'),checked.value);
    $('versions-latest').hidden=meta.isLatest;$('versions-summary').hidden=false;$('versions-receipt').hidden=true;$('versions-conflict').hidden=true;$('versions-register').hidden=true;
    conflicted=false;ownershipLost=false;lastAttempt=null;pendingAttempt=null;approval.checked=false;reviewed=false;savedCompletion='';
    say(released?(meta.isLatest?'Released files available. Download them, or revise the public website copy.':'Earlier files available. Open the latest version of this website to revise it.'):'Your approved brief is saved. '+reviewLabel(meta)+'. Use Refresh saved versions to check for file release.');
    focus($('versions-title'),'start');
  }catch(error){if(generation===readGeneration){if(selected)select.value=selected.meta.completion;say(error.message+' Use Refresh saved versions to retry.',true);}}
  finally{if(generation===readGeneration){loading=false;setMode('browse');}}
}
async function loadVersions(preferred='',project=''){
  const knownLatest=versions.find(item=>item.project===project&&item.isLatest),previousSelection=selected?.meta;
  loading=true;setMode('browse');say('Loading your saved versions.');
  try{
    const page=versionPage(await jsonRead('/api/walk/versions'));
    versions=page.versions;hasMore=page.hasMore;nextCursor=page.nextCursor;fillPicker();pageNote();$('versions-library').hidden=!versions.length;$('versions-empty').hidden=Boolean(versions.length);
    if(!versions.length){selected=null;$('versions-summary').hidden=true;say('There are no saved website versions for this registration yet.');return;}
    let completion=completionPattern.test(preferred)?preferred:'';
    if(!completion&&project){
      completion=(versions.find(item=>item.project===project&&item.isLatest)||knownLatest)?.completion||'';
      if(!completion){
        if(previousSelection&&!versions.some(item=>item.completion===previousSelection.completion)){versions.push(previousSelection);fillPicker();pageNote();}
        if(previousSelection)select.value=previousSelection.completion;
        say('The latest version of this website is not in the loaded history page yet. Load older versions to find it; your selected saved preview remains here.');return;
      }
    }
    if(!completion)completion=(versions.find(item=>item.isLatest)||versions[0]).completion;
    await openVersion(completion);
  }catch(error){say(error.message+' Use Refresh saved versions to retry loading.',true);}
  finally{loading=false;setMode('browse');}
}
async function loadOlder(){
  if(loading||['pending','saving'].includes(mode)||!hasMore||!completionPattern.test(nextCursor))return;
  const cursor=nextCursor,selection=selected?.meta.completion||select.value;loading=true;setMode(mode);say('Loading older saved versions. Your current selection and edits will stay here.');
  try{
    const page=versionPage(await jsonRead('/api/walk/versions?before='+encodeURIComponent(cursor)));
    if(page.hasMore&&page.nextCursor===cursor)throw new Error('The older-version page did not advance.');
    const known=new Set(versions.map(item=>item.completion));for(const version of page.versions)if(!known.has(version.completion)){known.add(version.completion);versions.push(version);}
    hasMore=page.hasMore;nextCursor=page.nextCursor;fillPicker();select.value=selection;pageNote();
    say(hasMore?'Older versions added. You can load another page, or keep your current selection.':'Older versions added. The list has reached its oldest available version.');
  }catch(error){say(error.message+' Your current selection and edits remain here. Use Load older versions to retry.',true);}
  finally{loading=false;setMode(mode);}
}
function fieldError(name,text=''){const field=form.elements[name],error=$(name+'-error');if(field)field.setAttribute('aria-invalid',String(Boolean(text)));if(error){error.textContent=text;error.hidden=!text;}}
function validate(){
  for(const name of [...Object.keys(websiteFields),'contact'])fieldError(name);
  const checked=validateWebsiteInterview(facts());
  if(!checked.ok){
    setMode('edit');for(const [name,error] of Object.entries(checked.errors))fieldError(name,error==='Please answer this question.'?`Enter ${labels[name]?.toLowerCase()||'this detail'}.`:error);
    focus(form.elements[Object.keys(checked.errors)[0]]||form.elements.email);say('Check the highlighted public website details before continuing.',true);return null;
  }
  return checked.value;
}
function invalidateDraft(){reviewed=false;approval.checked=false;$('versions-draft-preview').removeAttribute('srcdoc');setMode('edit');}
function leaveEditor(){invalidateDraft();csrf='';lastAttempt=null;conflicted=false;$('versions-refresh-session').hidden=true;$('versions-unsaved').hidden=true;$('versions-conflict').hidden=true;setMode('browse');}
function requestNavigation(action){
  if(['pending','saving'].includes(mode)){say('Resolve the pending save with Retry the same save before starting another revision.',true);return;}
  if(dirty()){
    navigation=action;$('versions-unsaved').hidden=false;$('versions-unsaved-message').textContent='Continuing would discard the unsaved edits on this page. Any earlier released files remain separate.';
    if(selected)select.value=selected.meta.completion;focus($('versions-keep-editing'));return;
  }
  leaveEditor();action();
}
async function connectEditing(){
  const access=await fetch('/api/access/status',{credentials:'same-origin',cache:'no-store',redirect:'error'});
  if(access.status===403){accessLost();const error=new Error('This browser no longer has registration access to revise the saved website. Keep any files already downloaded; recover your original registration with its private retry receipt and original details before returning here.');error.code='registration_required';throw error;}
  if(access.status!==200)throw new Error('Registration access could not be checked right now.');
  const response=await fetch('/api/registration-session',{credentials:'same-origin',cache:'no-store',redirect:'error'}),data=await response.json();
  if(!response.ok||!data.ok||typeof data.csrf!=='string')throw new Error(data.error||'Editing is unavailable right now.');
  csrf=data.csrf;$('versions-refresh-session').hidden=true;
}
async function beginEdit(){
  if(!selected?.meta.isLatest||editing()||loading||ownershipLost)return;loading=true;setMode(mode);say('Checking whether revisions are available.');
  try{
    await connectEditing();for(const name of Object.keys(websiteFields))form.elements[name].value=selected.facts[name];
    lastAttempt=null;pendingAttempt=null;conflicted=false;invalidateDraft();$('versions-receipt').hidden=true;$('versions-conflict').hidden=true;
    $('versions-parent').textContent=`Based on saved version ${selected.meta.version}. Saving creates version ${selected.meta.version+1} of this website.`;
    say('Edit the public website facts, then review and approve a fresh preview. Any earlier released files remain separate.');focus($('versions-editor-title'),'start');
  }catch(error){say(error.code==='registration_required'?error.message:error.message+' Your selected saved brief remains here. Previously released files remain separate. Use Revise this latest version to retry when editing is available.',true);}
  finally{loading=false;setMode(mode);}
}
function review(){
  if(mode!=='edit'||conflicted)return;const value=validate();if(!value)return;
  const container=$('revision-facts');container.replaceChildren();
  for(const name of Object.keys(websiteFields)){
    const item=document.createElement('div');item.className='review-fact';const label=document.createElement('dt'),text=document.createElement('dd');label.textContent=labels[name];text.textContent=value[name]||'Not included';item.append(label,text);container.append(item);
  }
  setMode('review');say('Review these edited facts. They have not been saved.');focus($('versions-review-title'),'start');
}
function preview(){
  if(mode!=='review'||conflicted)return;const value=validate();if(!value)return;
  try{$('versions-draft-preview').srcdoc=createWebsiteFiles(value)[0].content;width('draft','wide');reviewed=true;approval.checked=false;setMode('preview');say('Unsaved preview ready. Check the page and approve it before saving.');focus($('versions-draft-title'),'start');}
  catch{invalidateDraft();say('The revision preview could not be prepared. Your edits are still here; review them and retry.',true);}
}
function showSaved(input){
  const data=metadata(input);if(data.parentCompletion!==lastAttempt?.parentCompletion)throw new Error('The saved version receipt could not be confirmed.');
  savedCompletion=data.completion;pendingAttempt=null;reviewed=false;approval.checked=false;
  for(const version of versions)if(version.project===selected.meta.project)version.isLatest=false;
  selected.meta={...selected.meta,isLatest:false};const known=versions.findIndex(version=>version.completion===data.completion);if(known<0)versions.unshift(data);else versions[known]=data;fillPicker();pageNote();select.value=selected.meta.completion;
  $('versions-latest-status').textContent='Earlier saved version';$('versions-latest-status').className='provenance from-you';$('versions-latest').hidden=false;
  setMode('success');$('versions-refresh-session').hidden=true;
  for(const id of ['versions-saved-html','versions-saved-readme'])$(id).removeAttribute('href');
  const released=data.deliveryState==='released';$('versions-receipt-downloads').hidden=!released;
  if(released)links('versions-saved-html','versions-saved-readme',data.completion);
  $('versions-receipt-title').textContent=released?`Version ${data.version} files are available.`:`Version ${data.version} brief is saved.`;$('versions-receipt-reference').textContent='Saved request reference: '+data.completion;
  $('versions-receipt-status').textContent=deliveryLabel(data)+'. '+reviewLabel(data)+'.';
  $('versions-receipt-note').textContent=released?'Download both released files and open the HTML locally. Any earlier released files remain separate.':'Your approved revision brief is recorded for Solborne processing and review. Its files become available after release. Any earlier released files remain separate; view this request to check its status.';
  $('versions-receipt').hidden=false;
  say(released?'Your revision files are available.':'Your revision brief is saved and pending Solborne processing. View this request to check its status.');focus($('versions-receipt'),'start');
}
async function sendAttempt(attempt){
  if(mode==='saving')return;const resolving=mode==='pending';pendingAttempt=attempt;setMode('saving');say('Saving the approved public brief for Solborne processing and review.');
  try{
    const response=await fetch('/api/walk/revisions',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(attempt)}),data=await response.json();
    if(response.ok&&data.ok){showSaved(data);return;}
    if(response.status>=500||response.status===429){setMode('pending');say((data.error||'The save could not be confirmed.')+' Retry the same save before editing or selecting another version. Any earlier released files remain separate.',true);return;}
    if(data.code==='registration_required'){accessLost();if(resolving){setMode('pending');say('The earlier save result is still uncertain, and this browser no longer has registration access to confirm it. Reconnecting the editing form cannot restore ownership. Keep any files already downloaded.',true);return;}}
    if(resolving&&!(response.status===409&&data.code==='revision_conflict')){
      if(data.code==='session_expired'){$('versions-refresh-session').hidden=false;csrf='';}
      setMode('pending');say((data.error||'The earlier save result is still uncertain.')+' The previous save has not been resolved. Retry the same attempt before starting another revision.',true);return;
    }
    pendingAttempt=null;invalidateDraft();
    if(response.status===409&&data.code==='revision_conflict'){
      conflicted=true;$('versions-conflict').hidden=false;say('A newer version already exists. Your edits are still here. Open the latest version before starting another revision.',true);
    }else{
      if(data.code==='session_expired'){csrf='';$('versions-refresh-session').hidden=false;}
      if(response.status===403&&data.code!=='session_expired')csrf='';
      say(data.code==='registration_required'?'This browser no longer has access to revise the saved website. Your public edits are still here, but a new editing session cannot restore ownership. Keep any files already downloaded; recover the original registration with its private retry receipt and matching details.':(data.error||'This revision was not saved.')+' Your edits are still here. Review a fresh preview before retrying.',true);
    }
    setMode(mode);
  }catch{
    setMode('pending');say('The save result is uncertain. Retry the same save to confirm it before editing or selecting another version. Any earlier released files remain separate.',true);
  }
}
form.addEventListener('input',event=>{
  if(event.target===approval){setMode(mode);return;}
  if(['pending','saving'].includes(mode))return;
  if(event.target.name){fieldError(event.target.name);if(['email','phone','websiteUrl'].includes(event.target.name))fieldError('contact');}
  invalidateDraft();
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(loading||mode!=='preview'||!reviewed||!approval.checked||!csrf||conflicted||!selected?.meta.isLatest)return;
  const checked=validateWebsiteInterview(facts());if(!checked.ok){validate();return;}
  const serialized=JSON.stringify(checked.value),previous=lastAttempt;
  lastAttempt={csrf,idempotencyKey:previous&&JSON.stringify(previous.facts)===serialized&&previous.parentCompletion===selected.meta.completion?previous.idempotencyKey:key(),facts:checked.value,ownerApproved:true,parentCompletion:selected.meta.completion};
  await sendAttempt(lastAttempt);
});
select.addEventListener('change',()=>{const completion=select.value;requestNavigation(()=>openVersion(completion));});
$('versions-refresh').addEventListener('click',()=>requestNavigation(()=>loadVersions(savedCompletion||selected?.meta.completion)));
$('versions-older').addEventListener('click',loadOlder);
$('versions-edit').addEventListener('click',beginEdit);
$('versions-review').addEventListener('click',review);$('versions-preview').addEventListener('click',preview);
for(const id of ['versions-review-edit','versions-edit-answers'])$(id).addEventListener('click',()=>{if(['pending','saving'].includes(mode))return;invalidateDraft();focus($('versions-editor-title'),'start');say('Edit your public facts, then review and approve a new preview.');});
$('versions-cancel').addEventListener('click',()=>requestNavigation(()=>{say('Revision cancelled. Your saved version is unchanged.');focus($('versions-title'),'start');}));
$('versions-keep-editing').addEventListener('click',()=>{navigation=null;$('versions-unsaved').hidden=true;focus($(mode==='edit'?'versions-editor-title':mode==='review'?'versions-review-title':'versions-draft-title'),'start');});
$('versions-discard').addEventListener('click',()=>{const action=navigation;navigation=null;leaveEditor();action?.();});
for(const id of ['versions-latest','versions-conflict-latest'])$(id).addEventListener('click',()=>{const project=selected?.meta.project;requestNavigation(()=>loadVersions('',project));});
$('versions-receipt-view').addEventListener('click',()=>requestNavigation(()=>loadVersions(savedCompletion)));
$('versions-retry').addEventListener('click',()=>{if(mode==='pending'&&pendingAttempt)sendAttempt(pendingAttempt);});
$('versions-refresh-session').addEventListener('click',async()=>{
  if(mode==='saving'||ownershipLost)return;
  try{await connectEditing();if(mode==='pending'&&pendingAttempt){pendingAttempt={...pendingAttempt,csrf};lastAttempt=pendingAttempt;say('Form connection refreshed. Retry the same approved save to resolve its result.');}else say('Editing reconnected. Review and approve a fresh preview before saving.');setMode(mode);}
  catch(error){say(error.message+' Your public edits remain on this page.',true);}
});
for(const kind of ['saved','draft'])for(const view of ['wide','phone'])$(kind==='saved'?'saved-'+view:'revision-view-'+view).addEventListener('click',()=>width(kind,view));
window.addEventListener('beforeunload',event=>{if(dirty()||mode==='pending'||mode==='saving'){event.preventDefault();event.returnValue='';}});
const requestedVersion=new URLSearchParams(location.search).get('version');
loadVersions(completionPattern.test(requestedVersion||'')?requestedVersion:'');
