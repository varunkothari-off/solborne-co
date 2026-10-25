# Plan and ownership

Root owns layout adaptation, page content protection, build/local-preview/link-audit integration, analytics anchor behaviour, scene containment, rendered verification and release. Stable-style worker owns shared shell module/partials/tests only. SEO worker owns pure SEO helper/tests, exact Worker marketing path allowlist and sitemap/robots only. No shared file has multiple writers.

1. Observe live stable desktop and inspect unchanged stable design/footer code. Record failing assembled-page consistency, schema/CSP and analytics-anchor checks.
2. Build-time applyShell then applySeo, then compute asset bodies/schema hashes/ETags. Apply the same transforms in the disconnected preview and link audit. Render the footer identically without a JS fetch.
3. Reuse stable CSS with a layout-only adapter for the retained staging content. Reuse stable office illustration/UI components rather than generating new art. Place the full footer after the contained payment example.
4. Validate public SEO readiness separately from staging noindex; preserve crawler policy and private boundaries. Run full checks and independent review; inspect desktop/mobile and actual staging release.

Existing stable palette paper#f5f6f2/ink#183b3c/accent#315c58 and gold wordmark retained. Stable Public body16/1.65, heading weight500, hero up to96px, pill radius100px and Source Serif/footer treatment are the reference. No new theme.
