// Shared public navigation. Customer access and private review remain separate.
'use strict';
(() => {
  const header = document.querySelector('[data-site-header]');
  if (!header) return;
  const menu = header.querySelector('.menu-toggle');
  const nav = header.querySelector('#main-nav');
  const mobile = window.matchMedia('(max-width: 1040px)');
  let focusedControl = null;
  document.addEventListener('focusin', event => {
    focusedControl = header.contains(event.target) ? event.target : null;
  });
  document.addEventListener('focusout', event => {
    // Preserve a control hidden by a breakpoint until the media event runs.
    // An ordinary blur from a visible control clears the remembered focus.
    if (event.target === focusedControl && !event.relatedTarget && event.target.getClientRects().length) focusedControl = null;
  });
  const route = location.pathname.replace(/\.html$/, '').replace(/\/$/, '');
  nav.querySelectorAll('a').forEach(link => {
    const target = new URL(link.href, location.href);
    if (!target.hash && target.pathname.replace(/\.html$/, '').replace(/\/$/, '') === route && route) link.setAttribute('aria-current', 'page');
  });
  function close(restoreFocus = false) {
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    if (restoreFocus) menu.focus();
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('open', open);
  });
  nav.addEventListener('click', event => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      close(true);
    }
  });
  header.addEventListener('focusout', () => {
    queueMicrotask(() => {
      if (!header.contains(document.activeElement)) close();
    });
  });
  mobile.addEventListener('change', () => {
    const focused = header.contains(document.activeElement) ? document.activeElement : focusedControl;
    const focusedLink = focused && nav.contains(focused);
    close(mobile.matches && focusedLink);
    if (!mobile.matches && focused === menu) nav.querySelector('a').focus();
  });
  menu.hidden = false;
  header.dataset.navReady = 'true';
})();
