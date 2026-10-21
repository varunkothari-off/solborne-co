// One account navigation on every current Solborne page. No provider tokens in the browser.
(() => {
  const nav = document.querySelector('#site-nav');
  if (!nav) return;
  const current = location.pathname;
  for (const link of nav.querySelectorAll('a')) {
    if (new URL(link.href).pathname === current) link.setAttribute('aria-current', 'page');
  }
  window.solborneSession().then(session => {
    if (!session.authenticated) return;
    const entry = nav.querySelector('a[href="/signin.html"],a[href="/signin.html?next=walk"]');
    if (entry) {
      const walk = entry.getAttribute?.('href')?.includes('next=walk');
      entry.href = walk ? (session.registered?'/walk.html':'/start.html') : '/canvas.html';
      entry.textContent = walk ? (session.registered?'Your Walk':'Take the Walk of Fame') : 'Your canvas';
      if (current === entry.href || current === new URL(entry.href,'https://solborne.in').pathname) entry.setAttribute('aria-current', 'page');
    }
    for (const link of document.querySelectorAll('main a[href="/signin.html"]')) {
      link.href = '/canvas.html'; link.textContent = 'Open your canvas';
    }
    for (const link of document.querySelectorAll('main a[href="/signin.html?next=walk"]')) {
      link.href = session.registered?'/walk.html':'/start.html';
    }
    if(!nav.querySelector('a[href="/canvas.html"]')){const projects=document.createElement('a');projects.href='/canvas.html';projects.textContent='Your projects';if(current==='/canvas.html')projects.setAttribute('aria-current','page');nav.append(projects);}
    const button = document.createElement('button');
    button.type = 'button'; button.id = 'signout'; button.className = 'nav-signout'; button.textContent = 'Sign out';
    button.addEventListener('click', async () => {
      button.disabled = true; button.textContent = 'Signing out…';
      try {
        const result = await fetch('/api/auth/signout', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({csrf:session.csrf})});
        if (!result.ok) throw Error();
        location.replace('/signin.html');
      } catch {
        button.disabled = false; button.textContent = 'Retry sign out';
        message.textContent = 'Could not sign out. Please try again.';
      }
    });
    const message = document.createElement('span'); message.className='nav-status'; message.setAttribute('role','status');
    nav.append(button, message);
  }).catch(() => { /* Keep public navigation usable when the network is unavailable. */ });
})();
