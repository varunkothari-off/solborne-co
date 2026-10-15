-- This schema belongs only in a new, isolated Solborne database. Never apply to the legacy Sites database.
CREATE TABLE solborne_intake_control (id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL CHECK(enabled IN(0,1)),policy_version TEXT NOT NULL);
INSERT INTO solborne_intake_control VALUES (1,0,'solborne-public-intake-v1');
CREATE TABLE solborne_registrations (id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,payload_hash TEXT NOT NULL,name TEXT NOT NULL,contact TEXT NOT NULL,enquiry_type TEXT NOT NULL,permission_to_respond INTEGER NOT NULL CHECK(permission_to_respond=1),consent_version TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX idx_solborne_registrations_created_at ON solborne_registrations(created_at);
CREATE TABLE solborne_form_sessions (token_hash TEXT PRIMARY KEY,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX idx_solborne_form_sessions_expiry ON solborne_form_sessions(expires_at);
CREATE TABLE solborne_rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX idx_solborne_rate_limits_expiry ON solborne_rate_limits(expires_at);
CREATE TABLE solborne_access_grants (token_hash TEXT PRIMARY KEY,registration_id TEXT NOT NULL REFERENCES solborne_registrations(id),expires_at INTEGER NOT NULL);
CREATE INDEX idx_solborne_access_expiry ON solborne_access_grants(expires_at);
CREATE TABLE solborne_walk_completions (id TEXT PRIMARY KEY,registration_id TEXT NOT NULL REFERENCES solborne_registrations(id),idempotency_key TEXT NOT NULL UNIQUE,payload_hash TEXT NOT NULL,website_facts_json TEXT NOT NULL,scope_version TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX idx_solborne_walk_registration ON solborne_walk_completions(registration_id,created_at);
