import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../public/home-refinement.js',import.meta.url),'utf8');
function setup(reduced=false){
 const node=()=>({classes:new Set(),attributes:{},handlers:{},inert:false,textContent:'',classList:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.handlers[k]=v;}});
 const panels=[node(),node(),node()],buttons=[node(),node(),node()],toggle=node(),description=node(),section=node();
 for(const item of [...panels,section])item.classList={add:v=>item.classes.add(v),toggle:(v,on)=>on?item.classes.add(v):item.classes.delete(v)};
 section.querySelectorAll=s=>s==='.process-panel'?panels:buttons;section.querySelector=s=>s==='.process-motion'?toggle:s==='.process-description'?description:node();
 let observer,task;const media={matches:reduced,addEventListener(k,f){this.change=f;}};
 const document={hidden:false,querySelector:()=>section,addEventListener(){}};
 vm.runInNewContext(code,{document,matchMedia:()=>media,window:{IntersectionObserver:true},IntersectionObserver:class{constructor(f){observer=f;}observe(){}},setTimeout:f=>(task=f,1),clearTimeout:()=>task=null});
 return {panels,buttons,toggle,description,media,enter(){observer([{isIntersecting:true}]);},advance(){const f=task;task=null;f?.();},pending:()=>!!task};
}
test('process waits until visible, plays once, then offers replay',()=>{
 const s=setup();assert.equal(s.pending(),false);s.enter();assert.equal(s.pending(),true);
 s.advance();assert.equal(s.buttons[1].attributes['aria-pressed'],'true');s.advance();assert.equal(s.buttons[2].attributes['aria-pressed'],'true');assert.equal(s.pending(),false);assert.equal(s.toggle.textContent,'Replay animation');
 s.toggle.handlers.click();assert.equal(s.buttons[0].attributes['aria-pressed'],'true');assert.equal(s.pending(),true);
});
test('manual stage selection pauses playback and hides inactive panels from interaction',()=>{
 const s=setup();s.enter();s.buttons[2].handlers.click();assert.equal(s.pending(),false);assert.equal(s.panels[2].inert,false);assert.equal(s.panels[0].inert,true);assert.equal(s.panels[0].attributes['aria-hidden'],'true');assert.equal(s.toggle.textContent,'Play animation');
});
test('reduced motion never autoplays and direct controls remain available',()=>{
 const s=setup(true);s.enter();assert.equal(s.pending(),false);s.buttons[1].handlers.click();assert.equal(s.buttons[1].attributes['aria-pressed'],'true');assert.equal(s.panels[1].inert,false);
});
