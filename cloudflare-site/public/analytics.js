// Basic consent: no Google tag or measurement request before opt-in.
(()=>{
const id=document.querySelector('script[data-measurement-id]')?.dataset.measurementId;
if(!/^G-[A-Z0-9]+$/.test(id||''))return;
const key='solborne.analytics.v1';let loaded=false;
const saved=()=>{try{return localStorage.getItem(key);}catch{return null;}};
const remember=v=>{try{localStorage.setItem(key,v);}catch{}};
function cleanCookies(){
 for(const item of document.cookie.split(';')){const name=item.trim().split('=')[0];if(!/^_ga(?:_|$)|^_gid$|^_gat/.test(name))continue;
  for(const domain of ['',`; domain=${location.hostname}`,`; domain=.${location.hostname}`])document.cookie=`${name}=; Max-Age=0; path=/${domain}; SameSite=Lax; Secure`;
 }
}
function enable(){
 if(loaded)return;loaded=true;window['ga-disable-'+id]=false;window.dataLayer=window.dataLayer||[];
 window.gtag=function(){window.dataLayer.push(arguments);};
 window.gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
 window.gtag('js',new Date());
 window.gtag('config',id,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:2592000,cookie_flags:'SameSite=Lax;Secure',page_location:location.origin+location.pathname,page_referrer:document.referrer?new URL(document.referrer).origin:'',ignore_referrer:false});
 const params={page_location:location.origin+location.pathname,page_title:document.title,page_referrer:document.referrer?new URL(document.referrer).origin:''};
 const q=new URLSearchParams(location.search);
 if(q.get('utm_source')==='solborne_outreach'&&q.get('utm_medium')==='email'&&q.get('utm_campaign')==='uk_pilot_20261015')Object.assign(params,{campaign_source:'solborne_outreach',campaign_medium:'email',campaign_name:'uk_pilot_20261015'});
 window.gtag('event','page_view',params);
 const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.append(script);
}
const box=document.createElement('section');box.className='analytics-choice';box.setAttribute('aria-label','Optional analytics preferences');
box.innerHTML='<div><strong>Help us understand what works?</strong><p>Optional Google Analytics measures public-page visits and button use. Your registration and website answers stay out of analytics. <a href="/privacy.html#analytics">Details</a></p></div><div class="analytics-actions"><button type="button" data-decline>Decline analytics</button><button type="button" data-allow>Allow analytics</button></div>';
document.body.append(box);
function choose(value){remember(value);box.hidden=true;if(value==='granted')enable();else{window['ga-disable-'+id]=true;if(window.gtag)window.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});cleanCookies();if(loaded)location.reload();}}
box.querySelector('[data-allow]').addEventListener('click',()=>choose('granted'));box.querySelector('[data-decline]').addEventListener('click',()=>choose('denied'));
document.querySelectorAll('[data-analytics-settings]').forEach(el=>el.addEventListener('click',event=>{event?.preventDefault?.();box.hidden=false;box.querySelector('[data-decline]').focus();}));
document.addEventListener('click',e=>{if(saved()!=='granted'||!loaded)return;const a=e.target.closest('a');if(!a)return;let kind=null;
 try{const u=new URL(a.href);if(u.origin===location.origin&&u.pathname==='/start.html')kind='start_website';else if(u.protocol==='mailto:')kind='email_contact';else if(u.origin==='https://kfs.solborne.in')kind='view_kfs_example';}catch{}
 if(kind)window.gtag('event','cta_click',{cta_kind:kind,page_location:location.origin+location.pathname});
});
const choice=saved();box.hidden=choice==='granted'||choice==='denied';if(choice==='granted')enable();
})();
