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
  db.prepare("UPDATE meta SET value = '2' WHERE key = 'schema_version' AND CAST(value AS INTEGER) < 2").run();
}
