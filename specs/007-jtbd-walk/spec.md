# Jobs to Be Done website and Walk, v1

Owner approved implementation of the preceding recommendation on 24 October 2026: two relevant entrances sharing saved context, operations-focused discovery, route-specific summaries and commitments, and a tracked handoff. This implements that approval, without another product-design approval loop.

## Acceptance

- AC-01: Business-outcome homepage retains approved identity, supporting canvas, honest metrics, examples and full free-site terms. Website and operations entrances are explicit. Three operational examples explain routine work, human intervention and learning without claiming deployed customer results.
- AC-02: Allowlisted website/operations and payments/documents/quotes context survives sign-in, registration and Walk redirect; saved project intent wins on resume. No arbitrary redirects, cross-project context leakage or silent rewriting of existing briefs.
- AC-03: Both model engines use relevant questions and readiness. Operations asks about a recent instance and progress, current process, human decision and success; it does not require website design/legal-publication details. Existing website customers may defer nonessential deeper operations discovery.
- AC-04: Review shows the relevant business job/current journey/desired improvement/human decisions and unknowns. Public website data and private discovery remain separate; consent, voice, files, sketches and correction safeguards stay intact.
- AC-05: Submission records a stable reference, team responsibility, next action, truthful status and history. Operations has no invented 24-hour website promise. Existing website commitments and legacy receipts survive. An explicit owner-side update mechanism permits status/owner/next-action tracking without automatic customer sends or fabricated delivery.
- AC-06: Desktop/narrow layouts, keyboard paths, links, all existing tests and new failure/replay/context scenarios pass. No production publication, email/call, credential, provider default or database migration change.

## Architecture and decisions

Extend the current vanilla HTML/JS Cloudflare Worker, not a redesign or new service. Add allowlisted journey metadata inside existing per-project Walk JSON, preserving revision checks and auth boundaries. Current first draft and submitted state are durable sources of truth. A new contextual URL cannot change an existing project's route; user may create a separate project. No schema migration. Existing legacy website handoffs default to website; existing intake and account routes remain available.

Track assignment to the Solborne team, never invent acceptance by a named individual. No new operations delivery SLA is specified. Record next update only when authorised operator actually sets one. A local operator tool uses the existing authenticated deployment CLI, explicit identifiers and revision comparison; its production use is not authorised by implementation alone.

## Alternatives considered

Copy-only changes leave wrong readiness and handoff behaviour. Rebuilding the whole platform adds migration and risk. Extend the current flow with two routes and shared project memory: smallest change satisfying the approved customer journey.

## Reuse and rollback

Reuse approved brand/assets/components, owned source and existing tests. No external design base or package added. Revert this isolated feature branch to 98e9d96 before promotion; preserve customer rows and references if rollback happens after an eventual authorised release. No production changes in this task.
