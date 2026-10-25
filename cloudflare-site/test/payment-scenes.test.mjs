import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function mount({readAll=false,reduced=false,missingVendor=false}={}){
 const states=new Set(),listeners={};
 const slides=Array.from({length:3},()=>({inert:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},querySelectorAll(){return[];}}));
 const status={textContent:''},toggle={textContent:'',setAttribute(){},addEventListener(type,fn){listeners.toggle=fn;}};
 let config,instance;
 const document={body:{classList:{add:s=>states.add(s),remove:s=>states.delete(s)}},querySelector:s=>s==='#scene-progress'?status:s==='#reading-mode'?toggle:{},querySelectorAll:()=>slides,addEventListener(type,fn){listeners[type]=fn;}};
 function Swiper(_el,options){config=options;instance=this;this.activeIndex=0;this.slides=slides;this.animating=false;this.params={speed:options.speed};this.destroy=()=>{this.destroyed=true;delete this.params;};this.slideNext=()=>{this.activeIndex=Math.min(2,this.activeIndex+1);options.on.slideChange(this);};this.slidePrev=()=>{this.activeIndex=Math.max(0,this.activeIndex-1);options.on.slideChange(this);};options.on.init(this);}
 const window={location:{search:readAll?'?read=all':''},matchMedia:()=>({matches:reduced,addEventListener(type,fn){listeners.motion=fn;}}),Swiper:missingVendor?undefined:Swiper};
 vm.runInNewContext(readFileSync('public/payment-scenes.js','utf8'),{window,document,URLSearchParams});
 return {states,listeners,slides,status,toggle,get config(){return config;},get instance(){return instance;}};
}
test('scene mode uses stock bounded navigation and exposes only the current scene',()=>{
 const app=mount();assert.ok(app.states.has('scene-mode'));
 assert.equal(app.config.direction,'vertical');assert.equal(app.config.loop,false);
 assert.equal(app.config.mousewheel.releaseOnEdges,false);assert.ok(app.config.mousewheel.thresholdTime>=500);
 assert.equal(app.status.textContent,'1 / 3');assert.equal(app.slides[0].inert,false);assert.equal(app.slides[1].inert,true);
 let prevented=false;app.listeners.keydown({key:'ArrowRight',target:{closest:()=>null},repeat:false,preventDefault(){prevented=true;}});
 assert.equal(app.status.textContent,'2 / 3');assert.equal(app.slides[0].attributes['aria-hidden'],'true');assert.equal(app.slides[1].inert,false);assert.equal(prevented,true);
 app.listeners.keydown({key:'ArrowRight',target:{closest:()=>({})},repeat:false,preventDefault(){throw Error('input was intercepted');}});
 assert.equal(app.status.textContent,'2 / 3');
});
test('reduced motion, missing vendor and read-all mode preserve access to the story',()=>{
 assert.equal(mount({reduced:true}).config.speed,0);
 assert.equal(mount({missingVendor:true}).states.has('scene-mode'),false);
 assert.equal(mount({readAll:true}).states.has('scene-mode'),false);
 const app=mount();app.listeners.toggle();assert.equal(app.instance.destroyed,true);assert.equal(app.states.has('scene-mode'),false);assert.ok(app.slides.every(s=>!s.inert));
 assert.doesNotThrow(()=>app.listeners.motion({matches:false}));
});
