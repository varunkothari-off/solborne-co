/* Solborne's original Bearing identity, recovered from the approved project.
   Source: github.com/varunkothari-off/solborne-co, commit 177cb82,
   src/styles/tokens.css, src/components/{Mark,Wordmark}.astro.
   No contact destination is active until verified. */
window.SOLBORNE_BRAND = Object.freeze({
  name: 'Solborne & Co.',
  title: 'Solborne & Co. — Your story. Your free first website.',
  description: 'Complete the Walk of Fame to get your free one-page website and editable source. Hosting, domains, maintenance and future edits are separate.',
  intendedDomain: 'solborne.in',
  emailDomain: 'getsolborne.com',
  contactEmail: null,
  pilotRegistration: { enabled: true, endpoint: '/api/registrations' },
  identity: 'Bearing',
  colors: { ink: '#211d18', paper: '#f1ebdd', panel: '#f7f3ea', bearing: '#c1872e', steel: '#375562', stone: '#8b8274' },
  fonts: { display: 'Source Serif 4', body: 'Public Sans', mono: 'IBM Plex Mono' }
});
