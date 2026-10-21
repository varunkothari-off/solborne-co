/* Optional answer attachments. Signature Pad 5.1.4, MIT; see vendor notice. */
(()=>{
const groups=(strokes,w,h)=>strokes.map(points=>({penColor:'#193d3a',dotSize:1.5,minWidth:1,maxWidth:2.5,velocityFilterWeight:.7,compositeOperation:'source-over',points:points.map((p,i)=>({x:p.x*w,y:p.y*h,time:i*16+1,pressure:.5}))}));
window.SolborneAnswerSketch={
 create({getContext,request,onSaved,onChange=()=>{}}){
 const $=id=>document.getElementById(id),canvas=$('answer-sketch-canvas'),space=$('answer-sketch-space');
 let pad=null,normal=[],dirty=false,target=null,baseRevision=0,saving=false,size={width:600,height:300},drawing=false;
 const allowed=()=>getContext().allowed&&!getContext().submitted&&!saving;
 const status=(message,error=false)=>{$('answer-sketch-status').textContent=message;$('answer-sketch-status').setAttribute('role',error?'alert':'status');};
 function data(){return pad?pad.toData().map(group=>group.points.map(p=>({x:Math.max(0,Math.min(1,p.x/size.width)),y:Math.max(0,Math.min(1,p.y/size.height))}))):normal;}
 function paint(strokes){normal=strokes;if(!pad)return;const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;size={width:rect.width,height:rect.height};const ratio=Math.min(window.devicePixelRatio||1,3);canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;canvas.getContext('2d').scale(ratio,ratio);pad.clear();pad.fromData(groups(strokes,rect.width,rect.height));}
 function resize(){if(pad&&!space.hidden&&!drawing)paint(data());}
 function changed(){dirty=true;normal=data();status(target===null?'Sketch added to your answer.':'Unsaved sketch.');onChange();}
 function init(){if(pad)return;pad=new window.SignaturePad(canvas,{penColor:'#193d3a',minWidth:1,maxWidth:2.5});pad.addEventListener('beginStroke',()=>drawing=true);pad.addEventListener('endStroke',()=>{drawing=false;changed();});new ResizeObserver(resize).observe(canvas);}
 function update(){const disabled=!allowed();$('answer-sketch-open').disabled=disabled;for(const name of ['undo','clear','cancel','save'])$('answer-sketch-'+name).disabled=disabled;$('answer-sketch-save').hidden=target===null;if(pad){if(disabled)pad.off();else pad.on();}}
 function open(turn=null,strokes=[]){if(!allowed())return false;if(dirty&&turn!==target){status('Send or cancel this sketch before opening another.',true);space.hidden=false;return false;}if(!window.SignaturePad){status('Sketching is unavailable. You can still describe your answer.',true);return false;}space.hidden=false;if(turn!==target||!dirty){target=turn;baseRevision=getContext().revision;normal=strokes;}const saved=normal;init();paint(saved);$('answer-sketch-title').textContent=turn===null?'Sketch your answer.':'Sketch for answer '+turn;status('');update();onChange();canvas.focus?.();return true;}
 function reset(){pad?.clear();normal=[];dirty=false;target=null;space.hidden=true;status('');update();onChange();}
 $('answer-sketch-open').addEventListener('click',()=>open());
 $('answer-sketch-undo').addEventListener('click',()=>{if(!allowed())return;const next=data();next.pop();paint(next);changed();});
 $('answer-sketch-clear').addEventListener('click',()=>{if(!allowed())return;paint([]);changed();});
 $('answer-sketch-cancel').addEventListener('click',()=>{if(allowed())reset();});
 $('answer-sketch-save').addEventListener('click',async()=>{if(!allowed()||target===null)return;saving=true;update();status('Saving…');try{const result=await request('/api/ai-walk/sketch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:getContext().csrf,revision:baseRevision,turn:target,sketch:data()})});saving=false;reset();onSaved(result);}catch(error){status(error.message||'Couldn’t save. Your sketch is still here.',true);}finally{saving=false;update();}});
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 return {get dirty(){return dirty;},get editingPast(){return target!==null;},attachment:data,open,update,sent(snapshot){if(target===null&&JSON.stringify(data())===JSON.stringify(snapshot))reset();},restorePending(pending){if(!dirty&&pending?.sketch?.length&&open(null,pending.sketch)){dirty=true;onChange();}}};
 },
 preview(strokes){const figure=document.createElement('figure'),canvas=document.createElement('canvas');figure.className='answer-sketch-preview';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Sketch attached to this answer');figure.append(canvas);let pad=null;
 const draw=()=>{const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;const ratio=Math.min(window.devicePixelRatio||1,3);canvas.width=rect.width*ratio;canvas.height=rect.height*ratio;canvas.getContext('2d').scale(ratio,ratio);if(!pad){pad=new window.SignaturePad(canvas);pad.off();}pad.clear();pad.fromData(groups(strokes,rect.width,rect.height));};const observer=new ResizeObserver(draw);observer.observe(canvas);figure.disposeSketch=()=>{observer.disconnect();pad?.off();};return figure;}
};
})();
