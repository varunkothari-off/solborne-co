# Stable design and SEO review

25 October 2026. Independent source and focused-test review against specs/011-stable-design-seo. This reviewer did not edit product code, use the browser or deploy.

## Status

Passed for staging after the responsive integration correction. No remaining material source-content, SEO, privacy, canonical-host, CSP or sticky-offset blocker was found in the reviewed scope. Root still owns rendered and actual-destination acceptance.

## Required mobile integration check

The initial review identified the new76px sticky header covering the mobile Walk demo board at `top:0`, and the older story canvas retaining top66px. Root corrected both in public/site-shell.css: the board uses top76px with selector specificity above its legacy rule; the enhanced story canvas uses top76px only when reduced motion is not requested. Desktop placement and reduced-motion fallback remain intact.

The same bridge exposes the existing mobile menu up to1040px to accommodate the expanded common navigation. It preserves design.js ownership of `.enhanced`, `.open` and `aria-expanded`, with a wrapping no-JS navigation fallback. applyShell includes the bridge once after stable footer styles and before local page CSS. Independently rerun focused tests remain22 passed,0 failed after these corrections.

## Reviewed and verified

- The stable header/footer derive from the verified stable source, with Services navigation and a single identical footer. The large serif wordmark, INDIA artwork and entity/contact/policy links are retained. Storyset attribution survives the footer replacement.
- applyShell is a build-time transform, not a browser fetch. Private/auth/customer-example paths are excluded. Dependency ordering keeps the stable foundation before page adapters. applySeo runs before body encoding, ETag and JSON-LD hashes; the matching schema/CSP integration test passes.
- The staging service body, free/paid boundaries, expected outputs, owner decisions and quoted timing/cost model are retained. Reused fictional website art remains labelled illustrative. No measured collection, automation, prediction or customer-result claim was introduced.
- Services and Operations become indexable only through the public production path allowlist. Private/demo aliases keep noindex. The staging wrapper still overrides headers to noindex, disconnects live bindings and refuses mutations. Robots permissions are unchanged. Metadata has linked Organization/WebSite/WebPage and relevant Service/OfferCatalog data without fake prices, ratings, FAQ rich-result promises or a new crawler permission policy.
- The analytics preferences link has a working privacy-section fallback. With the existing consent loader it prevents default navigation and opens the current choice panel. No consent default, tracking category or new external send was added. Root explicitly records that this individual prevention regression test followed the edit; this review makes no test-first chronology claim for it.
- The canonical-host regression still checks exact assembled reviewed bytes, no-transform, CSP hashes and protected methods/paths. Updating the expected bytes through the deterministic build transforms does not turn it into an edge rewrite or remove its host/security assertions.

Independent command: `cd cloudflare-site; node --test test/site-shell.test.mjs test/site-seo.test.mjs test/design-shell-integration.test.mjs test/deployment-hosts.test.mjs test/launch-seo-analytics.test.mjs` —22 passed,0 failed.

Root owns desktop/mobile visual comparison, wordmark fit, navigation/reduced-motion checks and actual deployed-version verification. Search indexing/ranking, AI citation inclusion, physical-phone behaviour and owner comprehension are not established by these source tests.
