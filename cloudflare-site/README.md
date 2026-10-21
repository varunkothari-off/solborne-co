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

The owner workspace runs the full local suite before each release; current counts and receipts are recorded in the release flight report. Live consent testing observed zero Google requests before opt-in, then a Google tag HTTP 200 and collection HTTP 204 afterward. A collection response does not establish Google report processing or search rankings. Indexing, real-phone behaviour and campaign outcomes are separate checks.

Reused assets retain their source notices: MIT Bootstrap, OFL fonts, and the HTML5 UP licences/credits on older pages and applicable generated customer templates. See `docs/studio-design-sources.md`.

## Runtime and recovery

The live conversation uses the grounded Argon adapter; Gemini Live transcription is separately gated by `GEMINI_LIVE_TRANSCRIPTION_ENABLED`. Audio consent and explicit transcript review/send are required. The browser capture limit is one minute; direct-provider token restrictions are separate. No audio recordings are stored in Solborne databases.

Browser document misses receive the branded404 with an actual404 status; API and machine requests retain JSON errors. Account pages show a delayed, non-blocking session loading indicator. `/loading.html` is an explicitly labelled visual preview, not a mandatory splash route.

Only eligible, leased AI work reserves shared daily model units. Invalid attempts have their own rate limiter. Do not add shared-provider charges in routing before validation.

Database schema files live in `drizzle/`; database changes are managed separately from site deployment. `wrangler d1 migrations list` is not configured as the source of migration truth. A deployment must not bootstrap or migrate the production database. Private owner queue snapshots/exports live under ignored `private-owner/`.

### Walk input polish (21 October 2026)
Live transcription writes directly into the editable answer. One mic/WS session is reused across explicit turns; pause/send disables capture and suspends audio, while Disconnect/withdrawal/page exit releases it. No one-minute live recording or 2,000-character answer limit. Requests retain a 256 KiB abuse/resource bound. Ephemeral credentials remain single-use, model-restricted, with a 60-second connection window and 30-minute expiry. Provider/network disconnects preserve draft text but may require a new mic click.

Privacy choices use the versioned `solborne.walk-privacy.v1:<active-registration>` browser key, with separate AI/audio choices and the existing optional analytics key. No analytics tag is added to the private Walk. Reuse this purpose-specific, revisable pattern in future sites; never copy consent across brands, new purposes or browser microphone permissions. A future purpose change requires a new notice/version.

Argon answer ideas are optional, unconfirmed drafts. Selecting appends editable text and never sends or updates owner facts automatically. The core discovery rules remain intact. Submitted briefs remain awaiting manual review; there is no automatic website publication.

Walk copy follows a minimal workspace pattern: no inline provider explanations or persistent dictation hints. A labelled native Manage consent dialog groups separate processing choices; full voice behaviour, limitations and withdrawal details live in Privacy and Terms. The dialog opens for new business/browser choices and remains available through Manage consent. Essential recording/finalizing/error feedback remains visible.

## 21 October 2026 launch audit
Normal test suite:222passed. Removed package aliases pointing at absent browser/security-probe files; no claim those probes ran. Offer copy now aligns with24hour human-reviewed private delivery after confirmed submission and distinguishes sample paid-platform demos from inactive production integrations. Worker versionced4956e-b7e7-4985-89b6-c015b353fb41; previous02fe8568-94da-448f-9c0d-fd993bd5bb8a. Five post-release pages match source and branded404verified. Read-only queue audit:0pending sync,2awaiting_manual_review,0overdue. Fresh authenticated real-phone journey and outbound mail alignment/delivery remain campaign-scale gates. No outreach sent.
