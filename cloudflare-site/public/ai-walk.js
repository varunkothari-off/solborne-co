const $=id=>document.getElementById(id);

const labels={businessName:'Business',description:'What you do',audience:'Who you help',services:'What you offer',location:'Where you work',callToAction:'How customers begin',email:'Public email',phone:'Public phone',websiteUrl:'Existing website',industry:'Industry',brandDirection:'Design direction',legalName:'Legal operator',entityType:'Business type',businessAddress:'Business address',complaintsContact:'Support contact',feesAndTerms:'Fees & terms',dataHandling:'Information handling',proofAndPermissions:'Evidence & permissions',currentAndPlanned:'Current & planned'};

const briefLabels={primaryPain:'What matters most',desiredOutcome:'Your goal',confirmedPriority:'Your priority',successMeasure:'What success means',freeScope:'Your first website',customerJourney:'Your customer journey',humanApprovals:'What you want to approve',designVision:'Your design',designReferences:'Design references',designAvoid:'What to avoid',designMotion:'Movement',businessModel:'How the business earns',currentTools:'Tools you use',currentProcess:'How you work today',currentWorkaround:'What you do now',recentSituation:'Your recent example',interventionTriggers:'When a person is needed',outcomeLearning:'What outcomes to record',automationOpportunities:'What could work better',budget:'Your budget',timeline:'Your timing',documentsNeeded:'Supporting materials',dataSources:'Information you work with',constraints:'Things to keep in mind',languages:'Languages',serviceArea:'Where you work'};

function readableLabel(value){const key=String(value||'').replace(/^(facts\.|businessBrief\.|business brief: )/,'');return labels[key]||briefLabels[key]||'A detail to confirm';}

let state={facts:{},messages:[]},revision=0,csrf='',enabled=false,uploadsEnabled=false,registered=false,busy=false,voiceBusy=false,voice=null,voiceMode='batch',sending=false,privacyKey='',answerSketch=null,composer=null,optimisticAnswer=null;

function feedback(text,error=false){$('ai-feedback').textContent=text;$('ai-feedback').setAttribute('role',error?'alert':'status');}

function controls(){answerSketch?.update();composer?.update();const submitted=!!state.submission;$('ai-send').disabled=!!composer?.uploading||!!answerSketch?.editingPast||busy||sending||voice?.phase==='requesting'||(voiceBusy&&voiceMode!=='live')||!enabled||!registered||!csrf||!$('ai-consent').checked||submitted;$('ai-refresh').disabled=busy||sending||voiceBusy;for(const button of $('answer-ideas-list').children)button.disabled=busy||sending||voiceBusy;$('ai-submit-brief').disabled=!!composer?.uploading||!!composer?.currentFiles().length||!!answerSketch?.dirty||!!answerSketch?.editingPast||busy||voiceBusy||!state.ready||!$('ai-confirm').checked||!csrf||submitted;$('ai-answer-form').hidden=submitted;$('ai-submit-brief').textContent=busy?'Saving…':'Send my brief';for(const button of $('ai-messages').querySelectorAll?.('.answer-sketch-link')||[])button.disabled=busy||sending||voiceBusy||submitted;voice?.update();}

function pair(target,label,value){if(!value)return;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;target.append(dt,dd);}

function startedJourney(){return state.messages?.length||state.submission||state.pendingAnswer||state.ownerMessages?.length||Object.keys(state.businessBrief||{}).length;}

function activeJourney(){return state.journey||(startedJourney()?{intent:'website',workflow:''}:window.solborneJourney)||{intent:'website',workflow:''};}

function journeyCopy(){

 const j=activeJourney(),ops=j.intent==='operations';

 const text=(id,value)=>{if($(id))$(id).textContent=value;};

 text('walk-intro-title',ops?'Your work. A clearer way forward.':'Your business. One conversation.');

 text('walk-intro-description',ops?'Let’s understand what gets stuck, where a person is needed and what a useful improvement would look like.':'Tell us your story. We’ll ask the right questions, then create a website around you.');

 text('summary-title',ops?'Your workflow, taking shape.':'Your business, in a few words.');

 text('ai-confirm-label',ops?'I confirm this private workflow brief for team review. This does not approve a paid project.':'I confirm this summary and the details intended for my public website.');

 text('walk-delivery-title',ops?'A reviewed next step.':'Your website link. Within 24 hours.');

 if($('walk-delivery'))$('walk-delivery').hidden=ops;

 // A saved project always wins over a new campaign. Offer an explicit separate project.

 const incoming=window.solborneJourney;

 const mismatch=incoming?.intent==='operations'&&startedJourney()&&j.intent!=='operations';

 if($('journey-conflict')){$('journey-conflict').hidden=!mismatch;text('journey-conflict','You’re viewing your saved website project. Its brief has not changed. Start a separate project to discuss operations.');}

 if($('journey-new-project')){$('journey-new-project').hidden=!mismatch;$('journey-new-project').href='/start.html'+(window.solborneJourneyQuery?.(incoming)||'');}

 const s=state.submission;

 if(s){

  const status={awaiting_manual_review:'Awaiting team review',in_review:'Being reviewed',awaiting_customer:'Waiting for your input',proposal_ready:'Recommendation ready',completed:'Review completed'}[s.status]||'With our team';

  text('ai-submitted-description',ops?(s.nextAction||'Our team will review your workflow brief and confirm the next step. Scope, price and timing are agreed separately.'):'We’ll send your private website link within 24 hours. Your website will be manually reviewed before delivery.');

  const due=!ops&&Number.isFinite(s.dueAt)?' · Link due by '+new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(s.dueAt):'';

  const update=Number.isFinite(s.nextUpdateAt)?' · Next update '+new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(s.nextUpdateAt):'';

  text('ai-receipt','Reference '+s.id+' · '+status+' · Responsible: '+(s.owner||'Solborne team')+due+update);

 }

}

function render(){

 journeyCopy();

 answerSketch?.update();

 const ideas=$('answer-ideas-list');ideas.replaceChildren();for(const idea of state.answerIdeas||[]){const button=document.createElement('button');button.type='button';button.className='answer-idea';button.textContent=idea;button.addEventListener('click',()=>{const answer=$('ai-answer');answer.value=(answer.value.trim()?answer.value.trim()+'\n':'')+idea;answer.dispatchEvent?.(new Event('input',{bubbles:true}));answer.focus?.();});ideas.append(button);}$('answer-ideas').hidden=!ideas.children.length||!!state.submission;

 const history=state.messages?.length?[...state.messages]:[{role:'assistant',text:activeJourney().intent==='operations'?({payments:'Think of the last payment you had to chase. Where did it get stuck?',documents:'Think of the last client job blocked by missing documents. What happened?',quotes:'Think of the last quotation that took too much of your time. What happened?'}[activeJourney().workflow]||'Think of the last time work got stuck waiting for you. What happened?'):'Let’s start with your story. Tell me about your business.'}];if(optimisticAnswer)history.push({role:'user',text:optimisticAnswer.text,pending:true});if(busy&&optimisticAnswer)history.push({role:'assistant',text:'Thinking…',pending:true});const list=$('ai-messages');for(const preview of list.querySelectorAll?.('.answer-sketch-preview')||[])preview.disposeSketch?.();list.replaceChildren();let userTurn=0;for(const m of history){const li=document.createElement('li'),name=document.createElement('strong'),text=document.createElement('p');li.className=m.role==='user'?'user':'assistant';name.textContent=m.role==='user'?'You':'Solborne';text.textContent=m.text==='[Sketch attached]'?'Sketch attached.':m.text==='[Files attached]'?'Files attached.':m.text;li.append(name,text);if(m.role==='user'&&!m.pending){const turn=m.turn||++userTurn;userTurn=Math.max(userTurn,turn);const saved=state.answerSketches?.find(x=>x.turn===turn);if(saved?.strokes?.length&&window.SolborneAnswerSketch)li.append(window.SolborneAnswerSketch.preview(saved.strokes));const sketchButton=document.createElement('button');sketchButton.type='button';sketchButton.className='answer-sketch-link sketch-link';sketchButton.textContent=saved?.strokes?.length?'Edit sketch':'Sketch';sketchButton.setAttribute('aria-label',(saved?.strokes?.length?'Edit':'Add')+' sketch for answer '+turn);sketchButton.disabled=busy||sending||voiceBusy||!!state.submission;sketchButton.addEventListener('click',()=>{answerSketch?.open(turn,saved?.strokes||[]);$('answer-sketch-space')?.scrollIntoView?.({block:'nearest',behavior:'instant'});});li.append(sketchButton);for(const file of state.answerFiles?.find(x=>x.turn===turn)?.files||[]){if(!/^\/api\/ai-walk\/files\/[a-f0-9-]{36}$/.test(file.url||''))continue;const link=document.createElement('a');link.href=file.url;link.textContent=file.name;link.className='walk-saved-file';link.setAttribute('download','');li.append(link);}}list.append(li);}

 $('ai-facts').replaceChildren();for(const [k,v] of Object.entries(state.facts||{}))pair($('ai-facts'),readableLabel(k),v);

 $('ai-business-brief').replaceChildren();const journeyFields=activeJourney().intent==='operations'?{customerJourney:'How work moves today',currentWorkaround:'What you do now',humanApprovals:'Where a person is needed',currentOperations:'Your current process',constraints:'Constraints',paidOpportunities:'Possible improvements — to review',researchQuestions:'Still to establish',recentSituation:'Your recent example',interventionTriggers:'When to involve a person',outcomeLearning:'What outcomes to record'}:{};for(const [k,label] of Object.entries({...journeyFields,primaryPain:'What matters most',desiredOutcome:'Your goal',confirmedPriority:'Your priority',successMeasure:'What success means',freeScope:'Your first website',designVision:'Your design',designReferences:'Design references',designAvoid:'What to avoid',designMotion:'Movement'}))pair($('ai-business-brief'),label,state.businessBrief?.[k]);$('ai-priorities').hidden=!$('ai-business-brief').children.length;

 $('ai-missing').replaceChildren();for(const label of new Set((state.missing||[]).map(readableLabel))){const li=document.createElement('li');li.textContent=label;$('ai-missing').append(li);}$('ai-gaps').hidden=state.ready||!(state.missing||[]).length;

 $('ai-stage').textContent=state.submission?'Saved for review.':state.ready?'Ready to review.':'Your summary, as we talk.';$('ai-handoff').hidden=!state.ready||!!state.submission;$('ai-submitted').hidden=!state.submission;

 journeyCopy();controls();

}

async function request(url,options={}){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...options});let d;try{d=await r.json();}catch{throw Error('We couldn’t read the connection. Your answer is still here. Please try again.');}if(!r.ok||!d.ok)throw Error(d.error||'We couldn’t save that. Please try again.');return d;}

async function prepare(){if(busy||voiceBusy||composer?.uploading)return;busy=true;controls();try{const session=await window.solborneSession();registered=session.authenticated&&session.registered;privacyKey=session.activeRegistration?'solborne.walk-privacy.v1:'+session.activeRegistration:'';csrf=session.csrf||'';$('ai-register').hidden=registered;

 if(!registered){const a=$('ai-register').querySelector('a');const q=window.solborneJourneyQuery?.(activeJourney())||'';a.href=session.authenticated?'/start.html'+q:'/signin.html?next=walk'+(q?'&'+q.slice(1):'');a.textContent=session.authenticated?'Save your basic details to begin':'Sign in to begin';$('ai-availability').textContent='Sign in and choose your business to save your Walk.';return;}

 const d=await request('/api/ai-walk');state=d.state;revision=d.revision;enabled=d.enabled;uploadsEnabled=d.uploadsEnabled===true;{const desiredMode=d.voiceMode==='live'?'live':'batch';if(desiredMode!==voiceMode){voice?.destroy();voiceMode=desiredMode;initVoice();}}{const s=await request('/api/registration-session');csrf=s.csrf;}restorePrivacy();$('ai-availability').textContent=enabled?'Saved automatically.':'The guided Walk is temporarily unavailable. Please come back shortly.';render();feedback(state.submission?'Your brief is saved for manual review.':state.messages?.length?'':'');

 }catch(e){feedback(e.message,true);}finally{busy=false;if(state.pendingAnswer?.text&&!['[Sketch attached]','[Files attached]'].includes(state.pendingAnswer.text)&&!$('ai-answer').value?.trim())$('ai-answer').value=state.pendingAnswer.text;render();answerSketch?.restorePending(state.pendingAnswer);if(state.pendingAnswer?.files?.length)composer?.restore(state.pendingAnswer.files.map(id=>(state.fileLibrary||[]).find(f=>f.id===id)).filter(Boolean));}}

$('ai-consent').addEventListener('change',controls);$('voice-consent').addEventListener('change',()=>voice?.update());$('privacy-save').addEventListener('click',savePrivacy);$('ai-confirm').addEventListener('change',controls);$('ai-refresh').addEventListener('click',prepare);$('ai-status-refresh')?.addEventListener('click',prepare);

$('ai-answer-form').addEventListener('submit',async e=>{e.preventDefault();if($('ai-send').disabled||answerSketch?.editingPast||composer?.uploading)return;if(voice?.phase==='requesting'){feedback('Your microphone is preparing. Wait for live text, or pause before sending.');return;}sending=true;controls();try{await voice?.settle?.();}finally{sending=false;}if(!$('ai-consent').checked||!enabled||!registered||!csrf||state.submission||busy){controls();return;}const sentDraft=$('ai-answer').value;const message=$('ai-answer').value.trim(),sketch=answerSketch?.attachment()||[],files=composer?.currentFiles()||[];if(!message&&!sketch.length&&!files.length){controls();return;}busy=true;state.ready=false;optimisticAnswer={text:message||(sketch.length?'[Sketch attached]':'[Files attached]'),sketch,files};$('ai-confirm').checked=false;render();$('ai-send').textContent='···';feedback('Thinking…');

 try{const d=await request('/api/ai-walk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,consent:true,message,revision,sketch,files,journey:activeJourney()})});state=d.state;revision=d.revision;$('ai-confirm').checked=false;if($('ai-answer').value===sentDraft)$('ai-answer').value='';answerSketch?.sent(sketch);composer?.clearSent(files);optimisticAnswer=null;render();feedback('Saved.');}catch(e){feedback(e.message,true);}finally{optimisticAnswer=null;busy=false;$('ai-send').textContent='↑';render();}});

$('ai-submit-brief').addEventListener('click',async()=>{if($('ai-submit-brief').disabled)return;busy=true;controls();try{const d=await request('/api/ai-walk/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,revision,confirmed:true})});state=d.state;revision=d.revision;voice?.cancel();render();feedback(activeJourney().intent==='operations'?'Your workflow brief is saved for team review. Scope, price and timing will be agreed separately.':'Your brief is with our team. We’ll send your website link within 24 hours.');$('ai-submitted').scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}catch(e){feedback(e.message,true);}finally{busy=false;controls();}});

function restorePrivacy(){let saved;try{saved=privacyKey&&JSON.parse(localStorage.getItem(privacyKey));$('walk-analytics-consent').checked=localStorage.getItem('solborne.analytics.v1')==='granted';}catch{}$('ai-consent').checked=saved?.version===1?!!saved.ai:!!state.consentAt;$('voice-consent').checked=saved?.version===1&&!!saved.audio;if(!(saved?.version===1)&&!state.submission)openConsent();}

function openConsent(){if(!$('consent-dialog').open)$('consent-dialog').showModal();}

$('consent-open').addEventListener('click',openConsent);$('consent-close').addEventListener('click',()=>{$('consent-dialog').close();});

function savePrivacy(){try{if(privacyKey)localStorage.setItem(privacyKey,JSON.stringify({version:1,ai:$('ai-consent').checked,audio:$('voice-consent').checked}));localStorage.setItem('solborne.analytics.v1',$('walk-analytics-consent').checked?'granted':'denied');$('privacy-saved').textContent='Choices saved.';}catch{$('privacy-saved').textContent='Choices apply now. This browser could not remember them.';}$('consent-dialog').close();controls();}

function initVoice(){voice=(voiceMode==='live'?window.SolborneLiveVoice:window.SolborneVoice)?.create({onConsentRequired:openConsent,getContext:()=>({allowed:enabled&&registered&&!!csrf&&!busy&&!state.submission,csrf,consent:$('ai-consent').checked}),onBusy:value=>{voiceBusy=value;controls();}})||null;}

answerSketch=window.SolborneAnswerSketch?.create({getContext:()=>({allowed:registered&&!!csrf&&!busy&&!sending&&!voiceBusy&&!composer?.uploading,submitted:!!state.submission,revision,csrf}),request,onSaved:d=>{state=d.state;revision=d.revision;$('ai-confirm').checked=false;render();},onChange:controls})||null;

composer=window.SolborneComposer?.create({getContext:()=>({allowed:enabled&&registered&&!!csrf&&$('ai-consent').checked,uploadsAllowed:uploadsEnabled,busy:busy||sending||voiceBusy,editingPast:!!answerSketch?.editingPast,submitted:!!state.submission}),upload:async file=>{const d=await request('/api/ai-walk/files',{method:'POST',headers:{'Content-Type':file.type||({pdf:'application/pdf',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[file.name.split('.').at(-1)?.toLowerCase()]||'application/octet-stream'),'X-File-Name':encodeURIComponent(file.name),'X-CSRF-Token':csrf,'X-Walk-Revision':String(revision)},body:file});state=d.state;revision=d.revision;$('ai-confirm').checked=false;render();return d.file;},onChange:controls})||null;

initVoice();

render();prepare();
