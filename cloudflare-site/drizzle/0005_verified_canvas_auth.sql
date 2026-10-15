-- Solborne-only identity boundary. No existing registration is linked by matching an email.
CREATE TABLE solborne_auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,access_token TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,active_registration_id TEXT);
CREATE INDEX idx_solborne_auth_sessions_expiry ON solborne_auth_sessions(expires_at);
CREATE TABLE solborne_auth_challenges(token_hash TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN('email','google')),verifier TEXT NOT NULL,email TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX idx_solborne_auth_challenges_expiry ON solborne_auth_challenges(expires_at);
CREATE TABLE solborne_auth_registrations(user_id TEXT NOT NULL,registration_id TEXT NOT NULL UNIQUE REFERENCES solborne_registrations(id),created_at INTEGER NOT NULL,PRIMARY KEY(user_id,registration_id));
