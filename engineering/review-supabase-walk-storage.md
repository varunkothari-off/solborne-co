# Supabase file provider review

Independent reviewer: upload_security_review, 22 October 2026.

30 focused checks passed; no blocking code finding. Fixed project and private bucket, server-only opaque credential hash auth, exact project/UUID key constraints, bounded writes, hash validation and duplicate protection, private reads, uncertain-write reconciliation and reset safeguards inspected.

Parent validation: 311 platform tests passed, build succeeded. Hosted bucket private with no storage policies, document metadata RLS enabled and no anon/authenticated table grants. Unauthenticated Edge request returns401; direct private download denied, public bucket route rejects.

Pending: authenticated hosted upload/download, actual emailed Grammable byte import and asset-driven preview. These are not established by unit tests or this review. Rollback Worker to3d8ad27a-2926-4df4-920e-dd814a053d11; keep private objects/table intact and disable flag if storage fails. Never delete imported customer data as rollback.


Live runtime follow-up: workerd rejected redirect:error before network. Regression commit7813894 fails as intended; fix uses manual and existing non-ok rejection, preventing credential forwarding to redirects. New total312 tests. Hosted retest required.

Final hosted receipt: ad1627bd-434d-4ed4-bcd9-37a0fc101b9d from436dcfa. Private upload succeeded, size/SHA256 matched and metadata reached presales. Anonymous direct routes denied. Browser blocked authenticated download; no successful download claim. AI retry state preserved answer and file reference. Grammable actualbyte import remains blocked on native email downloads.
