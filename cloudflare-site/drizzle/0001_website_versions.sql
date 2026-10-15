-- Additive migration for the existing isolated Solborne D1 only.
-- Existing completions remain distinct version-one projects. Their files were
-- rendered on demand, so do not fabricate frozen artifact bytes for them.
ALTER TABLE solborne_walk_completions ADD COLUMN project_id TEXT;
ALTER TABLE solborne_walk_completions ADD COLUMN parent_completion_id TEXT REFERENCES solborne_walk_completions(id);
ALTER TABLE solborne_walk_completions ADD COLUMN revision_number INTEGER NOT NULL DEFAULT 1 CHECK(revision_number>0);
UPDATE solborne_walk_completions SET project_id=id WHERE project_id IS NULL;
CREATE UNIQUE INDEX idx_solborne_project_revision ON solborne_walk_completions(project_id,revision_number);
CREATE INDEX idx_solborne_version_history ON solborne_walk_completions(registration_id,created_at DESC,revision_number DESC,id DESC);

CREATE TABLE solborne_website_artifacts (
  completion_id TEXT PRIMARY KEY REFERENCES solborne_walk_completions(id),
  html_content TEXT NOT NULL,
  readme_content TEXT NOT NULL,
  html_sha256 TEXT NOT NULL CHECK(length(html_sha256)=64 AND html_sha256 NOT GLOB '*[^0-9a-f]*'),
  readme_sha256 TEXT NOT NULL CHECK(length(readme_sha256)=64 AND readme_sha256 NOT GLOB '*[^0-9a-f]*'),
  render_version TEXT NOT NULL CHECK(render_version='solborne-static-v1')
);
CREATE TRIGGER solborne_artifacts_require_completion BEFORE INSERT ON solborne_website_artifacts
WHEN NOT EXISTS (SELECT 1 FROM solborne_walk_completions WHERE id=NEW.completion_id)
BEGIN SELECT RAISE(ABORT,'Artifact requires a completion'); END;
CREATE TRIGGER solborne_artifacts_immutable BEFORE UPDATE ON solborne_website_artifacts
BEGIN SELECT RAISE(ABORT,'Saved website artifacts are immutable'); END;
CREATE TRIGGER solborne_completions_immutable BEFORE UPDATE ON solborne_walk_completions
BEGIN SELECT RAISE(ABORT,'Website versions are immutable'); END;

CREATE TABLE solborne_owner_reviews (
  completion_id TEXT PRIMARY KEY REFERENCES solborne_walk_completions(id),
  status TEXT NOT NULL CHECK(status IN ('pending','reviewing','reviewed')),
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_solborne_owner_review_status ON solborne_owner_reviews(status,updated_at);
CREATE TABLE solborne_owner_review_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  completion_id TEXT NOT NULL REFERENCES solborne_walk_completions(id),
  status TEXT NOT NULL CHECK(status IN ('pending','reviewing','reviewed')),
  changed_at INTEGER NOT NULL
);
CREATE INDEX idx_solborne_owner_review_events ON solborne_owner_review_events(completion_id,id);
CREATE TRIGGER solborne_owner_review_insert_event AFTER INSERT ON solborne_owner_reviews
BEGIN INSERT INTO solborne_owner_review_events(completion_id,status,changed_at) VALUES(NEW.completion_id,NEW.status,NEW.updated_at); END;
CREATE TRIGGER solborne_owner_review_update_event AFTER UPDATE OF status ON solborne_owner_reviews
WHEN OLD.status<>NEW.status
BEGIN INSERT INTO solborne_owner_review_events(completion_id,status,changed_at) VALUES(NEW.completion_id,NEW.status,NEW.updated_at); END;

-- Legacy work is reviewable without claiming its previous downloads were saved.
INSERT INTO solborne_owner_reviews(completion_id,status,updated_at)
SELECT id,'pending',CAST(strftime('%s','now') AS INTEGER)*1000 FROM solborne_walk_completions;
-- Modern entries require confirmed saved files in the same atomic batch.
-- Old Workers omit the additive project columns; only those legacy root rows
-- may be queued without claiming their on-demand downloads were frozen.
CREATE TRIGGER solborne_owner_review_requires_artifact BEFORE INSERT ON solborne_owner_reviews
WHEN NOT EXISTS (
  SELECT 1 FROM solborne_walk_completions c
  WHERE c.id=NEW.completion_id AND (
    EXISTS (SELECT 1 FROM solborne_website_artifacts a WHERE a.completion_id=c.id)
    OR (c.project_id IS NULL AND c.parent_completion_id IS NULL AND c.revision_number=1)
  )
)
BEGIN SELECT RAISE(ABORT,'Review requires saved source files'); END;
-- Covers the migrate-before-deploy window and deliberate old-Worker rollback.
-- Queue and initial audit are atomic with that old-format completion INSERT.
CREATE TRIGGER solborne_legacy_completion_review AFTER INSERT ON solborne_walk_completions
WHEN NEW.project_id IS NULL AND NEW.parent_completion_id IS NULL AND NEW.revision_number=1
BEGIN
  INSERT INTO solborne_owner_reviews(completion_id,status,updated_at)
  VALUES(NEW.id,'pending',CAST(strftime('%s','now') AS INTEGER)*1000);
END;
