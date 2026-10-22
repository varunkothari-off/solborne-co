# Plan

Preserve4869029 as UI baseline. Replace object-store provider through a small tested adapter, retaining existing Walk validation and project authorization. Add a Supabase Edge Function authenticated using the existing Solborne sync-token hash; use the function's server-only service credentials to access one fixed private bucket. No new frontend auth scope or exposed credentials.

Use native Supabase dashboard for the authorised email-file import, with private database document metadata isolated from outbox-overwritten JSON. Create private schema table with RLS and no public grants. Verify bucket privacy, object counts, hashes and project binding. Use an isolated synthetic production QA project for runtime tests.

Separate storage implementation, asset acquisition and industry research with one writer per source. Record independent review, meaningful red/green tests and exact release receipts. Roll back Worker version if core chat fails; keep private objects/metadata intact.
