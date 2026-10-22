# Plan

Preserve verified production source ab34b6f in a feature branch. Reuse the existing Signature Pad adapter, vanilla frontend, project-pinned auth, form CSRF, optimistic D1 updates and presales outbox. Use the platform R2 binding for private bytes rather than putting large binary values in JSON or adding a third-party upload dependency.

Own frontend layout/composer and backend files separately; parent owns page integration, readable labels, provider metadata and build configuration. Demonstrate regressions before changes; review independently. Private attachments may be downloaded only through the existing authenticated owner boundary. Team retrieval uses the private storage/dashboard and saved presales metadata; no new team/admin permission system.

Rollback: previous Worker version remains available. Existing sketches and briefs remain compatible; new file metadata is additive. Do not delete objects on rollback. Local preview uses synthetic SQLite and an in-memory bucket, never production credentials. Owner-requested live refinement uses the existing human release process: exact commit, passing CI, private storage configuration, rollback receipt and synthetic production verification. The autonomous issue worker remains unable to deploy.
