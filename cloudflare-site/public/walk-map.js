// A visual reading of the saved brief. It never generates facts or changes the Walk.
(() => {
 const workflowNames={payments:'Payments',documents:'Documents',quotes:'Quotations'};
 const progressLabels={captured:'Captured',current:'Next to explore',pending:'Still open',ready:'Ready to review',submitted:'With our team',reviewed:'Review completed'};
 const icons={situation:'◌',work:'↝',decision:'◇',outcome:'◎',review:'✓',story:'◌',visitors:'↗',look:'◇'};
 function savedValue(state,source){
  const [group,key]=source.split('.'),value=state?.[group]?.[key],evidence=state?.evidence?.[source];
  if(typeof value!=='string'||!value.trim()||(evidence&&evidence.kind!=='owner_stated'))return '';
  if(/^(?:hypothesis\b|deferred\b|unknown(?:$|[:;])|not provided$|tbd$)/i.test(value.trim()))return '';
  return value.trim();
 }
 function project(state={},incoming={}){
  const journey=state.journey||incoming,intent=journey?.intent==='operations'?'operations':'website';
  const definitions=intent==='operations'?
   [['situation','Your situation',['businessBrief.primaryPain','businessBrief.recentSituation']],['work','Current work',['businessBrief.customerJourney','businessBrief.currentOperations','businessBrief.currentWorkaround']],['decision','Where you decide',['businessBrief.humanApprovals','businessBrief.interventionTriggers']],['outcome','Better looks like',['businessBrief.desiredOutcome']],['review','Next step',[]]]:
   [['story','Your story',['facts.description','facts.businessName']],['visitors','Your customers',['facts.audience']],['look','Your look',['businessBrief.designVision','facts.brandDirection']],['review','Team review',[]]];
  let currentFound=false;
  const nodes=definitions.map(([id,label,sources])=>{
   const source=sources.find(key=>savedValue(state,key))||'',value=source?savedValue(state,source):'';
   let status=value?'captured':'pending';
   if(id==='review')status=state.submission?(state.submission.status==='completed'?'reviewed':'submitted'):state.ready?'ready':'pending';
   if(status==='pending'&&!currentFound){status='current';currentFound=true;}
   const extra=id==='outcome'?savedValue(state,'businessBrief.successMeasure'):'';
   return {id,label,value,source,state:status,detail:extra};
  });
  const workflow=intent==='operations'&&Object.hasOwn(workflowNames,journey?.workflow)?journey.workflow:'';
  return {intent,workflow,label:intent==='operations'?(workflowNames[workflow]||'Your workflow'):'Your website',nodes};
 }
 function render(state={},journey={}){
  const host=document.getElementById('walk-job-map');if(!host)return;
  const view=project(state,journey),create=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  const heading=create('div','walk-map-heading'),title=create('p','walk-map-title',view.label),legend=create('span','walk-map-legend','Your brief, taking shape');
  heading.append(title,legend);
  const list=create('ol','walk-map-track');list.setAttribute('aria-label',view.label+' decisions');
  for(const item of view.nodes){
   const li=create('li','walk-map-node is-'+item.state),details=create('details','walk-map-detail'),summary=create('summary','walk-map-control');
   li.setAttribute('data-decision',item.id);li.setAttribute('data-state',item.state);
   if(item.state==='current')li.setAttribute('aria-current','step');
   const symbol=create('span','walk-map-symbol',icons[item.id]);symbol.setAttribute('aria-hidden','true');
   const label=create('span','walk-map-label',item.label),status=create('span','walk-map-status',progressLabels[item.state]);
   summary.append(symbol,label,status);summary.setAttribute('aria-label',item.label+': '+progressLabels[item.state]);
   const body=create('div','walk-map-answer');
   if(item.value){body.append(create('p','',item.value));if(item.detail)body.append(create('p','walk-map-measure',item.detail));}
   else body.append(create('p','',progressLabels[item.state]));
   details.append(summary,body);li.append(details);list.append(li);
  }
  host.className='walk-job-map';host.setAttribute('data-journey',view.intent);host.replaceChildren(heading,list);
 }
 window.SolborneWalkMap={project,render};
})();
