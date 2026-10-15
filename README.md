# Current production implementation

The active solborne.in website and Cloudflare Worker are maintained in [cloudflare-site](cloudflare-site/README.md). The Astro application below is retained as the previous implementation.

# Solborne & Co. — Marketing Site

Static marketing site for Solborne & Co., an independent AI advisory.
Built against the authoritative design source in
[`design/Solborne_Brand_-_Final_Direction__standalone_.html`](design/Solborne_Brand_-_Final_Direction__standalone_.html)
(the **"Bearing"** direction: marigold point over a level horizon, warm oat
ground, Source Serif 4 / Public Sans / IBM Plex Mono).

## Stack: Astro (and why)

**Astro 5, static output, zero client-side framework.** The alternatives were
Next.js or Astro; Astro wins for this site because:

1. **This is a content site, not an app.** Every page is static copy and CSS.
   Astro ships **zero JavaScript by default** — the only JS on the whole site
   is a ~10-line mobile-nav toggle and the placeholder contact-form notice.
   Next.js would ship the React runtime (~90 KB+) to render what is, in the
   end, prose.
2. **No CSS framework bloat by design.** Astro's scoped `<style>` blocks plus
   one global tokens file give component-scoped styling with no Tailwind, no
   CSS-in-JS, no purge step. What's in `tokens.css` is the entire theme.
3. **The upgrade path is real.** When the diagnostic/booking product (Phase 3)
   arrives, Astro supports server islands, API routes, and any UI framework
   per-component — without rewriting the marketing pages.
4. **Fonts self-hosted via `@fontsource`.** No Google Fonts requests, no
   third-party calls at runtime, matching the "no external services" rule.

## Run locally

```bash
npm install
npm run dev        # dev server at http://localhost:4321
npm run build      # static production build into dist/
npm run preview    # serve the production build locally
```

Requires Node 18.17+ (built on Node 22).

## File structure

```
design/                      Authoritative brand/design source (binding)
public/
  favicon.svg                Bearing-mark favicon (ink tile, amber point)
src/
  styles/
    tokens.css               THE theme file — every color, font, size,
                             spacing, radius, shadow. Edit theme here only.
    global.css               Reset + base typography; consumes tokens only
  components/
    Mark.astro               The bearing mark (SVG, never tilted)
    Wordmark.astro           "Solborne & Co." with the amber ampersand
    Header.astro             Sticky nav + mobile toggle
    Footer.astro             Centered lockup, tagline, footer nav
    PageIntro.astro          Masthead: eyebrow / serif h1 / intro / level rule
    Section.astro            Section frame: hairline top + mono label + dash
    Button.astro             Solid (ink) and ghost link-buttons
    ConfidenceBar.astro      "Confidence gets a number" — the signature element
  layouts/
    BaseLayout.astro         <head>, fonts, skip-link, header/footer shell
  data/
    site.ts                  Name, tagline, contact email
    services.ts              Service catalog (names, prices, deliverables)
    case-studies.ts          Case-study registry (both entries: coming soon)
  pages/
    index.astro              Home
    services.astro           Services
    approach.astro           Approach
    about.astro              About
    contact.astro            Contact (form is front-end only — see below)
    case-studies/
      index.astro            Case-study index
      [slug].astro           Dynamic route rendering each entry in
                             data/case-studies.ts as a clearly-marked
                             coming-soon stub (currently MyNDSHyP and
                             Kothari Financial Services)
```

### Where things are marked for you

- **Every block of draft copy** is preceded by `<!-- DRAFT COPY -->` in the
  template (or `/* DRAFT COPY */` for strings that live in component
  frontmatter, where HTML comments can't go). Search the repo for
  `DRAFT COPY` to find every sentence that needs your voice pass.
- **The contact-form backend integration point** is a loud comment block in
  `src/pages/contact.astro` directly above the `<form>`. The form currently
  intercepts submit and shows a "not connected yet — email us" notice; the
  comment explains exactly what to delete and where to point the real
  endpoint when one exists.

## Design-system rules encoded in this build

Carried from the brand sheet's usage guardrails — future edits should keep to
them:

- Paper and Ink do almost all the work. **Bearing amber is one accent per
  view** — never a fill, never body text, never a button. The only amber
  surface is the 7% wash on a single highlighted card.
- **Steel + IBM Plex Mono wherever a price, figure, or confidence level
  appears** — "a number, not a shrug."
- The mark's horizon stays level. No rays, no glow, no gradients, no
  navy-and-gilt cues, no luxury tracking.
- All theme values live in `src/styles/tokens.css` and nowhere else.

## Decisions needed from Varun

1. **Production domain** — `astro.config.mjs` uses `https://solborne.com` as
   a placeholder `site` value (canonical URLs + OG tags derive from it).
   Confirm the real domain.
2. **Contact email** — `src/data/site.ts` uses `hello@solborne.com` as a
   placeholder. Confirm the real address.
3. **Show prices publicly?** The Services page currently displays the USD
   price sheet from the Phase 0 research ($0 / $1,497 / $2,500 / $990 /
   $1,900 / $6,900). Transparent pricing fits the "within reach" brand, but
   it's a business call — say the word and the price column comes out.
4. **INR / India storefront** — Phase 0 recommends a geo-gated INR track
   launched after the USD one. This build is USD-only; the dual-storefront
   split (separate pricing page? subdomain? geo logic?) needs a product
   decision before it's built.
5. **Case-study facts** — both entries (MyNDSHyP, Kothari Financial
   Services) are honest "coming soon" stubs with zero invented details.
   They need: sector line, engagement scope, and eventually the write-up
   (plus client consent, per the copy's own promise).
6. **Copy pass** — all copy is first-draft, marked `DRAFT COPY` throughout.
   Especially review: the "reply within two business days" claim on Contact,
   and every claim on Home/Services.
7. **Repo privacy / business docs** — the confidential planning docs in this
   folder (internal brand ground-truth, Phase 0 research, cost model,
   trademark filings, `architecture-and-api-spec.md`) are **gitignored on
   purpose** and never pushed. If you want any of them versioned, move them
   to a private docs repo rather than un-ignoring them here. (The GitHub
   repo has been renamed to `solborne_co`; the old `salborne_co.` name
   still redirects. Note the repo is public.)
8. **Phase 3 scope** — `architecture-and-api-spec.md` describes the full
   diagnostic/booking/payments product (Supabase, Razorpay, ElevenLabs).
   That is deliberately **not** built here (this task was the static site,
   front-end only). The contact form's integration point and the
   "free diagnostic" CTAs are where that system will plug in. The spec also
   assumes analytics before ad spend — also intentionally absent from this
   build per the no-tracking rule.
9. **Legal footer** — currently "© Solborne & Co." with no entity name,
   no privacy policy, no terms. If the LLP name must appear (or a privacy
   page is needed before the form goes live), that's a content addition.
10. **Social-share image** — pages emit OG/Twitter meta but no `og:image`
    (link previews will be text-only). Needs a designed 1200x630 card
    (bearing mark on Paper) dropped in as `public/og.png` plus one meta
    tag in `BaseLayout.astro`.

## Working rules honored

- Branch: `build/initial-site`; `main` untouched (it doesn't exist locally).
- Incremental commits, one concern each.
- No deploys, no external services, no analytics, no tracking, no
  third-party scripts. Fonts are self-hosted npm packages.
