const intents=new Set(['website','operations']);
const workflows=new Set(['','payments','documents','quotes']);
export function normalizeJourney(value){
 if(value===undefined)return {intent:'website',workflow:''};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['intent','workflow'].includes(k))||!intents.has(value.intent)||(value.workflow!==undefined&&typeof value.workflow!=='string')||!workflows.has(value.workflow??'')||(value.intent==='website'&&value.workflow))throw Error('Invalid Walk journey');
 return {intent:value.intent,workflow:value.workflow||''};
}
export function resolveJourney(state,inputJourney){
 const requested=normalizeJourney(inputJourney);
 if(state?.journey!==undefined)return normalizeJourney(state.journey);
 // A named project seed alone is not an interview. Existing answers always retain the legacy website journey.
 const started=state?.submission||state?.pendingAnswer||(state?.messages?.length>0)||(state?.ownerMessages?.length>0)||Object.keys(state?.businessBrief||{}).length>0;
 return started?normalizeJourney():requested;
}
export function requirementsForJourney(value){
 return normalizeJourney(value).intent==='operations'
  ? {facts:['businessName','description'],brief:['customerJourney','primaryPain','desiredOutcome','successMeasure','humanApprovals','confirmedPriority','currentWorkaround'],contact:false}
  : {facts:['businessName','description','audience','services','callToAction','industry','legalName','entityType','businessAddress'],brief:['customerJourney','primaryPain','desiredOutcome','successMeasure','humanApprovals','confirmedPriority','freeScope'],contact:true};
}
export function journeyInstruction(value){
 const journey=normalizeJourney(value);
 if(journey.intent==='website')return 'WEBSITE JOURNEY: Prepare a complete usable free website brief. Deeper operational discovery is optional. Accept an explicit owner deferral in private operational fields; do not make an operations audit a condition of the free website. Keep free and paid scopes separate.';
 const focus={payments:'payment follow-ups',documents:'document readiness',quotes:'quotation preparation'}[journey.workflow]||'the business process the owner wants to improve';
 return `OPERATIONS JOURNEY: The owner came for ${focus}, not website design. Start with a recent instance of work getting stuck. Understand the desired progress, current steps and workaround, frequency/impact if known, when a person must intervene, and what would show improvement. Reuse supplied context. Ask one useful unanswered decision at a time. Reflect a short current journey and a labelled proposed improvement for correction. Use humanApprovals for intervention triggers, currentWorkaround for existing methods, and successMeasure for the observable outcome; optional recentSituation, interventionTriggers and outcomeLearning can add detail. Do not require invented metrics. Readiness requires businessName and description plus customerJourney, primaryPain, desiredOutcome, successMeasure, humanApprovals, confirmedPriority and currentWorkaround. Do not require legal identity, public contact, audience, brand preferences or freeScope to review an operations brief. End with a private workflow brief for Solborne team review, not a finished automation or a website. No 24-hour website promise, guaranteed saving, collection outcome or predictive-accuracy claim applies here. No system access, credentials, customer records, sending or calls occur in this chat. Capture business-level descriptions only. Existing tool configuration may be enough. Learning from outcomes is proposed evaluation, not automatic training or cross-customer reuse. Research, price, scope and a delivery commitment require team review.`;
}
export function journeyPrompt(base,value){
 const journey=normalizeJourney(value);
 if(journey.intent==='website')return base+'\n'+journeyInstruction(journey);
 // Keep the grounded interviewer safeguards while excluding website-only delivery/design obligations.
 let common=base.replace(/DESIGN INPUT AND REUSE[\s\S]*?(?=INTERVIEW, DON'T PROCESS A FORM)/,'').replace(/WEBSITE AND DELIVERY[\s\S]*?(?=OPTIONAL ANSWER HELP)/,'');
 common=common.split('\n').filter(line=>! /^(?:DELIVERY:|DESIGN CONVERSATION:|REQUIRED SEQUENCE:|FREE AND PAID:)/.test(line)).join('\n');
 common=common.replace(/Explore the person's business story before detailed operations\./g,'Start with the recent operational situation, using existing business context.').replace(/ready=true only when sufficient grounded public identity\/contact\/offer and private journey\/priority\/success\/approval\/free-scope facts exist;/g,'ready=true only when the required grounded operations facts and private brief fields exist;').replace(/ready requires essential public details plus a confirmed priority and at least a usable current journey, pain, desired outcome, success measure, human approval and free scope summary\./g,'ready requires the operational fields described in OPERATIONS JOURNEY.').replace(/Understand THIS business well enough for a distinct, useful business website and a needs-led automation proposal\./g,'Understand the owner’s operational job and prepare a useful workflow brief.').replace(/You conduct Solborne's Walk of Fame: a progressive interview to understand a WHOLE BUSINESS, produce its public website brief, and discover a worthwhile digital improvement\./g,'You conduct Solborne’s Walk of Fame to understand the operational job and prepare a private workflow brief.');
 return journeyInstruction(journey)+'\n'+common+'\n'+journeyInstruction(journey);
}
