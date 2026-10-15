import {step} from './letter-physics.js';
// Only the INDIA artwork is interactive; the Solborne wordmark stays intact.
const board = document.querySelector('.india-board');
if (board) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const layer=document.createElement('div');
  layer.className='india-flight-layer';
  document.body.append(layer);
  const states = [...board.querySelectorAll('.play-shape')].map(el => ({el,x:0,y:0,vx:0,vy:0,drag:null,suppressClick:false,home:null}));
  let frame=0, last=0;
  const float = s => {
    if(s.home)return;
    const rect=s.el.getBoundingClientRect(),focused=document.activeElement===s.el;
    s.home=document.createElement('span');s.home.className='india-shape-home';s.home.setAttribute('aria-hidden','true');
    s.home.style.height=`${rect.height}px`;
    s.el.before(s.home);layer.append(s.el);s.el.classList.add('in-flight');
    s.el.style.width=`${rect.width}px`;s.el.style.height=`${rect.height}px`;
    if(focused)s.el.focus({preventScroll:true});
  };
  const land = s => {
    if(!s.home)return;
    const focused=document.activeElement===s.el;
    s.home.replaceWith(s.el);s.home=null;s.el.classList.remove('in-flight');
    for(const prop of ['left','top','width','height'])s.el.style.removeProperty(prop);
    if(focused)s.el.focus({preventScroll:true});
  };
  const paint = s => {
    if(s.drag||s.x||s.y)float(s);
    if(s.home){const home=s.home.getBoundingClientRect();s.el.style.left=`${home.left}px`;s.el.style.top=`${home.top}px`;}
    s.el.style.transform=`translate(${s.x}px,${s.y}px)`;
    if(!s.drag&&!s.x&&!s.y&&!s.vx&&!s.vy)land(s);
  };
  const reset = () => {
    cancelAnimationFrame(frame);frame=0;
    states.forEach(s=>{
      const id=s.drag?.id;s.drag=null;
      if(id!==undefined&&s.el.hasPointerCapture(id))s.el.releasePointerCapture(id);
      s.x=s.y=s.vx=s.vy=0;s.el.classList.remove('grabbed');paint(s);
    });
  };
  const tick = now => {
    const dt=Math.min(.025,(now-last)/1000);last=now;let moving=false;
    states.forEach(s=>{if(!s.drag){step(s,dt);paint(s);}moving ||= Boolean(s.drag || s.x || s.y || s.vx || s.vy);});
    frame=moving?requestAnimationFrame(tick):0;
  };
  const run = () => {
    if(reduced.matches){states.forEach(s=>{if(!s.drag){s.x=s.y=s.vx=s.vy=0;paint(s);}});return;}
    if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}
  };
  states.forEach((s,i)=>{
    s.el.disabled=false;
    s.el.addEventListener('click',e=>{
      if(s.suppressClick){s.suppressClick=false;return;}
      // Keyboard motion is handled once by keydown; avoid a second native click impulse.
      if(e.detail===0)return;
      if(Math.abs(s.x)<1&&Math.abs(s.y)<1){s.vx=(i%2?1:-1)*130;s.vy=-100;run();}
    });
    s.el.addEventListener('pointerdown',e=>{
      if(!e.isPrimary||e.button!==0)return;
      const r=s.el.getBoundingClientRect();
      float(s);
      s.suppressClick=false;
      s.drag={id:e.pointerId,grabX:e.clientX-r.left,grabY:e.clientY-r.top,t:e.timeStamp,px:s.x,py:s.y,moved:false};
      paint(s);
      s.vx=s.vy=0;s.el.setPointerCapture(e.pointerId);s.el.classList.add('grabbed');
    });
    s.el.addEventListener('pointermove',e=>{
      const d=s.drag;if(!d||e.pointerId!==d.id)return;
      const home=s.home.getBoundingClientRect();
      s.x=e.clientX-home.left-d.grabX;s.y=e.clientY-home.top-d.grabY;
      if(Math.abs(s.x-d.px)+Math.abs(s.y-d.py)>2)d.moved=true;
      const dt=Math.max(8,e.timeStamp-d.t)/1000;
      s.vx=(s.x-d.px)/dt;s.vy=(s.y-d.py)/dt;
      d.px=s.x;d.py=s.y;d.t=e.timeStamp;paint(s);
    });
    const release=e=>{
      if(!s.drag||e.pointerId!==s.drag.id)return;
      s.suppressClick=s.drag.moved;
      if(e.type!=='pointerup'||e.timeStamp-s.drag.t>100)s.vx=s.vy=0;
      s.drag=null;s.el.classList.remove('grabbed');run();
    };
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>s.el.addEventListener(t,release));
    s.el.addEventListener('keydown',e=>{
      if(e.key==='Escape'){reset();return;}
      const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],' ':[i%2?1:-1,-1],Enter:[i%2?1:-1,-1]};
      if(!dirs[e.key])return;e.preventDefault();const [x,y]=dirs[e.key];s.vx=x*130;s.vy=y*100;run();
    });
  });
  const instructions=board.querySelector('#shape-instructions');
  if(instructions?.firstChild)instructions.firstChild.textContent='Drag the INDIA shapes anywhere. Throw them off-screen. They always find their way home. ';
  board.querySelector('.letter-help').hidden=false;
  board.querySelector('[data-reset-shapes]').addEventListener('click',reset);
  addEventListener('resize',reset);reduced.addEventListener('change',reset);
  addEventListener('scroll',()=>states.forEach(s=>{if(s.home)paint(s);}),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
}
/* Fit the complete static name, including & Co., to its divider width without stretching glyphs. */
const wordmark=document.querySelector('.footer-wordmark');
if(wordmark){
  const lockup=wordmark.querySelector('.wordmark-lockup');
  const fit=()=>{
    if(!lockup)return;
    const available=wordmark.clientWidth-1,measured=lockup.getBoundingClientRect().width;
    if(available>0&&measured>0)wordmark.style.fontSize=`${parseFloat(getComputedStyle(wordmark).fontSize)*available/measured}px`;
  };
  let width=0;
  new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(next!==width){width=next;fit();}}).observe(wordmark);
  addEventListener('resize',fit);
  document.fonts.ready.then(fit);
  fit();
}
