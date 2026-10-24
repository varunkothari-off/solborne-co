# JTBD Walk Implementation Plan

Goal: implement the approved two-route business journey with truthful tracked handoff.

Architecture: preserve current source and account/project contracts; extend allowlisted journey context in existing JSON, server-enforced readiness and browser presentation. Tech: vanilla JS/HTML/CSS, existing Worker and D1. Spec: specs/007-jtbd-walk/spec.md.

## Constraints and review focus

No production deploy, sends, model calls with real customers, secrets or schema migration. Preserve legacy website route and provider model. Test intent loss after OAuth, existing project conflicts, private summary leakage, incorrect operations deadlines and misleading delivered status. One writer per file.

## Tasks

- [x] Capture failing behavioural tests for contextual entry and operations readiness/handoff before implementation.
- [x] Homepage worker: edit index.html, studio-motion/index.html, home-refinement.css; add operations.html. Preserve existing homepage contract and test links.
- [x] Backend worker: add walk-journey helper; extend both engines and submission metadata. Run synthetic route/readiness/replay/authority tests.
- [x] Root: preserve context in entry-intent/signin/form/walk redirect; adapt ai-walk UI to persisted route with route-specific summary, confirmation and status.
- [x] Root: owner-side handoff tracking helper and CLI, revision guarded, read-only default, no transports; route build includes new server module.
- [x] Run full existing suite/build/link audit; inspect rendered desktop/mobile and synthetic operations/customer journeys; independent review and fix findings.
- [x] Record verification and prepare reviewable branch/preview; production promotion remains separate.
