/* Live transcription. Capture and transmission run only during an explicit microphone turn. */
(function(global){
 'use strict';
 const MODEL='gemini-3.5-transcribe-live';
 async function connect({csrf,signal,onPartial,onFinal,onError},deps={}){
  const win=deps.window||global,fetcher=deps.fetch||win.fetch.bind(win),Audio=win.AudioContext||win.webkitAudioContext;
  const audio=new Audio();let stream,source,node,socket,closed=false,recording=true,stopping=false,flushResolve,finishResolve,finishReject,finalTimer,endSent=false,ready=false,queued=[],queuedBytes=0;
  const abortError=()=>Object.assign(Error('Cancelled'),{name:'AbortError'});
  const check=()=>{if(closed||signal.aborted)throw abortError();};
  const mute=()=>{stream?.getTracks().forEach(t=>t.enabled=false);try{source?.disconnect();}catch{}};
  const close=()=>{if(closed)return;closed=true;recording=false;mute();win.clearTimeout(finalTimer);queued=[];queuedBytes=0;stream?.getTracks().forEach(t=>t.stop());try{node?.disconnect();socket?.close();}catch{}void audio.close().catch(()=>{});flushResolve?.();finishReject?.(abortError());};
  const fail=()=>{if(closed)return;finishReject?.(Error('Connection interrupted'));onError?.();close();};
  const sendAudio=bytes=>{if(socket.bufferedAmount>128000){fail();return;}let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));socket.send(JSON.stringify({realtimeInput:{audio:{data:win.btoa(raw),mimeType:'audio/pcm;rate=16000'}}}));};
  signal.addEventListener('abort',close,{once:true});
  try{
   const resume=audio.resume();void resume.catch(()=>{});
   const incoming=await win.navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});if(closed||signal.aborted){incoming.getTracks().forEach(t=>t.stop());throw abortError();}stream=incoming;check();await resume;check();
   await audio.audioWorklet.addModule('/walk-pcm-worklet.js');check();
   node=new win.AudioWorkletNode(audio,'solborne-pcm');source=audio.createMediaStreamSource(stream);
   node.port.onmessage=event=>{if(closed)return;if(event.data?.flushed){flushResolve?.();return;}if(!recording&&!stopping)return;const bytes=new Uint8Array(event.data);if(!ready){queuedBytes+=bytes.byteLength;if(queuedBytes>160000){fail();return;}queued.push(bytes);return;}if(socket.readyState!==1){fail();return;}sendAudio(bytes);};
   // Capture opening words locally during setup; bounded to five seconds, never stored persistently.
   source.connect(node);node.connect(audio.destination);
   const r=await fetcher('/api/ai-walk/live-token',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,consent:true,audioConsent:true})});
   const d=await r.json();check();if(!r.ok||!d.ok||d.model!==MODEL||typeof d.token!=='string'||!d.token.startsWith('auth_tokens/'))throw Error('Connection unavailable');
   socket=new win.WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(d.token));
   await new Promise((resolve,reject)=>{
    let setupDone=false;const timer=win.setTimeout(()=>reject(Error('Connection timeout')),12000);
    const failed=()=>{win.clearTimeout(timer);if(!setupDone)reject(Error('Connection interrupted'));else fail();};
    socket.onopen=()=>{if(closed)return;socket.send(JSON.stringify({setup:{model:'models/'+MODEL,generationConfig:{responseModalities:['TEXT']},realtimeInputConfig:{automaticActivityDetection:{disabled:true}},inputAudioTranscription:{}}}));};
    socket.onmessage=async event=>{try{
     const raw=typeof event.data==='string'?event.data:await event.data.text();if(raw.length>50000)throw Error('Response too large');check();const message=JSON.parse(raw);if(message.error)throw Error('Provider unavailable');
     if(message.setupComplete){setupDone=true;win.clearTimeout(timer);resolve();}
     const content=message.serverContent;
     if((recording||stopping)&&content){if(typeof content.interimInputTranscription?.text==='string')onPartial(content.interimInputTranscription.text);if(typeof content.inputTranscription?.text==='string')onFinal(content.inputTranscription.text);}
     // Deliver any final transcript in the same envelope before settling the turn.
     if(endSent&&message.voiceActivity?.type==='ACTIVITY_END')finishResolve?.();
    }catch{failed();}};
    socket.onerror=failed;socket.onclose=failed;
    signal.addEventListener('abort',()=>{win.clearTimeout(timer);reject(abortError());},{once:true});
   });check();ready=true;socket.send(JSON.stringify({realtimeInput:{activityStart:{}}}));for(const bytes of queued)sendAudio(bytes);queued=[];queuedBytes=0;
   const session={close,async start(){check();if(recording||stopping)return;endSent=false;await audio.resume();check();socket.send(JSON.stringify({realtimeInput:{activityStart:{}}}));recording=true;stream.getTracks().forEach(t=>t.enabled=true);source.connect(node);},async stop(){
    if(closed||!recording)return;recording=false;stopping=true;mute();
    try{
     await new Promise((resolve,reject)=>{const timer=win.setTimeout(()=>reject(Error('Audio flush timeout')),1000);flushResolve=()=>{win.clearTimeout(timer);resolve();};node.port.postMessage({flush:true});});check();
     await audio.suspend();check();
     await new Promise((resolve,reject)=>{finalTimer=win.setTimeout(()=>reject(Error('Final transcript timeout')),12000);finishReject=reject;finishResolve=()=>{win.clearTimeout(finalTimer);resolve();};endSent=true;socket.send(JSON.stringify({realtimeInput:{activityEnd:{}}}));});
     stopping=false;finishResolve=finishReject=null;
    }catch(error){close();throw error;}
   }};return session;
  }catch(error){close();throw error;}
 }
 function create(options={}){
  const win=options.window||global,doc=options.document||win.document,$=id=>doc.getElementById(id),context=()=>options.getContext?.()||{};
  const supported=!!(win.isSecureContext&&(win.AudioContext||win.webkitAudioContext)&&win.AudioWorkletNode&&win.WebSocket&&win.navigator?.mediaDevices?.getUserMedia);
  let phase='idle',active=false,id=0,session=null,abort=null,tick=null,finalText='',partial='',destroyed=false,settling=null;
  let regionStart=0,regionEnd=0,lastValue='',sealedPrefix='',applying=false;
  function text(value,error=false){$('voice-status').textContent=value;$('voice-status').setAttribute('role',error?'alert':'status');}
  function cleanup(){win.clearInterval(tick);tick=null;session?.close();session=null;}
  function update(){
   const ctx=context(),consent=ctx.consent&&$('voice-consent').checked;if(!consent&&(active||session)){cancel('Microphone disconnected. Your answer is kept.');return;}
   $('voice-start').disabled=!supported||!ctx.allowed||!consent||active;$('voice-start').hidden=active;
   $('voice-stop').hidden=phase!=='recording';$('voice-stop').setAttribute('aria-label','Stop microphone');$('voice-timer').hidden=phase!=='recording';
   $('voice-cancel').hidden=!active&&!session;$('voice-retry').hidden=true;$('voice-again').hidden=true;
   $('voice-review').hidden=true;$('voice-use').hidden=true;
   $('voice-consent').disabled=!ctx.consent&&!$('voice-consent').checked;$('voice-tools').dataset.state=phase;
   $('voice-note').textContent='Speak or type. Edit before you send.';
  }
  function setPhase(next){phase=next;const value=['requesting','recording','transcribing'].includes(next);active=value;options.onBusy?.(value);update();}
  function cancel(message='Microphone disconnected. Your answer is kept.'){
   id++;abort?.abort();abort=null;cleanup();finalText=partial='';setPhase('idle');text(message);
  }
  function interrupted(){cancel();text('Connection interrupted. Your words are kept; the ending may be missing. Check your answer, then tap the microphone to reconnect.',true);}
  function beginRegion(){const answer=$('ai-answer');lastValue=answer.value;regionStart=regionEnd=answer.value.length;sealedPrefix='';finalText=partial='';}
  function render(){
   const answer=$('ai-answer'),spoken=(finalText+partial).trim();let words=spoken;
   if(sealedPrefix){let i=0;while(i<sealedPrefix.length&&i<spoken.length&&sealedPrefix[i]===spoken[i])i++;words=spoken.slice(Math.max(i,sealedPrefix.length)).trimStart();}
   const before=answer.value.slice(0,regionStart),after=answer.value.slice(regionEnd),separator=words&&before&&!/\s$/.test(before)?'\n':'';
   const inserted=separator+words;const start=answer.selectionStart,end=answer.selectionEnd;
   applying=true;answer.value=before+inserted+after;regionEnd=regionStart+inserted.length;lastValue=answer.value;answer.dispatchEvent(new Event('input',{bubbles:true}));applying=false;
   // Avoid moving a user's selection outside the dictated span.
   if(typeof answer.setSelectionRange==='function'&&typeof start==='number'&&end<=regionStart)answer.setSelectionRange(start,end);
  }
  function edited(){if(applying||!active)return;const answer=$('ai-answer'),next=answer.value;let left=0;while(left<lastValue.length&&left<next.length&&lastValue[left]===next[left])left++;let oldRight=lastValue.length,newRight=next.length;while(oldRight>left&&newRight>left&&lastValue[oldRight-1]===next[newRight-1]){oldRight--;newRight--;}
   const delta=next.length-lastValue.length;if(oldRight<=regionStart){regionStart+=delta;regionEnd+=delta;}else if(left<regionEnd){sealedPrefix=(finalText+partial).trim();regionStart=regionEnd=typeof answer.selectionStart==='number'?answer.selectionStart:next.length;}lastValue=next;
  }
  async function start(){
   const ctx=context();if(destroyed||active||!supported||!ctx.allowed||!ctx.consent||!$('voice-consent').checked)return;
   const attempt=++id;beginRegion();setPhase('requesting');text(session?'Microphone on…':'Microphone on. Preparing live text…');
   try{
    if(session)await session.start();else{
     abort=new AbortController();const connectionSignal=abort.signal;const incoming=await (options.connect||connect)({csrf:ctx.csrf,signal:abort.signal,
      onPartial:words=>{if(!active||destroyed||connectionSignal.aborted)return;partial=words;render();},
      onFinal:words=>{if(!active||destroyed||connectionSignal.aborted)return;finalText+=(finalText&&!/\s$/.test(finalText)&&!/^\s/.test(words)?' ':'')+words;partial='';render();},
      onError:()=>{if(!destroyed&&!connectionSignal.aborted&&(active||session))interrupted();}});
     if(attempt!==id||destroyed){incoming.close();return;}session=incoming;
    }
    if(attempt!==id)return;setPhase('recording');text('Listening. Your words appear in your answer.');const started=Date.now();$('voice-timer').textContent='0:00';tick=win.setInterval(()=>{const s=Math.floor((Date.now()-started)/1000);$('voice-timer').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0');},1000);
   }catch(error){if(attempt!==id)return;cleanup();setPhase('idle');text(error?.name==='NotAllowedError'?'Microphone access was not allowed. Enable it in browser settings, or type your answer.':'Live text couldn’t connect. Opening words may be missing. Tap the microphone to try again, or type your answer.',true);}
  }
  async function stop(){
   if(settling)return settling;if(phase!=='recording'||!session)return;const attempt=id;win.clearInterval(tick);setPhase('transcribing');text('Microphone paused. Finishing your words…');
   settling=(async()=>{try{await session.stop();if(attempt!==id)return;/* Preserve any visible interim tail if the provider supplied no final replacement. */setPhase('idle');text('Microphone paused. Edit or send your answer.');}catch{if(attempt===id)interrupted();}finally{settling=null;}})();return settling;
  }
  const handlers=[];function bind(target,event,fn){target.addEventListener(event,fn);handlers.push(()=>target.removeEventListener?.(event,fn));}
  bind($('voice-start'),'click',start);bind($('voice-stop'),'click',stop);bind($('voice-cancel'),'click',()=>cancel());bind($('voice-again'),'click',start);bind($('ai-answer'),'input',edited);
  for(const name of ['voice-consent','ai-consent'])bind($(name),'change',()=>{if(!$(name).checked)cancel('Microphone disconnected. Your answer is kept.');else update();});
  for(const event of ['pagehide','beforeunload'])bind(win,event,()=>cancel(''));
  update();if(!supported)text('Live audio isn’t available here. Type, or use your keyboard microphone.');
  return {update,cancel,stop,settle:stop,destroy(){destroyed=true;cancel('');for(const remove of handlers)remove();},get phase(){return phase;}};
 }
 global.SolborneLiveVoice={create,connect,MODEL};
})(window);
