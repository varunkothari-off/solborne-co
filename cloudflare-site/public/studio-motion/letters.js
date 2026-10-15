import {step} from './letter-physics.js';
const board = document.querySelector('.letter-board');
if (board) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const states = [...board.querySelectorAll('.play-letter')].map(el => ({el,x:0,y:0,vx:0,vy:0,drag:null}));
  let frame=0, last=0;
  const paint = s => {s.el.style.transform=`translate(${s.x}px,${s.y}px)`;};
  const reset = () => {cancelAnimationFrame(frame);frame=0;states.forEach(s=>{s.x=s.y=s.vx=s.vy=0;s.drag=null;s.el.classList.remove("grabbed");paint(s);});};
  const tick = now => {
    const dt=Math.min(.025,(now-last)/1000);last=now;let moving=false;
    states.forEach(s=>{if(!s.drag){step(s,dt);paint(s);}moving ||= Boolean(s.drag || s.x || s.y || s.vx || s.vy);});
    frame=moving?requestAnimationFrame(tick):0;
  };
  const run = () => {if(reduced.matches){states.forEach(s=>{if(!s.drag){s.x=s.y=s.vx=s.vy=0;paint(s);}});return;}if(!frame){last=performance.now();frame=requestAnimationFrame(tick);}};
  states.forEach((s,i)=>{
    s.el.disabled=false;
    s.el.addEventListener('click',e=>{if(e.detail===0)return;if(Math.abs(s.x)<1&&Math.abs(s.y)<1){s.vx=(i%2?1:-1)*130;s.vy=-100;run();}});
    s.el.addEventListener('pointerdown',e=>{
      if(e.button!==0)return;
      const r=s.el.getBoundingClientRect(),b=board.getBoundingClientRect();
      s.drag={id:e.pointerId,startX:e.clientX-s.x,startY:e.clientY-s.y,t:e.timeStamp,px:s.x,py:s.y,minX:b.left-r.left+s.x+4,maxX:b.right-r.right+s.x-4};
      s.vx=s.vy=0;s.el.setPointerCapture(e.pointerId);s.el.classList.add('grabbed');
    });
    s.el.addEventListener('pointermove',e=>{
      const d=s.drag;if(!d||e.pointerId!==d.id)return;
      s.x=Math.max(d.minX,Math.min(d.maxX,e.clientX-d.startX));s.y=Math.max(-45,Math.min(45,e.clientY-d.startY));
      const dt=Math.max(8,e.timeStamp-d.t)/1000;
      s.vx=Math.max(-450,Math.min(450,(s.x-d.px)/dt));s.vy=Math.max(-250,Math.min(250,(s.y-d.py)/dt));
      d.px=s.x;d.py=s.y;d.t=e.timeStamp;paint(s);
    });
    const release=e=>{if(!s.drag||e.pointerId!==s.drag.id)return;if(e.type!=='pointerup'||e.timeStamp-s.drag.t>100)s.vx=s.vy=0;s.drag=null;s.el.classList.remove('grabbed');run();};
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>s.el.addEventListener(t,release));
    s.el.addEventListener('keydown',e=>{
      if(e.key==='Escape'){reset();return;}
      const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1],' ':[i%2?1:-1,-1],Enter:[i%2?1:-1,-1]};
      if(!dirs[e.key])return;e.preventDefault();const [x,y]=dirs[e.key];s.vx=x*130;s.vy=y*100;run();
    });
  });
  board.querySelector('.letter-help').hidden=false;
  board.querySelector('[data-reset-letters]').addEventListener('click',reset);
  addEventListener('resize',reset);reduced.addEventListener('change',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
}
