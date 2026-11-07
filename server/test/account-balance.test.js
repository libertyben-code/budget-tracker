import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { syncAll } from '../src/bank-sync.js';

function startApp() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-balance-'));
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
const account = (app, id) => fetch(`${app.base}/api/bootstrap`).then(json).then(r => r.body.accounts.find(a => a.id === id));
const patchSettings = (app, id, body) =>
  fetch(`${app.base}/api/accounts/${id}/settings`, { method: 'PATCH', headers, body: JSON.stringify(body) }).then(json);
const addTx = (app, id, date, amount) =>
  fetch(`${app.base}/api/accounts/${id}/transactions`, { method: 'POST', headers, body: JSON.stringify({ date, description: 'x', amount }) });

function fakeBank(balances) {
  const failing = new Set();
  return {
    failing,
    fetchTransactions: async () => [],
    fetchBalances: async (uid) => {
      if (failing.has(uid)) throw Object.assign(new Error('balances unavailable'), { status: 501 });
      return { balances: balances[uid] };
    },
  };
}

function linkBankAccounts(db, rows) {
  db.prepare("INSERT INTO bank_connections (id, session_id, aspsp_name, aspsp_country, valid_until) VALUES ('c1', 's1', 'Revolut', 'FR', '2027-01-01')").run();
  const insert = db.prepare("INSERT INTO bank_accounts (id, connection_id, account_id, uid, enabled) VALUES (?, 'c1', ?, ?, ?)");
  for (const [id, accountId, enabled = 1] of rows) insert.run(id, accountId, `uid-${id}`, enabled);
}

const closing = (amount, referenceDate) => [
  { balance_type: 'ITAV', balance_amount: { amount: String(amount - 20), currency: 'EUR' } },
  { balance_type: 'CLBD', balance_amount: { amount: String(amount), currency: 'EUR' }, reference_date: referenceDate },
];

test('a bank-fed account sums its enabled bank accounts, dated by the oldest, and keeps it when the bank cannot answer', async (t) => {
  const app = await startApp();
  t.after(app.close);
  linkBankAccounts(app.db, [['main', 'default'], ['pocket', 'default'], ['old', 'default', 0]]);
  app.db.prepare("UPDATE bank_accounts SET balance = 9999, balance_date = '2026-01-01' WHERE id = 'old'").run();
  const bank = fakeBank({ 'uid-main': closing(1000.1, '2026-11-05'), 'uid-pocket': closing(250.25, '2026-11-03') });

  await syncAll(app.db, bank, { today: '2026-11-06' });
  const first = await account(app, 'default');
  assert.equal(first.balanceSource, 'bank');
  assert.equal(first.balance, 1250.35);
  assert.equal(first.balanceAsOf, '2026-11-03');
  assert.equal(first.openingBalance, null);
  assert.equal(first.openingBalanceDate, null);

  bank.failing.add('uid-pocket');
  await syncAll(app.db, bank, { today: '2026-11-07' });
  const second = await account(app, 'default');
  assert.equal(second.balance, 1250.35);
  assert.equal(second.balanceAsOf, '2026-11-03');
  const status = app.db.prepare("SELECT last_sync_status FROM bank_accounts WHERE id = 'pocket'").get().last_sync_status;
  assert.equal(status, 'ok', 'a missing balance does not fail the sync');
});

test('a bank account whose balance was never read leaves the account balance unknown', async (t) => {
  const app = await startApp();
  t.after(app.close);
  linkBankAccounts(app.db, [['main', 'default'], ['silent', 'default']]);
  const bank = fakeBank({ 'uid-main': closing(500, '2026-11-05') });
  bank.failing.add('uid-silent');

  await syncAll(app.db, bank, { today: '2026-11-06' });
  const row = await account(app, 'default');
  assert.equal(row.balanceSource, 'bank');
  assert.equal(row.balance, null);
  assert.equal(row.balanceAsOf, null);
});

test('a manual account adds every transaction from its opening date on to the opening balance', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const before = await account(app, 'default');
  assert.equal(before.balance, null);
  assert.equal(before.balanceSource, null);

  await addTx(app, 'default', '2026-09-30', -50);
  await addTx(app, 'default', '2026-10-01', -20.1);
  await addTx(app, 'default', '2026-10-15', 500.2);
  const patched = await patchSettings(app, 'default', { openingBalance: '1000.005', openingBalanceDate: '2026-10-01' });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.openingBalance, 1000.01);
  assert.equal(patched.body.balance, 1480.11);
  assert.equal(patched.body.balanceAsOf, '2026-10-15');
  assert.equal(patched.body.balanceSource, 'manual');

  await addTx(app, 'default', '2026-11-02', -80.11);
  const later = await account(app, 'default');
  assert.equal(later.balance, 1400);
  assert.equal(later.balanceAsOf, '2026-11-02');
  assert.equal(later.openingBalanceDate, '2026-10-01');
});

test('opening balance settings are validated, and clearing both removes the balance', async (t) => {
  const app = await startApp();
  t.after(app.close);
  for (const body of [
    { openingBalance: 'abc', openingBalanceDate: '2026-10-01' },
    { openingBalance: true, openingBalanceDate: '2026-10-01' },
    { openingBalance: { n: 1 }, openingBalanceDate: '2026-10-01' },
    { openingBalance: 10, openingBalanceDate: '2026-02-30' },
    { openingBalance: 10, openingBalanceDate: '01/10/2026' },
    { openingBalance: 10 },
    { openingBalanceDate: '2026-10-01' },
    { openingBalance: 10, openingBalanceDate: '2026-10-01', balance: 3 },
  ]) {
    const res = await patchSettings(app, 'default', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal((await patchSettings(app, 'nope', { openingBalance: 1, openingBalanceDate: '2026-10-01' })).status, 404);
  assert.equal((await account(app, 'default')).openingBalance, null);

  assert.equal((await patchSettings(app, 'default', { openingBalance: -35.5, openingBalanceDate: '2026-10-01' })).body.balance, -35.5);
  assert.equal((await patchSettings(app, 'default', { openingBalance: '' })).status, 400, 'the date would be left alone');
  const cleared = await patchSettings(app, 'default', { openingBalance: null, openingBalanceDate: '' });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.balance, null);
  assert.equal(cleared.body.balanceSource, null);
});
