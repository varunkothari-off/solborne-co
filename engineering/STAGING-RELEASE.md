# Solborne staging release

## Current: visual-story update

24 October 2026. Version77ec39e6-e02c-4d35-9cfe-3b67da584425 at100%, product source142f6960e8610705ebd7330b10a5900e6860dda7. Seven scroll-linked story scenes at the staging root; previous homepage remains at /?view=baseline. New /walk-demo.html is an explicitly scripted interaction example; actual AI Walk has a saved-state visual map.

375 platform tests, eight-feature evidence gate, GitHub source/evidence checks and20-page link audit passed. Desktop/390px, scroll-to-scene correspondence, post-review corrections, retained context, dispute pause, reduced-motion/static fallback and no overflow checked. Actual HTTPS domain verified: root/story, demo, baseline and AI Walk all200 with staging/noindex headers. Browser verified work token moves with scroll, dispute pauses routine follow-up, and actual Walk has five map decisions. Production homepage SHA256 remains57a06d0de7679f896d77b55ba9759bcec9757eea25444e5dc174d4b920cf5f25.

Only staging changed. Live auth/AI/uploads/submissions remain disconnected. No customer data, production bindings, cron or external transports added. Rollback version995ede53-8e73-4f26-88d6-793f2a2465d4 remains the prior visual staging release.

## Initial staging release

Owner request on 24 October 2026: publish the reviewed JTBD website and Walk changes on staging.solborne.in. This is staging authorisation only; production and draft-PR merge remain unchanged.

- URL: https://staging.solborne.in/
- Worker: solborne-staging; exact custom domain staging.solborne.in.
- Deployed version: 995ede53-8e73-4f26-88d6-793f2a2465d4, 100%, uploaded 24 October 2026 11:58:39 UTC.
- Product source: 153fa23fb617d436e618402c64f176e4b42df669 plus the staging-only wrapper/config/isolation tests in this branch.
- Build/dry-run: same reviewed product assets; Worker upload 2727.05KiB / gzip1016.26KiB; startup2ms.
- Config: cloudflare-site/wrangler.staging.jsonc. Explicit command only; default production config was not used or modified.

## Scope and isolation

Visual/customer-journey review deployment. It has no production database, storage, service, secret or cron binding. The wrapper ignores supplied bindings and passes explicit disconnected settings to the product. It rejects mutations, disables authentication/provider/file services, removes analytics initialisation and returns noindex/nofollow/noarchive. A visible banner explains these limits; sign-in pages provide a direct read-only Walk-introduction preview.

This is not a live AI conversation environment. Enabling real sign-in, models, uploads and private testing requires separately configured isolated services and acceptance. No production credentials or customer data were copied to staging. No new paid service or plan was created.

## Verified at destination

- Ordinary Chrome loaded the new homepage through HTTPS and the outcome hero was visible.
- Operations entrance displayed operations sign-in copy and its Walk introduction; website entrance displayed the website sign-in copy. No authenticated customer session was used.
- HTTP homepage200; X-Solborne-Environment=staging; X-Robots-Tag=noindex,nofollow,noarchive; visible banner; analytics loader absent.
- Auth session: authenticated=false, enabled=false, configured=false.
- Empty POST to registration returned503 with staging-disconnected explanation; no enquiry created.
- Public resolver1.1.1.1 resolves staging to Cloudflare. The local resolver briefly retained NXDOMAIN, then Chrome and ordinary HTTP loaded successfully. API checks also used the published Cloudflare address with normal hostname/SNI certificate verification; no certificate bypass.
- Ordinary supported Wrangler deployment listing confirmed the version above. Its only listed binding is SITE_ORIGIN. No token extraction used.
- Production homepage remained HTTP200, title Free Business Website & Workflow Automation, SHA25657a06d0de7679f896d77b55ba9759bcec9757eea25444e5dc174d4b920cf5f25, matching the prior production receipt.
- Four isolation tests pass; independent read-only review found no material production-isolation defect.

Rollback/redeploy only the solborne-staging Worker with the staging configuration. Do not use the production wrapper or attach production bindings to make the review preview interactive. Domain removal is not required for ordinary staging code rollback.
