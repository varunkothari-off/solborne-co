// Share one identity check per page, avoiding competing first-visit CSRF cookies.
(() => {
  let pending;
  const originalFetch=window.fetch?.bind(window);let projectId=null;
  if(originalFetch)window.fetch=async(input,options={})=>{
    const url=new URL(typeof input==='string'?input:input.url||String(input),location.origin);
    const projectRoute=url.origin===location.origin&&(/^\/api\/(?:ai-walk|walk)(?:\/|$)/.test(url.pathname)||url.pathname==='/api/access/status');
    if(!projectRoute)return originalFetch(input,options);
    const session=await window.solborneSession();
    const headers=new Headers(options.headers||input?.headers);
    if(session.authenticated&&projectId)headers.set('X-Solborne-Project',projectId);
    return originalFetch(input,{...options,headers});
  };
  window.solborneSession = () => pending ||= (() => {
    const finish = window.SolborneLoading?.begin();
    return fetch('/api/auth/session', {cache:'no-store'}).then(async response => {
    if (!response.ok) throw Error('Sign-in is temporarily unavailable. Please refresh to try again.');
    const session=await response.json();projectId=session.activeRegistration||null;return session;
  }).catch(error => { pending = undefined; throw error; }).finally(() => finish?.());
  })();
})();
