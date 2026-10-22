import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class El{
 constructor(){this.hidden=true;this.disabled=false;this.children=[];this.listeners={};this.attrs={};this.value='';this.files=[];this.textContent='';this.clicks=0;}
 addEventListener(type,fn){this.listeners[type]=fn;} setAttribute(k,v){this.attrs[k]=v;} append(...items){this.children.push(...items);} replaceChildren(...items){this.children=items;} contains(target){return target===this||this.children.some(c=>c.contains?.(target));} click(){this.clicks++;return this.fire('click');} focus(){this.focused=true;} fire(type,event={}){return this.listeners[type]?.({preventDefault(){},target:this,...event});}
}
function fixture({failName=''}={}){
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new El());return nodes.get(id);};let changed=0,observeChanges=()=>{};const animationFrames=[];const requests=[],context={allowed:true,submitted:false,editingPast:false,busy:false};const window={},document={getElementById:get,createElement:()=>new El(),addEventListener(){}};
 if(fs.existsSync('public/walk-composer.js'))vm.runInNewContext(fs.readFileSync('public/walk-composer.js','utf8'),{window,document,console,MutationObserver:class{constructor(fn){observeChanges=fn;}observe(){}},requestAnimationFrame:fn=>animationFrames.push(fn)});
 const widget=window.SolborneComposer?.create({getContext:()=>context,upload:async file=>{requests.push(file.name);if(file.name===failName)throw Error('Upload failed. Try again.');return {id:'file-'+file.name,name:file.name,type:file.type,size:file.size,url:'/api/ai-walk/files?id=file-'+file.name};},onChange:()=>changed++});
 return {widget,get,context,requests,changed:()=>changed,mutate:()=>observeChanges(),paint:()=>{for(const frame of animationFrames.splice(0))frame();}};
}
test('chat shell exposes one accessible attachment menu and retains the review handoff',()=>{
 const html=fs.readFileSync('public/ai-walk.html','utf8');assert.match(html,/id="walk-add"[^>]*aria-expanded="false"/);assert.match(html,/id="walk-attachment-menu"/);for(const id of ['answer-sketch-open','walk-photo-input','walk-file-input','ai-handoff','ai-submit-brief','voice-start'])assert.ok(html.includes('id="'+id+'"'));assert.match(html,/src="\/walk-composer.js"/);
});
test('plus menu opens choosers without sending and Escape restores focus',()=>{
 const f=fixture();assert.ok(f.widget,'attachment composer exists');f.get('walk-add').click();assert.equal(f.get('walk-attachment-menu').hidden,false);f.get('walk-upload-photo').click();assert.equal(f.get('walk-photo-input').clicks,1);assert.equal(f.get('walk-attachment-menu').hidden,true);assert.deepEqual(f.requests,[]);f.get('walk-add').click();f.get('walk-attachment-menu').fire('keydown',{key:'Escape'});assert.equal(f.get('walk-attachment-menu').hidden,true);assert.equal(f.get('walk-add').focused,true);
});
test('selected files upload privately and remain editable attachments without auto-sending',async()=>{
 const f=fixture();assert.ok(f.widget);f.get('walk-file-input').files=[{name:'brief.pdf',size:1024,type:'application/pdf'}];await f.get('walk-file-input').fire('change');assert.deepEqual(f.requests,['brief.pdf']);assert.deepEqual(Array.from(f.widget.currentFiles()),['file-brief.pdf']);assert.equal(f.widget.uploading,false);assert.ok(f.get('walk-pending-files').children.length);assert.ok(f.changed()>0);f.get('walk-pending-files').children[0].children.at(-1).click();assert.equal(f.widget.currentFiles().length,0);
});
test('partial upload failure keeps earlier attachments and exposes a concise retry error',async()=>{
 const f=fixture({failName:'second.pdf'});assert.ok(f.widget);f.get('walk-file-input').files=[{name:'first.pdf',size:22,type:'application/pdf'},{name:'second.pdf',size:22,type:'application/pdf'}];await f.get('walk-file-input').fire('change');assert.deepEqual(Array.from(f.widget.currentFiles()),['file-first.pdf']);assert.match(f.get('walk-upload-status').textContent,/Upload failed/);assert.equal(f.get('walk-upload-status').attrs.role,'alert');assert.equal(f.widget.uploading,false);
});
test('blocked and submitted states cannot select files; successful send clears only its snapshot',async()=>{
 const f=fixture();assert.ok(f.widget);f.widget.restore([{id:'one',name:'one.pdf'},{id:'two',name:'two.pdf'}]);f.widget.clearSent(['one']);assert.deepEqual(Array.from(f.widget.currentFiles()),['two']);for(const key of ['busy','editingPast','submitted']){f.context[key]=true;f.widget.update();assert.equal(f.get('walk-add').disabled,true);f.get('walk-file-input').files=[{name:'no.pdf',size:5,type:'application/pdf'}];await f.get('walk-file-input').fire('change');assert.equal(f.requests.length,0);f.context[key]=false;}f.widget.update();assert.equal(f.get('walk-add').disabled,false);
});


test('pending retry restoration replaces edited attachments in the authoritative original order',()=>{
 const f=fixture(),pending=[{id:'A',name:'a.pdf',type:'application/pdf',size:20},{id:'B',name:'b.pdf',type:'application/pdf',size:30}];f.widget.restore(pending);f.get('walk-pending-files').children[0].children.at(-1).click();assert.deepEqual(Array.from(f.widget.currentFiles()),['B']);f.widget.restore(pending);assert.deepEqual(Array.from(f.widget.currentFiles()),['A','B']);f.widget.restore([{id:'B',name:'b.pdf'},{id:'B',name:'duplicate.pdf'},null,{id:'',name:'empty.pdf'}]);assert.deepEqual(Array.from(f.widget.currentFiles()),['B']);f.widget.restore([]);assert.equal(f.widget.currentFiles().length,0);
});

test('a reply does not pull the reader down after they scroll up, including queued animation frames',()=>{
 const f=fixture(),messages=f.get('ai-messages');messages.scrollHeight=1000;messages.clientHeight=200;messages.scrollTop=800;messages.fire('scroll');f.get('ai-answer-form').fire('submit');f.mutate();messages.scrollTop=100;messages.fire('scroll');f.paint();assert.equal(messages.scrollTop,100);messages.scrollHeight=1200;f.mutate();f.paint();assert.equal(messages.scrollTop,100);messages.scrollTop=1000;messages.fire('scroll');messages.scrollHeight=1400;f.mutate();f.paint();assert.equal(messages.scrollTop,1400);
});


test('unavailable private storage disables uploads while leaving plus and sketch usable',async()=>{
 const f=fixture();f.context.uploadsAllowed=false;f.widget.update();assert.equal(f.get('walk-add').disabled,false);assert.equal(f.get('answer-sketch-open').disabled,false);for(const id of ['walk-upload-photo','walk-upload-file','walk-photo-input','walk-file-input']){assert.equal(f.get(id).disabled,true);assert.equal(f.get(id).attrs.title,'File uploads are being connected.');}f.get('walk-add').click();assert.equal(f.get('walk-attachment-menu').hidden,false);f.get('walk-upload-file').click();assert.equal(f.get('walk-file-input').clicks,0);f.get('walk-file-input').files=[{name:'blocked.pdf',size:5,type:'application/pdf'}];await f.get('walk-file-input').fire('change');assert.equal(f.requests.length,0);f.context.uploadsAllowed=true;f.widget.update();assert.equal(f.get('walk-upload-file').disabled,false);assert.equal(f.get('walk-upload-file').attrs.title,'');
});
