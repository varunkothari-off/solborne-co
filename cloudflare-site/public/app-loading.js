/* Opt-in feedback for account session checks. Never covers or disables content. */
(()=>{
  'use strict';
  if(window.SolborneLoading)return;
  const pending=new Set();
  let panel,copy,links,showTimer,slowTimer,dismissed=false;
  function clearTimers(){clearTimeout(showTimer);clearTimeout(slowTimer);showTimer=slowTimer=undefined;}
  function hide(){clearTimers();if(panel)panel.hidden=true;}
  function element(tag,className,text){const node=document.createElement(tag);node.className=className;if(text)node.textContent=text;return node;}
  function create(){
    if(panel)return;
    panel=element('aside','app-loading');panel.setAttribute('aria-label','Opening your Solborne space');panel.hidden=true;
    const mark=element('span','app-loading-mark');mark.setAttribute('aria-hidden','true');
    const image=element('img','');image.src='/assets/bearing.svg';image.alt='';image.width=34;image.height=40;mark.append(image);
    const content=element('div','app-loading-content');
    copy=element('p','app-loading-copy','Opening your space…');copy.setAttribute('role','status');copy.setAttribute('aria-live','polite');
    links=element('div','app-loading-links');links.hidden=true;
    const home=element('a','','Back to home');home.href='/';
    const dismiss=element('button','','Dismiss');dismiss.type='button';dismiss.addEventListener('click',()=>{dismissed=true;hide();});
    links.append(home,dismiss);content.append(copy,links);panel.append(mark,content);document.body.append(panel);
  }
  function start(){
    clearTimers();dismissed=false;
    if(panel){panel.hidden=true;panel.setAttribute('data-state','loading');copy.textContent='Opening your space…';links.hidden=true;}
    showTimer=setTimeout(()=>{if(!pending.size||dismissed)return;create();panel.setAttribute('data-state','loading');panel.hidden=false;},150);
    slowTimer=setTimeout(()=>{
      if(!pending.size||dismissed)return;
      create();panel.hidden=false;panel.setAttribute('data-state','slow');copy.textContent='This is taking longer than usual. You can keep browsing.';links.hidden=false;
    },8000);
  }
  window.SolborneLoading=Object.freeze({begin(){
    const token={};pending.add(token);
    if(pending.size===1||dismissed)start();
    let finished=false;
    return ()=>{if(finished)return;finished=true;pending.delete(token);if(!pending.size)hide();};
  }});
  window.addEventListener('pagehide',()=>{pending.clear();dismissed=false;hide();});
  if(document.body?.dataset.loadingDemo==='true')window.SolborneLoading.begin();
})();
