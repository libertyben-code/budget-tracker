CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  salary_person1      TEXT NOT NULL DEFAULT '',
  salary_person2      TEXT NOT NULL DEFAULT '',
  joint_target_amount TEXT NOT NULL DEFAULT '2100',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
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
  id         INTEGER PRIMARY KEY,
  pattern    TEXT NOT NULL UNIQUE,
  category   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- user-defined categories that may have no transactions yet
CREATE TABLE IF NOT EXISTS custom_categories (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (account_id, name)
);

CREATE TABLE IF NOT EXISTS savings_accounts (
  id         TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  balance    REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sav_account ON savings_accounts(account_id);

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
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Keyed by the provider's stable per-account hash, not the session-scoped uid, so renewing
-- a consent keeps the budget-account mapping and the sync cursor. account_id is the budget
-- account transactions land in; NULL means linked but not synced anywhere.
CREATE TABLE IF NOT EXISTS bank_accounts (
  id               TEXT PRIMARY KEY,
  connection_id    TEXT NOT NULL REFERENCES bank_connections(id) ON DELETE CASCADE,
  account_id       TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  uid              TEXT NOT NULL,
  iban             TEXT NOT NULL DEFAULT '',
  name             TEXT NOT NULL DEFAULT '',
  currency         TEXT NOT NULL DEFAULT '',
  enabled          INTEGER NOT NULL DEFAULT 1,
  sync_from        TEXT,
  synced_to        TEXT,
  last_sync_at     TEXT,
  last_sync_status TEXT
);
CREATE INDEX IF NOT EXISTS idx_ba_connection ON bank_accounts(connection_id);

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '2');
INSERT OR IGNORE INTO accounts (id, name) VALUES ('default', 'Main Account');
