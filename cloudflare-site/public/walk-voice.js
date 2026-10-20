/* Audio stays in memory. Only an explicit Stop (or the time limit) sends it for transcription. */
(function(global){
 'use strict';
 const MAX_BYTES=3*1024*1024,MAX_MS=60000,MAX_TEXT=2000;
 function create(options={}){
  const doc=options.document||global.document,win=options.window||global,nav=options.navigator||global.navigator;
  const Recorder=options.MediaRecorder||global.MediaRecorder,fetcher=options.fetch||global.fetch.bind(global);
  const clock=options.now||Date.now,later=options.setTimeout||global.setTimeout.bind(global),cancelLater=options.clearTimeout||global.clearTimeout.bind(global);
  const every=options.setInterval||global.setInterval.bind(global),cancelEvery=options.clearInterval||global.clearInterval.bind(global);
  const $=id=>doc.getElementById(id),answer=$('ai-answer'),status=$('voice-status');
  const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>Recorder?.isTypeSupported?.(type));
  const supported=!!(win.isSecureContext&&nav?.mediaDevices?.getUserMedia&&mime);
  let phase='idle',stream=null,recorder=null,chunks=[],blob=null,bytes=0,started=0,durationMs=0,timer=null,tick=null,controller=null,generation=0,active=false,destroyed=false;
  const context=()=>options.getContext?.()||{};
  function text(value,error=false){status.textContent=value;status.setAttribute('role',error?'alert':'status');}
  function stopTracks(){if(stream){for(const track of stream.getTracks())track.stop();stream=null;}if(timer!==null)cancelLater(timer);if(tick!==null)cancelEvery(tick);timer=tick=null;}
  function update(){
   const ctx=context(),consented=!!ctx.consent&&$('voice-consent').checked;
   if(!consented&&active){cancel('Recording cancelled. Your microphone is off.');return;}
   $('voice-start').disabled=!supported||!ctx.allowed||!consented||active;
   $('voice-start').hidden=active||phase==='review'||phase==='error';
   $('voice-stop').hidden=phase!=='recording';$('voice-timer').hidden=phase!=='recording';
   $('voice-cancel').hidden=!active&&phase!=='review'&&phase!=='error';
   $('voice-retry').hidden=phase!=='error'||!blob;
   $('voice-retry').disabled=!ctx.allowed||!consented;
   $('voice-again').hidden=phase!=='error';
   $('voice-again').disabled=!supported||!ctx.allowed||!consented;
   $('voice-review').hidden=phase!=='review';
   $('voice-use').disabled=!ctx.allowed||!consented;
   $('voice-consent').disabled=!ctx.consent&&!$('voice-consent').checked;
   $('voice-tools').dataset.state=phase;
  }
  function setPhase(value){phase=value;const next=['requesting','recording','transcribing'].includes(value);if(active!==next){active=next;options.onBusy?.(next);}update();}
  function cancel(message){
   if(message===undefined)message=phase==='transcribing'?'Cancelled here. Your answer has not changed. Audio already sent may still be processed.':'Recording discarded. Your answer has not changed.';
   generation++;controller?.abort();controller=null;
   if(recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch{}}
   recorder=null;stopTracks();chunks=[];blob=null;bytes=0;$('voice-transcript').value='';setPhase('idle');text(message);
  }
  async function encode(audio){
   if(options.encode)return options.encode(audio);
   const data=new Uint8Array(await audio.arrayBuffer());let binary='';
   for(let offset=0;offset<data.length;offset+=8192)binary+=String.fromCharCode(...data.subarray(offset,offset+8192));
   return global.btoa(binary);
  }
  async function transcribe(id){
   const ctx=context();if(id!==generation||!blob||!ctx.allowed||!ctx.consent||!$('voice-consent').checked)return;
   if(blob.size===0||blob.size>MAX_BYTES){blob=null;setPhase('error');text('That recording could not be used. Record again, or type your answer.',true);return;}
   setPhase('transcribing');text('Turning your recording into words… You can keep editing your answer.');
   controller=new AbortController();const signal=controller.signal;
   try{
    const audio=await encode(blob);if(id!==generation)return;
    const response=await fetcher('/api/ai-walk/transcribe',{method:'POST',credentials:'same-origin',cache:'no-store',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:ctx.csrf,consent:true,audioConsent:true,audio,mimeType:blob.type,durationMs})});
    const data=await response.json();if(id!==generation)return;
    if(!response.ok||!data.ok||typeof data.text!=='string'||!data.text.trim())throw Error('transcription');
    controller=null;blob=null;chunks=[];$('voice-transcript').value=data.text.trim();setPhase('review');
    text(data.text.trim().length>MAX_TEXT?'Your transcript is ready. Shorten it before adding it: answers can contain 2,000 characters.':'Your words are ready. Check them, then add them to your answer.');$('voice-transcript').focus();
   }catch(error){if(id!==generation)return;controller=null;stopTracks();setPhase('error');text('We couldn’t transcribe that recording. Retry, record again, or type your answer. Nothing has been sent as an answer.',true);}
  }
  function stop(){
   if(phase!=='recording'||!recorder)return;
   text('Microphone off. Preparing your recording…');
   try{recorder.stop();stopTracks();setPhase('transcribing');}catch{cancel('Recording stopped. Please record again or type your answer.');}
  }
  async function start(){
   const ctx=context();if(destroyed||active||!supported||!ctx.allowed||!ctx.consent||!$('voice-consent').checked)return;
   const id=++generation;blob=null;chunks=[];bytes=0;setPhase('requesting');text('Allow microphone access to begin. You can cancel at any time.');
   try{
    const incoming=await nav.mediaDevices.getUserMedia({audio:true});
    if(id!==generation||destroyed){for(const track of incoming.getTracks())track.stop();return;}
    stream=incoming;recorder=new Recorder(stream,{mimeType:mime,audioBitsPerSecond:64000});
    recorder.ondataavailable=event=>{
     if(id!==generation||!event.data?.size)return;
     bytes+=event.data.size;if(bytes>MAX_BYTES){cancel('Recording reached the size limit and was discarded. Please record a shorter answer.');return;}chunks.push(event.data);
    };
    recorder.onerror=()=>{if(id===generation)cancel('Recording stopped unexpectedly. Please record again or type your answer.');};
    recorder.onstop=()=>{
     if(id!==generation)return;durationMs=Math.min(MAX_MS,Math.max(1,clock()-started));stopTracks();blob=new Blob(chunks,{type:recorder?.mimeType||mime});chunks=[];recorder=null;void transcribe(id);
    };
    recorder.start(250);started=clock();setPhase('recording');text('Microphone on. Recording for up to one minute. Stop when you’re ready.');$('voice-timer').textContent='0:00 / 1:00';
    tick=every(()=>{const seconds=Math.min(60,Math.floor((clock()-started)/1000));$('voice-timer').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+' / 1:00';},1000);
    timer=later(stop,MAX_MS);
   }catch(error){if(id!==generation)return;stopTracks();recorder=null;setPhase('error');text(error?.name==='NotAllowedError'?'Microphone access was not allowed. You can enable it in browser settings, record again, or type your answer.':'Your microphone couldn’t start. Check that it is available, or type your answer.',true);}
  }
  function useTranscript(){
   const ctx=context();if(phase!=='review'||!ctx.allowed||!ctx.consent||!$('voice-consent').checked)return;
   const transcript=$('voice-transcript').value.trim();if(!transcript){text('Add some words to the transcript, or discard it.',true);return;}
   const existing=answer.value,candidate=existing+(existing&&!/\s$/.test(existing)?'\n':'')+transcript;
   if(candidate.length>MAX_TEXT){text('Your answer and transcript total '+candidate.length+' characters. Shorten them to 2,000 before adding. Your typed answer has not changed.',true);return;}
   answer.value=candidate;answer.dispatchEvent(new Event('input',{bubbles:true}));cancel('Transcript added. Review your answer, then choose Send answer.');answer.focus();
  }
  $('voice-start').addEventListener('click',start);$('voice-stop').addEventListener('click',stop);$('voice-cancel').addEventListener('click',()=>cancel());
  $('voice-retry').addEventListener('click',()=>{if(!active)void transcribe(generation);});$('voice-again').addEventListener('click',start);$('voice-use').addEventListener('click',useTranscript);
  $('voice-consent').addEventListener('change',()=>{if(!$('voice-consent').checked)cancel('Audio consent withdrawn. Local recording and transcript discarded.');else update();});
  $('ai-consent').addEventListener('change',()=>{if(!$('ai-consent').checked)cancel('Consent withdrawn. Local recording and transcript discarded.');else update();});
  win.addEventListener('pagehide',()=>cancel(''));win.addEventListener('beforeunload',()=>cancel(''));
  if(!supported)text('Audio recording isn’t available in this browser. Type your answer, or use the microphone on your device’s keyboard.');
  update();return {update,cancel,destroy(){destroyed=true;cancel('');},get phase(){return phase;}};
 }
 global.SolborneVoice={create,MAX_BYTES,MAX_MS};
})(window);
