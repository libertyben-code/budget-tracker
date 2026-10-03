import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
const post = (base, url, body) => fetch(`${base}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
const patch = (base, url, body) => fetch(`${base}${url}`, { method: 'PATCH', headers, body: JSON.stringify(body) });

test('category-fed savings: stored as given, manual movements refused, rename follows, delete unlinks', async (t) => {
  const app = await startApp();
  t.after(app.close);
  app.db.prepare("INSERT INTO transactions (account_id, date, description, category, amount) VALUES ('default', '2026-09-01', 'To pocket Vacation', 'Savings: Vacation', -200)").run();

  // the client sends the opening balance (typed − net), so a fed account may store a negative one
  const created = await json(await post(app.base, '/api/accounts/default/savings', { name: 'Vacation', balance: -50, category: 'Savings: Vacation' }));
  assert.equal(created.status, 201);
  const sid = created.body.id;
  assert.deepEqual(created.body, { id: sid, name: 'Vacation', balance: -50, category: 'Savings: Vacation' });

  const manual = await json(await post(app.base, '/api/accounts/default/savings', { name: 'Nope', balance: -50 }));
  assert.equal(manual.status, 400);

  assert.equal((await post(app.base, `/api/savings/${sid}/transactions`, { type: 'deposit', amount: 10 })).status, 400);
  assert.equal((await post(app.base, `/api/savings/${sid}/recurring`, { amount: 10, day: 1 })).status, 400);

  await post(app.base, '/api/accounts/default/categories/rename', { from: 'Savings: Vacation', to: 'Pocket Vacation' });
  let data = await json(await fetch(`${app.base}/api/accounts/default/data`));
  assert.deepEqual(data.body.savingsAccounts, [{ id: sid, name: 'Vacation', balance: -50, category: 'Pocket Vacation' }]);
  assert.deepEqual(data.body.savingsHistory[sid], []);

  const unlinked = await json(await patch(app.base, `/api/savings/${sid}`, { name: 'Vacation', balance: 150, category: '' }));
  assert.deepEqual(unlinked.body, { id: sid, name: 'Vacation', balance: 150, category: null });
  assert.equal((await patch(app.base, `/api/savings/${sid}`, { balance: -1 })).status, 400);

  // relinked, then deleting the category drops the link rather than following the replacement
  await patch(app.base, `/api/savings/${sid}`, { category: 'Pocket Vacation' });
  await post(app.base, '/api/accounts/default/categories/delete', { category: 'Pocket Vacation', replacement: 'Savings' });
  data = await json(await fetch(`${app.base}/api/accounts/default/data`));
  assert.equal(data.body.savingsAccounts[0].category, null);
});

test('due recurring deposits skip a category-fed account', async (t) => {
  const app = await startApp();
  t.after(app.close);
  app.db.prepare("INSERT INTO savings_accounts (id, account_id, name, balance, category) VALUES ('fed', 'default', 'Fed', 100, 'Savings')").run();
  app.db.prepare("INSERT INTO savings_accounts (id, account_id, name, balance) VALUES ('manual', 'default', 'Manual', 100)").run();
  for (const sid of ['fed', 'manual']) {
    app.db.prepare("INSERT INTO savings_recurring (id, savings_account_id, amount, day, next_date) VALUES (?, ?, 25, 1, '2026-01-01')").run(`rec_${sid}`, sid);
  }
  const data = await json(await fetch(`${app.base}/api/accounts/default/data`));
  const byId = Object.fromEntries(data.body.savingsAccounts.map(s => [s.id, s]));
  assert.equal(byId.fed.balance, 100);
  assert.ok(byId.manual.balance > 100);
  assert.deepEqual(data.body.savingsHistory.fed, []);
});
