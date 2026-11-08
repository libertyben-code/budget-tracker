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
  const present = db.pragma(`table_info(${table})`).some(c => c.name === column);
  if (!present) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
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
  db.prepare("UPDATE meta SET value = '7' WHERE key = 'schema_version' AND CAST(value AS INTEGER) < 7").run();
}

// The joint split starts from the budget account whose salaries were filled in, else the default.
function createSettings(db) {
  const source = db.prepare(`
    SELECT salary_person1, salary_person2, joint_target_amount FROM accounts
    ORDER BY (CAST(salary_person1 AS REAL) > 0 OR CAST(salary_person2 AS REAL) > 0) DESC, id = 'default' DESC, created_at
    LIMIT 1
  `).get();
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
    db.exec('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    db.prepare("INSERT INTO settings (key, value) VALUES ('joint', ?)").run(JSON.stringify(joint));
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
