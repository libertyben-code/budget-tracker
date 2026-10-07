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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-savings-'));
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
const patch = (base, url, body) => fetch(`${base}${url}`, { method: 'PATCH', headers, body: JSON.stringify(body) });

function addTx(db, accountId, date, category, amount) {
  db.prepare("INSERT INTO transactions (account_id, date, description, category, amount) VALUES (?, ?, 'transfer', ?, ?)")
    .run(accountId, date, category, amount);
}

async function addJoint(app) {
  return (await json(await post(app.base, '/api/accounts', { name: 'Joint' }))).body.id;
}

test('a category-fed account sums the category across every budget account', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const joint = await addJoint(app);
  addTx(app.db, 'default', '2026-09-01', 'Savings: Vacation', -200);
  addTx(app.db, joint, '2026-09-05', 'Savings: Vacation', -100);
  addTx(app.db, joint, '2026-09-10', 'Savings: Vacation', 30);

  // the balance sent is the one shown; the server stores the opening the movements add to
  const created = await json(await post(app.base, '/api/savings', { name: 'Vacation', balance: 300, category: 'Savings: Vacation' }));
  assert.equal(created.status, 201);
  const sid = created.body.id;
  assert.deepEqual(created.body, { id: sid, name: 'Vacation', balance: 300, category: 'Savings: Vacation' });
  assert.equal(app.db.prepare('SELECT balance FROM savings_accounts WHERE id = ?').get(sid).balance, 30);

  // the same savings whichever budget account is loaded
  const fromJoint = await get(app.base, `/api/accounts/${joint}/data`);
  const fromDefault = await get(app.base, '/api/accounts/default/data');
  const global = await get(app.base, '/api/savings');
  for (const data of [fromJoint, fromDefault]) {
    assert.deepEqual(data.body.savingsAccounts, global.body.savingsAccounts);
    assert.deepEqual(data.body.savingsHistory, global.body.savingsHistory);
  }
  assert.deepEqual(global.body.savingsHistory[sid].map(m => [m.date, m.type, m.amount]), [
    ['2026-09-10', 'withdrawal', 30],
    ['2026-09-05', 'deposit', 100],
    ['2026-09-01', 'deposit', 200],
  ]);

  assert.equal((await post(app.base, `/api/savings/${sid}/transactions`, { type: 'deposit', amount: 10 })).status, 400);
  assert.equal((await post(app.base, `/api/savings/${sid}/recurring`, { amount: 10, day: 1 })).status, 400);
  assert.equal((await post(app.base, '/api/savings', { name: 'Nope', balance: -50 })).status, 400);
  assert.equal((await patch(app.base, `/api/savings/${sid}`, { balance: -1 })).status, 400);
});

test('a rename carries the link; a delete turns it manual at the balance it showed', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const joint = await addJoint(app);
  addTx(app.db, 'default', '2026-09-01', 'Pocket', -200);
  addTx(app.db, joint, '2026-09-02', 'Pocket', -70);
  const sid = (await json(await post(app.base, '/api/savings', { name: 'Pocket', balance: 270, category: 'Pocket' }))).body.id;
  const account = async () => (await get(app.base, '/api/savings')).body.savingsAccounts[0];

  // both accounts' rows move to the new name, so the balance holds
  await post(app.base, '/api/categories/rename', { from: 'Pocket', to: 'Pocket Vacation' });
  assert.deepEqual(await account(), { id: sid, name: 'Pocket', balance: 270, category: 'Pocket Vacation' });

  // relinking without a balance keeps the one shown
  await patch(app.base, `/api/savings/${sid}`, { category: 'Pocket' });
  assert.deepEqual(await account(), { id: sid, name: 'Pocket', balance: 270, category: 'Pocket' });

  addTx(app.db, joint, '2026-09-03', 'Pocket', -50);
  await post(app.base, '/api/categories/delete', { category: 'Pocket', replacement: 'Savings' });
  assert.deepEqual(await account(), { id: sid, name: 'Pocket', balance: 320, category: null });
});

test('savings outlive a budget account; due recurring deposits apply globally, skipping fed accounts', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const joint = await addJoint(app);
  addTx(app.db, joint, '2026-09-01', 'Savings', -40);
  app.db.prepare("INSERT INTO savings_accounts (id, name, balance, category) VALUES ('fed', 'Fed', 100, 'Savings')").run();
  app.db.prepare("INSERT INTO savings_accounts (id, name, balance) VALUES ('manual', 'Manual', 100)").run();
  for (const sid of ['fed', 'manual']) {
    app.db.prepare("INSERT INTO savings_recurring (id, savings_account_id, amount, day, next_date) VALUES (?, ?, 25, 1, '2026-01-01')").run(`rec_${sid}`, sid);
  }

  assert.equal((await fetch(`${app.base}/api/accounts/${joint}`, { method: 'DELETE' })).status, 204);
  const data = await get(app.base, '/api/savings');
  const byId = Object.fromEntries(data.body.savingsAccounts.map(s => [s.id, s]));
  assert.equal(byId.fed.balance, 100, 'the deleted account no longer feeds it, and recurring skips it');
  assert.ok(byId.manual.balance > 100);
  assert.deepEqual(data.body.savingsHistory.fed, []);
});

test('v3 migration drops the savings owner and keeps history, recurring and bank links', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-savings-v3-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, 'old.db');
  // a v2 database: today's schema with the per-account savings table it replaced
  const schema = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/schema.sql'), 'utf8')
    .replace(/CREATE TABLE IF NOT EXISTS savings_accounts \([\s\S]*?\n\);/, `
      CREATE TABLE IF NOT EXISTS savings_accounts (
        id         TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        balance    REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sav_account ON savings_accounts(account_id);`);
  const old = new Database(dbPath);
  old.pragma('foreign_keys = ON');
  old.exec(schema);
  old.exec(`
    UPDATE meta SET value = '2' WHERE key = 'schema_version';
    INSERT INTO savings_accounts (id, account_id, name, balance) VALUES ('sav1', 'default', 'Livret', 500);
    INSERT INTO savings_history (id, savings_account_id, date, type, amount, timestamp) VALUES ('h1', 'sav1', '2026-09-01', 'deposit', 500, 1);
    INSERT INTO savings_recurring (id, savings_account_id, amount, day, next_date) VALUES ('r1', 'sav1', 25, 1, '2999-01-01');
    INSERT INTO bank_connections (id, session_id, aspsp_name, aspsp_country, valid_until) VALUES ('c1', 's1', 'Bank', 'FR', '2999-01-01');
    INSERT INTO bank_accounts (id, connection_id, uid, savings_account_id) VALUES ('b1', 'c1', 'u1', 'sav1');
  `);
  old.close();

  const db = openDb(dbPath);
  t.after(() => db.close());
  assert.deepEqual(db.pragma('table_info(savings_accounts)').map(c => c.name), ['id', 'name', 'balance', 'category']);
  assert.deepEqual(db.prepare('SELECT id, name, balance, category FROM savings_accounts').all(), [{ id: 'sav1', name: 'Livret', balance: 500, category: null }]);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM savings_history').get().n, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM savings_recurring').get().n, 1);
  assert.equal(db.prepare("SELECT savings_account_id AS sid FROM bank_accounts WHERE id = 'b1'").get().sid, 'sav1');
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get().value, '4');
  assert.equal(db.pragma('foreign_keys', { simple: true }), 1);

  // the rebuilt table is still the parent: deleting it cascades and unlinks as before
  db.prepare("DELETE FROM savings_accounts WHERE id = 'sav1'").run();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM savings_history').get().n, 0);
  assert.equal(db.prepare("SELECT savings_account_id AS sid FROM bank_accounts WHERE id = 'b1'").get().sid, null);
});
