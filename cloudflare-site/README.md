# Solborne production website

This is the active Cloudflare Worker and website source for **https://solborne.in/**. The Astro application at the repository root is retained as the earlier implementation; it is not the current production release.

The motion design is the canonical public site. `/studio/` retains the quiet option, `/studio-motion/` the earlier motion preview, and `/previous-site/index.html` the previous homepage. The customer KFS site uses its own separate Worker and is not deployed from this folder.

## Build and verify

Use Node.js 24. The build and test suite use Node built-ins; no application dependencies are required.

```sh
node scripts/promote-motion.mjs
npm run build
npm test
```

Before a **production** build, the owner must provide the existing `private/canvas.pdf` and `private/canvas.txt` deployment inputs. These gated intake materials are intentionally absent from this public repository. Credentials, customer data, private receipts, owner captures and generated private payloads are also excluded. CI uses explicitly synthetic fixture bytes to exercise access controls; its build is not a deployment artifact. The single test pinning the private production-canvas hashes is explicitly skipped in public CI. That check remains enabled in the full owner-workspace test run.

Deployment is manual with the owner's authenticated Wrangler account and the existing secret store. Do not create or migrate a database as part of this website release. Do not enable `AI_WALK_ENABLED` without the provider and owned end-to-end checks in `docs/ai-activation.md`.

## Launch scope

- Responsive motion website, complete navigation, logo story and interactive footer.
- Eight indexable public pages with canonical, Open Graph and structured company/site metadata; private/preview pages remain non-indexable.
- Sitemap, robots rules, canonical redirects and Search Console verification metadata.
- GA4 `G-RCN3M8J1PG`: basic opt-in, public pages only, enhanced measurement disabled, no advertising signals. No form answers, registration identities, receipts or private query strings are sent. These Google measurement/verification identifiers are public configuration, not credentials.
- Existing registration, ownership, private review/release and isolated presales sync remain intact. The free deliverable is the current one-page V1 plus source and README; hosting/domains/maintenance are separate. Automated AI delivery and seven-day preview expiry are not represented as live.

## Evidence boundaries

The owner workspace passed 127 local tests. Live consent testing observed zero Google requests before opt-in, then a Google tag HTTP 200 and collection HTTP 204 afterward. A collection response does not establish Google report processing or search rankings. Indexing, real-phone behaviour and campaign outcomes are separate checks.

Reused assets retain their source notices: MIT Bootstrap, OFL fonts, and the HTML5 UP licences/credits on older pages and applicable generated customer templates. See `docs/studio-design-sources.md`.
