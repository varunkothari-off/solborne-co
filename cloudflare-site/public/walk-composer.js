/* Optional private attachments. The upload callback owns authenticated transport. */
(()=>{
window.SolborneComposer={
 create({getContext,upload,onChange=()=>{}}){
  const $=id=>document.getElementById(id),menu=$('walk-attachment-menu'),trigger=$('walk-add'),pending=$('walk-pending-files');
  let files=[],uploading=false;
  const blocked=()=>{const c=getContext();return uploading||!c.allowed||c.busy||c.editingPast||c.submitted;};
  const status=(text,error=false)=>{$('walk-upload-status').textContent=text;$('walk-upload-status').setAttribute('role',error?'alert':'status');};
  function close(returnFocus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(returnFocus)trigger.focus();}
  function update(){const disabled=blocked();for(const id of ['walk-add','walk-upload-photo','walk-upload-file','walk-photo-input','walk-file-input'])$(id).disabled=disabled;for(const button of pending.querySelectorAll?.('button')||[])button.disabled=disabled;if(disabled)close();}
  function render(){pending.replaceChildren();for(const file of files){const chip=document.createElement('li'),name=document.createElement('span'),remove=document.createElement('button');chip.className='walk-file-chip';name.textContent=file.name;remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Remove '+file.name);remove.addEventListener('click',()=>{if(blocked())return;files=files.filter(item=>item.id!==file.id);render();onChange();});chip.append(name,remove);pending.append(chip);}pending.hidden=!files.length;update();}
  async function select(input){if(blocked())return;const chosen=Array.from(input.files||[]);if(!chosen.length)return;close();uploading=true;status('Uploading…');update();onChange();let failed=false;try{for(const file of chosen){if(files.length>=5)throw Error('Send these five files before adding more.');const saved=await upload(file);if(!saved||typeof saved.id!=='string'||typeof saved.name!=='string')throw Error('The file could not be saved. Try again.');if(!files.some(item=>item.id===saved.id))files.push({id:saved.id,name:saved.name,type:saved.type,size:saved.size,url:saved.url});render();}}catch(error){failed=true;status(error?.message||'Upload failed. Try again.',true);}finally{uploading=false;input.value='';if(!failed)status('');render();onChange();}}
  trigger.addEventListener('click',()=>{if(blocked())return;const opening=menu.hidden;menu.hidden=!opening;trigger.setAttribute('aria-expanded',String(opening));if(opening)$('answer-sketch-open').focus();});
  for(const [button,input] of [['walk-upload-photo','walk-photo-input'],['walk-upload-file','walk-file-input']]){$(button).addEventListener('click',()=>{if(blocked())return;close();$(input).click();});$(input).addEventListener('change',()=>select($(input)));}
  $('answer-sketch-open').addEventListener('click',()=>close());
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close(true);}});
  document.addEventListener('click',event=>{if(!menu.hidden&&!menu.contains(event.target)&&!trigger.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();close(true);}});
  const answer=$('ai-answer');answer.addEventListener('input',()=>{answer.style.height='auto';answer.style.height=Math.min(answer.scrollHeight,180)+'px';});
  const summary=$('walk-summary');if(summary&&typeof matchMedia==='function'&&matchMedia('(max-width:760px)').matches)summary.open=false;
  const messages=$('ai-messages');let followNewest=true;messages.addEventListener('scroll',()=>{followNewest=messages.scrollHeight-messages.scrollTop-messages.clientHeight<100;});
  const scrollToLatest=()=>{followNewest=true;if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(followNewest)messages.scrollTop=messages.scrollHeight;});};
  $('ai-answer-form').addEventListener('submit',()=>{followNewest=true;});
  if(typeof MutationObserver==='function')new MutationObserver(()=>{if(followNewest)scrollToLatest();}).observe(messages,{childList:true,subtree:true});
  window.addEventListener?.('beforeunload',event=>{if(uploading||files.length){event.preventDefault();event.returnValue='';}});
  render();
  return {scrollToLatest,currentFiles:()=>files.map(file=>file.id),clearSent(ids){const sent=new Set(ids);files=files.filter(file=>!sent.has(file.id));render();},restore(saved){files=[];for(const file of Array.isArray(saved)?saved:[])if(file&&typeof file.id==='string'&&file.id.trim()&&typeof file.name==='string'&&file.name.trim()&&!files.some(item=>item.id===file.id))files.push({id:file.id,name:file.name,type:file.type,size:file.size,url:file.url});render();},update,get uploading(){return uploading;}};
 }
};
})();
