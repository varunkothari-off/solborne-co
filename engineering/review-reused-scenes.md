# Reused payment-scene review

24 October 2026. Read-only source review against specs/009-reused-payment-scenes. Root owns browser evidence and staging release.

The new structure addresses the earlier alignment defect: text and art share one fitted scene-group; Swiper owns the single active scene and movement. The three-workflow selector is absent. Root reports settled360x640 scene3 content within the deck and the footer within the viewport. Existing Storyset illustrations and Swiper are reused with retained attribution/licence records. The footer includes Solborne & Co. identity and useful company/contact/policy links. Staging remains exact-host, noindex and disconnected from production bindings/transports.

## Review status: passed for staging

Both mandatory findings are corrected in the re-reviewed source:

1. The per-event thresholdDelta40 was removed. Stock thresholdTime650 and transition handling remain. Root's actual-browser check reports deltaY4 advances one settled scene, so high-resolution input is no longer discarded by that threshold.
2. The reduced-motion listener now checks that the instance is not destroyed and params still exists. The test double deletes params on destruction; independently rerun component tests pass, including preference changes after Read all. Root's browser check reports no errors in that sequence and zero-duration changes on reduced-motion reload.

## Optional interaction refinement

The optional interaction refinement was also applied: stock mousewheel.eventsTarget is `.scene-shell`, covering the header/footer frame rather than only the deck.

No remaining material source or production-isolation blocker found in this review scope. Root reports desktop copy/art centres431.492/431.5, short360x640 scene3 content95.5..470.5 within deck62..503.6, touch swipe3to2 with page scrollY0, and all three headings visible without JavaScript. Root also reports377 tests passing and zero link-audit failures. These are attributed browser/full-suite checks; this reviewer independently reran the two component tests and re-read the corrections. Staging release may proceed subject to verifying the deployed version and actual destination. This review does not certify physical-device behaviour or live AI quality.
