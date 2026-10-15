(() => {
  const menu = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  const mobile = matchMedia('(max-width: 800px)');
  function closeMenu(returnFocus = false) {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.toggle('is-collapsed', mobile.matches);
    if (returnFocus) menu.focus();
  }
  if (menu && nav) {
    menu.hidden = false;
    closeMenu();
    menu.addEventListener('click', () => {
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-collapsed', !open && mobile.matches);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeMenu()));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') closeMenu(true);
    });
    mobile.addEventListener('change', () => closeMenu());
  }
  const tabs = [...document.querySelectorAll('.demo-tabs [role="tab"]')];
  function selectTab(tab, focus = false) {
    tabs.forEach(t => {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      t.tabIndex = selected ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', e => {
      let next;
      if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (e.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { e.preventDefault(); selectTab(tabs[next], true); }
    });
  });
})();

const form=document.querySelector('#improvement-form');
if(form){
 document.querySelector("#prepare-brief").disabled=false;
 const error=document.querySelector('#form-error'),result=document.querySelector('#brief-result'),text=document.querySelector('#brief-text'),copy=document.querySelector('#copy-brief'),status=document.querySelector('#copy-status');
 form.addEventListener('submit',e=>{
  e.preventDefault();error.hidden=true;
  const data=new FormData(form),url=String(data.get('website')).trim();
  let parsed;try{parsed=new URL(url)}catch{}
  if(!parsed||!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password){error.textContent='Enter a website address starting with https:// or http://, without passwords or login details.';error.hidden=false;document.querySelector('#website-url').focus();return}
  text.textContent=`Website improvement brief\n\nWebsite: ${parsed.href}\nRole: ${data.get('role')}\nMain priority: ${data.get('goal')}\n\nCurrent problem and desired change:\n${String(data.get('problem')).trim()}\n\nFor discussion only. No audit has been run, no enquiry has been sent, and no site changes are authorised by this draft.`;
  status.textContent='';result.hidden=false;result.focus();
 });
 copy.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(text.textContent);status.textContent='Brief copied. Review it before pasting or sending.'}
  catch{status.textContent='Copy is unavailable here. Select the brief text and copy it manually.'}
 });
}
