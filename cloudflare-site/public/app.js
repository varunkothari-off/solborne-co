'use strict';
const brand = window.SOLBORNE_BRAND;
if (brand) {
  document.title = brand.title;
  document.querySelectorAll('[data-brand-name]').forEach(el => { el.textContent = brand.name; });
  document.querySelector('meta[name="description"]').content = brand.description;
}
const examples = {
  proposal: { label:'CLIENT WORK', title:'From a scattered brief\nto a reviewable proposal.', description:'Give your team a consistent starting point without handing over the commercial decisions.', input:'Approved client brief, scope notes, and a proposal example', output:'A structured first draft, missing-information list, and scope checklist', review:'Facts, pricing, commitments, and the final message before it is sent' },
  knowledge: { label:'TEAM KNOWLEDGE', title:'From scattered notes\nto a usable team guide.', description:'Make a repeat question easier to answer, using context the team has approved.', input:'Selected process notes, trusted references, and common team questions', output:'A draft guide with source references, open questions, and review dates', review:'Accuracy, access permissions, sensitive information, and what becomes the approved reference' },
  followup: { label:'CLIENT RELATIONSHIPS', title:'From meeting notes\nto a clear next step.', description:'Prepare a useful follow-up while keeping the relationship and commitments in your hands.', input:'Approved meeting notes, agreed actions, and relevant client context', output:'A follow-up draft, an action list, and unresolved questions for review', review:'Recipients, tone, facts, dates, commitments, and permission to send' }
};
const tabs = [...document.querySelectorAll('[role="tab"]')];
function chooseExample(tab) {
  const item = examples[tab.dataset.example];
  tabs.forEach(button => { const active = button === tab; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
  document.getElementById('example-panel').setAttribute('aria-labelledby', tab.id);
  ['label','title','description','input','output','review'].forEach(key => { document.getElementById('example-' + key).textContent = item[key]; });
  document.getElementById('example-title').style.whiteSpace = 'pre-line';
}
tabs.forEach((tab,index) => {
  tab.addEventListener('click', () => chooseExample(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index+1)%tabs.length;
    if (event.key === 'ArrowLeft') next = (index+tabs.length-1)%tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length-1;
    if (next !== undefined) { event.preventDefault(); chooseExample(tabs[next]); tabs[next].focus(); }
  });
});
