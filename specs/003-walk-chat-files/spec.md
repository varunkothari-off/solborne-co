# Conversational workspace and private attachments

Owner request,22October2026: replace raw variable names under Still to explore; make the Walk feel like a chat; provide one plus menu for sketches, photos and files. Keep the existing interview, manual-review handoff, identity and saved progress.

- AC-01: Every public summary and missing-field label uses plain language. Known dotted keys and legacy business-brief keys resolve to descriptive labels. Unknown technical identifiers use a safe generic label, never raw code.
- AC-02: Conversation history and typing share a coherent chat workspace. Composer stays reachable, new pending answers are visibly acknowledged, and automatic scrolling does not pull someone away from older messages. Summary remains accessible on mobile. Keyboard, zoom, reduced motion, mic and submitted states remain usable.
- AC-03: A plus menu offers Sketch, Upload photos and Upload files. File selection does not send an answer. Upload progress/failure and removable pending chips are visible. Existing and earlier-answer sketches remain usable. Successful send clears only the exact attachments sent; failed answers preserve text, sketch and file references.
- AC-04: Authenticated project-owned attachments use private R2 storage, with metadata in D1 Walk state and the existing Solborne Supabase presales outbox. No public bucket or public upload route. Upload/read enforce project ownership, Origin/CSRF on writes, optimistic revision, busy/submitted guards, bounded rate/payload and file allowlist. No schema migration. No file contents sent to the model. Original content is untrusted and delivered as a download with safe headers.
- AC-05: A text, sketch or file-only answer attaches to a stable answer turn and question. Invalid or foreign file references fail before model calls. Exact pending retries preserve files; conflicting retries fail without overwriting. Saved file links survive reload and manual submission.

Initial file scope: JPEG,PNG,WebP,PDF,UTF-8 text and opaque DOCX/XLSX/PPTX downloads. Five MiB per file, twenty MiB/twenty files per project, five attachments per answer. SVG,HTML,executables,macro-enabled office files and other archives fail closed. OOXML ZIP signatures are checked; contents are not extracted. File validation is not malware certification. No automatic document extraction, OCR or visual interpretation in this release.

Acceptance evidence uses synthetic fixtures. Inspect only the newly reported entry/email for diagnosis; do not edit that submitted brief or send a reply without authorisation. Inspect a reviewable preview before promoting the owner-requested refinement; deploy only after checks pass and verify the actual destination.

Unavailable storage: API reports upload readiness. Without a configured private bucket, only photo/file actions are disabled; chat and sketches stay usable. Never advertise unavailable uploads as live.
