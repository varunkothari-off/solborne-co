// Share one identity check per page, avoiding competing first-visit CSRF cookies.
(() => {
  let pending;
  window.solborneSession = () => pending ||= fetch('/api/auth/session', {cache:'no-store'}).then(async response => {
    if (!response.ok) throw Error('Sign-in is temporarily unavailable. Please refresh to try again.');
    return response.json();
  }).catch(error => { pending = undefined; throw error; });
})();
