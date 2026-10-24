import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {existsSync,readFileSync} from 'node:fs';
function load(document={getElementById(){return null;}}){
 const context={window:{},document};vm.createContext(context);
 if(existsSync('public/walk-map.js'))vm.runInContext(readFileSync('public/walk-map.js','utf8'),context);
 assert.equal(typeof context.window.SolborneWalkMap?.project,'function','The saved Walk must expose a visual progress map.');
 return context.window.SolborneWalkMap;
}
const operations={intent:'operations',workflow:'payments'};
test('an empty operations brief shows unanswered decisions rather than invented progress',()=>{
 const view=load().project({},operations);
 assert.equal(view.intent,'operations');assert.equal(view.nodes.length,5);
 assert.equal(view.nodes.filter(n=>n.state==='captured').length,0);
 assert.equal(view.nodes.filter(n=>n.state==='current').length,1);
 assert.equal(view.nodes[0].state,'current');
});
test('captured decisions come from saved fields and corrections replace older values',()=>{
 const api=load(),state={businessBrief:{primaryPain:'Manual reminders',customerJourney:'Invoice → reminder',humanApprovals:'Owner resolves disputes',desiredOutcome:'Less manual chasing',successMeasure:'Compare follow-up time'}};
 const first=api.project(state,operations);
 assert.equal(first.nodes.slice(0,4).every(n=>n.state==='captured'),true);
 assert.equal(first.nodes.at(-1).state,'current');
 const corrected=api.project({...state,businessBrief:{...state.businessBrief,primaryPain:'Missed promises'}},operations);
 assert.equal(corrected.nodes[0].value,'Missed promises');
 assert.equal(corrected.nodes.some(n=>n.value==='Manual reminders'),false);
});
test('hypotheses and deferred operational answers are not shown as captured owner decisions',()=>{
 const api=load(),state={businessBrief:{primaryPain:'Hypothesis; not confirmed: late invoices',humanApprovals:'Deferred by owner'},evidence:{'businessBrief.primaryPain':{kind:'hypothesis'},'businessBrief.humanApprovals':{kind:'deferred'}}};
 const view=api.project(state,operations);
 assert.equal(view.nodes[0].value,'');assert.equal(view.nodes[2].value,'');
 assert.equal(view.nodes.filter(n=>n.state==='captured').length,0);
});
test('saved project intent wins over incoming campaign and website map needs no operations fields',()=>{
 const view=load().project({journey:{intent:'website',workflow:''},facts:{description:'We repair things',audience:'Local households'},businessBrief:{designVision:'Simple and calm'}},operations);
 assert.equal(view.intent,'website');assert.equal(view.nodes.length,4);
 assert.equal(view.nodes.slice(0,3).every(n=>n.state==='captured'),true);
});
test('ready, submitted and completed distinguish review from delivery without exposing history',()=>{
 const api=load();
 assert.equal(api.project({ready:true},operations).nodes.at(-1).state,'ready');
 const sent=api.project({submission:{status:'in_review',owner:'PRIVATE OWNER',id:'PRIVATE ID'}},operations);
 assert.equal(sent.nodes.at(-1).state,'submitted');
 assert.equal(JSON.stringify(sent).includes('PRIVATE'),false);
 assert.equal(api.project({submission:{status:'completed'}},operations).nodes.at(-1).state,'reviewed');
});
test('render uses text nodes for private summary values and tolerates absent host',()=>{
 const node=tag=>({tag,children:[],textContent:'',attrs:{},append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},setAttribute(key,value){this.attrs[key]=value;},addEventListener(){},className:''});
 const host=node('section'),doc={getElementById:id=>id==='walk-job-map'?host:null,createElement:node};
 const api=load(doc),attack='<img src=x onerror=alert(1)>';
 api.render({businessBrief:{primaryPain:attack}},operations);
 const all=[];function visit(n){all.push(n);for(const child of n.children)visit(child);}visit(host);
 assert.equal(all.some(n=>n.textContent===attack),true);
 assert.equal(all.some(n=>n.tag==='img'),false);
 assert.equal(all.some(n=>Object.hasOwn(n,'innerHTML')),false);
 assert.doesNotThrow(()=>load().render({},operations));
});
