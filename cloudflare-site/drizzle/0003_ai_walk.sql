-- Additive private drafts. Existing registration and release records are unchanged.
CREATE TABLE solborne_ai_walks (
  registration_id TEXT PRIMARY KEY REFERENCES solborne_registrations(id),
  state_json TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0,
  busy_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
