# Solborne development policy

The owner requires specification-led, test-driven platform development. Follow `engineering/SDLC.md` for all future product changes. This policy supplements existing user instructions and release safeguards.

- Establish the actual current implementation and approved baseline before planning a change. Existing behaviour is observed, not automatically approved.
- Before changing behaviour, write or update a versioned feature specification, concrete acceptance scenarios, and a proportionate technical plan. Keep business decisions, assumptions and unresolved questions distinct.
- For behavioural changes, demonstrate the relevant acceptance/regression test failing for the intended reason before implementing the fix; then implement the minimum change, verify it passes and refactor while green. Do not manufacture historical test-first evidence for existing code.
- Map acceptance criteria to executable checks and identify manual-only checks. Tests must verify intended outcomes, including permission and failure cases, rather than merely mirror implementation.
- Keep architecture, schema/API contracts, privacy/security implications, migrations and rollback explicit when affected. Use synthetic data in tests.
- Use isolated branches, one accountable owner and one writer per shared resource. An autonomous agent may implement ready, scoped tasks and prepare a draft PR; it must not invent business requirements, approve its own specification, merge, or deploy production.
- Review implementation independently against the specification, not just against passing tests. Record commands, results, limitations and staging evidence in the PR.
- Do not describe this policy as installed Spec Kit, enforced branch protection, an active autonomous worker or a proven delivery workflow. Those require separate verified implementation evidence.
- Preserve the standing Solborne design skill and actual client brand identities for UI work. Keep research, outreach, client data and production secrets out of public source.

