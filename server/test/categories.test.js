import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

function startApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-categories-'));
  const db = openDb(path.join(dir, 'test.db'));
  const app = createApp(db, { bank: { config: { configured: false }, client: null } });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({
        db,
        base: `http://127.0.0.1:${server.address().port}`,
        close: () => { server.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); },
      });
    });
  });
}

const headers = { 'Content-Type': 'application/json' };
const json = async (res) => ({ status: res.status, body: await res.json() });
const get = (base, url) => fetch(`${base}${url}`).then(json);
const post = (base, url, body) => fetch(`${base}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });

function addTx(db, accountId, category) {
  db.prepare("INSERT INTO transactions (account_id, date, description, category, amount) VALUES (?, '2026-09-01', 'x', ?, -10)")
    .run(accountId, category);
}

const categoriesOf = (db, accountId) => db.prepare('SELECT category FROM transactions WHERE account_id = ? ORDER BY id')
  .all(accountId).map(r => r.category);

test('one category list, with counts across accounts, whichever budget account is loaded', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const joint = (await json(await post(app.base, '/api/accounts', { name: 'Joint' }))).body.id;
  addTx(app.db, 'default', 'Groceries');
  addTx(app.db, 'default', 'Groceries');
  addTx(app.db, joint, 'Groceries');
  addTx(app.db, joint, 'Rent');
  assert.equal((await post(app.base, '/api/categories', { name: 'Gifts' })).status, 201);
  assert.equal((await post(app.base, '/api/categories', { name: 'Gifts' })).status, 201, 'adding twice is harmless');

  const expected = [{ name: 'Gifts', count: 0 }, { name: 'Groceries', count: 3 }, { name: 'Rent', count: 1 }];
  assert.deepEqual((await get(app.base, '/api/categories')).body, expected);
  assert.deepEqual((await get(app.base, '/api/accounts/default/data')).body.categories, expected);
  assert.deepEqual((await get(app.base, `/api/accounts/${joint}/data`)).body.categories, expected);

  assert.equal((await fetch(`${app.base}/api/accounts/${joint}`, { method: 'DELETE' })).status, 204);
  assert.deepEqual((await get(app.base, '/api/categories')).body, [{ name: 'Gifts', count: 0 }, { name: 'Groceries', count: 2 }],
    'a custom category outlives the account it was added from');
});

test('rename and delete reach every budget account', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const joint = (await json(await post(app.base, '/api/accounts', { name: 'Joint' }))).body.id;
  addTx(app.db, 'default', 'Groceries');
  addTx(app.db, joint, 'Groceries');
  addTx(app.db, joint, 'Rent');
  await post(app.base, '/api/rules', { pattern: 'carrefour', category: 'Groceries' });
  await post(app.base, '/api/categories', { name: 'Food' });

  // renaming onto an existing custom category merges into it
  const renamed = await json(await post(app.base, '/api/categories/rename', { from: 'Groceries', to: 'Food' }));
  assert.deepEqual(renamed.body, { transactions: 2, rules: 1 });
  assert.deepEqual(categoriesOf(app.db, 'default'), ['Food']);
  assert.deepEqual(categoriesOf(app.db, joint), ['Food', 'Rent']);
  assert.deepEqual(app.db.prepare('SELECT name FROM custom_categories').all(), [{ name: 'Food' }]);

  assert.equal((await post(app.base, '/api/categories/delete', { category: 'Food', replacement: 'Food' })).status, 400);
  const deleted = await json(await post(app.base, '/api/categories/delete', { category: 'Food', replacement: 'Uncategorized' }));
  assert.deepEqual(deleted.body, { transactions: 2, rules: 1 });
  assert.deepEqual(categoriesOf(app.db, 'default'), ['Uncategorized']);
  assert.deepEqual(categoriesOf(app.db, joint), ['Uncategorized', 'Rent']);
  assert.deepEqual((await get(app.base, '/api/categories')).body, [{ name: 'Rent', count: 1 }, { name: 'Uncategorized', count: 2 }]);
});

test('v4 migration merges the per-account custom categories into one list', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-categories-v4-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, 'old.db');
  // a v3 database: today's schema with the per-account custom_categories table it replaced
  const schema = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/schema.sql'), 'utf8')
    .replace(/CREATE TABLE IF NOT EXISTS custom_categories \([\s\S]*?\n\);/, `
      CREATE TABLE IF NOT EXISTS custom_categories (
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (account_id, name)
      );`);
  const old = new Database(dbPath);
  old.pragma('foreign_keys = ON');
  old.exec(schema);
  old.exec(`
    UPDATE meta SET value = '3' WHERE key = 'schema_version';
    INSERT INTO accounts (id, name) VALUES ('joint', 'Joint');
    INSERT INTO custom_categories (account_id, name, created_at) VALUES
      ('default', 'Gifts', '2026-09-02 00:00:00'),
      ('joint',   'Gifts', '2026-09-01 00:00:00'),
      ('joint',   'Pets',  '2026-09-03 00:00:00');
  `);
  old.close();

  const db = openDb(dbPath);
  t.after(() => db.close());
  assert.deepEqual(db.pragma('table_info(custom_categories)').map(c => c.name), ['name', 'created_at']);
  assert.deepEqual(db.prepare('SELECT name, created_at FROM custom_categories ORDER BY name').all(), [
    { name: 'Gifts', created_at: '2026-09-01 00:00:00' },
    { name: 'Pets', created_at: '2026-09-03 00:00:00' },
  ]);
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get().value, '4');

  db.prepare("DELETE FROM accounts WHERE id = 'joint'").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM custom_categories').get().n, 2, 'no longer owned by an account');
});
