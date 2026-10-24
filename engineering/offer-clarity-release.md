# Offer clarity: staging release

24 October 2026. Owner requested a design-thinking/expert UI redesign after finding the payment scene player navigable but the overall offer unclear. Added an overview, Services and separate website/automation process paths. Retained the fixed payment scenes as a labelled optional example and preserved the Solborne & Co. footer.

## Receipt

- Homepage:https://staging.solborne.in/
- Services:https://staging.solborne.in/services.html
- Process:https://staging.solborne.in/how-it-works.html
- Payment example:https://staging.solborne.in/payment-scenes.html
- Source:abc558c; primary implementatione83167a. Worker:solborne-staging; versioncf17698a-172e-492a-a18b-7e07656e3f01. Deployment usedwrangler.staging.jsonc, onlySITE_ORIGIN binding.
- Rollback:388e2719-606e-463d-bbc5-04e40e8062a2 returns the earlier payment-story entrance. Intermediate clarity deployment5460a449-6a23-4007-b135-15eac74919d7 precedes the final concrete-jobs introduction.
- Draft PR:https://github.com/varunkothari-off/solborne-co/pull/27. No merge or production deployment.

The final homepage response was browser-verified200 with cache-control:no-store, x-robots-tag:noindex,nofollow,noarchive and x-solborne-environment:staging. Live copy names payment follow-ups, document collection and quotations; free website files and paid automation have separate labels. The Services button opens the correct page. Services covers deliverables, target outcomes, owner decisions, price/timing basis, access, recurring costs and support terms. The24-hour timing applies only to a private website preview. Workflow examples do not claim live connections or customer results.

## Rendered acceptance

Chrome local desktop overview and390px Services/costs were inspected. A later Chrome connection stall was bypassed only by ordinary navigation of the authorised public staging URL in a fresh in-app browser; no browser security warning, website access control or denial was overridden. Command-line HTTP returned403, so it was not used as a false success receipt.

Fresh in-app browser verified actual staging at360x640: document width345px within360; header navigation visible; first CTA bottom559.92px. Costs table303.59px wide; anchor top25.3px. Native grouped details showed Documents open with Payments/Quotations closed. How it works exposed both routes; Contact exposed the workflow brief route. Keyboard focus reached the brand link with a solid outline. In-app viewport override was reset and the final page left open. Physical-phone behaviour and unfamiliar-owner comprehension remain unmeasured.

## Automated evidence

Build158 assets. Platform suite378 passed,0 failed. Link audit23pages/643links/191assets,0 failures. Feature gate10 records; independent review inengineering/review-offer-clarity.md passed after the local-preview analytics regression was corrected. New black-box preview test verifies shared routing, read-only/API refusal, parent-file protection, HEAD and removed analytics loader. Existing public metadata/schema/consent checks retained.

The loopback preview runs withnode scripts/preview-staging.mjs4193 and uses the same entrance mapping as Cloudflare. It cannot access live APIs or submit. Previous baseline/?view=baseline, story/story.html and payment/payment-scenes.html remain available. Production index remains the retained baseline apart from Services navigation; any future production entrance promotion requires a separate approved release decision.
