# Visual customer story and inspectable Walk

24 October 2026. Owner asks for minimal words, maximum explanatory graphics, scroll-linked storytelling, each section answering the previous customer's question and introducing the next. They also need a way to inspect whether the Walk changes are good. Existing staging authorisation continues; production stays unchanged.

- AC-01: A new staging homepage tells a coherent short story using actual scroll-linked explanatory graphics, not a timed slideshow. Native scroll, links and keyboard chapter controls work. Existing homepage remains accessible for comparison.
- AC-02: Story questions connect pain, routine work, human intervention, outcome learning, customer-facing website and a useful first conversation. Graphics are labelled illustrative; no fabricated ROI, customers, accuracy or autonomous capabilities.
- AC-03: An interactive synthetic Walk demo lets the reviewer choose payments, documents, quotations or website; supplied context fills a visual map, corrections update it, human intervention is explicit, and a reviewed summary preserves their choices. No model, network, storage, customer records or actual submission; label stays visible.
- AC-04: The actual AI Walk receives a compact visual map derived from saved facts. It distinguishes known/unknown/reviewed state and retains existing conversation/auth/upload/approval behaviour. It does not replace the real interview with demo responses.
- AC-05: Mobile/desktop, reduced motion, no-JavaScript, keyboard focus, SVG semantics and no overflow verified. Required service/scope disclosures remain discoverable without lengthy main copy. Staging stays isolated and noindex.

## Implementation

Keep owned brand, self-hosted fonts and existing vanilla stack. New story.html/css/js are a staging-root presentation via staging-worker.mjs; baseline root is available with view=baseline. Separate walk-demo assets hold deterministic examples; each screen demonstrates the desired interaction and never claims an actual provider result. Actual AI Walk integrates a separate project/render helper using public/private saved state already permitted to the owner. No new service, schema, secrets, analytics, dependency or customer writes.

Design: pale existing background, green/ink operational paths, gold owner decision, readable text labels as well as colour. One evolving graphic carries the story. Chapter copy stays short; details are progressively disclosed. Avoid generic rounded-card dashboards and decorative numbers. Scroll drives understanding, not compulsory delay. Reduced-motion and no-JS variants retain the complete explanation.

## Alternatives

Animating the existing long copy does not solve clarity. Replacing the real conversation with a scripted demo misrepresents quality. Use a visual scroll story, a clearly separate inspectable demo, and a real saved-state map in the actual Walk.

## Verification and rollout

Root owns integration/demo; scroll_story owns new story files; walk_visual_map owns new map assets/tests. Each behavioural task records failing checks before implementation, then regression/browser checks and independent review. Publish only with wrangler.staging.jsonc. Roll back to995ede53-8e73-4f26-88d6-793f2a2465d4 if rendering/isolation fails. Production remains untouched.
