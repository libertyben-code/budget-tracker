CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Accounts are created by the owner from the command line (scripts/create-user.js) and born
-- pending: no password, only the hash of a one-time activation code. The username collates
-- NOCASE so a phone's autocapitalised first letter still finds the account.
CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  username           TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name       TEXT NOT NULL,
  role               TEXT NOT NULL,
  password_hash      TEXT,
  active             INTEGER NOT NULL DEFAULT 1,
  activation_hash    TEXT,
  activation_expires TEXT,
  failed_logins      INTEGER NOT NULL DEFAULT 0,
  locked_until       TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

-- Opaque server-side sessions, stored as the SHA-256 of the token the cookie carries:
-- revoking one takes effect on the next request, and a database read yields nothing that logs in.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip         TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- A workspace is a household. Data is isolated between workspaces and shared within one; a
-- couple is two members of one. 'home' holds everything written before there were logins and
-- is taken by the first admin account.
CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
-- One workspace per account: a session has to name exactly one. An index rather than a table
-- constraint, so lifting the rule one day is a DROP INDEX and not a rebuild.
CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  salary_person1      TEXT NOT NULL DEFAULT '',
  salary_person2      TEXT NOT NULL DEFAULT '',
  joint_target_amount TEXT NOT NULL DEFAULT '',
  currency            TEXT NOT NULL DEFAULT 'EUR',
  -- manual accounts: balance at the start of opening_balance_date, before that day's rows
  opening_balance      REAL,
  opening_balance_date TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  -- the household; transactions and bank links reach theirs through the account
  workspace_id        TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY,
  account_id  TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'Uncategorized',
  amount      REAL NOT NULL DEFAULT 0,
  type        TEXT NOT NULL DEFAULT '',
  state       TEXT NOT NULL DEFAULT 'COMPLETED',
  -- provider-scoped id for rows that arrived through bank sync; NULL for CSV/manual rows
  external_id TEXT,
  source      TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_account_date     ON transactions(account_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_account_category ON transactions(account_id, category);

CREATE TABLE IF NOT EXISTS category_rules (
  id           INTEGER PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  pattern      TEXT NOT NULL,
  category     TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (workspace_id, pattern)
);

-- user-defined categories that may have no transactions yet; shared by the household's
-- budget accounts, like every category
CREATE TABLE IF NOT EXISTS custom_categories (
  workspace_id TEXT NOT NULL,
  name         TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (workspace_id, name)
);

-- owned by the household, not by a budget account, so deleting one never deletes savings
CREATE TABLE IF NOT EXISTS savings_accounts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0,
  -- set when every budget account's transactions in this category feed the account: a debit is
  -- a deposit, a credit a withdrawal, and `balance` is the opening balance they add to
  category   TEXT,
  workspace_id TEXT
);

CREATE TABLE IF NOT EXISTS savings_history (
  id                 TEXT PRIMARY KEY,
  savings_account_id TEXT NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  date               TEXT NOT NULL,
  type               TEXT NOT NULL CHECK (type IN ('deposit','withdrawal')),
  amount             REAL NOT NULL,
  timestamp          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sh_account_ts ON savings_history(savings_account_id, timestamp DESC);

-- day capped at 28 so every month has the deposit day
CREATE TABLE IF NOT EXISTS savings_recurring (
  id                 TEXT PRIMARY KEY,
  savings_account_id TEXT NOT NULL REFERENCES savings_accounts(id) ON DELETE CASCADE,
  amount             REAL NOT NULL,
  day                INTEGER NOT NULL CHECK (day BETWEEN 1 AND 28),
  next_date          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sr_account ON savings_recurring(savings_account_id);

-- One row per consent granted at a bank through the sync provider. Deleted when the
-- consent is revoked in-app, or automatically once a renewal has moved every account off it.
CREATE TABLE IF NOT EXISTS bank_connections (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'enablebanking',
  session_id    TEXT NOT NULL,
  aspsp_name    TEXT NOT NULL,
  aspsp_country TEXT NOT NULL,
  psu_type      TEXT NOT NULL DEFAULT 'personal',
  valid_until   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  workspace_id  TEXT
);

-- Keyed by the provider's stable per-account hash, not the session-scoped uid, so renewing
-- a consent keeps the budget-account mapping and the sync cursor. account_id is the budget
-- account transactions land in; NULL means linked but not synced anywhere.
CREATE TABLE IF NOT EXISTS bank_accounts (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  account_id       TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  -- alternative target: a savings account gets the bank balance and a deposit/withdrawal history
  savings_account_id TEXT REFERENCES savings_accounts(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL DEFAULT '',
  uid              TEXT NOT NULL,
  iban             TEXT NOT NULL DEFAULT '',
  name             TEXT NOT NULL DEFAULT '',
  currency         TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1,
  sync_from        TEXT,
  synced_to        TEXT,
  last_sync_at     TEXT,
  last_sync_status TEXT,
  -- the bank's own figure at the last sync that could read it, and the day it refers to
  balance          REAL,
  balance_date     TEXT
);
CREATE INDEX IF NOT EXISTS idx_ba_connection ON bank_accounts(connection_id);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '8');
INSERT OR IGNORE INTO workspaces (id, name, created_at) VALUES ('home', 'Home', datetime('now'));
