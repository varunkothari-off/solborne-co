# Stable design and SEO: staging receipt

25 October 2026. Owner asked to retain staging content while restoring the current stable design, hierarchy and UI, unifying footers, and adding SEO/AIEO.

- Homepage:https://staging.solborne.in/
- Services:https://staging.solborne.in/services.html
- Deployed source:14cc6ef. Worker:solborne-staging. Version45c5ea2c-8ac2-4689-aed2-d795c930e485.
- Config:cloudflare-site/wrangler.staging.jsonc, onlySITE_ORIGIN binding. Production was not deployed or merged.
- Rollback:cf17698a-172e-492a-a18b-7e07656e3f01, the preceding clarity design.
- Draft PR:https://github.com/varunkothari-off/solborne-co/pull/27.

## What changed

Reused stable98e9d963 studio typography, design/footer CSS, existing header/menu, office/atelier illustration and lettering behaviour. Staging's services, jobs, deliverables, owner decisions, costs and timing remain. The layout adapter no longer defines a replacement font/theme/button system. One build-time header/footer template serves14 Solborne marketing/demo documents, including the full INDIA artwork, oversized Solborne & Co., company/policy/contact links, Services and retained illustration attribution. Private workspaces and customer examples keep their appropriate shells.

Shared assembly runs before asset bytes, ETags and schema CSP hashes. The local preview and link audit use the same transforms. The full footer sits after the contained payment player rather than being reduced to a compact logo. Company & links provides explicit access.

Public metadata now includes unique titles/descriptions, canonical/social data and linked Organization/WebSite/WebPage entities. Services includes factual Service/OfferCatalog data. Services and Operations join the production marketing allowlist and sitemap. Existing crawler permissions are unchanged. No special AI schema, llms.txt ranking promise, fabricated price/rating or FAQ rich-result claim was added. Staging noindex and disconnected services remain enforced by the existing wrapper and HEAD regression checks.

## Verification

- Live stable read-only versus local candidate at1280x720: same Public heading500 at84.48px/87.8592px, header90px and pill radius100px. Footer typography and full-width treatment restored.
- Local360px: document345px, header76px, full footer lockup304.03px within305px. Existing Menu exposes Services. At800px the new bridge uses that same menu rather than crowding the expanded navigation. Mobile demo board top76px equals header bottom76px.
- Payment wheel1to2 and actual pointer Previous3to2 both retained scrollY0; the explicit company link reaches the common footer. Locator click helpers can scroll targets themselves, so direct pointer input was also checked.
- Actual HTTPS staging homepage and Services were opened after deployment. Services renderedlabs-footer and canonicalhttps://solborne.in/services.html with WebPage,Organization,WebSite,2Services and OfferCatalog data. Live introduction/content remained intact. The staging banner remained visible. Top-document network headers were not re-captured in this in-app session; noindex is covered by deployed source and the HEAD test, not misreported as a new network-header observation.
- Build161 assets. Full platform suite389 passed,0 failed. Link audit23pages/756links/198assets,0 failures. Feature gate11records. Independent review passed; source/evidence CI passed on14cc6ef.

Physical-phone behaviour, customer comprehension, search inclusion, rankings and AI citations remain external/unmeasured outcomes. Production entrance promotion remains a separate approved release decision.

Search guidance references:https://developers.google.com/search/docs/fundamentals/ai-optimization-guide ; https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a ; https://developers.openai.com/api/docs/bots .
