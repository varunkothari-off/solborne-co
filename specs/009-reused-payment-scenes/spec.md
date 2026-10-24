# Reuse-first payment scenes

24 October2026. Owner found free scrolling and three concurrent journeys confusing, requested each wheel/swipe/arrow action advance one section, shared text/illustration centring, mobile-first layout, existing assets modified/reused instead of custom animation, and restored Solborne & Co. footer identity.

- AC-01: One payment journey, three fixed scenes. No in-story workflow selector. One existing Swiper component owns transitions, wheel, touch and navigation; no bespoke animation engine or redrawn illustrations.
- AC-02: Each scene's text and illustration share one centre-aligned layout. Desktop side-by-side; mobile one fitted vertical group. Header/footer deducted from usable height. Buttons never navigate to an off-centre anchor.
- AC-03: Wheel, arrow controls and swipe advance/back without page scrolling in the enhanced view; inertial/rapid input is bounded by stock component configuration. Native controls and a read-all fallback remain. Reduced motion uses immediate changes. No-JS shows the complete linear explanation.
- AC-04: Reuse three same-style licensed illustration assets, recolour only as permitted, retain licences/attribution. Existing Solborne logo/wordmark returns in a compact, legible footer with useful company/contact/policy links, on mobile too. No paid asset purchase or account required.
- AC-05: Staging only; retained previous story and baseline remain accessible. No production, auth/provider/data/notification changes. Verify desktop,390px portrait, short360x640, navigation, centring and meaningful footer; retain isolation and required checks.

## Approach

Use pinned official Swiper14.3.0 MIT distribution with built-in navigation, keyboard, mousewheel and touch modules. Adapt existing SVG illustrations and brand typography/colours; do not animate individual illustration parts. Prototype the three-scene payment explanation before rebuilding other campaigns. Story: completed work/unpaid invoice → routine follow-up → exception needs owner's context. No collection guarantee or unearned metric.

## Ownership

Root owns scene HTML/CSS/component configuration, staging route, tests, evidence and release. Asset worker owns public/assets/payment-story and assets.md only. Reuse the current isolated staging setup and leave production unchanged.
