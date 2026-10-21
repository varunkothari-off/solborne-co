# Solborne & Co. Constitution

## Core Principles

### I. Specification Before Implementation

Every behavioural change MUST start with a versioned feature specification stating the business
problem, intended users, scope, exclusions, acceptance scenarios and unresolved decisions. A
proportionate technical plan and task list MUST map those requirements to implementation and
verification. Observed legacy behaviour MUST remain distinct from approved product intent.
Consequential business, policy or security decisions MUST be resolved by the owner, not invented
by an implementation agent. Small fixes MAY use short artifacts; process size follows risk.

### II. Test First, Then the Minimum Change

For behavioural changes, the implementer MUST run a meaningful acceptance or regression test and
observe it fail for the intended missing behaviour before writing production code. The minimum
implementation MUST then make it pass; refactoring MUST preserve green checks. Evidence MUST
record the command, failure reason and passing result. Existing tests MUST NOT be relabelled as
historical TDD proof. Tests MUST verify outcomes and failure cases rather than mirror source text.
Visual or text-only changes MUST use proportionate rendered/manual evidence where unit tests do
not establish usability. Exceptions MUST be explicit in the feature plan.

### III. Reuse First, With Industry and Brand Fit

Website work MUST begin with the actual client's Walk, audience, pain points, brand assets and
industry journey. Compare relevant templates/components before choosing a base. Solborne's own
website MUST NOT become the default design for every client. Prefer adapting maintained,
commercially reusable open-source parts to writing equivalent systems from scratch.

Every reused source MUST have a recorded URL, pinned version or commit, licence, attribution
requirements, asset rights, selected parts and customisation rationale. Mixing several sources
or rewriting their appearance MUST NOT be treated as removing licence obligations. Reject sources
with incompatible or unresolved rights. A custom implementation requires a documented fit,
accessibility, performance or integration reason. Do not add a framework solely for a component.

### IV. Client Boundaries, Privacy and Grounded AI

Every private operation MUST be bound to the authenticated owner and explicit project. Cross-client
access, stale writes and provider failures MUST have meaningful tests. Credentials, client records,
raw private transcripts and production data MUST NOT enter public source or test fixtures. Use
synthetic fixtures. AI suggestions MUST remain distinguishable from owner-confirmed facts;
readiness MUST NOT imply legal certification, publishing approval or completed external work.

### V. Independent Review and Human Release Authority

An autonomous agent MAY execute an explicitly ready, bounded issue on an isolated branch and
prepare a draft PR. It MUST NOT invent requirements, approve its own specification, merge, deploy
production, alter credentials or spend money. A separate review MUST assess the patch against its
specification and test adequacy. Human product decisions and production promotion remain with
the owner. Passing CI MUST NOT be described as staging or live verification.

## Delivery Constraints

- Preserve approved functionality and client identity. Apply the standing Solborne design skill
  and relevant frontend, interaction, animation, mobile and accessibility guidance to UI work.
- Motion MUST explain hierarchy or interaction, preserve normal navigation and respect reduced
  motion. Essential content MUST not depend on decorative effects.
- Reuse existing data, authentication, outbox and deployment boundaries unless the approved plan
  explicitly changes them. Migrations MUST state backward compatibility and rollback.
- Research, marketing, template/licence checks and disclosures MUST precede a customer design
  recommendation. Missing evidence MUST remain visible to the human reviewer.
- Software may be open source while inference, CI and hosting still incur costs. No additional
  paid service is authorised merely by adopting this constitution.

## Development Workflow and Quality Gates

Ready means scope is explicit, scenarios are testable, dependencies are available, owner decisions
are resolved and allowed files/resources are bounded. The sequence is specification, plan, tasks,
failing test, minimum implementation, green regression checks, independent review, staging
validation and owner-approved release. Each acceptance criterion MUST map to executable evidence
or a named manual check. Review findings MUST be resolved before claiming the change done.

The verification record MUST state exact commit/build, commands, results, manual checks,
limitations and rollback where relevant. Installation, scheduled execution, prepared PRs, sent
messages and live releases MUST each be reported only with their actual destination receipts.
An active schedule alone does not prove that an issue agent has successfully prepared a change.

## Governance

This constitution governs Solborne engineering artifacts and agent work, subject to explicit
human instructions and host safety/approval rules. Amendments MUST record their reason and a
semantic version change; the owner decides changes to mandatory boundaries. Every feature plan
MUST check compliance and explain any proposed exception before implementation. Templates and
agent commands read this constitution at runtime; changing this file is not evidence that CI or
branch protection enforces every rule. See `AGENTS.md` and `engineering/SDLC.md` for operating
context, and preserve the difference between proposed and actually implemented controls.

**Version**: 1.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21

