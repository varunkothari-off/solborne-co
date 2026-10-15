# Walk of Fame: reusable full-business meta prompt

Version: `solborne-business-walk-v2-20261016`.

The executable prompt is exported as `WALK_META_PROMPT` from `src/walk-meta-prompt.mjs`. `src/ai-walk.mjs` imports this exact source for every interview request; this is not a disconnected copy of instructions. `WALK_PROMPT_VERSION` is attached to new and updated draft state. Prompt revisions can therefore be identified in saved conversations.

## What changed

The previous prompt only gathered facts for a static portfolio and chose between two legacy layouts. This version follows the agreed full-business Walk: adaptive discovery, owner-confirmed pain and success measure, research handoff, industry-specific template comparison, distinct brand implementation and human review before release. A useful customised free website demonstrates Solborne's understanding; relevant paid workflows follow the confirmed business problem.

The public `facts` allowlist remains unchanged. A separate private `businessBrief` records business goals, journey, operations, pain, impact, frequency, workaround, outcome, success measure, constraints, systems/data, permissions, human approval, confirmed priority, free scope, paid opportunities and research questions. These notes must never be copied into public website facts or analytics. Only business-level summaries are requested, not credentials or customer records. Both public facts and private notes are sent to the model for contextual follow-up and, when explicitly requested and approved, research/marketing advice.

The prompt asks one question at a time and uses existing context instead of making the owner repeat an intake form. It allows nonessential deeper discovery to be deferred. Readiness means the brief can go to human review, not that research, design, generation or publication have occurred. Existing saved drafts acquire the expanded schema on their next successful model answer; they are not magically reassessed while untouched.

## Handoff and feature split

1. Capture the business story, public identity, offers, audience, brand, permissions and real contact actions.
2. Identify a pain using impact, frequency, current workaround and evidence. Record an explicitly confirmed priority, measurable outcome and human decisions.
3. Confirm a usable free scope. Separate hosting, domain, maintenance and paid work according to actual terms.
4. Conduct audience, marketing, digital-workflow, disclosure and industry-template research with evidence and commercial/asset-rights checks.
5. Compare fit and agree a design direction before implementation. Preserve the customer's identity; do not apply Solborne's visual style to every company.
6. In a private customer preview, clearly label relevant unimplemented paid proposals as inactive optional upgrades. The free website is complete and usable. Do not fake form, payment, booking or automation success. Remove unpurchased ghost proposals from the final public site.
7. Solborne's own implemented services and next actions work normally; they are not ghost demos. Human review precedes delivery or publication.

## Integration boundary: implemented versus pending

Implemented locally: versioned runtime interview prompt, structured private business brief, separate public fields, readiness validation, contextual research/marketing advice and tested privacy separation. Server call caps, consent, ownership and revision protections remain in place. No API key was created or configured and no provider flag was enabled by this change.

Pending: live provider evaluation, measured question-quality parity with this conversation, an industry-template research and approval gate, customer preview paid-feature rendering, and an end-to-end owner-reviewed implementation pipeline. The legacy `template` response field remains `editorial` or `story` solely for compatibility. It is **not a research-backed template selection**. Review state explicitly records `industryTemplateResearch: pending-human-research` and `designApproval: required`. Those labels are disclosure, not an enforced build gate: the legacy completion/render endpoints are now blocked by default at the server using a separate AI_WEBSITE_BUILD_ENABLED flag, and their UI controls are hidden. Do not enable that build flag until the research and design approval gate is implemented.

`gemini-4-argon` is accepted as an explicit model setting, alongside existing models. The existing default is unchanged. This allowlist is not proof that the provider model identifier exists, is available to this account or follows the schema well; there was no live provider request. Verify official availability/pricing and run evaluation before selection or activation. No prompt guarantees identical results.

## Quality checks before activation

Use synthetic or owner-authorised business briefs, including Solborne and a different industry. Check that the interview:

- asks one relevant question, uses prior facts, accepts corrections and avoids repeated questions;
- confirms the owner's pain instead of inventing it or pushing the same paid package;
- discovers impact, success measure, current journey, permissions and human approval;
- prevents private operations entering public facts and refuses credential/identity-document collection;
- does not claim research or template selection without evidence;
- produces a coherent free deliverable and relevant optional paid proposal;
- preserves brand differences and routes unresolved disclosure/asset questions to review;
- makes no publication or delivery claim before actual approval and completion.

Evaluate actual outcomes and cost across models using the same cases. Schema and mocked endpoint tests establish software behavior; they do not establish live model quality.
