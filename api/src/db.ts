import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  agent_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  admin TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT ''
);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS logo_type TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS listed BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS staff (
  account TEXT PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  name TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3)
);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS admin TEXT NOT NULL DEFAULT '';
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS position TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  requester_org TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  purpose TEXT NOT NULL,
  consent_agent BOOLEAN NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_sha256 TEXT NOT NULL,
  tracking_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'received',
  level INTEGER NOT NULL DEFAULT 1,
  priority TEXT NOT NULL DEFAULT 'normal',
  escalation_reason TEXT,
  assigned_to TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  registry_status TEXT NOT NULL DEFAULT 'unchecked',
  registry_institution TEXT,
  registry_institution_id INTEGER,
  triage_status TEXT NOT NULL DEFAULT 'not_run',
  triage JSONB,
  answer_outcome TEXT,
  answer_note TEXT,
  answered_by TEXT,
  answered_at TIMESTAMPTZ,
  receipt_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS registry_institution_id INTEGER;
CREATE INDEX IF NOT EXISTS requests_inbox ON requests (institution_id, status, due_at);
CREATE TABLE IF NOT EXISTS audit_log (
  seq BIGSERIAL PRIMARY KEY,
  request_id UUID,
  institution_id INTEGER,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_hash TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  institution_id INTEGER NOT NULL REFERENCES institutions(id),
  owner_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_sha256 TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credentials_inst ON credentials (institution_id, created_at DESC);
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY,
  credential_id TEXT NOT NULL REFERENCES credentials(id),
  recipient TEXT NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  token_hash TEXT NOT NULL UNIQUE,
  shared_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_nonces (
  nonce TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY,
  institution_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  institution_type TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  official_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  applicant_name TEXT NOT NULL,
  applicant_position TEXT NOT NULL,
  applicant_email TEXT NOT NULL DEFAULT '',
  signatory_name TEXT NOT NULL,
  signatory_title TEXT NOT NULL,
  wallet TEXT NOT NULL,
  registration_type TEXT NOT NULL,
  mandate_type TEXT,
  status TEXT NOT NULL DEFAULT 'awaiting_mandate',
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  institution_id INTEGER,
  tracking_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE applications ADD COLUMN IF NOT EXISTS applicant_email TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS applications_open_number ON applications (lower(registration_number)) WHERE status <> 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS applications_open_wallet ON applications (wallet) WHERE status <> 'rejected';
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sponsorship_usage (
  institution_id INTEGER NOT NULL,
  day DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (institution_id, day)
);
`;

export type Db = PGlite;

/** `dataDir` undefined means in-memory (tests). Production should swap in managed Postgres. */
export async function openDb(dataDir?: string): Promise<Db> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.exec(SCHEMA);
  return db;
}
