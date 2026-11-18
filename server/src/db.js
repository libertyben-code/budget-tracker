import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrate(db);
  return db;
}

function ensureColumn(db, table, column, ddl) {
  if (!hasColumn(db, table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

// schema.sql only creates what is missing, so columns added to an existing table have to be
// applied here. Every step is idempotent; the version in `meta` is informational.
function migrate(db) {
  // v2 (bank sync): provider ids on transactions, unique per budget account
  ensureColumn(db, 'transactions', 'external_id', 'TEXT');
  ensureColumn(db, 'transactions', 'source', "TEXT NOT NULL DEFAULT ''");
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_external ON transactions(account_id, external_id) WHERE external_id IS NOT NULL');
  // v2b: a bank account may feed a savings account instead of a budget account
  ensureColumn(db, 'bank_accounts', 'savings_account_id', 'TEXT REFERENCES savings_accounts(id) ON DELETE SET NULL');
  ensureColumn(db, 'bank_accounts', 'kind', "TEXT NOT NULL DEFAULT ''");
  // v2c: a savings account may be fed by one category of the budget account's transactions
  ensureColumn(db, 'savings_accounts', 'category', 'TEXT');
  // v3: savings are global, so savings_accounts loses account_id
  if (db.pragma('table_info(savings_accounts)').some(c => c.name === 'account_id')) dropSavingsOwner(db);
  // v4: categories are global, so custom_categories loses account_id
  if (db.pragma('table_info(custom_categories)').some(c => c.name === 'account_id')) dropCategoryOwner(db);
  // v5: the joint split is one global setting; the per-account columns stay, unused
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()) createSettings(db);
  // v6: a budget account has one currency, so a bank account in another one gets its own
  ensureColumn(db, 'accounts', 'currency', "TEXT NOT NULL DEFAULT 'EUR'");
  // v7: real balances, from the bank for synced accounts and an opening balance for manual ones
  ensureColumn(db, 'bank_accounts', 'balance', 'REAL');
  ensureColumn(db, 'bank_accounts', 'balance_date', 'TEXT');
  ensureColumn(db, 'accounts', 'opening_balance', 'REAL');
  ensureColumn(db, 'accounts', 'opening_balance_date', 'TEXT');
  // v8: households. What existed before logins belongs to 'home' (seeded by schema.sql).
  db.transaction(() => {
    for (const table of ['accounts', 'savings_accounts', 'bank_connections']) {
      if (hasColumn(db, table, 'workspace_id')) continue;
      db.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id TEXT`);
      db.prepare(`UPDATE ${table} SET workspace_id = 'home'`).run();
    }
    if (!hasColumn(db, 'category_rules', 'workspace_id')) addRuleOwner(db);
    if (!hasColumn(db, 'custom_categories', 'workspace_id')) addCategoryOwner(db);
    if (!hasColumn(db, 'settings', 'workspace_id')) addSettingsOwner(db);
  })();
  db.exec('CREATE INDEX IF NOT EXISTS idx_accounts_workspace ON accounts(workspace_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_savings_workspace ON savings_accounts(workspace_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bank_connections_workspace ON bank_connections(workspace_id)');
  db.prepare("INSERT OR IGNORE INTO accounts (id, name, workspace_id) VALUES ('default', 'Main Account', 'home')").run();
  db.prepare("UPDATE meta SET value = '8' WHERE key = 'schema_version' AND CAST(value AS INTEGER) < 8").run();
}

function hasColumn(db, table, column) {
  return db.pragma(`table_info(${table})`).some(c => c.name === column);
}

// Rules and custom categories were unique by pattern and name alone; each household now has its
// own, so the key gains workspace_id. Nothing references either table, nor settings.
function addRuleOwner(db) {
  db.exec(`
    CREATE TABLE category_rules_v8 (
      id           INTEGER PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      pattern      TEXT NOT NULL,
      category     TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (workspace_id, pattern)
    );
    INSERT INTO category_rules_v8 (id, workspace_id, pattern, category, created_at)
      SELECT id, 'home', pattern, category, created_at FROM category_rules;
    DROP TABLE category_rules;
    ALTER TABLE category_rules_v8 RENAME TO category_rules;
  `);
}

function addCategoryOwner(db) {
  db.exec(`
    CREATE TABLE custom_categories_v8 (
      workspace_id TEXT NOT NULL,
      name         TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (workspace_id, name)
    );
    INSERT INTO custom_categories_v8 (workspace_id, name, created_at)
      SELECT 'home', name, created_at FROM custom_categories;
    DROP TABLE custom_categories;
    ALTER TABLE custom_categories_v8 RENAME TO custom_categories;
  `);
}

function addSettingsOwner(db) {
  db.exec(`
    CREATE TABLE settings_v8 (
      workspace_id TEXT NOT NULL,
      key          TEXT NOT NULL,
      value        TEXT NOT NULL,
      PRIMARY KEY (workspace_id, key)
    );
    INSERT INTO settings_v8 (workspace_id, key, value) SELECT 'home', key, value FROM settings;
    DROP TABLE settings;
    ALTER TABLE settings_v8 RENAME TO settings;
  `);
}

// The joint split starts from the budget account whose salaries were filled in, else the default.
// A new database has no account yet at this point, and starts empty.
function createSettings(db) {
  const source = db.prepare(`
    SELECT salary_person1, salary_person2, joint_target_amount FROM accounts
    ORDER BY (CAST(salary_person1 AS REAL) > 0 OR CAST(salary_person2 AS REAL) > 0) DESC, id = 'default' DESC, created_at
    LIMIT 1
  `).get() ?? {};
  const amount = (text) => {
    const n = parseFloat(text);
    return Number.isFinite(n) ? n : null;
  };
  const joint = {
    wanted: amount(source.joint_target_amount),
    salary1: amount(source.salary_person1),
    salary2: amount(source.salary_person2),
    name1: '',
    name2: '',
  };
  db.transaction(() => {
    db.exec('CREATE TABLE settings (workspace_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (workspace_id, key))');
    db.prepare("INSERT INTO settings (workspace_id, key, value) VALUES ('home', 'joint', ?)").run(JSON.stringify(joint));
  })();
}

// SQLite cannot drop a column that carries a foreign key, so the table is rebuilt (create, copy,
// drop, rename). Foreign keys are off for the swap: with them on, the DROP would cascade into
// savings_history and savings_recurring and null the bank_accounts links. The pragma is a no-op
// inside a transaction, hence outside it.
function dropSavingsOwner(db) {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE savings_accounts_v3 (
          id       TEXT PRIMARY KEY,
          name     TEXT NOT NULL,
          balance  REAL NOT NULL DEFAULT 0,
          category TEXT
        );
        INSERT INTO savings_accounts_v3 (id, name, balance, category)
          SELECT id, name, balance, category FROM savings_accounts ORDER BY rowid;
        DROP TABLE savings_accounts;
        ALTER TABLE savings_accounts_v3 RENAME TO savings_accounts;
      `);
      if (db.pragma('foreign_key_check').length) throw new Error('savings_accounts rebuild left a dangling reference');
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

// No table references custom_categories, so this rebuild can run with foreign keys on. A name
// several budget accounts had collapses to one row.
function dropCategoryOwner(db) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE custom_categories_v4 (
        name       TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO custom_categories_v4 (name, created_at)
        SELECT name, MIN(created_at) FROM custom_categories GROUP BY name;
      DROP TABLE custom_categories;
      ALTER TABLE custom_categories_v4 RENAME TO custom_categories;
    `);
  })();
}
