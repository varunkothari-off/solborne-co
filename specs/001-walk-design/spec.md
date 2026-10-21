# Feature: Your website, your way

Owner instruction, 21 October 2026: add design components to the conversational Walk, capture how customers imagine their website, and leave space to draw if requested. This is the real feature proving the specification-led, test-first workflow. No automatic website generation, publication or change of live model.

## User scenarios and acceptance criteria

- AC-01: A signed-in registered project owner can optionally save the site's feel, colours, reference URLs, things to avoid, motion preference and additional design notes without sending a conversation turn or invoking an AI model. Empty preferences are valid and must not prevent completing the Walk.
- AC-02: Sketching is opt-in. Opening the design section does not capture drawing input until the owner opens the sketch space. A pointer/touch sketch, undo and clear work; a text description is an equivalent accessible alternative. Saved strokes survive refresh and viewport resizing.
- AC-03: Design preferences and sketch belong only to the active project, use existing authentication/project binding and CSRF/origin controls, and require an exact saved revision. Foreign, unbound, stale, busy and already-submitted writes cannot mutate the brief. Concurrent edits report a conflict rather than overwriting it.
- AC-04: Validate allowlisted fields and bounded vector strokes on the server. Only http(s) reference URLs are accepted, never fetched automatically. No arbitrary images, SVG markup, scripts or file uploads. Reject malformed/oversized sketches and oversized request bodies. Browser renders supplied text as text.
- AC-05: Save design privately alongside the Walk, increment revision and retain existing messages/facts. Subsequent model answers preserve it. The model receives only textual design preferences, never raw strokes; preferences are owner input, not research, permissions or executable instructions. The existing outbox carries it to Solborne's presales payload and manual-review submission retains it. No design answer is automatically public copy.
- AC-06: Use existing brand controls and one pinned MIT Signature Pad component, self-hosted with its licence. No React or drawing framework. Mobile layout has no horizontal overflow, controls have labels, keyboard text entry is usable, ordinary page scrolling remains available outside the opened sketch area, and status/errors are announced. No decorative motion is required.

## Boundaries

Strings: feel/colours/avoid 500 chars each, notes 1500, references at most five http(s) URLs of at most 500 chars each, motion enum undecided/subtle/expressive/minimal. Sketch at most 80 non-empty strokes and 2000 finite normalized x/y points in [0,1]. Save endpoint body cap 131072 bytes. Preserve practical security limits; this does not reintroduce an answer-box character cap.

## Success and verification

Meaningful endpoint red -> green tests, authentic owner/project/CSRF failures, persistence through an answer and submission/outbox handoff, frontend handlers, full regression suite, rendered desktop/mobile local preview and a reviewable draft PR. Production promotion remains human approved. An active autonomous worker is connected only after this proof; its output is draft PRs, not merges/releases.
