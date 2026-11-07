import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

function startApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-similar-'));
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
const call = (base, method, url, body) => fetch(`${base}${url}`, { method, headers, body: JSON.stringify(body) });
const json = (...args) => call(...args).then(res => res.json());

async function seed(app) {
  const other = await json(app.base, 'POST', '/api/accounts', { name: 'Joint' });
  const add = (account, description, category) =>
    json(app.base, 'POST', `/api/accounts/${account}/transactions`, { date: '2026-10-01', description, amount: -12, category });
  return {
    other: other.id,
    edited: await add('default', 'SNCF CONNECT PARIS'),
    sameAccount: await add('default', 'SNCF CONNECT PARIS'),
    otherAccount: await add(other.id, 'Card sncf connect paris 12/10'),
    alreadySet: await add(other.id, 'SNCF CONNECT PARIS', 'Work'),
    unrelated: await add('default', 'SNCF TER LYON'),
  };
}

const categoryOf = (app, tx) => app.db.prepare('SELECT category FROM transactions WHERE id = ?').get(tx.id).category;

test('a learned rule applies to Uncategorized matching rows in every account, never to categorised ones', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const rows = await seed(app);

  const result = await json(app.base, 'PATCH', `/api/accounts/default/transactions/${rows.edited.id}`, { category: 'Transport', learnRule: true });

  assert.deepEqual(result.rule, { pattern: 'sncf connect paris', category: 'Transport' });
  assert.equal(result.applied.count, 2);
  assert.deepEqual([...result.applied.ids].sort(), [rows.sameAccount.id, rows.otherAccount.id].sort());
  assert.equal(categoryOf(app, rows.edited), 'Transport');
  assert.equal(categoryOf(app, rows.sameAccount), 'Transport');
  assert.equal(categoryOf(app, rows.otherAccount), 'Transport');
  assert.equal(categoryOf(app, rows.alreadySet), 'Work');
  assert.equal(categoryOf(app, rows.unrelated), 'Uncategorized');
});

test('a change that learns no rule applies nothing; a rule with no other match applies to none', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const rows = await seed(app);

  const plain = await json(app.base, 'PATCH', `/api/accounts/default/transactions/${rows.edited.id}`, { category: 'Transport' });
  assert.equal(plain.rule, null);
  assert.equal(plain.applied, null);
  assert.equal(categoryOf(app, rows.sameAccount), 'Uncategorized');

  const lone = await json(app.base, 'PATCH', `/api/accounts/default/transactions/${rows.unrelated.id}`, { category: 'Transport', learnRule: true });
  assert.deepEqual(lone.applied, { count: 0, ids: [] });
});

test('undo reverts exactly the applied rows, leaving ones changed since', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const rows = await seed(app);
  const { applied } = await json(app.base, 'PATCH', `/api/accounts/default/transactions/${rows.edited.id}`, { category: 'Transport', learnRule: true });
  await call(app.base, 'PATCH', `/api/accounts/${rows.other}/transactions/${rows.otherAccount.id}`, { category: 'Travel' });

  const undo = await json(app.base, 'POST', '/api/transactions/uncategorize', { ids: applied.ids, category: 'Transport' });

  assert.equal(undo.reverted, 1);
  assert.equal(categoryOf(app, rows.sameAccount), 'Uncategorized');
  assert.equal(categoryOf(app, rows.otherAccount), 'Travel');
  assert.equal(categoryOf(app, rows.edited), 'Transport');
  assert.equal(categoryOf(app, rows.alreadySet), 'Work');
});

test('undo refuses a malformed request', async (t) => {
  const app = await startApp();
  t.after(app.close);
  for (const body of [{}, { ids: 'all', category: 'Transport' }, { ids: ['1'], category: 'Transport' }, { ids: [1] }]) {
    assert.equal((await call(app.base, 'POST', '/api/transactions/uncategorize', body)).status, 400, JSON.stringify(body));
  }
});
