import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { openDb } from '../src/db.js';
import { displayToIso } from '../../shared/dates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = { ...loadEnv(path.join(ROOT, '.env')), ...process.env };
const email = env.MIGRATE_EMAIL;
const password = env.MIGRATE_PASSWORD;
if (!email || !password) {
  console.error('Set MIGRATE_EMAIL and MIGRATE_PASSWORD (env vars or .env entries).');
  process.exit(1);
}

const app = initializeApp({
  apiKey: env.REACT_APP_FIREBASE_API_KEY,
  authDomain: env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.REACT_APP_FIREBASE_APP_ID,
});

const cred = await signInWithEmailAndPassword(getAuth(app), email, password);
const uid = process.argv[2] || cred.user.uid;
console.log(`Signed in as ${email} (uid ${uid})`);

const snap = await getDoc(doc(getFirestore(app), 'users', uid));
if (!snap.exists()) {
  console.error('No Firestore document at users/' + uid);
  process.exit(1);
}
const data = snap.data();

const dbPath = env.DB_PATH || path.join(ROOT, 'data', 'budget.db');
const db = openDb(dbPath);

const existing = db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
if (existing > 0) {
  console.error(`Refusing to migrate: ${dbPath} already contains ${existing} transactions.`);
  process.exit(1);
}

const accounts = data.accounts?.length ? data.accounts : [{ id: 'default', name: 'Main Account' }];
const accountsData = data.accountsData || {};
if (!accountsData.default && data.transactions) {
  accountsData.default = { transactions: data.transactions };
}

const insertAccount = db.prepare(`
  INSERT INTO accounts (id, name, salary_person1, salary_person2, joint_target_amount)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name,
    salary_person1 = excluded.salary_person1, salary_person2 = excluded.salary_person2,
    joint_target_amount = excluded.joint_target_amount
`);
const insertTx = db.prepare(`
  INSERT INTO transactions (account_id, date, description, category, amount, type, state)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertSavings = db.prepare('INSERT INTO savings_accounts (id, account_id, name, balance) VALUES (?, ?, ?, ?)');
const insertHistory = db.prepare(
  'INSERT INTO savings_history (id, savings_account_id, date, type, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
);
const insertRule = db.prepare('INSERT INTO category_rules (pattern, category) VALUES (?, ?)');

const report = [];
db.transaction(() => {
  for (const account of accounts) {
    const d = accountsData[account.id] || {};
    insertAccount.run(
      account.id,
      account.name || account.id,
      String(d.salaryInputs?.person1 ?? ''),
      String(d.salaryInputs?.person2 ?? ''),
      String(d.jointTargetAmount ?? '2100')
    );
    let txCount = 0;
    for (const t of d.transactions || []) {
      insertTx.run(
        account.id,
        displayToIso(t.date) || '1970-01-01',
        t.description || '',
        t.category || 'Uncategorized',
        Number(t.amount) || 0,
        t.type || '',
        t.state || 'COMPLETED'
      );
      txCount++;
    }
    let savingsTotal = 0;
    for (const s of d.savingsAccounts || []) {
      insertSavings.run(s.id, account.id, s.name || s.id, Number(s.balance) || 0);
      savingsTotal += Number(s.balance) || 0;
      for (const h of d.savingsTransactionHistory?.[s.id] || []) {
        insertHistory.run(h.id, s.id, displayToIso(h.date) || '1970-01-01', h.type, Number(h.amount) || 0, h.timestamp || 0);
      }
    }
    report.push(`  ${account.id} (${account.name}): ${txCount} transactions, savings total ${savingsTotal.toFixed(2)}`);
  }
  for (const [pattern, category] of Object.entries(data.categoryRules || {})) {
    insertRule.run(pattern, category);
  }
})();

console.log('Migration complete:');
console.log(report.join('\n'));
console.log(`  category rules: ${Object.keys(data.categoryRules || {}).length}`);
console.log(`Database written to ${dbPath}`);
process.exit(0);
