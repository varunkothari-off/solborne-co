import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
async function page({registered=false,enabled=false,ready=false,failAnswers=false}={}){
 const html=readFileSync('public/ai-walk.html','utf8'),source=readFileSync('public/ai-walk.js','utf8');
 const node=()=>({textContent:'',children:[],handlers:{},disabled:false,checked:false,hidden:false,setAttribute(){},addEventListener(k,f){this.handlers[k]=f;},append(...v){this.children.push(...v);},replaceChildren(...v){this.children=v;},querySelector(){return this.link ||=node();},scrollIntoView(){}});
 const nodes=new Map([...html.matchAll(/id="([^"]+)"/g)].map(([,id])=>[id,node()]));let requests=[];
 const state={facts:{businessName:'Synthetic business'},messages:[],ready,businessBrief:{}};
 vm.runInNewContext(source,{Intl,console,document:{getElementById:id=>nodes.get(id)||null,createElement:node},window:{solborneSession:async()=>({authenticated:registered,registered,csrf:'csrf'})},matchMedia:()=>({matches:true}),fetch:async(url,options)=>{requests.push({url,options});if(failAnswers&&url==='/api/ai-walk'&&options?.method==='POST')return Response.json({ok:false,error:'Your answer is saved for retry.'},{status:502});return Response.json({ok:true,csrf:'form-csrf',enabled,state:url.endsWith('/submit')?{...state,submission:{id:'WB-test',submittedAt:1,dueAt:86400001}}:state,revision:1});}});
 await new Promise(resolve=>setImmediate(resolve));return {nodes,html,requests};
}
test('actual conversation page boots signed out, offers sign-in and cannot send',async()=>{
 const p=await page();assert.match(p.nodes.get('ai-availability').textContent,/Sign in/);assert.equal(p.nodes.get('ai-send').disabled,true);assert.equal(p.nodes.get('ai-submit-brief').disabled,true);assert.equal(p.nodes.get('ai-register').hidden,false);assert(!p.html.includes('ai-preview-frame'));assert.match(p.html,/Within 24 hours/);
});

test('a failed correction keeps the old summary unconfirmed and cannot expose stale handoff',async()=>{
 const p=await page({registered:true,enabled:true,ready:true,failAnswers:true});p.nodes.get('ai-consent').checked=true;p.nodes.get('ai-confirm').checked=true;p.nodes.get('ai-confirm').handlers.change();p.nodes.get('ai-answer').value='Correction: our address has changed.';
 await p.nodes.get('ai-answer-form').handlers.submit({preventDefault(){}});
 assert.equal(p.nodes.get('ai-handoff').hidden,true);assert.equal(p.nodes.get('ai-confirm').checked,false);assert.equal(p.nodes.get('ai-submit-brief').disabled,true);assert.equal(p.nodes.get('ai-answer').value,'Correction: our address has changed.');
});
test('ready summary needs explicit confirmation and submission renders a receipt without a website',async()=>{
 const p=await page({registered:true,enabled:true,ready:true});assert.equal(p.nodes.get('ai-submit-brief').disabled,true);p.nodes.get('ai-confirm').checked=true;p.nodes.get('ai-confirm').handlers.change();assert.equal(p.nodes.get('ai-submit-brief').disabled,false);
 await p.nodes.get('ai-submit-brief').handlers.click();assert.equal(p.nodes.get('ai-submitted').hidden,false);assert.equal(p.nodes.get('ai-answer-form').hidden,true);assert.match(p.nodes.get('ai-receipt').textContent,/WB-test/);assert.equal(p.requests.filter(r=>r.url.endsWith('/submit')).length,1);assert.equal(JSON.parse(p.requests.find(r=>r.url.endsWith('/submit')).options.body).csrf,'form-csrf');assert(!p.requests.some(r=>/preview|complete/.test(r.url)));
});
