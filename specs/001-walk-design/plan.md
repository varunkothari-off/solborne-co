# Walk design preferences implementation plan

Execution authorised explicitly by owner 21 October 2026. Parent executes feature, a bounded worker initializes Spec Kit, and an independent reviewer reviews the patch. One writer per resource. Source baseline 2435f53, 231 tests pass.

Architecture: persist allowlisted `designPreferences` in the existing project Walk JSON, saved with optimistic revision/busy/submission guards. Existing project auth, CSRF, outbox triggers and private manual-review handoff remain authoritative. Integrate self-hosted Signature Pad into the existing vanilla frontend with normalized vector storage; reuse established brand controls.

Tech: Node 24 built-in tests, SQLite test D1 adapter, existing Cloudflare Worker and HTML/CSS/JS. No new database schema or provider credentials.

## Tasks

- [ ] Write endpoint tests for save/refresh, fields and limits, origin/CSRF/ownership, stale/busy/submitted requests, preserving design across answers, submission and presales sync. Run before implementation and retain red output.
- [ ] Implement `saveDesignPreferences(env,registration,input,now)` and route POST /api/ai-walk/design through existing auth/project/CSRF guards. Add module to build. Include only text design preferences in model request; preserve full design in stored state.
- [ ] Vendor pinned MIT Signature Pad distribution/licence. Implement optional design details/sketch controls, revision-aware save/refresh, dirty state, read-only submitted view, normalized drawing restore/resizing and accessible text alternative. Test actual handlers using a synthetic browser harness and render a local preview.
- [ ] Run focused and full regression tests, build, inspect desktop/mobile, independently review and fix findings. Verify outbox payload uses only Solborne project context.
- [ ] Add machine-checked feature evidence/traceability gate, issue and PR templates plus failure tests for the gate; CI invokes it. Record limits: artifact checks do not establish semantic correctness or manufacture TDD chronology.
- [ ] Commit and push feature branch, create draft PR, observe CI. Connect bounded recurring autonomous issue worker only when proof passes. Verify one real issue pickup or explicitly report any remaining runtime blocker.

Review focus: resize data preservation; failed save leaves local sketch intact; submitted briefs immutable; project switching cannot mix dirty preferences; invalid points and URLs rejected; AI never treats references or preferences as instructions.
