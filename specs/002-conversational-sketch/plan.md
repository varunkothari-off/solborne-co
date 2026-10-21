# Implementation plan

Owner approved direct correction. Parent owns HTML/UI/prompts/spec artifacts, bounded backend implementer owns ai-walk.mjs/walk-design.mjs/worker.mjs and answer-sketch.test.mjs, independent reviewer owns review report only.

1. Backend tests demonstrate missing turn-bound sketches, sketch-only response and pending retry protection before implementation. Add per-answer save route using existing ownership/CSRF/revision/submission guards. No DB migration.
2. Root prompt tests demonstrate missing grounded private design fields and metadata-only sketch context; then add conversational guidance, fields and safe context. Preserve existing questioning quality and live model selection.
3. Add a reusable answer sketch adapter and tests before wiring it to the real answer composer/history. Reuse the proven normalized Signature Pad integration/resize fixes. Remove standalone form markup and handlers from the active page; retain old endpoint for compatibility.
4. Run focused and full tests, independent review, local synthetic browser save/send/retroactive sketch/reload/mobile checks, artifact gate and draft PR/remote CI. No production release.

Risk focus: sketch/text atomicity on failed provider calls, stable turn numbers after retries, editing a saved sketch while composing a different answer, submitted immutability, hidden canvas resize, cancelled/failed local drafts and truthful provider limitations.
