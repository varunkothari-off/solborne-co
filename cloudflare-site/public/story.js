(()=>{
 const clamp=(v,min=0,max=1)=>Math.min(max,Math.max(min,v));
 function position(rects,height,readingLine){
  if(!rects.length)return {index:0,progress:0};
  const focus=Number.isFinite(readingLine)?readingLine:Math.max(0,height)*.44;let index=0;
  for(let i=0;i<rects.length;i++)if(rects[i].top<=focus)index=i;
  const r=rects[index],progress=clamp((focus-r.top)/Math.max(1,r.height));
  return {index,progress};
 }
 window.SolborneStory={position};
 if(typeof document==='undefined')return;
 const chapters=[...document.querySelectorAll('[data-chapter]')],canvas=document.querySelector('.story-canvas');if(!canvas||!chapters.length)return;
 document.documentElement.classList.add('story-enhanced');
 const layers=[...canvas.querySelectorAll('[data-layer]')],links=[...canvas.querySelectorAll('.chapter-nav a')],token=document.getElementById('work-token'),halo=document.getElementById('work-halo'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),labels=['Everything comes back to you','Routine work can move','Exceptions come with context','Outcomes inform the next step','Your business, in view','One conversation. One clear brief.','Real work. Clearly labelled.'];
 let pending=false,current=-1;
 const routes=[[[122,120],[518,120],[410,339],[122,300],[122,120]],[[120,230],[320,230],[520,230]],[[78,220],[285,220],[500,340]],[[170,160],[475,160],[570,265],[475,365],[170,365],[70,265],[170,160]],[[157,412],[483,412]],[[360,316],[360,356]],[[120,400],[520,420]]];
 function interpolate(points,p){const scaled=clamp(p)*(points.length-1),i=Math.min(points.length-2,Math.floor(scaled)),t=scaled-i;return {x:points[i][0]+(points[i+1][0]-points[i][0])*t,y:points[i][1]+(points[i+1][1]-points[i][1])*t};}
 function update(){
  pending=false;const stacked=getComputedStyle(document.querySelector('.story-layout')).display==='block',edge=canvas.getBoundingClientRect().bottom;
  const {index,progress}=position(chapters.map(x=>{const r=x.getBoundingClientRect();return {top:r.top,height:r.height};}),innerHeight,stacked?edge+(innerHeight-edge)*.45:undefined);
  if(index!==current){current=index;layers.forEach((layer,i)=>{layer.classList.toggle('is-active',i===index);layer.setAttribute('aria-hidden',String(i!==index));});links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});document.getElementById('scene-state').textContent=labels[index];}
  const point=interpolate(routes[index],progress);for(const el of [token,halo]){el.setAttribute('cx',String(point.x));el.setAttribute('cy',String(point.y));}
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
 canvas.classList.add('is-enhanced');addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});reduce.addEventListener('change',schedule);update();
 const workflows={payments:{steps:['Invoice','Check status','Follow up'],exception:'Scope disputed'},documents:{steps:['Request','Check items','Follow up'],exception:'Wrong document'},quotes:{steps:['Capture','Draft quote','Approval'],exception:'Unusual scope'}};
 for(const button of canvas.querySelectorAll('[data-workflow]'))button.addEventListener('click',()=>{
  const key=button.dataset.workflow,data=workflows[key];if(!data)return;
  canvas.querySelectorAll('[data-workflow]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  ['routine-a','routine-b','routine-c'].forEach((id,i)=>document.getElementById(id).textContent=data.steps[i]);document.getElementById('exception-label').textContent=data.exception;
  document.getElementById('workflow-start').href='/signin.html?next=walk&intent=operations&workflow='+key;
  document.querySelectorAll('a[href^="/walk-demo.html"]').forEach(a=>a.href='/walk-demo.html?workflow='+key);
 });
})();
