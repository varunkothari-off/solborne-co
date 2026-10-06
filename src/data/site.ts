/**
 * Site-wide constants. Copy-level values only — theme values (colors, type,
 * spacing) live exclusively in src/styles/tokens.css.
 */
export const site = {
  name: 'Solborne & Co.',
  primaryDomain: 'solborne.in',
  outreachDomain: 'getsolborne.com',
  tagline: 'Every business deserves a webspace it owns.',
  /* Placeholder address — confirm before launch (see README decisions). */
  email: 'hello@solborne.com',
  /* ============================================================
     CASE-STUDIES TOGGLE: the write-ups are placeholders, so the
     section is hidden everywhere (home section, nav item, footer
     link). Flip to `true` once the first real case study exists.
     ============================================================ */
  showCaseStudies: false,
} as const;

/** Owner-approved proposed alias; publish a mail link only after delivery verification. */
export const enquiryContact = { email: 'enquiries@solborne.in', brandedDomain: 'solborne.in', verified: false };