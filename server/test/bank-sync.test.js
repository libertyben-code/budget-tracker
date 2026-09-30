import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { EnableBankingClient } from '../src/enablebanking.js';
import { mapTransaction, buildDescription, syncWindow, shiftDays, isBooked } from '../src/bank-sync.js';

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

// --- pure helpers -------------------------------------------------------------------------

test('mapTransaction: debit negative, credit positive, started date preferred, provider-scoped id', () => {
  const debit = mapTransaction({
    entry_reference: 'ref1',
    transaction_amount: { amount: '12.50', currency: 'EUR' },
    credit_debit_indicator: 'DBIT',
    status: 'BOOK',
    booking_date: '2026-09-20',
    transaction_date: '2026-09-19',
    creditor: { name: 'CARREFOUR MARKET' },
    remittance_information: ['Carrefour Market Paris'],
    bank_transaction_code: { description: 'Card payment' },
  }, 'acct-hash');
  assert.deepEqual(debit, {
    date: '2026-09-19',
    description: 'Carrefour Market Paris',
    amount: -12.5,
    type: 'Card payment',
    state: 'COMPLETED',
    externalId: 'acct-hash:ref1',
  });

  const credit = mapTransaction({
    transaction_id: 't2',
    transaction_amount: { amount: '2500' },
    credit_debit_indicator: 'CRDT',
    booking_date: '2026-09-25',
    debtor: { name: 'ACME SARL' },
    remittance_information: ['SALAIRE SEPTEMBRE'],
  }, 'acct-hash');
  assert.equal(credit.amount, 2500);
  assert.equal(credit.date, '2026-09-25');
  assert.equal(credit.description, 'ACME SARL - SALAIRE SEPTEMBRE');
  assert.equal(credit.type, 'CRDT');
  assert.equal(credit.externalId, 'acct-hash:t2');

  assert.equal(mapTransaction({ transaction_amount: { amount: 'abc' } }, 'x'), null);
  assert.equal(mapTransaction({ transaction_amount: { amount: '1' }, booking_date: 'soon' }, 'x'), null);
  assert.equal(mapTransaction({ transaction_amount: { amount: '1' }, booking_date: '2026-01-01' }, 'x').externalId, null);
});

test('buildDescription falls back to the code description, then to the direction', () => {
  assert.equal(buildDescription({ credit_debit_indicator: 'DBIT', bank_transaction_code: { description: 'ATM' } }), 'ATM');
  assert.equal(buildDescription({ credit_debit_indicator: 'DBIT' }), 'Debit');
  assert.equal(buildDescription({ credit_debit_indicator: 'CRDT', remittance_information: '  single   string ' }), 'single string');
});

test('isBooked keeps booked and status-less rows, drops pending', () => {
  assert.ok(isBooked({ status: 'BOOK' }));
  assert.ok(isBooked({}));
  assert.ok(!isBooked({ status: 'PENDING' }));
});

test('syncWindow: overlap behind the cursor, floored by sync_from, wide default on first sync', () => {
  const today = '2026-09-30';
  assert.deepEqual(syncWindow({ synced_to: '2026-09-20' }, today), { from: '2026-09-13', to: today });
  assert.deepEqual(syncWindow({ synced_to: '2026-09-20', sync_from: '2026-09-15' }, today), { from: '2026-09-15', to: today });
  assert.deepEqual(syncWindow({}, today), { from: shiftDays(today, -730), to: today });
  assert.deepEqual(syncWindow({ sync_from: '2026-09-01' }, today), { from: '2026-09-01', to: today });
  assert.deepEqual(syncWindow({ sync_from: '2027-01-01' }, today), { from: today, to: today });
});

// --- end to end against a mock provider ---------------------------------------------------

function tx(id, amount, indicator, date, name, extra = {}) {
  return {
    transaction_id: id,
    transaction_amount: { amount, currency: 'EUR' },
    credit_debit_indicator: indicator,
    status: 'BOOK',
    booking_date: date,
    [indicator === 'DBIT' ? 'creditor' : 'debtor']: { name },
    ...extra,
  };
}

function startMockProvider() {
  const state = { authCalls: [], sessionCount: 0, txCalls: [], deleted: [] };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const auth = req.headers.authorization || '';
    const [, header] = /^Bearer ([^.]+)\./.exec(auth) || [];
    if (!header || JSON.parse(Buffer.from(header, 'base64url')).kid !== 'app-test') {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'bad jwt' });
    }
    next();
  });
  app.get('/aspsps', (req, res) => {
    res.json({ aspsps: [
      { name: 'Revolut', country: req.query.country, psu_types: ['personal', 'business'], maximum_consent_validity: 90 * 86400 },
      { name: 'Crédit Agricole', country: req.query.country, psu_types: ['personal'], maximum_consent_validity: 180 * 86400 },
    ] });
  });
  app.post('/auth', (req, res) => {
    state.authCalls.push(req.body);
    res.json({ url: `http://bank.test/authorize?state=${encodeURIComponent(req.body.state)}`, authorization_id: 'auth-1' });
  });
  app.post('/sessions', (req, res) => {
    if (req.body.code !== 'good-code') return res.status(400).json({ code: 'INVALID_CODE', message: 'bad code' });
    const n = ++state.sessionCount;
    res.json({
      session_id: `sess-${n}`,
      accounts: [
        { uid: `uid-A-${n}`, account_id: { iban: 'FR7600000000000000000000A' }, currency: 'EUR', name: 'Main', identification_hash: 'hashA' },
        { uid: `uid-B-${n}`, account_id: { iban: 'FR7600000000000000000000B' }, currency: 'EUR', name: 'Joint', identification_hash: 'hashB' },
      ],
      aspsp: { name: 'Revolut', country: 'FR' },
      psu_type: 'personal',
      access: { valid_until: '2027-01-01T00:00:00Z' },
    });
  });
  app.get('/accounts/:uid/transactions', (req, res) => {
    state.txCalls.push({ uid: req.params.uid, query: req.query, psu: req.headers['psu-ip-address'] });
    if (req.params.uid.startsWith('uid-B')) {
      return res.json({ transactions: [tx('t9', '40.00', 'DBIT', '2026-09-10', 'EDF')] });
    }
    if (req.query.continuation_key === 'p2') {
      return res.json({ transactions: [
        tx('t3', '3.20', 'DBIT', '2026-09-28', 'RATP'),
        tx('t4', '99.00', 'DBIT', '2026-09-29', 'AMAZON', { status: 'PENDING' }),
      ] });
    }
    res.json({
      transactions: [
        tx('t1', '12.50', 'DBIT', '2026-09-20', 'CARREFOUR MARKET', { transaction_date: '2026-09-19', remittance_information: ['Carrefour Market Paris'] }),
        tx('t2', '2500.00', 'CRDT', '2026-09-25', 'ACME SARL', { remittance_information: ['SALAIRE SEPTEMBRE'] }),
      ],
      continuation_key: 'p2',
    });
  });
  app.delete('/sessions/:id', (req, res) => {
    state.deleted.push(req.params.id);
    res.json({ message: 'OK' });
  });
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ state, base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

function startApp(bank) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-bank-'));
  const db = openDb(path.join(dir, 'test.db'));
  const app = createApp(db, { bank });
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

const json = async (res) => ({ status: res.status, body: await res.json() });

test('unconfigured server: status says so and every other bank route is 503', async (t) => {
  const app = await startApp({ config: { configured: false }, client: null });
  t.after(app.close);
  const status = await json(await fetch(`${app.base}/api/bank/status`));
  assert.deepEqual(status.body, { configured: false, redirectUrl: '', connections: [] });
  const sync = await json(await fetch(`${app.base}/api/bank/sync`, { method: 'POST' }));
  assert.equal(sync.status, 503);
});

test('link → callback → initial sync → idempotent resync → renewal keeps mapping → remap → unlink', async (t) => {
  const mock = await startMockProvider();
  t.after(mock.close);
  const config = { appId: 'app-test', privateKey: pem, apiBase: mock.base, redirectUrl: '', configured: true };
  const client = new EnableBankingClient(config);
  const app = await startApp({ config, client });
  t.after(app.close);
  const headers = { 'Content-Type': 'application/json', 'User-Agent': 'test-agent' };

  // a CSV-era row that the first bank fetch overlaps with: must not double up
  app.db.prepare("INSERT INTO transactions (account_id, date, description, amount, type, state, source) VALUES ('default', '2026-09-10', 'EDF', -40, 'DBIT', 'COMPLETED', 'csv')").run();

  const aspsps = await json(await fetch(`${app.base}/api/bank/aspsps?country=fr`));
  assert.deepEqual(aspsps.body.aspsps.map(a => [a.name, a.maxConsentDays, a.psuTypes.length]), [['Crédit Agricole', 180, 1], ['Revolut', 90, 2]]);

  const bad = await json(await fetch(`${app.base}/api/bank/link`, { method: 'POST', headers, body: JSON.stringify({ aspspName: 'Nope', country: 'FR', accountId: 'default' }) }));
  assert.equal(bad.status, 400);

  const link = await json(await fetch(`${app.base}/api/bank/link`, {
    method: 'POST', headers,
    body: JSON.stringify({ aspspName: 'Revolut', country: 'FR', psuType: 'personal', accountId: 'default', syncFrom: '2026-09-01', language: 'fr' }),
  }));
  assert.equal(link.status, 200);
  assert.equal(link.body.redirectUrl, `${app.base}/api/bank/callback`);
  const state = new URL(link.body.url).searchParams.get('state');
  assert.ok(state);
  const auth = mock.state.authCalls[0];
  assert.deepEqual(auth.aspsp, { name: 'Revolut', country: 'FR' });
  assert.equal(auth.redirect_url, `${app.base}/api/bank/callback`);
  assert.equal(auth.psu_type, 'personal');
  assert.equal(auth.language, 'fr');
  const validDays = (Date.parse(auth.access.valid_until) - Date.now()) / 86400000;
  assert.ok(validDays > 89 && validDays <= 90, `consent capped by the bank's maximum, got ${validDays}`);

  const unknown = await fetch(`${app.base}/api/bank/callback?code=x&state=nope`, { redirect: 'manual' });
  assert.equal(unknown.status, 302);
  assert.equal(unknown.headers.get('location'), '/?bank=error&reason=expired');

  const cb = await fetch(`${app.base}/api/bank/callback?code=good-code&state=${state}`, { redirect: 'manual', headers: { 'User-Agent': 'test-agent' } });
  assert.equal(cb.status, 302);
  assert.equal(cb.headers.get('location'), '/?bank=linked&imported=3&skipped=1&errors=0');
  assert.equal(mock.state.txCalls[0].query.date_from, '2026-09-01', 'first sync starts at the chosen cutover');
  assert.equal(mock.state.txCalls[0].psu, '127.0.0.1', 'user-present headers are forwarded');

  const rows = app.db.prepare('SELECT date, description, amount, type, external_id AS ext, source FROM transactions ORDER BY date').all();
  assert.deepEqual(rows, [
    { date: '2026-09-10', description: 'EDF', amount: -40, type: 'DBIT', ext: null, source: 'csv' },
    { date: '2026-09-19', description: 'Carrefour Market Paris', amount: -12.5, type: 'DBIT', ext: 'hashA:t1', source: 'bank' },
    { date: '2026-09-25', description: 'ACME SARL - SALAIRE SEPTEMBRE', amount: 2500, type: 'CRDT', ext: 'hashA:t2', source: 'bank' },
    { date: '2026-09-28', description: 'RATP', amount: -3.2, type: 'DBIT', ext: 'hashA:t3', source: 'bank' },
  ]);

  let status = await json(await fetch(`${app.base}/api/bank/status`));
  assert.equal(status.body.connections.length, 1);
  const conn = status.body.connections[0];
  assert.equal(conn.aspspName, 'Revolut');
  assert.equal(conn.validUntil, '2027-01-01T00:00:00Z');
  assert.deepEqual(conn.accounts.map(a => [a.id, a.uid, a.accountId, a.enabled, a.syncFrom, a.lastSyncStatus]), [
    ['hashA', 'uid-A-1', 'default', true, '2026-09-01', 'ok'],
    ['hashB', 'uid-B-1', 'default', true, '2026-09-01', 'ok'],
  ]);
  assert.ok(conn.accounts.every(a => a.syncedTo && a.lastSyncAt));

  // resync: everything already stored, nothing added
  const resync = await json(await fetch(`${app.base}/api/bank/sync`, { method: 'POST', headers, body: '{}' }));
  assert.deepEqual(resync.body.results.map(r => [r.bankAccountId, r.imported, r.skippedDuplicates, r.error]), [['hashA', 0, 3, undefined], ['hashB', 0, 1, undefined]]);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 4);

  // renewal: same bank again, accounts matched by hash, one connection survives, mapping kept
  const relink = await json(await fetch(`${app.base}/api/bank/link`, {
    method: 'POST', headers, body: JSON.stringify({ aspspName: 'Revolut', country: 'FR', accountId: 'default' }),
  }));
  const state2 = new URL(relink.body.url).searchParams.get('state');
  const cb2 = await fetch(`${app.base}/api/bank/callback?code=good-code&state=${state2}`, { redirect: 'manual', headers: { 'User-Agent': 'test-agent' } });
  assert.equal(cb2.headers.get('location'), '/?bank=linked&imported=0&skipped=4&errors=0');
  status = await json(await fetch(`${app.base}/api/bank/status`));
  assert.equal(status.body.connections.length, 1);
  assert.notEqual(status.body.connections[0].id, conn.id);
  assert.deepEqual(status.body.connections[0].accounts.map(a => [a.id, a.uid, a.accountId, a.syncFrom]), [
    ['hashA', 'uid-A-2', 'default', '2026-09-01'],
    ['hashB', 'uid-B-2', 'default', '2026-09-01'],
  ]);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM bank_connections').get().n, 1);
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(mock.state.deleted, ['sess-1'], 'the superseded session is revoked at the provider');

  // re-mapping a bank account to another budget account carries its imported rows along
  const joint = await json(await fetch(`${app.base}/api/accounts`, { method: 'POST', headers, body: JSON.stringify({ name: 'Joint' }) }));
  const moved = await json(await fetch(`${app.base}/api/bank/accounts/hashA`, { method: 'PATCH', headers, body: JSON.stringify({ accountId: joint.body.id }) }));
  assert.equal(moved.body.moved, 3);
  assert.equal(moved.body.connections[0].accounts[0].accountId, joint.body.id);
  assert.deepEqual(
    app.db.prepare('SELECT account_id AS a, COUNT(*) AS n FROM transactions GROUP BY account_id ORDER BY a').all(),
    [{ a: joint.body.id, n: 3 }, { a: 'default', n: 1 }],
    'bank rows moved, the CSV row stayed'
  );
  const again = await json(await fetch(`${app.base}/api/bank/accounts/hashA`, { method: 'PATCH', headers, body: JSON.stringify({ accountId: joint.body.id }) }));
  assert.equal(again.body.moved, 0, 'same target moves nothing');

  // remap one account away, disable the other: sync has nothing left to do
  const patched = await json(await fetch(`${app.base}/api/bank/accounts/hashA`, { method: 'PATCH', headers, body: JSON.stringify({ accountId: '' }) }));
  assert.equal(patched.body.connections[0].accounts[0].accountId, null);
  assert.equal(patched.body.moved, 0);
  await fetch(`${app.base}/api/bank/accounts/hashB`, { method: 'PATCH', headers, body: JSON.stringify({ enabled: false, syncFrom: '' }) });
  const idle = await json(await fetch(`${app.base}/api/bank/sync`, { method: 'POST', headers, body: '{}' }));
  assert.deepEqual(idle.body.results, []);
  assert.equal(idle.body.status.connections[0].accounts[1].syncFrom, null);

  const badPatch = await json(await fetch(`${app.base}/api/bank/accounts/hashA`, { method: 'PATCH', headers, body: JSON.stringify({ accountId: 'ghost' }) }));
  assert.equal(badPatch.status, 400);

  // unlink revokes and cascades, transactions stay
  const currentId = status.body.connections[0].id;
  const del = await fetch(`${app.base}/api/bank/connections/${currentId}`, { method: 'DELETE', headers: { 'User-Agent': 'test-agent' } });
  assert.equal(del.status, 204);
  assert.ok(mock.state.deleted.includes('sess-2'));
  status = await json(await fetch(`${app.base}/api/bank/status`));
  assert.deepEqual(status.body.connections, []);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM bank_accounts').get().n, 0);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 4);
});

test('a provider error during sync is reported per account, not thrown', async (t) => {
  const mock = await startMockProvider();
  t.after(mock.close);
  const config = { appId: 'app-test', privateKey: pem, apiBase: mock.base, redirectUrl: 'https://budget.example.ts.net/api/bank/callback', configured: true };
  const app = await startApp({ config, client: new EnableBankingClient(config) });
  t.after(app.close);
  const headers = { 'Content-Type': 'application/json' };

  const link = await json(await fetch(`${app.base}/api/bank/link`, { method: 'POST', headers, body: JSON.stringify({ aspspName: 'Revolut', country: 'FR', accountId: 'default' }) }));
  assert.equal(link.body.redirectUrl, 'https://budget.example.ts.net/api/bank/callback', 'explicit redirect URL wins');
  const state = new URL(link.body.url).searchParams.get('state');
  await fetch(`${app.base}/api/bank/callback?code=good-code&state=${state}`, { redirect: 'manual' });

  // provider goes away: mark the row failed, keep serving
  mock.close();
  const sync = await json(await fetch(`${app.base}/api/bank/sync`, { method: 'POST', headers, body: '{}' }));
  assert.equal(sync.status, 200);
  assert.equal(sync.body.results.length, 2);
  assert.ok(sync.body.results.every(r => r.error && r.imported === 0));
  assert.match(sync.body.status.connections[0].accounts[0].lastSyncStatus, /^error: /);

  const failedCallback = await fetch(`${app.base}/api/bank/callback?code=bad&state=nope`, { redirect: 'manual' });
  assert.equal(failedCallback.headers.get('location'), '/?bank=error&reason=expired');
});
