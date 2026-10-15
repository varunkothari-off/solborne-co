// Preserve bookmarked registration links from the earlier homepage.
if(location.pathname==='/'&&['#register','#registration-recovery'].includes(location.hash))location.replace('/start.html'+location.hash);
document.querySelectorAll('[data-analytics-settings]').forEach(el=>{if(!document.querySelector('script[data-measurement-id]'))el.hidden=true;});
