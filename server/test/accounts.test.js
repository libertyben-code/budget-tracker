import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { openDb } from '../src/db.js';
import { createUser } from '../src/auth/users.js';
import { SESSION_COOKIE, CSRF_COOKIE } from '../src/auth/cookies.js';
import { startApp, signIn } from './helpers.js';

const json = async (res) => ({ status: res.status, body: res.status === 204 ? null : await res.json() });
const send = (fetcher, method, url, body) =>
  fetcher(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(json);

// The cookies a Set-Cookie answer hands the browser, as the header it would send back.
function cookiesFrom(res) {
  const jar = {};
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(';');
    const i = pair.indexOf('=');
    jar[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
  }
  return jar;
}

test('without a session the API answers 401, the health check and the shell still answer', async (t) => {
  const app = await startApp();
  t.after(app.close);
  assert.equal((await fetch(`${app.base}/api/bootstrap`)).status, 401);
  assert.equal((await fetch(`${app.base}/api/accounts/default/data`)).status, 401);
  assert.equal((await fetch(`${app.base}/api/bank/status`)).status, 401);
  assert.equal((await fetch(`${app.base}/api/health`)).status, 200);
  assert.equal((await fetch(`${app.base}/`)).status, 200);
});

test('a pending account activates with its code, logs in, and logs out', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const { code } = createUser(app.db, { username: 'Theo', displayName: 'Théo' });
  const post = (url, body, headers = {}) => fetch(`${app.base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });

  assert.equal((await post('/api/auth/login', { username: 'theo', password: 'whatever-long' })).status, 401, 'no password yet');
  assert.deepEqual(await json(await post('/api/auth/activate', { username: 'theo', code: 'WRONGCODE', newPassword: 'long enough pass' })),
    { status: 400, body: { error: 'bad_code' } });
  assert.equal((await json(await post('/api/auth/activate', { username: 'theo', code, newPassword: 'short' }))).body.error, 'weak_password');

  const activated = await post('/api/auth/activate', { username: 'theo', code: code.toLowerCase(), newPassword: 'long enough pass' });
  assert.equal(activated.status, 200);
  assert.equal((await activated.json()).user.displayName, 'Théo');
  assert.equal((await post('/api/auth/activate', { username: 'theo', code, newPassword: 'another long one' })).status, 400, 'one-time');

  const login = await post('/api/auth/login', { username: 'THEO', password: 'long enough pass' });
  assert.equal(login.status, 200);
  const setCookie = login.headers.getSetCookie().join('\n');
  assert.match(setCookie, new RegExp(`${SESSION_COOKIE}=[^;]+; Path=/; SameSite=Lax; HttpOnly; Secure`));
  assert.doesNotMatch(JSON.stringify(await login.json()), /token/i, 'the token never appears in a body');

  const jar = cookiesFrom(login);
  const headers = { Cookie: `${SESSION_COOKIE}=${jar[SESSION_COOKIE]}; ${CSRF_COOKIE}=${jar[CSRF_COOKIE]}` };
  const me = await json(await fetch(`${app.base}/api/auth/me`, { headers }));
  assert.equal(me.body.user.username, 'Theo');

  assert.deepEqual(await json(await post('/api/auth/logout', {}, headers)), { status: 403, body: { error: 'csrf' } }, 'cookie writes need the CSRF echo');
  assert.equal((await post('/api/auth/logout', {}, { ...headers, 'X-CSRF-Token': jar[CSRF_COOKIE] })).status, 204);
  assert.equal((await fetch(`${app.base}/api/bootstrap`, { headers })).status, 401, 'the session is gone server-side');
});

test('five wrong passwords lock the account for a while, with the same answer as an unknown user', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const { code } = createUser(app.db, { username: 'theo', displayName: 'Théo' });
  const post = (url, body) => fetch(`${app.base}${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(json);
  await post('/api/auth/activate', { username: 'theo', code, newPassword: 'long enough pass' });

  for (let i = 0; i < 5; i++) assert.equal((await post('/api/auth/login', { username: 'theo', password: 'wrong password' })).status, 401);
  assert.deepEqual(await post('/api/auth/login', { username: 'theo', password: 'long enough pass' }), { status: 401, body: { error: 'bad_credentials' } });
  assert.deepEqual(await post('/api/auth/login', { username: 'nobody', password: 'long enough pass' }), { status: 401, body: { error: 'bad_credentials' } });
});

test('log out everywhere ends every session of that account only', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const wife = signIn(app.db, 'wife', { pairWith: 'owner' });
  const owner2 = { headers: { ...app.owner.headers } };
  assert.equal((await send(app.fetch, 'POST', '/api/auth/logout-all')).status, 204);
  assert.equal((await app.as(owner2)('/api/bootstrap')).status, 401);
  assert.equal((await app.as(wife)('/api/bootstrap')).status, 200);
});

test('the first admin takes the existing household; a paired account shares it; anyone else starts empty', async (t) => {
  const app = await startApp();
  t.after(app.close);
  const wife = signIn(app.db, 'wife', { pairWith: 'owner' });
  const brother = signIn(app.db, 'brother');
  assert.equal(app.owner.workspaceId, 'home');
  assert.equal(wife.workspaceId, 'home');
  assert.notEqual(brother.workspaceId, 'home');

  await send(app.fetch, 'POST', '/api/accounts/default/transactions', { date: '2026-11-01', description: 'Courses', amount: -50 });
  const ownerBoot = await send(app.fetch, 'GET', '/api/bootstrap');
  const wifeBoot = await send(app.as(wife), 'GET', '/api/bootstrap');
  assert.deepEqual(wifeBoot.body.accounts, ownerBoot.body.accounts);
  assert.equal(wifeBoot.body.user.displayName, 'wife');

  const brotherBoot = await send(app.as(brother), 'GET', '/api/bootstrap');
  assert.equal(brotherBoot.body.accounts.length, 1);
  assert.equal(brotherBoot.body.accounts[0].name, 'Main Account');
  assert.equal(brotherBoot.body.accounts[0].txCount, 0);
  assert.deepEqual(brotherBoot.body.joint, { wanted: null, salary1: null, salary2: null, name1: '', name2: '' });

  const own = brotherBoot.body.accounts[0].id;
  assert.equal((await send(app.as(brother), 'DELETE', `/api/accounts/${own}`)).status, 400, 'a household keeps one account');
});

test("one household cannot read or change another's data", async (t) => {
  const app = await startApp();
  t.after(app.close);
  const brother = signIn(app.db, 'brother');
  const as = app.as(brother);

  const tx = (await send(app.fetch, 'POST', '/api/accounts/default/transactions', { date: '2026-11-01', description: 'Courses', amount: -50, category: 'Food' })).body;
  await send(app.fetch, 'POST', '/api/rules', { pattern: 'netflix', category: 'Fun' });
  await send(app.fetch, 'POST', '/api/categories', { name: 'Gifts' });
  await send(app.fetch, 'PATCH', '/api/settings/joint', { wanted: 1800 });
  const savings = (await send(app.fetch, 'POST', '/api/savings', { name: 'Livret', balance: 500 })).body;

  assert.equal((await send(as, 'GET', '/api/accounts/default/data')).status, 404);
  assert.equal((await send(as, 'PATCH', `/api/accounts/default/transactions/${tx.id}`, { amount: -1 })).status, 404);
  assert.equal((await send(as, 'DELETE', '/api/accounts/default')).status, 404);
  assert.equal((await send(as, 'PATCH', `/api/savings/${savings.id}`, { name: 'Mine' })).status, 404);
  assert.equal((await send(as, 'POST', `/api/savings/${savings.id}/transactions`, { type: 'withdrawal', amount: 100 })).status, 404);
  await send(as, 'DELETE', `/api/savings/${savings.id}`);
  assert.deepEqual((await send(as, 'POST', '/api/transactions/uncategorize', { ids: [tx.id], category: 'Food' })).body, { reverted: 0 });
  await send(as, 'POST', '/api/categories/rename', { from: 'Food', to: 'Hacked' });
  await send(as, 'POST', '/api/categories/delete', { category: 'Gifts', replacement: 'Other' });
  await send(as, 'POST', '/api/rules/delete', { patterns: ['netflix'] });

  const brotherData = await send(as, 'GET', `/api/accounts/${(await send(as, 'GET', '/api/bootstrap')).body.accounts[0].id}/data`);
  assert.deepEqual(brotherData.body.savingsAccounts, []);
  assert.deepEqual(brotherData.body.categories, []);
  assert.deepEqual((await send(as, 'GET', '/api/rules')).body, []);

  const ownerData = (await send(app.fetch, 'GET', '/api/accounts/default/data')).body;
  assert.deepEqual(ownerData.transactions.map(t => [t.amount, t.category]), [[-50, 'Food']]);
  assert.deepEqual(ownerData.savingsAccounts.map(s => [s.name, s.balance]), [['Livret', 500]]);
  assert.deepEqual(ownerData.categories.map(c => c.name), ['Food', 'Gifts']);
  assert.deepEqual((await send(app.fetch, 'GET', '/api/rules')).body, [{ pattern: 'netflix', category: 'Fun' }]);
  assert.equal((await send(app.fetch, 'GET', '/api/bootstrap')).body.joint.wanted, 1800);

  // the same rule and category names live side by side
  assert.equal((await send(as, 'POST', '/api/rules', { pattern: 'netflix', category: 'Films' })).status, 201);
  assert.equal((await send(as, 'POST', '/api/categories', { name: 'Gifts' })).status, 201);
  assert.deepEqual((await send(app.fetch, 'GET', '/api/rules')).body, [{ pattern: 'netflix', category: 'Fun' }]);
});

function fakeBank(accounts) {
  let n = 0;
  const deleted = [];
  return {
    deleted,
    config: { configured: true },
    client: {
      listAspsps: async () => ({ aspsps: [{ name: 'Revolut', country: 'FR', maximum_consent_validity: 90 * 86400 }] }),
      startAuth: async (body) => ({ url: `https://bank.test/auth?state=${body.state}` }),
      createSession: async () => ({
        session_id: `sess-${++n}`,
        aspsp: { name: 'Revolut', country: 'FR' },
        psu_type: 'personal',
        access: { valid_until: '2027-01-01T00:00:00Z' },
        accounts,
      }),
      deleteSession: async (id) => { deleted.push(id); },
      fetchTransactions: async () => [],
      fetchBalances: async () => ({ balances: [{ balance_type: 'CLBD', balance_amount: { amount: '100.00', currency: 'EUR' } }] }),
    },
  };
}

// The bank's redirect comes back without our cookies: the link's state is what names the household.
async function link(fetcher, base, accountId) {
  const { body } = await send(fetcher, 'POST', '/api/bank/link', { aspspName: 'Revolut', country: 'FR', accountId });
  const state = new URL(body.url).searchParams.get('state');
  const res = await fetch(`${base}/api/bank/callback?state=${state}&code=ok`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  return new URL(res.headers.get('location'), base).searchParams.get('bank');
}

test("bank connections belong to the household that linked them, and an account another household holds stays with it", async (t) => {
  const bank = fakeBank([{ uid: 'uid-A', identification_hash: 'hashA', account_id: { iban: 'FR76A' }, name: 'Main', currency: 'EUR', cash_account_type: 'CACC' }]);
  const app = await startApp(bank);
  t.after(app.close);
  const brother = signIn(app.db, 'brother');
  const as = app.as(brother);
  const brotherAccount = (await send(as, 'GET', '/api/bootstrap')).body.accounts[0].id;

  assert.equal(await link(app.fetch, app.base, 'default'), 'linked');
  assert.equal((await send(as, 'POST', '/api/bank/link', { aspspName: 'Revolut', country: 'FR', accountId: 'default' })).status, 400, "not the brother's account");
  assert.deepEqual((await send(as, 'GET', '/api/bank/status')).body.connections, []);
  assert.equal((await send(as, 'PATCH', '/api/bank/accounts/hashA', { accountId: brotherAccount })).status, 404);
  assert.deepEqual((await send(as, 'POST', '/api/bank/sync')).body.results, []);

  // the same bank account consented again from the brother's login: the owner keeps it
  assert.equal(await link(as, app.base, brotherAccount), 'linked');
  assert.deepEqual((await send(as, 'GET', '/api/bank/status')).body.connections, [], 'a connection left with no account is dropped');
  assert.deepEqual(bank.deleted, ['sess-2']);
  const ownerStatus = (await send(app.fetch, 'GET', '/api/bank/status')).body;
  assert.deepEqual(ownerStatus.connections.map(c => c.accounts.map(a => [a.id, a.accountId])), [[['hashA', 'default']]]);
  assert.equal((await send(app.fetch, 'GET', '/api/bootstrap')).body.accounts.find(a => a.id === 'default').balance, 100);
});

test('v8 migration hands everything from before logins to the home household', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-v8-'));
  const dbPath = path.join(dir, 'old.db');
  const old = new Database(dbPath);
  old.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta VALUES ('schema_version', '7');
    CREATE TABLE accounts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, salary_person1 TEXT NOT NULL DEFAULT '', salary_person2 TEXT NOT NULL DEFAULT '',
      joint_target_amount TEXT NOT NULL DEFAULT '', currency TEXT NOT NULL DEFAULT 'EUR', opening_balance REAL,
      opening_balance_date TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE category_rules (id INTEGER PRIMARY KEY, pattern TEXT NOT NULL UNIQUE, category TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE custom_categories (name TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE savings_accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, balance REAL NOT NULL DEFAULT 0, category TEXT);
    CREATE TABLE bank_connections (id TEXT PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'enablebanking', session_id TEXT NOT NULL,
      aspsp_name TEXT NOT NULL, aspsp_country TEXT NOT NULL, psu_type TEXT NOT NULL DEFAULT 'personal', valid_until TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')));
    INSERT INTO accounts (id, name) VALUES ('default', 'Main Account'), ('joint', 'Joint');
    INSERT INTO category_rules (id, pattern, category) VALUES (7, 'netflix', 'Fun');
    INSERT INTO custom_categories (name) VALUES ('Gifts');
    INSERT INTO settings VALUES ('joint', '{"wanted":1800,"salary1":3000,"salary2":2000,"name1":"Ben","name2":"Léa"}');
    INSERT INTO savings_accounts (id, name, balance) VALUES ('sav1', 'Livret', 500);
    INSERT INTO bank_connections (id, session_id, aspsp_name, aspsp_country, valid_until) VALUES ('c1', 's1', 'Revolut', 'FR', '2027-01-01');
  `);
  old.close();

  const db = openDb(dbPath);
  t.after(() => { db.close(); fs.rmSync(dir, { recursive: true, force: true }); });
  for (const table of ['accounts', 'category_rules', 'custom_categories', 'settings', 'savings_accounts', 'bank_connections']) {
    assert.deepEqual(db.prepare(`SELECT DISTINCT workspace_id AS ws FROM ${table}`).all(), [{ ws: 'home' }], table);
  }
  assert.deepEqual(db.prepare('SELECT id, pattern, category FROM category_rules').all(), [{ id: 7, pattern: 'netflix', category: 'Fun' }]);
  assert.equal(JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'joint'").get().value).name2, 'Léa');
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get().value, '8');

  const owner = createUser(db, { username: 'owner', displayName: 'Ben', role: 'admin' });
  const brother = createUser(db, { username: 'brother', displayName: 'Tom', role: 'admin' });
  assert.equal(owner.workspaceId, 'home');
  assert.notEqual(brother.workspaceId, 'home', 'a second admin does not take it');
  db.prepare("INSERT INTO category_rules (workspace_id, pattern, category) VALUES (?, 'netflix', 'Films')").run(brother.workspaceId);
  assert.throws(() => db.prepare("INSERT INTO category_rules (workspace_id, pattern, category) VALUES ('home', 'netflix', 'Films')").run(), /UNIQUE/);
});
