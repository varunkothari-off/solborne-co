# Current approved production baseline

23 October 2026. Owner authorised restoration, Avasa showcase, tests and release.

- Production code: b6f89e91f1c53359bd3131d56fb4e554b8a3ced0.
- Integration branch: fix/homepage-approved-showcase-20261023. Start future work from its latest verified head, not the outdated repository default or an old design branch.
- Worker: solborne-presales-reviewed-20261007. Deployed version fd6729a6-8570-4348-838c-8e9b172de746.
- Previous rollback version: ad1627bd-434d-4ed4-bcd9-37a0fc101b9d.
- GitHub source-checks and evidence workflows both succeeded on b6f89e9. Final local platform suite: 321 passed, zero failed. SDLC gate: five features passed; 14 gate tests passed. Link audit: 17 pages, 467 links, 156 assets, zero failures.
- Live browser: compact canvas second (263px at observed desktop viewport), database counts third (1 / 3), both case images loaded, one three-stage process and working direct controls. Desktop and 390px local rendering checked; physical phone not tested.

Build invokes scripts/home-contract.mjs before packaging. Both main and retained motion homepages must satisfy it. Source CI also runs the contract and animation tests. Do not bypass this gate or deploy a stale prebuilt dist directory. Rebuild from the current source and verify actual live output after every release.

No runtime/auth/model/schema/storage changes were made for this release. Production account/project/voice/sketch/attachment code remains byte-identical to the preceding baseline. Newer feature work must preserve these contracts and the full test suite.

Avasa is deliberately labelled a private preview and still requires its existing passcode. No credentials were made public. Existing draft PRs are not automatically merged by this release-baseline update.
