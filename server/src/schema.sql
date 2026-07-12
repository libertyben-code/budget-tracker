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

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO accounts (id, name) VALUES ('default', 'Main Account');
