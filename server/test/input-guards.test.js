import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

function startApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-guards-'));
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
const request = (base, method, url, body) => fetch(`${base}${url}`, { method, headers, body: JSON.stringify(body) });
const status = (...args) => request(...args).then(res => res.status);

test('a transaction date must be YYYY-MM-DD; an omitted one is today', async (t) => {
  const app = await startApp();
  t.after(app.close);
  for (const date of [{}, [], 20260901, '01/09/2026', '2026-09-01T00:00']) {
    assert.equal(await status(app.base, 'POST', '/api/accounts/default/transactions', { date, description: 'Coffee', amount: -5 }), 400, JSON.stringify(date));
  }
  const res = await request(app.base, 'POST', '/api/accounts/default/transactions', { description: 'Coffee', amount: -5 });
  assert.equal(res.status, 201);
  const tx = await res.json();
  assert.match(tx.date, /^\d{4}-\d{2}-\d{2}$/);

  assert.equal(await status(app.base, 'PATCH', `/api/accounts/default/transactions/${tx.id}`, { date: {} }), 400);
  assert.equal(await status(app.base, 'PATCH', `/api/accounts/default/transactions/${tx.id}`, { date: '2026-09-02' }), 200);
  assert.deepEqual(app.db.prepare('SELECT date FROM transactions').all().map(r => r.date), ['2026-09-02']);
});

test('a new transaction needs a non-zero amount and a description', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const post = (body) => request(app.base, 'POST', '/api/accounts/default/transactions', body);
  const count = () => app.db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;

  for (const amount of [undefined, null, '', 0, '0', 'abc', '1e400', {}]) {
    const res = await post({ description: 'Coffee', amount });
    assert.equal(res.status, 400, JSON.stringify(amount));
    assert.match((await res.json()).error, /amount/);
  }
  for (const description of [undefined, null, '', '   ', 5, {}]) {
    const res = await post({ description, amount: -5 });
    assert.equal(res.status, 400, JSON.stringify(description));
    assert.match((await res.json()).error, /description/);
  }
  assert.equal((await post({})).status, 400);
  assert.equal(count(), 0);

  const res = await post({ description: '  Coffee  ', amount: '-3.5' });
  assert.equal(res.status, 201);
  const created = await res.json();
  assert.equal(created.description, 'Coffee');
  assert.equal(created.amount, -3.5);
  assert.equal(count(), 1);
});

test('an edited transaction keeps a non-zero amount and a description; a category-only change is fine', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const tx = await (await request(app.base, 'POST', '/api/accounts/default/transactions', { description: 'Rent', amount: -800 })).json();
  const patch = (body) => request(app.base, 'PATCH', `/api/accounts/default/transactions/${tx.id}`, body);
  const stored = () => app.db.prepare('SELECT description, category, amount FROM transactions WHERE id = ?').get(tx.id);

  for (const body of [{ amount: 0 }, { amount: '' }, { amount: 'abc' }, { amount: '1e400' }, { description: '' }, { description: '   ' }, { description: 5 }]) {
    assert.equal((await patch(body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual(stored(), { description: 'Rent', category: 'Uncategorized', amount: -800 });

  assert.equal((await patch({ category: 'Housing', learnRule: true })).status, 200);
  assert.deepEqual(stored(), { description: 'Rent', category: 'Housing', amount: -800 });
  assert.equal((await patch({ description: ' Flat rent ', amount: '-750.5', category: 'Housing' })).status, 200);
  assert.deepEqual(stored(), { description: 'Flat rent', category: 'Housing', amount: -750.5 });
});

test('an amount or balance that is not finite is refused', async (t) => {
  const app = await startApp();
  t.after(app.close);
  assert.equal(await status(app.base, 'POST', '/api/savings', { name: 'Big', balance: '1e400' }), 400);
  const { id } = await (await request(app.base, 'POST', '/api/savings', { name: 'Pot', balance: 100 })).json();
  assert.equal(await status(app.base, 'PATCH', `/api/savings/${id}`, { balance: '1e400' }), 400);
  assert.equal(await status(app.base, 'POST', `/api/savings/${id}/recurring`, { amount: '1e400', day: 1 }), 400);
  assert.equal(await status(app.base, 'POST', `/api/savings/${id}/transactions`, { type: 'deposit', amount: '1e400' }), 400);
  assert.equal(app.db.prepare('SELECT balance FROM savings_accounts WHERE id = ?').get(id).balance, 100);
});

test('a request without a JSON body gets a 400, not a 500', async (t) => {
  const app = await startApp();
  t.after(app.close);
  assert.equal((await fetch(`${app.base}/api/accounts`, { method: 'POST', body: 'name=Joint' })).status, 400);
  const res = await fetch(`${app.base}/api/accounts/default/import`, { method: 'POST' });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).imported, 0);
});

test('a transaction can only be changed or deleted through its own account', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const other = await (await request(app.base, 'POST', '/api/accounts', { name: 'Joint' })).json();
  const tx = await (await request(app.base, 'POST', '/api/accounts/default/transactions', { description: 'Rent', amount: -800 })).json();
  const stored = () => app.db.prepare('SELECT description, category FROM transactions WHERE id = ?').get(tx.id);
  const json = (...args) => request(app.base, ...args).then(res => res.json());

  assert.equal(await status(app.base, 'PATCH', `/api/accounts/missing/transactions/${tx.id}`, { category: 'Housing' }), 404);
  assert.equal(await status(app.base, 'PATCH', `/api/accounts/${other.id}/transactions/${tx.id}`, { category: 'Housing' }), 404);
  assert.deepEqual(await json('POST', `/api/accounts/${other.id}/transactions/batch`, { ids: [tx.id], set: { description: 'X' } }), { updated: 0 });
  assert.equal(await status(app.base, 'DELETE', `/api/accounts/${other.id}/transactions/${tx.id}`), 204);
  assert.deepEqual(await json('POST', `/api/accounts/${other.id}/transactions/batch-delete`, { ids: [tx.id] }), { deleted: 0 });
  assert.deepEqual(stored(), { description: 'Rent', category: 'Uncategorized' });

  assert.deepEqual(await json('POST', '/api/accounts/default/transactions/batch', { ids: [tx.id], set: { category: 'Housing' } }), { updated: 1 });
  assert.equal(stored().category, 'Housing');
  assert.deepEqual(await json('POST', '/api/accounts/default/transactions/batch-delete', { ids: [tx.id] }), { deleted: 1 });
  assert.equal(stored(), undefined);
});
