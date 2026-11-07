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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-joint-'));
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
const bootstrap = (app) => fetch(`${app.base}/api/bootstrap`).then(json).then(r => r.body);
const patchJoint = (app, body) => fetch(`${app.base}/api/settings/joint`, { method: 'PATCH', headers, body: JSON.stringify(body) }).then(json);

const empty = { wanted: null, salary1: null, salary2: null, name1: '', name2: '' };

test('a new install starts with an empty joint split, not 2100', async (t) => {
  const app = await startApp();
  t.after(app.close);
  assert.deepEqual((await bootstrap(app)).joint, empty);
});

test('the joint split is one setting, saved field by field', async (t) => {
  const app = await startApp();
  t.after(app.close);
  await fetch(`${app.base}/api/accounts`, { method: 'POST', headers, body: JSON.stringify({ name: 'Joint' }) });

  assert.deepEqual((await patchJoint(app, { wanted: '2100.50', salary1: 3000 })).body,
    { ...empty, wanted: 2100.5, salary1: 3000 });
  assert.deepEqual((await patchJoint(app, { salary2: '2000', name1: '  Alex ' })).body,
    { wanted: 2100.5, salary1: 3000, salary2: 2000, name1: 'Alex', name2: '' });
  assert.deepEqual((await patchJoint(app, { wanted: '' })).body.wanted, null, "'' clears an amount");

  const boot = await bootstrap(app);
  assert.deepEqual(boot.joint, { wanted: null, salary1: 3000, salary2: 2000, name1: 'Alex', name2: '' });
  assert.equal(boot.accounts.length, 2);
  for (const account of boot.accounts) assert.deepEqual(Object.keys(account), ['id', 'name', 'currency', 'txCount']);
});

test('a joint split patch with a bad value changes nothing', async (t) => {
  const app = await startApp();
  t.after(app.close);
  await patchJoint(app, { salary1: 3000 });
  for (const body of [
    { salary1: -1 },
    { salary2: 'abc' },
    { wanted: true },
    { wanted: 100, salary1: '1e999' },
    { name1: 'x'.repeat(41) },
    { name2: 7 },
    { salaryPerson1: 3000 },
  ]) {
    assert.equal((await patchJoint(app, body)).status, 400, JSON.stringify(body));
  }
  assert.deepEqual((await bootstrap(app)).joint, { ...empty, salary1: 3000 });
});

// a v4 database: today's schema before the settings table, with the per-account values it replaced
function v4Db(t, accounts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-joint-v5-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dbPath = path.join(dir, 'old.db');
  const old = new Database(dbPath);
  old.exec(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/schema.sql'), 'utf8'));
  old.exec("UPDATE meta SET value = '4' WHERE key = 'schema_version'; UPDATE accounts SET joint_target_amount = '2100'");
  const upsert = old.prepare(`
    INSERT INTO accounts (id, name, salary_person1, salary_person2, joint_target_amount, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET salary_person1 = excluded.salary_person1, salary_person2 = excluded.salary_person2,
      joint_target_amount = excluded.joint_target_amount
  `);
  for (const a of accounts) upsert.run(a.id, a.id, a.salary1, a.salary2, a.wanted, a.createdAt || '2026-01-01 00:00:00');
  old.close();
  return dbPath;
}

test('v5 migration takes the joint split from the account whose salaries were set', (t) => {
  const dbPath = v4Db(t, [
    { id: 'default', salary1: '', salary2: '', wanted: '2100' },
    { id: 'joint', salary1: '3000', salary2: '2000.5', wanted: '1800', createdAt: '2026-02-01 00:00:00' },
  ]);
  const db = openDb(dbPath);
  t.after(() => db.close());
  assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'joint'").get().value),
    { wanted: 1800, salary1: 3000, salary2: 2000.5, name1: '', name2: '' });
  assert.equal(db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get().value, '6');
  assert.equal(db.prepare("SELECT salary_person1 FROM accounts WHERE id = 'joint'").get().salary_person1, '3000', 'old columns stay');
});

test('v5 migration falls back to the default account, and runs once', (t) => {
  const dbPath = v4Db(t, [
    { id: 'default', salary1: '', salary2: '', wanted: '2100' },
    { id: 'other', salary1: '', salary2: '', wanted: '999' },
  ]);
  const db = openDb(dbPath);
  assert.deepEqual(JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'joint'").get().value),
    { wanted: 2100, salary1: null, salary2: null, name1: '', name2: '' });
  db.prepare("UPDATE settings SET value = ? WHERE key = 'joint'").run(JSON.stringify({ ...empty, wanted: 500 }));
  db.close();

  const reopened = openDb(dbPath);
  t.after(() => reopened.close());
  assert.equal(JSON.parse(reopened.prepare("SELECT value FROM settings WHERE key = 'joint'").get().value).wanted, 500);
});
