import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { citedBusinessFacts, confirmWebsiteBrief, publicSourceUrl, websiteDraftFromInterview } from './walkDelivery.ts';
const facts=()=>({businessName:'Example',description:'Owner says this.',audience:'Families',services:'Repairs',location:'',callToAction:'Contact us',email:'a@example.org',phone:'',websiteUrl:''});
const candidate=()=>citedBusinessFacts([{type:'text',text:'Founded in 2020.',citations:[{type:'web_search_result_location',url:'https://example.org/about',title:'About',cited_text:'Founded in 2020'}]}]);
test('public citations remain attached and unapproved; uncited/unsafe output is excluded',()=>{
  const result=candidate();assert.equal(result.length,1);assert.equal(result[0].ownerConfirmed,false);
  assert.equal(result[0].sources[0].url,'https://example.org/about');assert.equal(result[0].sources[0].supportingPassage,'Founded in 2020');
  assert.deepEqual(citedBusinessFacts([{type:'text',text:'Uncited claim'}]),[]);
  for(const url of ['javascript:alert(1)','http://127.0.0.1/','https://user:pass@example.org/'])assert.equal(publicSourceUrl(url),null);
});
test('owner approval is mandatory; no accepted IDs means no researched claim',()=>{
  assert.equal(confirmWebsiteBrief(facts(),candidate(),[],false).ok,false);
  const result=confirmWebsiteBrief(facts(),candidate(),[],true);assert.equal(result.ok,true);
  if(result.ok)assert.equal(result.value.description,'Owner says this.');
});
test('approved fact retains sources in website facts; unknown selections and oversize aggregate fail',()=>{
  const result=confirmWebsiteBrief(facts(),candidate(),['fact-0'],true);assert.equal(result.ok,true);
  if(result.ok){assert.match(result.value.description,/Founded in 2020/);assert.match(result.value.description,/https:\/\/example.org\/about/);}
  assert.equal(confirmWebsiteBrief(facts(),candidate(),['not-shown'],true).ok,false);
  assert.equal(confirmWebsiteBrief({...facts(),description:'x'.repeat(3000)},candidate(),['fact-0'],true).ok,false);
});
test('draft uses interview opening but does not invent services, audience or convert research to facts',()=>{
  const draft=websiteDraftFromInterview({company:'Owner Company',email:'a@example.org'},[{section:'one',index:0,transcript:'Our story'}]);
  assert.equal(draft.description,'Our story');assert.equal(draft.businessName,'Owner Company');assert.equal(draft.services,'');assert.equal(draft.audience,'');
});
test('restored controller preserves cadence, text-start, conditional research and website handoff',()=>{
  const page=readFileSync(new URL('../pages/walk/index.astro',import.meta.url),'utf8');
  assert.match(page,/function showQuestion/);assert.match(page,/async function advance/);assert.match(page,/async function toPartTwo/);
  const begin=page.slice(page.indexOf('async function begin()'),page.indexOf('async function resume('));
  assert.doesNotMatch(begin,/ensureMic\(/);assert.match(page,/data-type-answer/);
  assert.match(page,/showWebsiteDelivery/);
  const component=readFileSync(new URL('../components/WebsiteInterview.astro',import.meta.url),'utf8');
  assert.match(component,/confirmWebsiteBrief/);assert.match(component,/website-research/);assert.match(component,/data-owner-approval/);
  assert.doesNotMatch(page,/Next: become a member/);
});

test('public review removes stale paid-flow claims and resets approvals/files on handoff',()=>{
  const component=readFileSync(new URL('../components/WebsiteInterview.astro',import.meta.url),'utf8');
  assert.doesNotMatch(component,/mode=advisory|separate voice advisory|preliminary read and optional paid screening/);
  assert.match(component,/data-saved-interview/);assert.match(component,/paragraph\.textContent/);
  const handoff=component.slice(component.indexOf("document.addEventListener('solborne-website-delivery'"),component.indexOf('let files:'));
  assert.match(handoff,/files = null/);assert.match(handoff,/frame\.removeAttribute\('srcdoc'\)/);
  assert.match(handoff,/data-owner-approval/);assert.match(handoff,/checked = false/);assert.match(handoff,/candidates = \[\]/);
});
test('answer operations capture their question and block navigation while recording or saving',()=>{
  const page=readFileSync(new URL('../pages/walk/index.astro',import.meta.url),'utf8');
  const recorder=page.slice(page.indexOf('function wireRecorder()'),page.indexOf('async function advance()'));
  assert.match(recorder,/const answerSection = state\.part/);assert.match(recorder,/const answerIndex = state\.qIndex/);
  assert.doesNotMatch(recorder,/section: state\.part|index: state\.qIndex|question: currentQuestion\(\)/);
  assert.match(recorder,/finally \{ setAnswerBusy\(false\); \}/);
  const advance=page.slice(page.indexOf('async function advance()'),page.indexOf('async function toPartTwo()'));
  assert.match(advance,/state\.answerBusy \|\| state\.recording/);
});
test('repeated typing preserves the edit buffer and leaving stops tracks and pending work',()=>{
  const page=readFileSync(new URL('../pages/walk/index.astro',import.meta.url),'utf8');
  const typeHandler=page.slice(page.indexOf("stage.querySelector('[data-type-answer]')"),page.indexOf('let recording = false'));
  assert.match(typeHandler,/if \(editMode \|\| state\.answerBusy \|\| state\.recording\) return/);
  assert.match(page,/pendingRequests\.forEach\(controller => controller\.abort\(\)\)/);
  assert.match(page,/recorder\.onstop = null/);assert.match(page,/getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
  assert.match(page,/if \(!questionIsCurrent\(operation\)\) return/);assert.match(page,/state\.lifecycle !== lifecycle/);
});
test('pending Q0 edit cannot cancel/advance and a late result cannot mark Q1 answered',()=>{
  const page=readFileSync(new URL('../pages/walk/index.astro',import.meta.url),'utf8');
  const cancel=page.slice(page.indexOf("stage.querySelector('[data-cancel-edit]')"),page.indexOf("stage.querySelector('[data-save-edit]')"));
  assert.match(cancel,/if \(state\.answerBusy \|\| state\.recording\) return/);
  const save=page.slice(page.indexOf("stage.querySelector('[data-save-edit]')"),page.indexOf('async function advance()'));
  assert.match(save,/const operation = \+\+operationGeneration/);
  assert.match(save,/if \(!questionIsCurrent\(operation\)\) return/);
  assert.match(save,/state\.transcripts\[`\$\{answerSection\}:\$\{answerIndex\}`\]/);
  assert.match(page,/answerGeneration === state\.questionGeneration/);
  assert.match(page,/operation === operationGeneration/);
});
test('saved transcript key is literal-safe and recording cleanup captures are defined before use',()=>{
  const page=readFileSync(new URL('../pages/walk/index.astro',import.meta.url),'utf8');
  assert.ok(page.includes('const savedTranscript = state.transcripts[`${answerSection}:${answerIndex}`];'));
  const recorded=page.slice(page.indexOf('async function onRecorded()'),page.indexOf("stage.querySelector('[data-accept]')"));
  assert.ok(recorded.indexOf('const clipRecorder = recorder;') < recorded.indexOf('clipRecorder?.mimeType'));
  assert.ok(recorded.indexOf('const releaseClipTracks = () => {') < recorded.indexOf('releaseClipTracks();'));
  assert.match(recorded,/const clipChunks = chunks\.slice\(\)/);
  // These assertions guard generation mistakes; qa/offhost/parse-controller.mjs performs real parser validation.
});
test('new interview resets research consent and late-response guards cover both awaits',()=>{
  const component=readFileSync(new URL('../components/WebsiteInterview.astro',import.meta.url),'utf8');
  const handoff=component.slice(component.indexOf("document.addEventListener('solborne-website-delivery'"),component.indexOf('let files:'));
  assert.match(handoff,/invalidateResearch\(\)/);assert.match(handoff,/data-research-permission/);
  const research=component.slice(component.indexOf("root.querySelector('[data-research]')"));
  assert.match(research,/requestedWalkId === walkId/);assert.match(research,/generation === researchGeneration/);
  assert.equal((research.match(/if \(!isCurrentResearch\(\)\) return/g)||[]).length,2);
});
test('both audio paths revalidate the operation after conversion and before transmission',()=>{
  const page=readFileSync(new URL('../pages/walk/index.astro',import.meta.url),'utf8');
  assert.equal((page.match(/const audioBase64 = await blobToBase64\(blob\);\s+if \(!questionIsCurrent\(operation\)\) return;\s+const (?:\{ transcript \}|saved) = await api/g)||[]).length,2);
});