/* Project-private design brief. Drawing core: vendored Signature Pad (MIT). */
(()=>{
const fields=['feel','colours','references','avoid','motion','notes'];
window.SolborneDesign={create({getContext,request,onSaved,onDirty=()=>{}}){
 const $=id=>document.getElementById(id),panel=$('design-panel'),canvas=$('design-sketch');
 let pad=null,dirty=false,baseRevision=null,lastState={},disabled=true,saving=false,externalBusy=false,normal=[],drawing=false,needsRedraw=false,size={width:600,height:300};
 const status=(text,error=false)=>{$('design-status').textContent=text;$('design-status').setAttribute('role',error?'alert':'status');};
 function changed(){if(!dirty)baseRevision=getContext().revision;dirty=true;status('Unsaved design.');onDirty();}
 function strokes(){if(!pad||needsRedraw)return normal;return pad.toData().map(group=>group.points.map(p=>({x:Math.max(0,Math.min(1,p.x/size.width)),y:Math.max(0,Math.min(1,p.y/size.height))})));}
 function draw(data){normal=data||[];if(!pad)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height){needsRedraw=true;return;}needsRedraw=false;size={width:rect.width,height:rect.height};pad.clear();pad.fromData(normal.map(points=>({penColor:'#193d3a',dotSize:1.5,minWidth:1,maxWidth:2.5,velocityFilterWeight:.7,compositeOperation:'source-over',points:points.map((p,i)=>({x:p.x*rect.width,y:p.y*rect.height,time:i*16+1,pressure:.5}))})));}
 function resize(){if(!pad||$('design-sketch-space').hidden||drawing)return;const data=strokes(),rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;size={width:rect.width,height:rect.height};const ratio=Math.min(window.devicePixelRatio||1,3);canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;canvas.getContext('2d').scale(ratio,ratio);draw(data);}
 function ensurePad(){if(pad)return;if(!window.SignaturePad){status('Sketching is unavailable. Describe your idea below.',true);return;}pad=new window.SignaturePad(canvas,{penColor:'#193d3a',minWidth:1,maxWidth:2.5});pad.addEventListener('beginStroke',()=>{drawing=true;});pad.addEventListener('endStroke',()=>{drawing=false;changed();normal=strokes();});const saved=normal;resize();draw(saved);new ResizeObserver(resize).observe(canvas);}
 function restore(state){const value=state.designPreferences||{};for(const key of fields)$('design-'+key).value=key==='references'?(value.references||[]).join('\n'):value[key]||(key==='motion'?'undecided':'');draw(value.sketch||[]);}
 function controls(){const context=getContext();disabled=!context.allowed||!!context.submitted||saving||externalBusy;for(const key of fields)$('design-'+key).disabled=disabled;for(const key of ['save','undo','clear','discard'])$('design-'+key).disabled=disabled;$('design-sketch-open').disabled=disabled&&!context.submitted;if(pad){if(disabled)pad.off();else pad.on();}}
 for(const key of fields){$('design-'+key).addEventListener('input',changed);$('design-'+key).addEventListener('change',changed);}
 $('design-sketch-open').addEventListener('click',()=>{$('design-sketch-space').hidden=false;ensurePad();controls();});
 $('design-undo').addEventListener('click',()=>{if(disabled)return;const data=strokes();data.pop();draw(data);changed();});
 $('design-clear').addEventListener('click',()=>{if(disabled)return;draw([]);changed();});
 $('design-discard').addEventListener('click',()=>{if(saving)return;dirty=false;baseRevision=null;restore(lastState);status('Showing saved design.');onDirty();});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 $('design-form').addEventListener('submit',async e=>{e.preventDefault();if(disabled)return;const context=getContext(),designPreferences={};for(const key of fields)designPreferences[key]=key==='references'?$('design-'+key).value.split('\n').map(x=>x.trim()).filter(Boolean):$('design-'+key).value;designPreferences.sketch=strokes();saving=true;controls();status('Saving…');
 try{const d=await request('/api/ai-walk/design',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:context.csrf,revision:baseRevision??context.revision,designPreferences})});dirty=false;baseRevision=null;lastState=d.state;onSaved(d);status('Design saved.');onDirty();}catch(error){status(error.message||'Couldn’t save. Your design is still here.',true);}finally{saving=false;controls();}});
 return {get dirty(){return dirty;},setBusy(busy){externalBusy=!!busy;controls();},update(state,busy){lastState=state;panel.hidden=!getContext().registered;externalBusy=!!busy;if(!dirty)restore(state);controls();}};
}};
})();
