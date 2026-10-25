// Inspectable examples only. No network, persistence, model or submission transport.
(()=>{
 const routes={
  payments:{name:'Get paid',question:'What happened last time?',start:'Invoice due',routine:'Check → remind → track',human:'Disputes & broken promises',end:'Payment / next action',situations:[{id:'email-chase',label:'I email. Then chase. I want my time back.',set:{situation:'Repeated chasing',method:'email',goal:'less-chasing'}},{id:'dispute',label:'They dispute the amount.',set:{situation:'Client disputes the invoice',dispute:true}},{id:'silence',label:'They go quiet after delivery.',set:{situation:'No reply after delivery'}}],methods:[['email','Email reminders'],['whatsapp','WhatsApp reminders'],['sheet','A spreadsheet']],approvals:[['exceptions','Bring me the exceptions'],['every','I approve every follow-up']],goals:[['less-chasing','Less time chasing'],['clear-status','Know who needs attention']]},
  documents:{name:'Get work ready',question:'What keeps the job waiting?',start:'Documents needed',routine:'Request → check → follow up',human:'Confusion & missing context',end:'Ready for professional review',situations:[{id:'partial',label:'I email a checklist. They send half.',set:{situation:'Incomplete documents',method:'email'}},{id:'wrong',label:'The upload is the wrong document.',set:{situation:'Wrong document received',dispute:true}},{id:'unknown',label:'Nobody knows what is still missing.',set:{situation:'Readiness is unclear'}}],methods:[['email','Email requests'],['whatsapp','WhatsApp requests'],['portal','A client portal']],approvals:[['exceptions','Bring me blocked cases'],['every','My team checks every document']],goals:[['ready','Know what is ready'],['less-chasing','Fewer repeated requests']]},
  quotes:{name:'Prepare the next quote',question:'Where does quoting get stuck?',start:'Enquiry arrives',routine:'Capture → draft → check',human:'Approve scope & price',end:'Customer decision → job outcome',situations:[{id:'excel',label:'I rebuild every quote in Excel.',set:{situation:'Repeated quote preparation',method:'sheet'}},{id:'custom',label:'The job needs unusual pricing.',set:{situation:'Custom scope and pricing',dispute:true}},{id:'missing',label:'The enquiry is missing details.',set:{situation:'Incomplete requirements'}}],methods:[['sheet','Excel / spreadsheet'],['email','Email & a document'],['tool','A quoting tool']],approvals:[['price','I approve scope & price'],['team','My authorised team approves']],goals:[['less-prep','Less preparation time'],['margin','Fewer scope & margin surprises']]},
  website:{name:'Your first website',question:'What should your website help people do?',start:'Your business story',routine:'Research → design → review',human:'You approve the content',end:'Reviewed website files',situations:[{id:'presence',label:'See my services and get in touch.',set:{situation:'A clear business presence',method:'none',goal:'presence'}},{id:'work',label:'See examples of my work.',set:{situation:'Show my work',method:'none',goal:'portfolio'}}],methods:[['none','No website yet'],['existing','An existing website']],approvals:[['content','I approve content before release']],goals:[['presence','Clear services & contact'],['portfolio','Show my work']]}
 };
 const approvalLabels={exceptions:'Exceptions come to you',every:'You approve each step',price:'You approve scope & price',team:'Your team approves',content:'You approve the content'};
 const copy=s=>JSON.parse(JSON.stringify(s));
 function create(route='payments'){return {route:Object.hasOwn(routes,route)?route:'payments',answers:{},confirmed:false};}
 function choices(s,key){const r=routes[s.route];if(key==='situation')return r.situations.map(x=>({id:x.id,label:x.label}));return (r[key==='method'?'methods':key==='approval'?'approvals':'goals']||[]).map(([id,label])=>({id,label}));}
 function choose(state,key,id){
  const next=copy(state),r=routes[next.route];if(!choices(next,key).some(x=>x.id===id))throw Error('Choose one of the illustrated answers.');
  if(key==='situation'){next.answers={...next.answers,dispute:false,...r.situations.find(x=>x.id===id).set};}
  else next.answers[key]=id;
  next.confirmed=false;return next;
 }
 function question(s){const key=['situation','method','approval','goal'].find(x=>!s.answers[x])||'review';return {key,title:key==='situation'?routes[s.route].question:key==='method'?'What do you use today?':key==='approval'?'Where do you want a person?':key==='goal'?'What would make this worthwhile?':'Does this look right?',choices:key==='review'?[]:choices(s,key)};}
 function project(s){const r=routes[s.route],a=s.answers;return {route:s.route,name:r.name,situation:a.situation||'Your recent example',start:r.start,routine:r.routine,method:r.methods.find(x=>x[0]===a.method)?.[1]||'How it works today',human:a.dispute?(s.route==='payments'?'Resolve the dispute first':'Resolve this exception first'):approvalLabels[a.approval]||r.human,goal:r.goals.find(x=>x[0]===a.goal)?.[1]||'Your desired outcome',end:r.end,paused:!!a.dispute,approved:!!a.approval,known:['situation','method','approval','goal'].filter(k=>a[k]).length,submitted:false,reference:null};}
 function confirm(s){if(question(s).key!=='review')throw Error('Finish the example before reviewing it.');return {...copy(s),confirmed:true};}
 const reopen=s=>({...copy(s),confirmed:false});
 const api={create,choose,question,project,confirm,reopen};window.SolborneWalkDemo=api;
 if(typeof document==='undefined')return;
 const host=document.getElementById('walk-demo');if(!host)return;
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);let state=create(params.get('workflow')||params.get('intent')),editing=null;
 function text(id,value){$(id).textContent=value;}
 function render(){
  const p=project(state),q=editing?{key:editing,title:editing==='method'?'Change the process. Keep the rest.':'Change where a person is needed.',choices:choices(state,editing)}:question(state);
  text('demo-job',p.name);text('demo-question',state.confirmed?'Your brief. Ready for review.':q.title);
  text('demo-caption',state.confirmed?'Example complete. Nothing submitted.':editing?'Your other answers stay in place.':q.key==='review'?'Check the map. Change anything.':q.key==='approval'&&p.known>=3?'One answer filled three details. Now, one decision.':'Choose an example to see it take shape.');
  text('demo-current',p.situation);text('demo-method',p.method);text('demo-routine',p.paused?'Routine follow-up paused':p.routine);text('demo-human',p.human);text('demo-outcome',p.goal);
  text('demo-context',p.paused?'The issue. Previous replies. The decision needed.':p.approved?'Your rule is kept in the brief.':'You keep the decisions that matter.');
  $('demo-board').dataset.paused=String(p.paused);$('demo-board').dataset.known=String(p.known);$('demo-board').dataset.ready=String(q.key==='review');
  $('demo-options').replaceChildren();
  if(!state.confirmed)for(const choice of q.choices){const b=document.createElement('button');b.type='button';b.className='demo-choice';b.textContent=choice.label;b.addEventListener('click',()=>{state=choose(state,q.key,choice.id);editing=null;render();$('demo-question').focus({preventScroll:true});});$('demo-options').append(b);}
  $('demo-confirm').hidden=state.confirmed||q.key!=='review';$('demo-edit').hidden=!state.answers.method;$('demo-owner-edit').hidden=!state.answers.approval;
  $('demo-finished').hidden=!state.confirmed;
  const steps=['situation','method','approval','goal'];for(const [i,node] of [...$('demo-progress').children].entries()){const done=!!state.answers[steps[i]];node.dataset.done=String(done);node.setAttribute('aria-label',node.dataset.label+(done?' understood':' still to explore'));}
  for(const b of document.querySelectorAll('[data-demo-route]'))b.setAttribute('aria-pressed',String(b.dataset.demoRoute===state.route));
  $('demo-real-link').href=state.route==='website'?'/signin.html?next=walk':'/signin.html?next=walk&intent=operations&workflow='+state.route;
 }
 for(const b of document.querySelectorAll('[data-demo-route]'))b.addEventListener('click',()=>{state=create(b.dataset.demoRoute);editing=null;render();});
 $('demo-confirm').addEventListener('click',()=>{state=confirm(state);render();});
 $('demo-edit').addEventListener('click',()=>{state=reopen(state);editing='method';render();$('demo-question').focus({preventScroll:true});});
 $('demo-owner-edit').addEventListener('click',()=>{state=reopen(state);editing='approval';render();$('demo-question').focus({preventScroll:true});});
 $('demo-reset').addEventListener('click',()=>{state=create(state.route);editing=null;render();});
 render();
})();
