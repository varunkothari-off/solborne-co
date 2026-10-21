# Independent review: Walk design preferences and optional sketch

Date: 21 October 2026. Reviewer: separate `reuse_audit` agent. Reviewed local diff against baseline 2435f53, feature specification/plan/tasks, API validation/persistence, frontend adapter, grounding, build inclusion and focused tests. No product edits made by reviewer.

Final scoped review verdict: **passed after corrections**. The initial review required changes; findings and their executed red/green evidence remain below. This verdict covers the inspected feature and local checks, not production release, live provider quality or autonomous-worker operation.

## Findings

### R1 — P1: Saved sketch can be replaced with an empty sketch after a hidden render

Location at initial review: `cloudflare-site/public/walk-design.js:10-11` (`draw` and `resize`).

`draw(data)` records normalized data but clears Signature Pad before checking whether the canvas has a nonzero rendered rectangle. Closing the surrounding details element gives it a zero rectangle. A subsequent normal state render calls restore/draw and clears the pad. When the section reopens, the resize handler reads the now-empty pad through `strokes()` and overwrites the retained normalized data. The next Save can therefore persist an empty sketch despite the owner never pressing Clear.

Executed a synthetic handler reproduction using the actual widget code with mutable visible geometry and a real ResizeObserver callback stub:

```
Saved strokes visible initially: 1
Saved strokes after hidden update and reopening: 0
Sketch subsequently posted: 0
```

Expected: the sketch remains one stroke and the posted normalized coordinates are unchanged. Keep normalized vector data authoritative across zero-size/hidden renders, or otherwise prevent clearing/discarding it when no drawable rectangle exists. Add a regression covering saved sketch -> close details -> state update -> reopen/resize -> save, plus visible width/DPR changes.

### R2 — P1: Design controls remain disabled after a conversation answer

Location at initial review: `cloudflare-site/public/ai-walk.js:5,8,23-24`; widget busy state at `public/walk-design.js:23`.

Answer submission sets `busy=true` and calls render; render passes busy=true to `designPanel.update`, which disables the design controls. The successful reply also renders while busy remains true. Finally the handler sets busy=false but calls only the main controls function. That function does not refresh the design widget, leaving it with pending=true/disabled controls until another full render, such as Refresh. The error path has the same final-state problem. A customer continuing the conversation can lose access to the new design feature after their first answer.

Synchronize the widget's control state when main busy state changes, without restoring over a dirty design or creating a controls/onDirty recursion. Add a frontend integration regression for successful and failed answer completion, asserting design fields/save are enabled again for an eligible unsubmitted project.

### R3 — P3: Normalize changed files before committing

`git diff --check` reported CRLF-related trailing-whitespace/new-EOF warnings across modified files, including the large Argon file. This is not a product vulnerability, but creates noisy review diffs. `git diff --ignore-space-at-eol` confirms the Argon semantic change is limited to importing textual design grounding, a design/reuse instruction and adding design preferences to the payload. Normalize changed files consistently and rerun diff check before the final commit.

## Checks actually run

- Node v24.19.0.
- `node --test --experimental-test-isolation=none test/walk-design.test.mjs test/walk-design-ui.test.mjs` from cloudflare-site: **9 passed**, no failures. Existing UI mocks always return a 600x300 rectangle and never fire ResizeObserver; they do not exercise R1. They invoke the isolated widget, not the surrounding answer busy lifecycle; they do not exercise R2.
- `node --test engineering/check-sdlc.test.mjs` from repository root: **14 passed**, no failures.
- Manual synthetic execution of actual widget handlers confirmed R1 as above.
- `git diff --check`: warnings outstanding at initial review.

## Security and requirements observations

- No exploitable script injection or reference-fetch SSRF path identified in the inspected new feature. Fields are rendered via `.value`/`.textContent`; only allowlisted, bounded data is stored; URL inputs are not automatically fetched.
- New save route uses existing project access, Origin and CSRF controls. Exact revision plus conditional update and busy guard protect normal save/answer/submission races; focused owner/foreign/stale/busy/submitted tests pass.
- Presales handoff retains design privately through existing outbox payload; focused synthetic submission/outbox test passes. This is not verification of a new real production record or live Supabase delivery.
- Both model adapters get `designText(state)`, excluding raw sketch vectors. Argon explicitly frames owner preferences as optional, unverified, non-executable private input. No live model call was made by this review.
- The artifact gate explicitly disclaims proving test chronology or correctness. Its unit tests pass; complete feature evidence and final CI were not present/verified at initial review.
- No independent current mobile rendering, real-phone test, production deployment or autonomous worker execution was performed by this reviewer. Parent must record those separately.

## Re-review requirement

After fixing R1/R2, rerun their new regressions and relevant suite, inspect the changes, and append the actual result here. Do not set the feature review status to passed while either finding remains unresolved.

## First re-review

The parent fixed R1 by retaining normalized vectors when the canvas is hidden, and fixed R2 with a separate widget `setBusy` control-state sync, splitting local saving state from external busy state. Inspection found no recursion or dirty-field overwrite in that sync. Re-ran the endpoint and UI command: **11 tests passed**, including the two new widget regressions. The parent's recorded pre-fix failures are in the private local output `outputs/solborne-sdlc/review-regression-red.log`; the hidden-restore test reported actual 0 strokes versus expected 1 before the fix.

### R4 — P2: Visible resize followed by a state render before observer delivery rescales stored vectors

The first resize fix protects zero-sized renders but `draw(data)` still creates points using the current DOM rectangle while leaving logical `size` unchanged. If a visible canvas changes from 600x300 to 300x150 and a state render/restore runs before the queued ResizeObserver callback, draw uses the new rectangle; resize then reads those points using the old size. A saved normalized point (.2,.3) becomes (.1,.15). Actual widget handler execution reproduced this result. Keep the logical coordinate size synchronized whenever points are drawn, or redraw exclusively from authoritative normalized vectors. Add a visible geometry change -> update -> observer -> save regression. Review remains **changes required** until this case is resolved.

## Final re-review and closeout

R4 is resolved: `draw` now updates logical width/height to exactly the rectangle used to generate pixel points, before replacing pad data. The dedicated regression covers visible geometry change -> state render -> observer -> save and preserves the original normalized coordinate. The parent first captured the intended failing assertion (`0.1 !== 0.2`) in private output `resize-order-red.log`, then implemented the correction.

The reviewer re-read the final adapter and surrounding controls; R1/R2/R4 are resolved. R3 is also resolved: final `git diff --check` produced no output. No unresolved blocking code/requirements/security finding remains from this scoped review.

Final independently executed checks:

- `node --test --experimental-test-isolation=none test/walk-design.test.mjs test/walk-design-ui.test.mjs`: **12 passed, 0 failed** (6 endpoint/persistence tests; 6 widget/resize/busy tests).
- `npm test` from cloudflare-site: **243 passed, 0 failed**, including existing ownership, rollback, model grounding, voice, recovery and delivery tests.
- Previously executed artifact-checker tests: **14 passed, 0 failed**.
- `git diff --check`: clean after normalization.

This demonstrates meaningful independent review: initial passing focused tests did not catch three real edge cases; each was reproduced, corrected and covered by added regression tests. It is not a guarantee of absence of all bugs. Real-browser rendering, live/provider calls, hosted database receipts, branch/CI status and autonomous-agent pickup are separate evidence owned by the parent and must not be inferred from this review.
