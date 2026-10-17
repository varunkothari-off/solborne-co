// A short, interruptible explanation. Every stage also works as a button.
(()=>{
 const section=document.querySelector('.process-story');if(!section)return;
 const panels=[...section.querySelectorAll('.process-panel')],buttons=[...section.querySelectorAll('[data-process-step]')],toggle=section.querySelector('.process-motion'),description=section.querySelector('.process-description'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const captions=['First, we get to know your business.','Then, we research and design your website.','Our team reviews it. You approve it before release.'];
 let current=0,timer=null,paused=false,near=false,finished=false;
 function stop(){clearTimeout(timer);timer=null;}
 function show(index){panels.forEach((p,i)=>{p.classList.toggle('is-leaving',i===current&&i!==index);p.classList.toggle('is-current',i===index);p.inert=i!==index;p.setAttribute('aria-hidden',String(i!==index));});current=index;buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));description.textContent=captions[index];}
 function schedule(){stop();if(paused||reduce.matches||!near||document.hidden||finished)return;timer=setTimeout(()=>{show(current+1);if(current===panels.length-1){finished=true;toggle.textContent='Replay animation';toggle.setAttribute('aria-pressed','false');}else schedule();},2800);}
 buttons.forEach((b,i)=>b.addEventListener('click',()=>{stop();paused=true;finished=false;show(i);toggle.textContent='Play animation';toggle.setAttribute('aria-pressed','true');}));
 toggle.addEventListener('click',()=>{if(finished||current===panels.length-1){show(0);finished=false;paused=false;}else paused=!paused;toggle.textContent=paused?'Play animation':'Pause animation';toggle.setAttribute('aria-pressed',String(paused));schedule();});
 reduce.addEventListener('change',()=>{stop();if(!reduce.matches)schedule();});document.addEventListener('visibilitychange',schedule);
 section.classList.add('process-enhanced');show(0);
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{near=entries[0].isIntersecting;schedule();},{threshold:.35}).observe(section.querySelector('.process-visual'));else{near=true;schedule();}
})();
