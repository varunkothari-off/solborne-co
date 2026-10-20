/* Live transcription transport. No long-lived provider secret or persistent audio storage. */
(function(global){
 'use strict';
 const MODEL='gemini-3.5-transcribe-live',MAX_MS=60000,MAX_TEXT=2000;
 async function connect({csrf,signal,onPartial,onFinal,onError},deps={}){
  const win=deps.window||global,fetcher=deps.fetch||win.fetch.bind(win),Audio=win.AudioContext||win.webkitAudioContext;
  const audio=new Audio(),resume=audio.resume();void resume.catch(()=>{});let stream,source,node,socket,closed=false,stopping=false,flushResolve,finishResolve,finishReject,finalTimer,endSent=false;
  const abortError=()=>Object.assign(Error('Cancelled'),{name:'AbortError'});
  const close=()=>{if(closed)return;closed=true;win.clearTimeout(finalTimer);stream?.getTracks().forEach(t=>t.stop());try{node?.disconnect();source?.disconnect();socket?.close();}catch{}void audio.close().catch(()=>{});flushResolve?.();finishReject?.(abortError());};
  const check=()=>{if(closed||signal.aborted)throw abortError();};
  signal.addEventListener('abort',close,{once:true});
  try{
   const incoming=await win.navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});if(closed||signal.aborted){incoming.getTracks().forEach(t=>t.stop());throw abortError();}stream=incoming;check();await resume;check();
   const r=await fetcher('/api/ai-walk/live-token',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf,consent:true,audioConsent:true})});
   const d=await r.json();check();if(!r.ok||!d.ok||d.model!==MODEL||typeof d.token!=='string'||!d.token.startsWith('auth_tokens/'))throw Error('Connection unavailable');
   socket=new win.WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(d.token));
   await new Promise((resolve,reject)=>{
    let ready=false;const timer=win.setTimeout(()=>reject(Error('Connection timeout')),12000);
    const fail=()=>{win.clearTimeout(timer);if(!ready)reject(Error('Connection interrupted'));else if(!closed&&!stopping)onError();else if(!closed){finishReject?.(Error('Connection interrupted'));}};
    socket.onopen=()=>{if(closed)return;socket.send(JSON.stringify({setup:{model:'models/'+MODEL,generationConfig:{responseModalities:['TEXT']},realtimeInputConfig:{automaticActivityDetection:{disabled:true}},inputAudioTranscription:{}}}));};
    socket.onmessage=async event=>{try{
     const raw=typeof event.data==='string'?event.data:await event.data.text();if(raw.length>50000)throw Error('Response too large');check();const message=JSON.parse(raw);
     if(message.error)throw Error('Provider unavailable');
     if(message.setupComplete){ready=true;win.clearTimeout(timer);resolve();}
     if(endSent&&message.voiceActivity?.type==='ACTIVITY_END')finishResolve?.();
     const content=message.serverContent;if(!content)return;
     if(typeof content.interimInputTranscription?.text==='string')onPartial(content.interimInputTranscription.text);
     if(typeof content.inputTranscription?.text==='string')onFinal(content.inputTranscription.text);

    }catch{if(!closed){fail();close();}}};
    socket.onerror=fail;socket.onclose=fail;
    signal.addEventListener('abort',()=>{win.clearTimeout(timer);reject(abortError());},{once:true});
   });check();
   await audio.audioWorklet.addModule('/walk-pcm-worklet.js');check();
   node=new win.AudioWorkletNode(audio,'solborne-pcm');source=audio.createMediaStreamSource(stream);
   node.port.onmessage=event=>{if(closed)return;if(event.data?.flushed){flushResolve?.();return;}if(socket.readyState!==1)return;const bytes=new Uint8Array(event.data);let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));if(socket.bufferedAmount>128000){onError();close();return;}socket.send(JSON.stringify({realtimeInput:{audio:{data:win.btoa(raw),mimeType:'audio/pcm;rate=16000'}}}));};
   socket.send(JSON.stringify({realtimeInput:{activityStart:{}}}));
   source.connect(node);node.connect(audio.destination);
   return {close,async stop(){
    if(closed)return;stopping=true;stream.getTracks().forEach(t=>t.stop());source.disconnect();
    await new Promise((resolve,reject)=>{const timer=win.setTimeout(()=>reject(Error('Audio flush timeout')),1000);flushResolve=()=>{win.clearTimeout(timer);resolve();};node.port.postMessage({flush:true});});check();
    node.disconnect();await audio.suspend();check();
    await new Promise((resolve,reject)=>{finalTimer=win.setTimeout(()=>reject(Error('Final transcript timeout')),12000);finishReject=reject;finishResolve=()=>{win.clearTimeout(finalTimer);resolve();};endSent=true;socket.send(JSON.stringify({realtimeInput:{activityEnd:{}}}));});
    close();
   }};
  }catch(error){close();throw error;}
 }
 function create(options={}){
  const win=options.window||global,doc=options.document||win.document,$=id=>doc.getElementById(id),context=()=>options.getContext?.()||{};
  const supported=!!(win.isSecureContext&&(win.AudioContext||win.webkitAudioContext)&&win.AudioWorkletNode&&win.WebSocket&&win.navigator?.mediaDevices?.getUserMedia);
  let phase='idle',active=false,id=0,session=null,abort=null,timer=null,tick=null,finalText='',partial='',destroyed=false;
  function text(value,error=false){$('voice-status').textContent=value;$('voice-status').setAttribute('role',error?'alert':'status');}
  function cleanup(){win.clearTimeout(timer);win.clearInterval(tick);timer=tick=null;session?.close();session=null;}
  function update(){
   const ctx=context(),consent=ctx.consent&&$('voice-consent').checked;if(!consent&&active){cancel('Consent withdrawn. Microphone off.');return;}
   $('voice-start').disabled=!supported||!ctx.allowed||!consent||active;$('voice-start').hidden=active||phase==='review'||phase==='error';
   $('voice-stop').hidden=phase!=='recording';$('voice-stop').textContent='Stop & review';$('voice-timer').hidden=phase!=='recording';
   $('voice-cancel').hidden=phase==='idle';$('voice-retry').hidden=true;$('voice-again').hidden=phase!=='error';$('voice-again').disabled=!ctx.allowed||!consent||!supported;
   $('voice-review').hidden=!['recording','transcribing','review'].includes(phase);$('voice-transcript').readOnly=phase!=='review';$('voice-use').hidden=phase!=='review';$('voice-use').disabled=!ctx.allowed||!consent;
   $('voice-consent').disabled=!ctx.consent&&!$('voice-consent').checked;$('voice-tools').dataset.state=phase;
   $('voice-note').textContent='Up to one minute. Your audio streams to Google as you speak. Review and edit the transcript before sending your answer.';
  }
  function setPhase(next){phase=next;const value=['requesting','recording','transcribing'].includes(next);if(value!==active){active=value;options.onBusy?.(value);}update();}
  function cancel(message='Discarded here. Audio already streamed may still be processed by Google. Your answer has not changed.'){
   id++;abort?.abort();abort=null;cleanup();finalText=partial='';$('voice-transcript').value='';setPhase('idle');text(message);
  }
  function interrupted(){
   id++;abort?.abort();cleanup();const captured=(finalText+partial).trim();partial='';$('voice-transcript').value=captured;setPhase(captured?'review':'error');text('The connection was interrupted. These words are unconfirmed and the ending may be missing. Check and edit them, or record again.',true);
  }
  async function start(){
   const ctx=context();if(destroyed||active||!supported||!ctx.allowed||!ctx.consent||!$('voice-consent').checked)return;
   const attempt=++id;finalText=partial='';$('voice-transcript').value='';abort=new AbortController();setPhase('requesting');text('Connecting your microphone…');
   try{
    const incoming=await (options.connect||connect)({csrf:ctx.csrf,signal:abort.signal,
     onPartial:words=>{if(attempt!==id||!active)return;partial=words;if(finalText.length+partial.length>12000){interrupted();return;}$('voice-transcript').value=(finalText+partial).trim();},
     onFinal:words=>{if(attempt!==id||!active)return;finalText+=(finalText&&!/\s$/.test(finalText)&&!/^\s/.test(words)?' ':'')+words;partial='';if(finalText.length>12000){interrupted();return;}$('voice-transcript').value=finalText.trim();},
     onError:()=>{if(attempt===id&&active)interrupted();}});
    if(attempt!==id||destroyed){incoming.close();return;}session=incoming;setPhase('recording');text('Listening. Your words appear below. Stop when you’re ready.');
    const started=Date.now();$('voice-timer').textContent='0:00 / 1:00';tick=win.setInterval(()=>{const s=Math.min(60,Math.floor((Date.now()-started)/1000));$('voice-timer').textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')+' / 1:00';},1000);timer=win.setTimeout(()=>void stop(),MAX_MS);
   }catch(error){if(attempt!==id)return;cleanup();setPhase('error');text(error?.name==='NotAllowedError'?'Microphone access was not allowed. Enable it in browser settings, or type your answer.':'Live transcription couldn’t connect. Record again or type your answer.',true);}
  }
  async function stop(){
   if(phase!=='recording'||!session)return;const attempt=id;win.clearTimeout(timer);win.clearInterval(tick);setPhase('transcribing');text('Microphone off. Finishing your transcript…');
   try{await session.stop();if(attempt!==id)return;cleanup();partial='';$('voice-transcript').value=finalText.trim();if(!finalText.trim()){setPhase('error');text('No clear words were captured. Record again, or type your answer.',true);return;}setPhase('review');text('Check your words, then add them to your answer.');$('voice-transcript').focus();}
   catch{if(attempt===id)interrupted();}
  }
  function use(){const ctx=context();if(phase!=='review'||!ctx.allowed||!ctx.consent||!$('voice-consent').checked)return;const words=$('voice-transcript').value.trim(),answer=$('ai-answer');if(!words)return text('Add some words, or discard this transcript.',true);const combined=answer.value+(answer.value&&!/\s$/.test(answer.value)?'\n':'')+words;if(combined.length>MAX_TEXT)return text('Shorten your answer and transcript to 2,000 characters. Your typed answer has not changed.',true);answer.value=combined;answer.dispatchEvent(new Event('input',{bubbles:true}));cancel('Transcript added. Review your answer, then choose Send answer.');answer.focus();}
  const handlers=[];function bind(target,event,fn){target.addEventListener(event,fn);handlers.push(()=>target.removeEventListener?.(event,fn));}
  bind($('voice-start'),'click',start);bind($('voice-stop'),'click',stop);bind($('voice-cancel'),'click',()=>cancel());bind($('voice-again'),'click',start);bind($('voice-use'),'click',use);
  for(const name of ['voice-consent','ai-consent'])bind($(name),'change',()=>{if(!$(name).checked)cancel('Consent withdrawn. Microphone off. Local transcript discarded.');else update();});
  for(const event of ['pagehide','beforeunload'])bind(win,event,()=>cancel(''));
  update();if(!supported)text('Live audio isn’t available in this browser. Type your answer, or use your device’s keyboard microphone.');
  return {update,cancel,destroy(){destroyed=true;cancel('');for(const remove of handlers)remove();},get phase(){return phase;}};
 }
 global.SolborneLiveVoice={create,connect,MODEL};
})(window);
