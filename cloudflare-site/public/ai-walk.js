const $=id=>document.getElementById(id);
const labels={businessName:'Business',description:'Introduction',audience:'Customers',services:'Services',location:'Location',callToAction:'Next action',email:'Public email',phone:'Public phone',websiteUrl:'Existing website',industry:'Industry',brandDirection:'Brand & design',legalName:'Legal operator',entityType:'Entity type',businessAddress:'Business address',complaintsContact:'Complaints',feesAndTerms:'Fees & terms',dataHandling:'Data handling',proofAndPermissions:'Evidence & permissions',currentAndPlanned:'Current & planned'};
let csrf='',revision=0,state={facts:{},messages:[]},enabled=false,registered=false,busy=false,previewedRevision=-1,attemptRevision=-1,previewURL='';
const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
let idempotencyKey=newKey();
function feedback(text,error=false){$('ai-feedback').textContent=text;$('ai-feedback').setAttribute('role',error?'alert':'status');}
function controls(){ $('ai-send').disabled=busy||!enabled||!registered||!csrf||!$('ai-consent').checked;$('ai-refresh').disabled=busy;$('ai-delete').disabled=busy||!registered||!csrf;$('ai-use-brief').disabled=busy||!state.ready;$('ai-run-reviews').disabled=busy||!enabled||!state.ready||!$('ai-consent').checked||!$('ai-approved').checked;$('ai-preview').disabled=busy||!state.review;$('ai-submit').disabled=busy||!state.review||previewedRevision!==revision||!$('ai-approved').checked; }
function render(){
  $('ai-messages').replaceChildren();
  for(const m of state.messages||[]){const item=document.createElement('li');item.className=m.role;const label=document.createElement('strong');label.textContent=m.role==='user'?'You':'Solborne';const p=document.createElement('p');p.textContent=m.text;item.append(label,p);$('ai-messages').append(item);}
  $('ai-facts').replaceChildren();for(const [key,value] of Object.entries(state.facts||{})){if(!value)continue;const dt=document.createElement('dt');dt.textContent=labels[key]||key;const dd=document.createElement('dd');dd.textContent=value;$('ai-facts').append(dt,dd);}
  $('ai-missing').replaceChildren();for(const value of state.missing||[]){const li=document.createElement('li');li.textContent=labels[value]||value;$('ai-missing').append(li);}$('ai-gaps').hidden=!(state.missing||[]).length;
  $('ai-stage').textContent=state.ready?'Your facts are ready for you to review.':`Current focus: ${state.stage||'business'}`;
  $('ai-template').textContent=state.template?`Suggested layout: ${state.template==='story'?'Story — narrative portfolio':'Editorial — business and services portfolio'}. Final suitability and licences are checked during preparation.`:'A licensed industry layout will be selected from your brief.';
  $('ai-review-results').replaceChildren();
  if(state.review)for(const kind of ['research','marketing']){const item=state.review[kind];const heading=document.createElement('h3');heading.textContent=kind==='research'?'Research review':'Marketing review';const summary=document.createElement('p');summary.textContent=item.summary;const list=document.createElement('ul');for(const text of [...item.improvements,...item.unresolved.map(x=>'To resolve: '+x)]){const li=document.createElement('li');li.textContent=text;list.append(li);}$('ai-review-results').append(heading,summary,list);for(const source of item.sources||[]){if(!source.url.startsWith('https://'))continue;const a=document.createElement('a');a.href=source.url;a.textContent=source.title;a.target='_blank';a.rel='noopener noreferrer';$('ai-review-results').append(a,document.createElement('br'));}}
  controls();
}
async function jsonRequest(url,options={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});let data;try{data=await r.json();}catch{throw new Error('The connection could not be read. Refresh saved progress.');}if(!r.ok||!data.ok)throw new Error(data.error||'The request could not be completed.');return data;}
async function prepare(){
  if(busy)return;busy=true;controls();
  try{
    const availability=await jsonRequest('/api/ai-walk/status');enabled=availability.enabled;
    const access=await fetch('/api/access/status',{credentials:'same-origin',cache:'no-store'});registered=access.ok;$('ai-register').hidden=registered;
    $('ai-availability').textContent=enabled?'The guided Walk is connected.':'The AI connection is being configured. The website-copy editor remains available.';
    if(!registered){csrf='';return;}
    const data=await jsonRequest('/api/ai-walk');state=data.state;revision=data.revision;enabled=data.enabled;
    const session=await jsonRequest('/api/registration-session');csrf=session.csrf;render();
    feedback(state.messages?.length?'Your saved conversation is restored.':'Start with what your business does and who it helps.');
  }catch(e){csrf='';feedback(e.message,true);}finally{busy=false;controls();}
}
$('ai-consent').addEventListener('change',controls);
$('ai-approved').addEventListener('change',controls);
$('ai-refresh').addEventListener('click',prepare);
$('ai-answer-form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||$('ai-send').disabled)return;const message=$('ai-answer').value.trim();if(!message)return;
  busy=true;controls();$('ai-send').textContent='Thinking…';feedback('Saving your answer and preparing the next question…');
  try{const result=await jsonRequest('/api/ai-walk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,consent:true,message,revision})});state=result.state;revision=result.revision;previewedRevision=-1;$('ai-approved').checked=false;$('ai-preview-panel').hidden=true;$('ai-preview-frame').removeAttribute('srcdoc');$('ai-preview-frame').removeAttribute('src');if(previewURL){URL.revokeObjectURL(previewURL);previewURL='';}render();$('ai-answer').value='';feedback('Your progress is saved.');$('ai-messages').lastElementChild?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  catch(e){feedback(e.message,true);}finally{busy=false;$('ai-send').textContent='Send answer';controls();}
});
$('ai-delete').addEventListener('click',async()=>{
  if(busy||!confirm('Delete your saved AI conversation and brief? Existing website versions are kept.'))return;
  busy=true;controls();try{await jsonRequest('/api/ai-walk',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf})});state={facts:{},messages:[]};revision=0;previewedRevision=-1;$('ai-preview-panel').hidden=true;$('ai-preview-frame').removeAttribute('src');if(previewURL){URL.revokeObjectURL(previewURL);previewURL='';}$('ai-approved').checked=false;render();feedback('Your saved AI conversation was deleted. Existing website versions are kept.');}catch(e){feedback(e.message,true);}finally{busy=false;controls();}
});
$('ai-run-reviews').addEventListener('click',async()=>{
  if($('ai-run-reviews').disabled)return;busy=true;controls();feedback('Running research and marketing reviews. This may take a minute…');
  try{const result=await jsonRequest('/api/ai-walk/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,ownerApproved:true,revision})});state=result.state;revision=result.revision;previewedRevision=-1;$('ai-approved').checked=false;render();feedback('The reviews are saved. Read the findings, then open your template preview.');}catch(e){feedback(e.message,true);}finally{busy=false;controls();}
});
$('ai-preview').addEventListener('click',async()=>{
  if($('ai-preview').disabled)return;busy=true;controls();try{const result=await jsonRequest('/api/ai-walk/preview');if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(new Blob([result.html],{type:'text/html'}));$('ai-preview-frame').src=previewURL;$('ai-preview-panel').hidden=false;previewedRevision=revision;feedback('Read the draft, check your public facts, then approve before submitting.');$('ai-preview-panel').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}catch(e){feedback(e.message,true);}finally{busy=false;controls();}
});
$('ai-submit').addEventListener('click',async()=>{
  if($('ai-submit').disabled)return;if(attemptRevision!==revision){idempotencyKey=newKey();attemptRevision=revision;}busy=true;controls();
  try{await jsonRequest('/api/ai-walk/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,ownerApproved:true,revision,idempotencyKey})});feedback('Your approved draft is saved in Solborne’s review queue. It has not been published.');const link=document.createElement('a');link.href='/versions.html';link.textContent='View saved versions and release status';$('ai-transfer-note').replaceChildren(link);}catch(e){feedback(e.message,true);}finally{busy=false;controls();}
});
$('ai-use-brief').addEventListener('click',()=>{
  if(!state.ready)return;
  // Public business facts only, short-lived handoff to the existing editor.
  try{sessionStorage.setItem('solborne-ai-facts',JSON.stringify({savedAt:Date.now(),facts:state.facts}));location.assign('/walk/?from=ai');}catch{feedback('Your browser could not transfer the brief. Keep this page open and use the website editor in another tab.',true);}
});
prepare();
