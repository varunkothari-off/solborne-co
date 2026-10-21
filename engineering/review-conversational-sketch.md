# Independent review: conversational design and per-answer sketches

Date: 21 October 2026. Reviewer: separate `reuse_audit` agent. Baseline: 9c27cdb. Scope: specs/002-conversational-sketch, actual frontend composer/history wiring and drawing adapter, grounded prompt fields, answer and past-sketch endpoints, ownership/concurrency guards, request/vector budgets, model payloads and focused/full local tests. Reviewer changed only this report.

**Final scoped code/requirements review: passed after corrections.** Two initial blocking integration bugs were corrected and covered by tests. Formatting cleanup remains a pre-commit hygiene check, not a claim that the current diff check was clean. No production deployment, live-provider quality, hosted sketch delivery or autonomous execution is certified by this report.

## Initial findings and resolutions

### C1 — P1, resolved: Editing a past sketch could send it as a new answer

Initial location: `public/answer-sketch.js` open(), and `public/ai-walk.js` history action/answer submit handler.

Opening a saved answer's sketch changed the widget's target but notified only its local control updater. The surrounding Send button retained the previously enabled state. The actual composer handler checked that stale disabled flag and read the widget attachment, permitting a past answer's drawing to be submitted with a new text answer. This would corrupt the intended answer/question binding despite correct backend turn validation.

Correction: open() now notifies the surrounding onChange callback, which refreshes main controls; the real submit handler separately rejects editingPast even if a stale control were activated. Saving/cancelling returns control to the current composer without replacing its text.

Added actual-page regression: `actual composer cannot send a past sketch as a new answer while editing history`. The parent captured its pre-fix failure (`false !== true`) in private local output `outputs/solborne-sdlc/conversational-wiring-red.log`. The reviewer read that evidence, inspected the correction and independently ran the passing regression.

### C2 — P1, resolved: Reloading a failed answer restored its sketch but lost the exact text needed to retry

Initial location: `public/ai-walk.js` prepare() and widget restorePending().

Failed Argon work retains a project-private pendingAnswer with exact text, question and sketch; the API deliberately rejects a different retry. The initial frontend restored only drawing points after reload. Pending text was not in the successful message history and the answer box remained empty. Sending the restored drawing would produce a sketch-only marker rather than the original text, so the exact-retry guard correctly returned a conflict and the owner could not naturally resume.

Correction: prepare restores pending text when the local answer box is empty, preserves newer local typing, and leaves the literal sketch-only marker out of the visible textbox. The widget restores its pending drawing only after a successful open. The actual page regression boots with a pending text+sketch answer, then checks the resulting retry POST includes both original text and points.

Added regression: `actual page restores original pending answer text and sketch after reload for exact retry`. Parent red evidence reported missing/undefined textbox text before the fix. Reviewer read that evidence and independently ran the passing corrected test.

### C3 — Minor, resolved: Duplicate design prompt and private-field declarations

Initial walk-meta-prompt contained duplicate designVision/designReferences/designAvoid/designMotion keys and a repeated DESIGN CONVERSATION paragraph. Duplicate object keys were identical, so no different value was selected, but the repeated paragraph needlessly enlarged the prompt. The parent removed both duplicates; reviewer re-read the current file.

### C4 — Minor pre-commit hygiene: line endings

At the last reviewer check, `git diff --check` still reported CRLF/trailing-whitespace warnings in modified ai-walk.js and other files. Normalize changed files and rerun before committing. This review does not assert that diff check has passed.

## Independently executed verification

Runtime: Node v24.19.0.

- Focused command from cloudflare-site:
  `node --test --experimental-test-isolation=none test/answer-sketch.test.mjs test/answer-sketch-ui.test.mjs test/ai-walk-frontend.test.mjs test/conversational-design.test.mjs`
  Result: **26 passed, 0 failed**.
- Full suite: explicit enumeration of all `test/*.test.mjs` and `qa/*.test.mjs`, run with Node's `--test --experimental-test-isolation=none`. Result: **265 passed, 0 failed**, no skipped tests.
- Additional independent synthetic execution loaded both actual `answer-sketch.js` and `ai-walk.js` against a mock DOM. After the fixes it reported:

  ```
  Main send disabled after opening past sketch: true
  Unexpected new-answer payload: undefined
  Restored pending textbox: "My original failed answer"
  Pending retry payload message: "My original failed answer"
  ```

The initial focused widget tests alone did not cover composer integration. The new tests now load the actual adapter into the actual page script harness, so they exercise the event-wiring boundary where C1/C2 occurred. This is mock-DOM functional evidence, not a rendered/mobile claim.

## Requirements/security observations

- Active HTML removes the standalone design form and keeps drawing beside the answer composer, with actions on saved user answers. The textarea is not required, allowing sketch-only answers to reach the JS handler. Design information is represented as grounded private conversational fields, not a second form.
- Sketch vectors are validated before answer/model calls and shared-rate writes. Both per-sketch point/stroke limits and a per-Walk aggregate budget are exercised. Invalid point keys, nonfinite/range-invalid coordinates, invalid turns and oversized drawings fail closed.
- Existing Origin, CSRF and pinned project ownership controls apply to the new endpoint. Revision, busy lease, pending-answer and submitted guards prevent normal stale or conflicting writes. Exact pending retries preserve stable turn/question/sketch and do not duplicate owner turns; conflicting retries do not invoke the provider.
- The past-sketch endpoint changes only the selected answer attachment without another model call. It supports adding/replacing/clearing and rejects foreign, missing, stale, busy, pending and submitted edits. The existing Solborne outbox/manual handoff retains drawings privately in the synthetic integration tests.
- Both provider adapters receive sketch metadata, not raw vector points. Prompts explicitly prohibit inventing visual interpretations. User text and sketch references remain untrusted business input; they do not grant publishing, research or licence rights. No automatic reference-fetch or new arbitrary SVG/image upload path was found.
- The Signature Pad dependency is reused with its existing vendored notice. Canvas normalization tracks the rectangle used to build points; resize/undo/clear and optional activation have focused tests. A text alternative remains available. Actual touch/rotation and browser layout need the parent's rendered checks.
- No unresolved blocking finding remains in the inspected code after C1/C2/C3 corrections. The repository still needs the formatting cleanup above and the parent's final immutable commit/CI receipts.

## Evidence boundaries

This review did not make paid model calls, deploy to solborne.in, insert real customer/hosted sketch records, certify provider conversational quality, or prove that an autonomous agent executed this change. Synthetic preview/in-memory persistence and production D1/Solborne Supabase sync are different environments. Storage claims must name which was actually tested. The parent's local browser, remote CI/PR, production and worker receipts must be reported separately and accurately.

## Coordinator closeout

Formatting normalized after review; git diff --check verified clean before commit. Actual browser sent text+sketch, edited answer1 with Send disabled, preserved and sent the next draft, reloaded both saved answers and sketch; mobile375CSSpx scrollWidth375 and zero standalone design forms, two per-answer actions. Synthetic local backend only, no paid provider or hosted sketch insert.
