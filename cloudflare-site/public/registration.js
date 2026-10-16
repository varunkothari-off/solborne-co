'use strict';
(()=>{
const form=document.getElementById('pilot-form'), submit=document.getElementById('pilot-submit'), message=document.getElementById('form-message'), retry=document.getElementById('form-retry'), receipt=document.getElementById('registration-receipt');
let csrf='', busy=false, conflict=false;
const newAttempt=document.getElementById('form-new');
const randomKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
let idempotencyKey=randomKey();
const receiptPattern=/^SB-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const recoveryFile=document.getElementById('registration-recovery-file'),recoveryMessage=document.getElementById('registration-recovery-message'),downloadReceipt=document.getElementById('registration-retry-download');
let importedAttempt=null,confirmedReceipt=null,importGeneration=0,recoveryInvalid=false;
function submitLabel(){return importedAttempt?'Recover my saved registration':'Save enquiry and continue';}
function recoverySay(text,error=false){recoveryMessage.textContent=text;recoveryMessage.setAttribute('role',error?'alert':'status');}
function retryReceipt(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==2||!Object.hasOwn(input,'receipt')||!Object.hasOwn(input,'idempotencyKey')||typeof input.receipt!=='string'||!receiptPattern.test(input.receipt)||typeof input.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(input.idempotencyKey))throw new Error('This file is not a valid Solborne registration retry receipt. Choose the private JSON receipt downloaded after your registration was saved.');
  return {receipt:input.receipt,idempotencyKey:input.idempotencyKey};
}
function progress(n){const label=document.getElementById('registration-step-status');if(label)label.textContent=n===2?'Enquiry saved · Continue to the Walk':'Enquiry · Before the Walk';for(let i=1;i<=2;i++){const item=document.getElementById('registration-progress-'+i);if(item)item.setAttribute('aria-current',i===n?'step':'false');}}
function show(text,isError=false){message.textContent=text;message.classList.toggle('error',isError);message.setAttribute('role',isError?'alert':'status');}
async function prepare(){
  submit.disabled=true;retry.hidden=true;show('Preparing the registration form.');
  try{const auth=typeof window!=='undefined'&&window.solborneSession?await window.solborneSession():await (async()=>{const r=await fetch('/api/auth/session',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error('We could not check your sign-in. Please refresh the form.');return r.json();})();if(auth.enabled){const oldCanvas=form.querySelector?.('[data-legacy-canvas]');if(oldCanvas){oldCanvas.hidden=true;oldCanvas.disabled=true;}if(!form.elements.enquiryType.value)form.elements.enquiryType.value='website-pilot';if(!auth.authenticated){location.replace('/signin.html');return;}form.elements.contact.value=auth.user.email;form.elements.contact.readOnly=true;if(!form.elements.name.value&&auth.user.name)form.elements.name.value=auth.user.name;document.querySelector('.returning-request').hidden=true;document.getElementById('legacy-retry-note').hidden=true;document.getElementById('verified-return-note').hidden=false;}
  const response=await fetch('/api/registration-session',{credentials:'same-origin',cache:'no-store'});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error||'The form connection is unavailable.');csrf=data.csrf;submit.disabled=conflict||recoveryInvalid;submit.textContent=submitLabel();show(recoveryInvalid?'Load a valid retry receipt before recovery, or explicitly clear the form to start a separate enquiry.':importedAttempt?'Re-enter the original name, email and enquiry type, then submit to recover this saved registration.':'Your enquiry will be saved only after you submit.');}
  catch(err){csrf='';submit.textContent='Registration unavailable';show(err.message||'We could not connect. Your entries have been kept.',true);retry.hidden=false;}
}
retry.addEventListener('click',prepare);
recoveryFile.addEventListener('change',async()=>{
  if(busy)return;const generation=++importGeneration,file=recoveryFile.files?.[0];if(!file)return;
  recoveryInvalid=true;submit.disabled=true;newAttempt.hidden=false;
  recoverySay('Reading your private retry receipt. Submission is blocked until the file is validated.');
  try{
    if(file.size>1024||file.size===0)throw new Error('Choose the original registration retry JSON file, no larger than 1 KB.');
    const parsed=retryReceipt(JSON.parse(await file.text()));if(generation!==importGeneration||busy)return;
    importedAttempt=parsed;idempotencyKey=parsed.idempotencyKey;recoveryInvalid=false;confirmedReceipt=null;downloadReceipt.disabled=true;conflict=false;newAttempt.hidden=false;form.hidden=false;receipt.hidden=true;
    progress(1);recoverySay('Retry receipt loaded for '+parsed.receipt+'. It does not grant access by itself. Re-enter the original registration details below.');
    await prepare();document.getElementById('pilot-name').focus({preventScroll:true});document.getElementById('pilot-name').scrollIntoView?.({block:'center',behavior:'instant'});
  }catch(error){if(generation===importGeneration){recoveryInvalid=true;submit.disabled=true;newAttempt.hidden=false;recoveryFile.value='';recoverySay((error instanceof SyntaxError?'This file is not readable JSON. Choose your original private registration retry receipt.':error.message)+' Recovery is blocked until a valid receipt is loaded. Clear and start a new enquiry only if you want a separate registration.',true);}}
});
downloadReceipt.addEventListener('click',()=>{
  if(!confirmedReceipt)return;
  const saved=retryReceipt(confirmedReceipt),url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)+'\n'],{type:'application/json'})),link=document.createElement('a');
  link.href=url;link.download='solborne-registration-retry-'+saved.receipt+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(recoveryInvalid){show('Load a valid registration retry receipt before recovering access. No enquiry has been submitted.',true);return;}
  if(!form.reportValidity())return;
  if(!csrf){show('Refresh the form connection before submitting. Your entries have been kept.',true);retry.hidden=false;return;}
  busy=true;submit.disabled=true;recoveryFile.disabled=true;submit.textContent=importedAttempt?'Checking your saved registration...':'Saving your enquiry...';show(importedAttempt?'Checking this receipt and the original details against your saved registration.':'Saving your enquiry securely.');retry.hidden=true;
  const payload={name:form.elements.name.value,contact:form.elements.contact.value,enquiryType:form.elements.enquiryType.value,permissionToRespond:form.elements.permissionToRespond.checked,website:form.elements.website.value,csrf,idempotencyKey};
  if(importedAttempt)payload.expectedReceipt=importedAttempt.receipt;
  try{
    const response=await fetch('/api/registrations',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const data=await response.json();
    if(!response.ok||!data.ok){if(data.code==='session_expired'){csrf='';retry.hidden=false;}if(data.code==='idempotency_conflict'&&!importedAttempt){conflict=true;newAttempt.hidden=false;}throw new Error(importedAttempt&&data.code==='idempotency_conflict'?'These details do not match the saved registration. Correct the original name, email and enquiry type, then retry the same receipt.':data.error||'We could not save your enquiry. Please try again.');}
    if(!receiptPattern.test(data.receipt)||(importedAttempt&&(data.receipt!==importedAttempt.receipt||data.replayed!==true)))throw new Error('The server did not confirm the original registration. Recovery could not be confirmed.');
    confirmedReceipt={receipt:data.receipt,idempotencyKey};downloadReceipt.disabled=false;
    document.getElementById('registration-receipt-title').textContent=importedAttempt?'Your saved registration is open again.':'Your enquiry is saved.';
    document.getElementById('registration-receipt-note').textContent=importedAttempt?'The original registration has been confirmed. Return to your saved requests and versions to check their current status.':'Continue into the Walk of Fame to explore your business, your customers and what needs to work better.';
    show(importedAttempt?'Your original registration is confirmed. No new enquiry was created.':'Your enquiry is saved.');
    form.hidden=true;receipt.hidden=false;progress(2);document.getElementById('receipt-id').textContent=data.receipt;document.getElementById('receipt-time').textContent=new Date(data.submittedAt).toLocaleString();receipt.focus();
  }catch(err){show((err.message||'The connection was interrupted.')+(conflict?' Your earlier attempt is already recorded. Clear the form only if you want to create a separate enquiry.':' Your entries have been kept. If the result is uncertain, retrying these same details will not create another copy.'),true);}
  finally{busy=false;recoveryFile.disabled=false;submit.disabled=!csrf||conflict||recoveryInvalid;submit.textContent=csrf?submitLabel():'Registration unavailable';}
});
function startNew(){if(busy)return;importGeneration++;importedAttempt=null;confirmedReceipt=null;recoveryInvalid=false;recoveryFile.value='';downloadReceipt.disabled=true;recoverySay('To recover an existing registration, load its private retry receipt and re-enter the original details.');progress(1);form.reset();form.hidden=false;receipt.hidden=true;idempotencyKey=randomKey();conflict=false;newAttempt.hidden=true;prepare();document.getElementById('pilot-name').focus();}
document.getElementById('new-enquiry').addEventListener('click',startNew);
newAttempt.addEventListener('click',startNew);
prepare();
})();
