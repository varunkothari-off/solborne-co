// Fixed local destinations and allowlisted campaign context only.
(() => {
 const key='solborne.entry.v1',params=new URLSearchParams(location.search);
 const requested=location.pathname==='/signin.html'&&params.get('next')==='walk';
 const parse=value=>({intent:value?.intent==='operations'?'operations':'website',workflow:value?.intent==='operations'&&['payments','documents','quotes'].includes(value?.workflow)?value.workflow:''});
 const current=parse({intent:params.get('intent'),workflow:params.get('workflow')});
 let saved;try{saved=JSON.parse(sessionStorage.getItem(key)||'null');if(!(saved?.flow==='walk'&&Number.isFinite(saved.at)&&Date.now()-saved.at>=0&&Date.now()-saved.at<15*60*1000))saved=null;}catch{}
 // Navigation only: no identity, brief or consent is stored in this cookie.
 // It also preserves the requested route when session storage is unavailable.
 const cookieKey='solborne.entry.context';
 const writeCookie=value=>{try{document.cookie=cookieKey+'='+value+'; Path=/; Max-Age='+(value?900:0)+'; SameSite=Lax; Secure';}catch{}};
 if(!saved)try{const value=document.cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieKey+'='))?.slice(cookieKey.length+1)||'';const parts=value.split('.'),at=Number(parts[0]);if(parts.length===3&&Number.isFinite(at)&&Date.now()-at>=0&&Date.now()-at<900000&&['website','operations'].includes(parts[1])&&['','payments','documents','quotes'].includes(parts[2]))saved={flow:'walk',at,...parse({intent:parts[1],workflow:parts[2]})};}catch{}
 if(location.pathname==='/signin.html'){
  saved=requested?{flow:'walk',...current,at:Date.now()}:null;
  try{if(saved)sessionStorage.setItem(key,JSON.stringify(saved));else sessionStorage.removeItem(key);}catch{}
  writeCookie(saved?saved.at+'.'+saved.intent+'.'+saved.workflow:'');
 }
 const journey=params.has('intent')?current:parse(saved);
 window.solborneJourney=journey;
 window.solborneJourneyQuery=value=>{const j=parse(value);return j.intent==='operations'?'?intent=operations'+(j.workflow?'&workflow='+j.workflow:''):'';};
 window.solborneEntryTarget=(session,{consume=false}={})=>{
  if(consume){try{sessionStorage.removeItem(key);}catch{}writeCookie('');}
  return requested||saved?(session.registered?'/walk.html':'/start.html')+window.solborneJourneyQuery(journey):'/canvas.html';
 };
 window.solborneWalkEntry=requested;
})();
