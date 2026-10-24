# Private Walk handoff tracking

This operator tool tracks current `WB-*` interview submissions in their existing project-owned Walk JSON. It does not build a website, assign work to an available person automatically, send notifications, collect money, or establish delivery. The existing `SW-*` website release tool remains separate.

Implementation and synthetic tests do not establish that the feature is deployed, that a person accepted an assignment, or that live customer records have been updated. Check the current release and permissions before production use. An owner/team value records the operator's explicit declaration of responsibility; confirm availability outside this tool.

## Read the queue

Use an existing, authenticated Wrangler JavaScript entry point; the tool installs no package and creates no credentials. It reuses `owner-queue.mjs`'s pinned Solborne D1 identity and config.

```text
node scripts/walk-handoffs.mjs list --wrangler ABSOLUTE_WRANGLER_JS
node scripts/walk-handoffs.mjs list --wrangler ABSOLUTE_WRANGLER_JS --remote
```

Default environment is local development. `--remote` selects the existing hosted database; it is not implied by the command name. Queue output is limited to 200 handoffs, oldest update first, with reference, project registration ID, revision, service, status, owner, next action and dates. It excludes registration contacts, business facts, transcript and private discovery. No raw private-state export is provided. Old submissions without service/owner metadata display as website/Solborne team; this fallback is not proof of fresh assignment.

## Prepare an update

```text
node scripts/walk-handoffs.mjs update WB-UUID --wrangler ABSOLUTE_WRANGLER_JS --revision 2 --expect awaiting_manual_review --status in_review --owner "Solborne team" --next-action "Review the agreed workflow scope"
```

Without `--apply`, the command returns a prepared receipt and performs **no database access**. A remote prepared command is also dry-run; adding `--remote` alone never writes. For an explicitly authorised remote mutation add both `--remote --apply`. Local mutations also require `--apply`.

Use a reference, revision and status freshly read from the queue. The compare-and-swap checks all three plus the absence of active interview work. If an outcome is uncertain, read the queue before trying anything again. The tool never automatically retries a write. Repeating an already applied update cannot append duplicate history with its old revision; identical current values also result in no update.

Optional `--next-update` accepts an actual future date/time with an explicit timezone, for example `2026-11-01T10:00:00+05:30`. Use only a supportable commitment approved by the responsible operator. Omitting it clears that optional field; it does not silently invent a deadline. The website's separate original `dueAt` remains intact. Operations submission has no inherited 24-hour website promise.

## States and meaning

| State | Meaning |
|---|---|
| awaiting_manual_review | Brief received; review has not been recorded as started. |
| in_review | Responsible operator records that review is underway. |
| awaiting_customer | Progress needs a specific customer action described in next action. No message is sent by this tool. |
| proposal_ready | Operator records that the scoped recommendation is ready. This does not send or accept a proposal. |
| completed | Operator records completion of the scoped handoff work. For operations, this does not mean a website was delivered or an automation is running. |

Allowed transitions: awaiting review → in review / awaiting customer; in review → awaiting customer / proposal ready / completed; awaiting customer → in review; proposal ready → in review / awaiting customer / completed. Completed cannot be reopened through this tool. Same-state owner/next-action/date corrections are permitted and recorded. No generic delivered, published or paid state exists here.

Each successful update preserves the original reference, submission and remaining Walk state, increments the project revision, and appends the operator-declared status/owner/next action/time. Retain the latest 100 history entries in chronological order. It creates no schema migration. Rollback must preserve customer references and status history; do not delete rows to revert code.

## Verification

Run `node --test test/walk-handoffs.test.mjs` using the repository's Node runtime with SQLite support. Tests use only synthetic in-memory data. They cover safe listing, revision/status conflicts, unchanged-state repetition, active interviews, transitions, bounded history, unsubmitted rows, prepared commands and ambiguous mutation outcomes. No live customer action is required by these tests.
