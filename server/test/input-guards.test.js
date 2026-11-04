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
    assert.equal(await status(app.base, 'POST', '/api/accounts/default/transactions', { date, amount: -5 }), 400, JSON.stringify(date));
  }
  const res = await request(app.base, 'POST', '/api/accounts/default/transactions', { amount: -5 });
  assert.equal(res.status, 201);
  const tx = await res.json();
  assert.match(tx.date, /^\d{4}-\d{2}-\d{2}$/);

  assert.equal(await status(app.base, 'PATCH', `/api/transactions/${tx.id}`, { date: {} }), 400);
  assert.equal(await status(app.base, 'PATCH', `/api/transactions/${tx.id}`, { date: '2026-09-02' }), 200);
  assert.deepEqual(app.db.prepare('SELECT date FROM transactions').all().map(r => r.date), ['2026-09-02']);
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
