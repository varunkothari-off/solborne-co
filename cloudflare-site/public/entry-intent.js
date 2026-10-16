// A fixed local destination only. Never accept an arbitrary return URL.
(() => {
  const key='solborne.entry.v1';
  const requested=location.pathname==='/signin.html'&&new URLSearchParams(location.search).get('next')==='walk';
  if(location.pathname==='/signin.html'){
    try{if(requested)sessionStorage.setItem(key,JSON.stringify({flow:'walk',at:Date.now()}));else sessionStorage.removeItem(key);}catch{}
  }
  window.solborneEntryTarget=(session,{consume=false}={})=>{
    let walk=requested;
    try{
      const saved=JSON.parse(sessionStorage.getItem(key)||'null'),age=Date.now()-saved?.at;
      walk ||= saved?.flow==='walk'&&Number.isFinite(age)&&age>=0&&age<15*60*1000;
      if(consume)sessionStorage.removeItem(key);
    }catch{}
    return walk?(session.registered?'/walk.html':'/start.html'):'/canvas.html';
  };
  window.solborneWalkEntry=requested;
})();
