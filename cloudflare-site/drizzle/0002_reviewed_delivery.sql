-- Preserve every file that was available before this delivery-gate migration.
-- Grandfathering records existing access, never a human review or frozen legacy bytes.
CREATE TABLE solborne_website_releases (
  completion_id TEXT PRIMARY KEY REFERENCES solborne_walk_completions(id),
  released_at INTEGER NOT NULL CHECK(typeof(released_at)='integer' AND released_at>=0),
  release_basis TEXT NOT NULL CHECK(release_basis IN ('grandfathered','reviewed'))
);
INSERT INTO solborne_website_releases(completion_id,released_at,release_basis)
SELECT id,CAST(strftime('%s','now') AS INTEGER)*1000,'grandfathered'
FROM solborne_walk_completions;

-- After the one migration backfill, no caller can grandfather a new completion.
-- Queue review alone is insufficient: the exact immutable source must exist too.
CREATE TRIGGER solborne_release_requires_review BEFORE INSERT ON solborne_website_releases
WHEN NEW.release_basis<>'reviewed' OR NOT EXISTS (
  SELECT 1 FROM solborne_walk_completions c
  JOIN solborne_website_artifacts a ON a.completion_id=c.id
  JOIN solborne_owner_reviews q ON q.completion_id=c.id
  WHERE c.id=NEW.completion_id AND q.status='reviewed'
)
BEGIN SELECT RAISE(ABORT,'Release requires reviewed saved source files'); END;
CREATE TRIGGER solborne_release_insert_immutable BEFORE INSERT ON solborne_website_releases
WHEN EXISTS (SELECT 1 FROM solborne_website_releases WHERE completion_id=NEW.completion_id)
BEGIN SELECT RAISE(ABORT,'Website delivery releases are immutable'); END;
CREATE TRIGGER solborne_release_update_immutable BEFORE UPDATE ON solborne_website_releases
BEGIN SELECT RAISE(ABORT,'Website delivery releases are immutable'); END;
-- No DELETE guard: existing authorized dependency-ordered privacy removal remains possible.
-- There is no public release, revoke, delete or owner-status API.
