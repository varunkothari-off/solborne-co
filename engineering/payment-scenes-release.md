# Payment scenes: staging release

24 October 2026. User requested single-scene wheel/arrow/swipe navigation, shared centring, mobile support, reused assets rather than custom animation, and a restored Solborne & Co. footer.

- Destination: https://staging.solborne.in/
- Deployed source:0410e3d (product d904d2f plus SVG whitespace/hash normalization).
- Worker:solborne-staging. Version388e2719-606e-463d-bbc5-04e40e8062a2, deployed through wrangler.staging.jsonc.
- Prior staging rollback:77ec39e6-e02c-4d35-9cfe-3b67da584425.
- Draft review:https://github.com/varunkothari-off/solborne-co/pull/27. No merge or production deployment.

## Actual destination checks

Chrome loaded the staging root with the new first scene, one payment journey and all three stock illustrations. Next and keyboard navigation reached the owner scene while scrollY stayed0. At360x640 with the real staging banner, the deck was97..503.56px; owner-scene content112.98..488px, centred within0.01px. The entire footer fit555.56..640px, including wordmark, company/contact/policies and attribution. Desktop text/art centres were verified locally at431.492/431.5px; mobile390px and360px, small wheel input, synthetic swipe, read-all, reduced motion and no-JS fallback also checked locally. Physical-device behaviour remains untested.

Actual staging response200; cache-control:no-store, x-robots-tag:noindex,nofollow,noarchive, x-solborne-environment:staging. The previous story at/story.html and baseline/?view=baseline were opened successfully. Staging retains disconnected authentication/models/storage/submission transport and receives no production bindings.

Production was viewed read-only and still showed the existing website-first homepage. Latest production deployment list remained dated23October2026, version0656cb25-d2bc-4b44-8fc2-46c20a153600. No production command was executed other than read-only deployment listing. A fresh byte-hash request was unavailable (HTTP403); this receipt does not reuse an old hash as current evidence.

## Validation and limits

377 platform checks passed,0 failed. Build155 self-contained assets. Link audit21pages/573links/185assets,0 failures. SDLC gate9 features and14 gate tests passed. Independent review:engineering/review-reused-scenes.md; both findings fixed and checked before deployment. Swiper14.3.0 MIT, stock scene transitions only; Storyset Cuate illustrations with visible attribution and source/rights manifest.

This is a visual payment-story prototype. The stock checkout is conceptual, not Solborne pricing. No collection result, automation percentage, prediction accuracy, live-model quality or measured saving is established by these checks.
