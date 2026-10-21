# Solborne specification-led, test-driven SDLC

Date: 21 October 2026.

Status: Spec Kit 1.2.2 installed with Codex skills, constitution and bundled SDD workflow. A local artifact gate and CI workflow are implemented. Feature proof and autonomous activation receipts are recorded in specs/001-walk-design/verification.md. Branch protection is not claimed configured; production behaviour is not changed until a separately approved release.

## Objective

Build and evolve the whole platform from explicit business requirements and observable acceptance criteria. AI assists discovery, architecture, implementation, testing, review and maintenance. Chat history is input; versioned specifications and verified results carry the durable engineering context.

## Framework decision

Use one specification framework. Prefer GitHub Spec Kit for its constitution, requirements, clarification, technical planning, tasks, consistency analysis and implementation-convergence workflow. Add Solborne's mandatory TDD and release controls; the framework alone does not enforce these.

OpenSpec is a viable lighter alternative with per-change proposals, scenarios, design and tasks, particularly for iterative existing-code work. BMAD provides a broader product/architecture/UX/testing delivery method; adopting its whole workflow now would add another process to maintain. Do not combine all three frameworks by default. An execution engine such as a coding CLI is separate from the SDLC method.

All three are open-source under MIT according to their official repositories checked today. Software licensing does not make model usage, CI, hosting or operation free. Pin and review a version before installation; preserve licence notices for any imported templates or code.

Sources:
- https://github.com/github/spec-kit
- https://github.github.com/spec-kit/reference/agentic-sdd.html
- https://github.com/Fission-AI/OpenSpec
- https://github.com/bmad-code-org/BMAD-METHOD

## Delivery lifecycle

| Stage | Required output and evidence | Accountable role |
| --- | --- | --- |
| Discover | User/problem, business outcome, current behaviour, constraints, unknowns, scope and exclusions | Product owner with AI analysis |
| Specify | Versioned user journeys, numbered acceptance criteria, error/permission cases, measurable success criteria | AI drafts; owner decides product intent |
| Design | Architecture decision, affected contracts/data, UX where relevant, security/privacy, migration and rollback | Technical lead/AI; owner resolves consequential choices |
| Plan | Small vertical tasks, requirement-to-check mapping, dependencies, review and deployment strategy | Implementation owner |
| Test first | Meaningful new test fails for the intended missing behaviour; preserve command and failure evidence | Implementer |
| Implement | Minimum change to pass; refactor with checks green; run relevant regression coverage | Implementer |
| Review | Separate review against requirements, security, maintainability and test adequacy; resolve findings | Reviewer |
| Validate | Staging end-to-end journeys, mobile/accessibility where affected, failure paths and migration rehearsal | QA/reviewer |
| Release | Human approval, exact commit/build, deploy receipt, rollback available, actual live smoke checks | Release owner |
| Learn | Errors, user outcomes, latency/cost for AI flows, incidents and newly discovered regression cases | Product/engineering owner |

TDD means red -> green -> refactor, not writing tests after coding and labelling the result TDD. A missing runtime/dependency or unrelated syntax failure is not the intended red. Existing tests establish a regression baseline but do not prove how existing code was developed.

Scale the work: a small bug needs a short scenario, reproducible failing test and fix; a new subsystem needs explicit specification and architecture. Text-only or visual changes use proportionate rendered/manual evidence, not artificial unit tests. Throwaway experiments must be labelled and must pass the normal process before becoming production code.

## Durable feature record

Use `specs/<feature-id>/` with spec.md, plan.md and tasks.md. Add contracts, data-model decisions, research, test mapping and verification evidence only where material. This path is an intended convention, not evidence that upstream Spec Kit has been initialized.

Each acceptance criterion maps to a check. The verification record includes exact commit, commands, results, red/green evidence for new behaviour, manual checks and known limitations. Do not publish client records, secrets or raw private transcripts as evidence.

## Definition of ready

The problem and intended behaviour are clear; success and failure cases are testable; scope is bounded; dependencies are available; consequential decisions are resolved; data ownership is explicit. An autonomous agent receives only tasks meeting this definition, with allowed paths, a runtime/resource ceiling and expected checks.

## Definition of done

Acceptance criteria are met with mapped evidence; relevant checks pass; independent review findings are resolved; documentation/contracts stay consistent; migration/rollback and operational monitoring are covered where relevant. A draft PR is prepared, not merged. Passing CI is not staging validation; staging validation is not production verification.

## Adoption on the existing platform

1. Establish a verified baseline: current production source/commit, architecture and data boundaries, existing tests and release process. Catalogue observed behaviour separately from owner-approved requirements. Do not rewrite the platform merely to fit a framework.
2. Install a reviewed, pinned Spec Kit release into an isolated branch; verify Codex integration and generated files. Write the constitution with mandatory TDD and these boundaries. No additional paid service is assumed.
3. Add PR evidence fields and CI checks for required artifacts and acceptance mappings. Verify their failure paths with missing/invalid artifacts. These checks cannot alone prove that a specification is correct or that TDD genuinely occurred.
4. Prove one meaningful platform change through failing test, implementation, review and draft PR. A candidate is the submitted-Walk-to-manual-review handoff: owner review precedes preview delivery. Define missing operational details before implementing it.
5. Connect the autonomous issue worker only after the workflow is proven. Retain human product decisions, merges and production promotion. Adopt on other platforms per repository after verifying their own baseline and requirements.

## Current evidence and limits

At inspection the repository had a Cloudflare source-check CI workflow and functional/security-oriented Node tests, including multi-project ownership and transaction rollback tests. The workflow builds isolated synthetic fixtures and runs test/QA files. It does not demonstrate specification traceability, enforced TDD chronology or an operational autonomous SDLC.

Adoption is incremental. Consult engineering/spec-kit-install.json for actual installation and specs/001-walk-design/verification.json for executed checks. Neither installed prompts nor a passing artifact gate establish correctness. No GitHub protection change, whole-platform certification or production release is implied.
