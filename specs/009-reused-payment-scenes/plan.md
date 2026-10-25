# Reused Payment Scenes Implementation Plan

Spec: specs/009-reused-payment-scenes/spec.md. Existing vanilla stack; new pinned Swiper vendor files only.

- [x] Verify component/asset source and licences, retain notices.
- [x] Write failing integration configuration/route checks; implement one component with unified scene layout and branded footer.
- [x] Inspect actual browser wheel, buttons/arrows, mobile layout, short viewport and centre alignment; reduced-motion/read-all and automated missing-vendor fallback.
- [x] Run full suite/build/link checks and independent review; resolve findings.
- [x] Deploy staging only and verify live version/paths/footer. Production viewed read-only and deployment list checked; a fresh byte-hash request returned403, so no fresh hash claim.
