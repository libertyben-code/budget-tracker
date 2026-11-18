import express from 'express';
import { randomUUID } from 'node:crypto';
import { autoCategorize, guessCategory, dedupKey, MIN_RULE_PATTERN } from '../../../shared/categorize.js';
import { parseImportCsv, toExportCsv } from '../../../shared/csv.js';
import { isoToDisplay, todayIso } from '../../../shared/dates.js';

const txColumns = 'id, account_id AS accountId, date, description, category, amount, type, state, source';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const round2 = (n) => Math.round(n * 100) / 100;

// Transactions belong to a household through their budget account; bind the workspace id.
const IN_WORKSPACE = 'account_id IN (SELECT id FROM accounts WHERE workspace_id = ?)';

// A budget account fed by enabled bank accounts takes the sum of their last bank balances,
// dated by the oldest; one that has never been read leaves the balance unknown. Otherwise an
// opening balance plus every row from its date on.
function accountRow(db, id) {
  const row = db.prepare(`
    SELECT a.id, a.name, a.currency, a.opening_balance AS openingBalance, a.opening_balance_date AS openingBalanceDate,
           (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id) AS txCount
    FROM accounts a WHERE a.id = ?
  `).get(id);
  const bank = db.prepare(`
    SELECT COUNT(*) AS feeds, COUNT(balance) AS known, SUM(balance) AS total, MIN(balance_date) AS asOf
    FROM bank_accounts WHERE account_id = ? AND enabled = 1
  `).get(id);
  if (bank.feeds) {
    const complete = bank.known === bank.feeds;
    return { ...row, balance: complete ? round2(bank.total) : null, balanceAsOf: complete ? bank.asOf : null, balanceSource: 'bank' };
  }
  if (row.openingBalanceDate) {
    const since = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total, MAX(date) AS last FROM transactions WHERE account_id = ? AND date >= ?')
      .get(id, row.openingBalanceDate);
    const asOf = since.last && since.last > row.openingBalanceDate ? since.last : row.openingBalanceDate;
    return { ...row, balance: round2(row.openingBalance + since.total), balanceAsOf: asOf, balanceSource: 'manual' };
  }
  return { ...row, balance: null, balanceAsOf: null, balanceSource: null };
}

function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

// one list for the household's budget accounts: what their transactions use plus the custom
// ones, each with its transaction count across those accounts
function categoryList(db, ws) {
  return db.prepare(`
    SELECT name, SUM(n) AS count FROM (
      SELECT category AS name, COUNT(*) AS n FROM transactions WHERE ${IN_WORKSPACE} GROUP BY category
      UNION ALL SELECT name, 0 FROM custom_categories WHERE workspace_id = ?
    ) GROUP BY name ORDER BY name
  `).all(ws, ws);
}

const EMPTY_JOINT = { wanted: null, salary1: null, salary2: null, name1: '', name2: '' };

// a household that never saved its split has no row yet
function jointSettings(db, ws) {
  const row = db.prepare("SELECT value FROM settings WHERE workspace_id = ? AND key = 'joint'").get(ws);
  return row ? JSON.parse(row.value) : { ...EMPTY_JOINT };
}

const JOINT_AMOUNTS = ['wanted', 'salary1', 'salary2'];
const JOINT_NAMES = ['name1', 'name2'];
const MAX_NAME_LENGTH = 40;

function allRules(db, ws) {
  return db.prepare('SELECT pattern, category FROM category_rules WHERE workspace_id = ? ORDER BY id').all(ws);
}

function saveRule(db, ws, pattern, category) {
  db.prepare(`
    INSERT INTO category_rules (workspace_id, pattern, category) VALUES (?, ?, ?)
    ON CONFLICT(workspace_id, pattern) DO UPDATE SET category = excluded.category
  `).run(ws, pattern, category);
}

// rows: { date, description, amount, type, state, externalId? }.
// Duplicate detection has two layers. Rows with an externalId (bank sync) are duplicates only
// when that id is already stored — two identical card payments on one day are two rows to
// the bank and stay two rows here. Every row is also checked against the legacy
// date|description|amount|type key, but a bank row only against rows that have NO external
// id: that catches the overlap with the CSV era without collapsing distinct bank rows.
export function importTransactions(db, accountId, rows, { source = 'csv' } = {}) {
  const ws = db.prepare('SELECT workspace_id FROM accounts WHERE id = ?').get(accountId).workspace_id;
  const rules = allRules(db, ws);
  const categories = categoryList(db, ws).map(c => c.name);
  const existing = db.prepare('SELECT date, description, amount, type, external_id AS externalId FROM transactions WHERE account_id = ?')
    .all(accountId);
  const legacyKeys = new Set(existing.filter(t => !t.externalId).map(dedupKey));
  const allKeys = new Set(existing.map(dedupKey));
  const externalIds = new Set(existing.filter(t => t.externalId).map(t => t.externalId));
  const insert = db.prepare(`
    INSERT INTO transactions (account_id, date, description, category, amount, type, state, external_id, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skippedDuplicates = 0;
  db.transaction(() => {
    for (const row of rows) {
      const key = dedupKey(row);
      const externalId = row.externalId || null;
      const duplicate = externalId
        ? externalIds.has(externalId) || legacyKeys.has(key)
        : allKeys.has(key);
      if (duplicate) {
        skippedDuplicates++;
        continue;
      }
      allKeys.add(key);
      if (externalId) externalIds.add(externalId);
      else legacyKeys.add(key);
      const ruleCategory = autoCategorize(row.description, rules);
      const category = ruleCategory !== 'Uncategorized'
        ? ruleCategory
        : guessCategory(row.description, categories);
      insert.run(accountId, row.date, row.description, category, row.amount, row.type, row.state, externalId, source);
      imported++;
    }
  })();

  return { imported, skippedDuplicates };
}

function monthDate(year, month, day) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function nextMonthDate(iso, day) {
  const [y, m] = iso.split('-').map(Number);
  return m === 12 ? monthDate(y + 1, 1, day) : monthDate(y, m + 1, day);
}

function applyDueRecurring(db, ws) {
  const rules = db.prepare(`
    SELECT r.id, r.savings_account_id AS sid, r.amount, r.day, r.next_date AS nextDate
    FROM savings_recurring r JOIN savings_accounts s ON s.id = r.savings_account_id
    WHERE s.category IS NULL AND s.workspace_id = ?
  `).all(ws);
  const today = todayIso();
  db.transaction(() => {
    for (const rule of rules) {
      let next = rule.nextDate;
      while (next <= today) {
        // deterministic id makes each occurrence apply-once even if next_date is ever rewound
        const inserted = db.prepare(
          'INSERT OR IGNORE INTO savings_history (id, savings_account_id, date, type, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(`rec_${rule.id}_${next}`, rule.sid, next, 'deposit', rule.amount, Date.now()).changes;
        if (inserted) {
          db.prepare('UPDATE savings_accounts SET balance = ROUND(balance + ?, 2) WHERE id = ?')
            .run(rule.amount, rule.sid);
        }
        next = nextMonthDate(next, rule.day);
      }
      if (next !== rule.nextDate) {
        db.prepare('UPDATE savings_recurring SET next_date = ? WHERE id = ?').run(next, rule.id);
      }
    }
  })();
}

// A category-fed savings account: the household's transactions in that category are its
// movements — a debit is a deposit, a credit a withdrawal — on top of the stored opening balance.
function fedMovements(db, ws, category) {
  return db.prepare(`SELECT id, date, amount FROM transactions WHERE category = ? AND amount != 0 AND ${IN_WORKSPACE} ORDER BY date DESC, id DESC`)
    .all(category, ws)
    .map(t => ({ id: `cat_${t.id}`, date: t.date, type: t.amount < 0 ? 'deposit' : 'withdrawal', amount: Math.abs(t.amount) }));
}

function fedNet(db, ws, category) {
  if (!category) return 0;
  return -db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE category = ? AND ${IN_WORKSPACE}`).get(category, ws).total;
}

// The API speaks in the balance the user sees: stored as-is for a manual account, opening plus
// movements for a fed one. Writes convert back (shown − net), so a fed account may store a
// negative opening.
function savingsRow(db, ws, id) {
  const row = db.prepare('SELECT id, name, balance, category FROM savings_accounts WHERE id = ? AND workspace_id = ?').get(id, ws);
  return row && { ...row, balance: round2(row.balance + fedNet(db, ws, row.category)) };
}

function savingsPayload(db, ws) {
  applyDueRecurring(db, ws);
  const savingsAccounts = db.prepare('SELECT id FROM savings_accounts WHERE workspace_id = ? ORDER BY rowid').all(ws)
    .map(s => savingsRow(db, ws, s.id));
  const savingsHistory = {};
  const savingsRecurring = {};
  for (const s of savingsAccounts) {
    savingsHistory[s.id] = s.category ? fedMovements(db, ws, s.category) : db.prepare(
      'SELECT id, date, type, amount, timestamp FROM savings_history WHERE savings_account_id = ? ORDER BY timestamp DESC'
    ).all(s.id);
    savingsRecurring[s.id] = db.prepare(
      'SELECT id, amount, day, next_date AS nextDate FROM savings_recurring WHERE savings_account_id = ? ORDER BY day'
    ).all(s.id);
  }
  return { savingsAccounts, savingsHistory, savingsRecurring };
}

export function createApiRouter(db) {
  const router = express.Router();

  // Mounted behind requireSession, which names the household a request may touch.
  router.use((req, res, next) => {
    req.ws = req.user.workspaceId;
    next();
  });

  // Another household's account answers exactly like one that does not exist.
  const requireAccount = (req, res, next) => {
    const account = db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(req.params.id, req.ws);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    next();
  };

  router.get('/bootstrap', (req, res) => {
    const accounts = db.prepare('SELECT id FROM accounts WHERE workspace_id = ? ORDER BY created_at').all(req.ws)
      .map(a => accountRow(db, a.id));
    const { displayName, username, role } = req.user;
    res.json({ user: { displayName, username, role }, accounts, rules: allRules(db, req.ws), joint: jointSettings(db, req.ws) });
  });

  // '' or null clears an amount
  router.patch('/settings/joint', (req, res) => {
    const joint = jointSettings(db, req.ws);
    for (const [key, value] of Object.entries(req.body)) {
      if (JOINT_AMOUNTS.includes(key)) {
        const amount = value === '' || value === null ? null : Number(value);
        const valid = amount === null || ((typeof value === 'number' || typeof value === 'string') && Number.isFinite(amount) && amount >= 0);
        if (!valid) return res.status(400).json({ error: `${key} must be an amount of 0 or more` });
        joint[key] = amount;
      } else if (JOINT_NAMES.includes(key)) {
        if (typeof value !== 'string' || value.trim().length > MAX_NAME_LENGTH) {
          return res.status(400).json({ error: `${key} must be text of at most ${MAX_NAME_LENGTH} characters` });
        }
        joint[key] = value.trim();
      } else {
        return res.status(400).json({ error: `Unknown setting: ${key}` });
      }
    }
    db.prepare(`
      INSERT INTO settings (workspace_id, key, value) VALUES (?, 'joint', ?)
      ON CONFLICT(workspace_id, key) DO UPDATE SET value = excluded.value
    `).run(req.ws, JSON.stringify(joint));
    res.json(joint);
  });

  // --- Accounts ---

  // savings and categories ride along although they are the household's, so one request loads the app
  router.get('/accounts/:id/data', requireAccount, (req, res) => {
    const transactions = db.prepare(`SELECT ${txColumns} FROM transactions WHERE account_id = ? ORDER BY date DESC, id DESC`)
      .all(req.params.id);
    res.json({ transactions, ...savingsPayload(db, req.ws), categories: categoryList(db, req.ws) });
  });

  router.post('/accounts', (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const currency = req.body.currency === undefined ? 'EUR' : String(req.body.currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ error: 'currency must be a three-letter code' });
    const id = `account_${randomUUID()}`;
    db.prepare('INSERT INTO accounts (id, name, currency, workspace_id) VALUES (?, ?, ?, ?)').run(id, name, currency, req.ws);
    res.status(201).json(accountRow(db, id));
  });

  // '' or null clears a field; the amount and its date are set or cleared together
  router.patch('/accounts/:id/settings', requireAccount, (req, res) => {
    const current = db.prepare('SELECT opening_balance AS openingBalance, opening_balance_date AS openingBalanceDate FROM accounts WHERE id = ?')
      .get(req.params.id);
    const next = { ...current };
    for (const [key, value] of Object.entries(req.body)) {
      const cleared = value === '' || value === null;
      if (key === 'openingBalance') {
        const amount = Number(value);
        const valid = cleared || ((typeof value === 'number' || typeof value === 'string') && Number.isFinite(amount));
        if (!valid) return res.status(400).json({ error: 'openingBalance must be an amount' });
        next.openingBalance = cleared ? null : round2(amount);
      } else if (key === 'openingBalanceDate') {
        if (!cleared && !isIsoDate(value)) return res.status(400).json({ error: 'openingBalanceDate must be YYYY-MM-DD' });
        next.openingBalanceDate = cleared ? null : value;
      } else {
        return res.status(400).json({ error: `Unknown setting: ${key}` });
      }
    }
    if ((next.openingBalance === null) !== (next.openingBalanceDate === null)) {
      return res.status(400).json({ error: 'openingBalance and openingBalanceDate are set together' });
    }
    db.prepare('UPDATE accounts SET opening_balance = ?, opening_balance_date = ? WHERE id = ?')
      .run(next.openingBalance, next.openingBalanceDate, req.params.id);
    res.json(accountRow(db, req.params.id));
  });

  // The client always has an account selected, so a household keeps at least one; and db.js
  // seeds 'default' at every boot, so that one stays too.
  router.delete('/accounts/:id', requireAccount, (req, res) => {
    if (req.params.id === 'default') {
      return res.status(400).json({ error: 'The default account cannot be deleted' });
    }
    if (db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE workspace_id = ?').get(req.ws).n < 2) {
      return res.status(400).json({ error: 'The last account cannot be deleted' });
    }
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  // --- Transactions ---

  router.post('/accounts/:id/transactions', requireAccount, (req, res) => {
    const { date, description, category = 'Uncategorized', amount, type = '', state = 'COMPLETED' } = req.body;
    if (date && !ISO_DATE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum === 0) return res.status(400).json({ error: 'amount must be a non-zero number' });
    if (typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'description must not be empty' });
    const info = db.prepare(`
      INSERT INTO transactions (account_id, date, description, category, amount, type, state, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      req.params.id,
      String(date || todayIso()),
      description.trim(),
      String(category ?? 'Uncategorized'),
      amountNum,
      String(type ?? ''),
      String(state ?? 'COMPLETED')
    );
    const tx = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(tx);
  });

  router.patch('/accounts/:id/transactions/:txId', requireAccount, (req, res) => {
    const current = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ? AND account_id = ?`)
      .get(req.params.txId, req.params.id);
    if (!current) return res.status(404).json({ error: 'Transaction not found' });
    const { date, description, category, amount, learnRule } = req.body;
    if (date != null && !ISO_DATE.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    const amountNum = Number(amount ?? current.amount);
    if (amount != null && (!Number.isFinite(amountNum) || amountNum === 0)) return res.status(400).json({ error: 'amount must be a non-zero number' });
    if (description != null && (typeof description !== 'string' || !description.trim())) return res.status(400).json({ error: 'description must not be empty' });
    const next = {
      date: String(date ?? current.date),
      description: description != null ? description.trim() : current.description,
      category: String(category ?? current.category),
      amount: amountNum,
    };
    db.prepare(`
      UPDATE transactions SET date = ?, description = ?, category = ?, amount = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `).run(next.date, next.description, next.category, next.amount, req.params.txId, req.params.id);

    let rule = null;
    let applied = null;
    if (learnRule && next.description.trim().length >= MIN_RULE_PATTERN && next.category && next.category !== 'Uncategorized') {
      const pattern = next.description.toLowerCase().trim();
      saveRule(db, req.ws, pattern, next.category);
      rule = { pattern, category: next.category };

      const matches = db.prepare(`SELECT id, description FROM transactions WHERE category = 'Uncategorized' AND ${IN_WORKSPACE}`).all(req.ws)
        .filter(t => autoCategorize(t.description, [rule]) === rule.category);
      const update = db.prepare("UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE id = ?");
      db.transaction(() => {
        for (const t of matches) update.run(rule.category, t.id);
      })();
      applied = { count: matches.length, ids: matches.map(t => t.id) };
    }

    const tx = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(req.params.txId);
    res.json({ transaction: tx, rule, applied });
  });

  // undoes the rows a learned rule just applied to, unless they were changed since
  router.post('/transactions/uncategorize', (req, res) => {
    const { ids, category } = req.body;
    if (!Array.isArray(ids) || !ids.every(Number.isInteger) || typeof category !== 'string') {
      return res.status(400).json({ error: 'ids and category required' });
    }
    const revert = db.prepare(`
      UPDATE transactions SET category = 'Uncategorized', updated_at = datetime('now')
      WHERE id = ? AND category = ? AND ${IN_WORKSPACE}
    `);
    let reverted = 0;
    db.transaction(() => {
      for (const id of ids) reverted += revert.run(id, category, req.ws).changes;
    })();
    res.json({ reverted });
  });

  router.delete('/accounts/:id/transactions/:txId', requireAccount, (req, res) => {
    db.prepare('DELETE FROM transactions WHERE id = ? AND account_id = ?').run(req.params.txId, req.params.id);
    res.status(204).end();
  });

  router.post('/accounts/:id/transactions/batch', requireAccount, (req, res) => {
    const { ids = [], set = {} } = req.body;
    if (!ids.length || (set.description === undefined && set.category === undefined)) {
      return res.status(400).json({ error: 'ids and at least one field required' });
    }
    const update = db.prepare(`
      UPDATE transactions SET
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        updated_at = datetime('now')
      WHERE id = ? AND account_id = ?
    `);
    let updated = 0;
    db.transaction(() => {
      for (const id of ids) {
        updated += update.run(set.description ?? null, set.category ?? null, id, req.params.id).changes;
      }
    })();
    res.json({ updated });
  });

  router.post('/accounts/:id/transactions/batch-delete', requireAccount, (req, res) => {
    const { ids = [] } = req.body;
    const del = db.prepare('DELETE FROM transactions WHERE id = ? AND account_id = ?');
    let deleted = 0;
    db.transaction(() => {
      for (const id of ids) deleted += del.run(id, req.params.id).changes;
    })();
    res.json({ deleted });
  });

  // --- Import / export ---

  router.post('/accounts/:id/import', requireAccount, express.text({ type: 'text/csv', limit: '20mb' }), (req, res) => {
    const { rows, failedLines } = parseImportCsv(typeof req.body === 'string' ? req.body : '');
    const { imported, skippedDuplicates } = importTransactions(db, req.params.id, rows);
    res.json({ imported, skippedDuplicates, failedLines });
  });

  router.get('/accounts/:id/export.csv', requireAccount, (req, res) => {
    const transactions = db.prepare(`SELECT ${txColumns} FROM transactions WHERE account_id = ? ORDER BY date DESC, id DESC`)
      .all(req.params.id);
    res.type('text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="budget-export-${todayIso()}.csv"`);
    res.send(toExportCsv(transactions, isoToDisplay));
  });

  // applies every rule across all transactions, overwriting where a rule matches
  router.post('/accounts/:id/autocategorize', requireAccount, (req, res) => {
    const rules = allRules(db, req.ws);
    const transactions = db.prepare(
      'SELECT id, description, category FROM transactions WHERE account_id = ?'
    ).all(req.params.id);
    const update = db.prepare("UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE id = ?");
    let updated = 0;
    db.transaction(() => {
      for (const t of transactions) {
        const category = autoCategorize(t.description, rules);
        if (category !== 'Uncategorized' && category !== t.category) {
          update.run(category, t.id);
          updated++;
        }
      }
    })();
    res.json({ updated });
  });

  // --- Rules ---

  router.get('/rules', (req, res) => {
    res.json(allRules(db, req.ws));
  });

  router.post('/rules', (req, res) => {
    const pattern = (req.body.pattern || '').toLowerCase().trim();
    const category = (req.body.category || '').trim();
    if (pattern.length < MIN_RULE_PATTERN || !category) {
      return res.status(400).json({ error: `pattern of at least ${MIN_RULE_PATTERN} characters and category required` });
    }
    saveRule(db, req.ws, pattern, category);
    res.status(201).json({ pattern, category });
  });

  router.post('/rules/batch', (req, res) => {
    const { patterns = [], category } = req.body;
    if (!patterns.length || !category) return res.status(400).json({ error: 'patterns and category required' });
    const update = db.prepare('UPDATE category_rules SET category = ? WHERE pattern = ? AND workspace_id = ?');
    let updated = 0;
    db.transaction(() => {
      for (const pattern of patterns) updated += update.run(category, pattern, req.ws).changes;
    })();
    res.json({ updated });
  });

  router.post('/rules/delete', (req, res) => {
    const { patterns = [] } = req.body;
    const del = db.prepare('DELETE FROM category_rules WHERE pattern = ? AND workspace_id = ?');
    let deleted = 0;
    db.transaction(() => {
      for (const pattern of patterns) deleted += del.run(pattern, req.ws).changes;
    })();
    res.json({ deleted });
  });

  // --- Categories: the household's, so a rename or delete reaches each of its budget accounts ---

  router.get('/categories', (req, res) => {
    res.json(categoryList(db, req.ws));
  });

  router.post('/categories', (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    db.prepare('INSERT OR IGNORE INTO custom_categories (workspace_id, name) VALUES (?, ?)').run(req.ws, name);
    res.status(201).json({ name });
  });

  router.post('/categories/rename', (req, res) => {
    const { from, to } = req.body;
    if (!from || !to || !to.trim()) return res.status(400).json({ error: 'from and to required' });
    const target = to.trim();
    let transactions = 0;
    let rules = 0;
    db.transaction(() => {
      transactions = db.prepare(
        `UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE category = ? AND ${IN_WORKSPACE}`
      ).run(target, from, req.ws).changes;
      rules = db.prepare('UPDATE category_rules SET category = ? WHERE category = ? AND workspace_id = ?').run(target, from, req.ws).changes;
      db.prepare('UPDATE savings_accounts SET category = ? WHERE category = ? AND workspace_id = ?').run(target, from, req.ws);
      // OR REPLACE: renaming onto an existing custom entry merges into it instead of hitting the PK
      db.prepare('UPDATE OR REPLACE custom_categories SET name = ? WHERE name = ? AND workspace_id = ?').run(target, from, req.ws);
    })();
    res.json({ transactions, rules });
  });

  router.post('/categories/delete', (req, res) => {
    const { category, replacement } = req.body;
    if (!category || !replacement || !replacement.trim()) {
      return res.status(400).json({ error: 'category and replacement required' });
    }
    const target = replacement.trim();
    if (target === category) return res.status(400).json({ error: 'replacement must differ from category' });
    let transactions = 0;
    let rules = 0;
    db.transaction(() => {
      const net = fedNet(db, req.ws, category);
      transactions = db.prepare(
        `UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE category = ? AND ${IN_WORKSPACE}`
      ).run(target, category, req.ws).changes;
      rules = db.prepare('DELETE FROM category_rules WHERE category = ? AND workspace_id = ?').run(category, req.ws).changes;
      db.prepare('DELETE FROM custom_categories WHERE name = ? AND workspace_id = ?').run(category, req.ws);
      // the category is gone everywhere, so a savings account it fed turns manual at the balance it showed
      db.prepare('UPDATE savings_accounts SET balance = ROUND(balance + ?, 2), category = NULL WHERE category = ? AND workspace_id = ?')
        .run(net, category, req.ws);
    })();
    res.json({ transactions, rules });
  });

  // --- Savings ---

  router.get('/savings', (req, res) => {
    res.json(savingsPayload(db, req.ws));
  });

  router.post('/savings', (req, res) => {
    const name = (req.body.name || '').trim();
    const balance = Number(req.body.balance);
    const category = String(req.body.category || '').trim() || null;
    if (!name || !Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({ error: 'name and non-negative balance required' });
    }
    const id = `savings_${randomUUID()}`;
    db.prepare('INSERT INTO savings_accounts (id, name, balance, category, workspace_id) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, round2(balance - fedNet(db, req.ws, category)), category, req.ws);
    res.status(201).json(savingsRow(db, req.ws, id));
  });

  // an omitted balance keeps the one shown, so relinking re-derives the opening rather than the total
  router.patch('/savings/:sid', (req, res) => {
    const current = savingsRow(db, req.ws, req.params.sid);
    if (!current) return res.status(404).json({ error: 'Savings account not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : current.name;
    const balance = req.body.balance !== undefined ? Number(req.body.balance) : current.balance;
    const category = req.body.category !== undefined ? (String(req.body.category || '').trim() || null) : current.category;
    if (!name || !Number.isFinite(balance) || (req.body.balance !== undefined && balance < 0)) {
      return res.status(400).json({ error: 'name and non-negative balance required' });
    }
    db.prepare('UPDATE savings_accounts SET name = ?, balance = ?, category = ? WHERE id = ?')
      .run(name, round2(balance - fedNet(db, req.ws, category)), category, req.params.sid);
    res.json(savingsRow(db, req.ws, req.params.sid));
  });

  router.delete('/savings/:sid', (req, res) => {
    db.prepare('DELETE FROM savings_accounts WHERE id = ? AND workspace_id = ?').run(req.params.sid, req.ws);
    res.status(204).end();
  });

  router.post('/savings/:sid/recurring', (req, res) => {
    const account = db.prepare('SELECT id, category FROM savings_accounts WHERE id = ? AND workspace_id = ?').get(req.params.sid, req.ws);
    if (!account) return res.status(404).json({ error: 'Savings account not found' });
    if (account.category) return res.status(400).json({ error: 'This savings account is fed by a category' });
    const amount = Number(req.body.amount);
    const day = Number(req.body.day);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(day) || day < 1 || day > 28) {
      return res.status(400).json({ error: 'positive amount and day 1-28 required' });
    }
    const today = todayIso();
    const [y, m] = today.split('-').map(Number);
    let nextDate = monthDate(y, m, day);
    if (nextDate < today) nextDate = nextMonthDate(nextDate, day);
    const id = `rec_${randomUUID()}`;
    db.prepare('INSERT INTO savings_recurring (id, savings_account_id, amount, day, next_date) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.sid, amount, day, nextDate);
    res.status(201).json({ id, amount, day, nextDate });
  });

  router.delete('/savings/recurring/:rid', (req, res) => {
    db.prepare('DELETE FROM savings_recurring WHERE id = ? AND savings_account_id IN (SELECT id FROM savings_accounts WHERE workspace_id = ?)')
      .run(req.params.rid, req.ws);
    res.status(204).end();
  });

  router.post('/savings/:sid/transactions', (req, res) => {
    const { type, amount } = req.body;
    const value = Number(amount);
    if (!['deposit', 'withdrawal'].includes(type) || !Number.isFinite(value) || value <= 0) {
      return res.status(400).json({ error: 'type deposit|withdrawal and positive amount required' });
    }
    const account = db.prepare('SELECT id, name, balance, category FROM savings_accounts WHERE id = ? AND workspace_id = ?').get(req.params.sid, req.ws);
    if (!account) return res.status(404).json({ error: 'Savings account not found' });
    if (account.category) return res.status(400).json({ error: 'This savings account is fed by a category' });
    // refused rather than clamped at 0, so removing the entry later puts back exactly what it took
    if (type === 'withdrawal' && value > account.balance) {
      return res.status(400).json({ error: 'Withdrawal is larger than the balance' });
    }
    const balance = round2(account.balance + (type === 'deposit' ? value : -value));
    const entry = { id: `tx_${randomUUID()}`, date: todayIso(), type, amount: value, timestamp: Date.now() };
    db.transaction(() => {
      db.prepare('UPDATE savings_accounts SET balance = ? WHERE id = ?').run(balance, account.id);
      db.prepare(
        'INSERT INTO savings_history (id, savings_account_id, date, type, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(entry.id, account.id, entry.date, entry.type, entry.amount, entry.timestamp);
    })();
    res.json({ account: { ...account, balance }, entry });
  });

  // Manual entries only: a fed account's history is derived from transactions, and a bank entry
  // would be fetched again on the next sync, which also resets the balance.
  router.delete('/savings/:sid/history/:hid', (req, res) => {
    const account = db.prepare('SELECT id, category FROM savings_accounts WHERE id = ? AND workspace_id = ?').get(req.params.sid, req.ws);
    if (!account) return res.status(404).json({ error: 'Savings account not found' });
    if (account.category) return res.status(400).json({ error: 'This savings account is fed by a category' });
    const entry = db.prepare('SELECT id, type, amount FROM savings_history WHERE id = ? AND savings_account_id = ?')
      .get(req.params.hid, account.id);
    if (!entry) return res.status(404).json({ error: 'History entry not found' });
    if (entry.id.startsWith('bank_')) return res.status(400).json({ error: 'This entry comes from the bank' });
    db.transaction(() => {
      db.prepare('DELETE FROM savings_history WHERE id = ?').run(entry.id);
      db.prepare('UPDATE savings_accounts SET balance = MAX(0, ROUND(balance + ?, 2)) WHERE id = ?')
        .run(entry.type === 'deposit' ? -entry.amount : entry.amount, account.id);
    })();
    res.json({ account: savingsRow(db, req.ws, account.id) });
  });

  return router;
}
