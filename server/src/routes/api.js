import express from 'express';
import { autoCategorize, guessCategory, dedupKey } from '../../../shared/categorize.js';
import { parseImportCsv, toExportCsv } from '../../../shared/csv.js';
import { isoToDisplay, todayIso } from '../../../shared/dates.js';

const txColumns = 'id, account_id AS accountId, date, description, category, amount, type, state, source';

function accountRow(db, id) {
  const row = db.prepare(`
    SELECT a.id, a.name, a.salary_person1 AS salaryPerson1, a.salary_person2 AS salaryPerson2,
           a.joint_target_amount AS jointTargetAmount,
           (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id) AS txCount
    FROM accounts a WHERE a.id = ?
  `).get(id);
  return row;
}

function accountCategories(db, accountId) {
  return db.prepare('SELECT DISTINCT category FROM transactions WHERE account_id = ?')
    .all(accountId).map(r => r.category);
}

function customCategories(db, accountId) {
  return db.prepare('SELECT name FROM custom_categories WHERE account_id = ? ORDER BY name')
    .all(accountId).map(r => r.name);
}

function allRules(db) {
  return db.prepare('SELECT pattern, category FROM category_rules ORDER BY id').all();
}

// rows: { date, description, amount, type, state, externalId? }.
// Duplicate detection has two layers. Rows with an externalId (bank sync) are duplicates only
// when that id is already stored — two identical card payments on one day are two rows to
// the bank and stay two rows here. Every row is also checked against the legacy
// date|description|amount|type key, but a bank row only against rows that have NO external
// id: that catches the overlap with the CSV era without collapsing distinct bank rows.
export function importTransactions(db, accountId, rows, { source = 'csv' } = {}) {
  const rules = allRules(db);
  const categories = accountCategories(db, accountId);
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

function applyDueRecurring(db) {
  const rules = db.prepare(`
    SELECT r.id, r.savings_account_id AS sid, r.amount, r.day, r.next_date AS nextDate
    FROM savings_recurring r JOIN savings_accounts s ON s.id = r.savings_account_id
    WHERE s.category IS NULL
  `).all();
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

const round2 = (n) => Math.round(n * 100) / 100;

// A category-fed savings account: every budget account's transactions in that category are its
// movements — a debit is a deposit, a credit a withdrawal — on top of the stored opening balance.
function fedMovements(db, category) {
  return db.prepare('SELECT id, date, amount FROM transactions WHERE category = ? AND amount != 0 ORDER BY date DESC, id DESC')
    .all(category)
    .map(t => ({ id: `cat_${t.id}`, date: t.date, type: t.amount < 0 ? 'deposit' : 'withdrawal', amount: Math.abs(t.amount) }));
}

function fedNet(db, category) {
  if (!category) return 0;
  return -db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE category = ?').get(category).total;
}

// The API speaks in the balance the user sees: stored as-is for a manual account, opening plus
// movements for a fed one. Writes convert back (shown − net), so a fed account may store a
// negative opening.
function savingsRow(db, id) {
  const row = db.prepare('SELECT id, name, balance, category FROM savings_accounts WHERE id = ?').get(id);
  return row && { ...row, balance: round2(row.balance + fedNet(db, row.category)) };
}

function savingsPayload(db) {
  applyDueRecurring(db);
  const savingsAccounts = db.prepare('SELECT id FROM savings_accounts ORDER BY rowid').all()
    .map(s => savingsRow(db, s.id));
  const savingsHistory = {};
  const savingsRecurring = {};
  for (const s of savingsAccounts) {
    savingsHistory[s.id] = s.category ? fedMovements(db, s.category) : db.prepare(
      'SELECT id, date, type, amount, timestamp FROM savings_history WHERE savings_account_id = ? ORDER BY timestamp DESC'
    ).all(s.id);
    savingsRecurring[s.id] = db.prepare(
      'SELECT id, amount, day, next_date AS nextDate FROM savings_recurring WHERE savings_account_id = ? ORDER BY day'
    ).all(s.id);
  }
  // what a savings account can be fed by: any category of any budget account
  const savingsCategories = db.prepare('SELECT category FROM transactions UNION SELECT name FROM custom_categories ORDER BY 1')
    .all().map(r => r.category);
  return { savingsAccounts, savingsHistory, savingsRecurring, savingsCategories };
}

export function createApiRouter(db) {
  const router = express.Router();

  const requireAccount = (req, res, next) => {
    const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    next();
  };

  router.get('/health', (req, res) => {
    res.json({ ok: true, version: 2 });
  });

  router.get('/bootstrap', (req, res) => {
    const accounts = db.prepare('SELECT id FROM accounts ORDER BY created_at').all()
      .map(a => accountRow(db, a.id));
    res.json({ accounts, rules: allRules(db) });
  });

  // --- Accounts ---

  // savings ride along although they are global, so one request loads the app
  router.get('/accounts/:id/data', requireAccount, (req, res) => {
    const transactions = db.prepare(`SELECT ${txColumns} FROM transactions WHERE account_id = ? ORDER BY date DESC, id DESC`)
      .all(req.params.id);
    res.json({ transactions, ...savingsPayload(db), customCategories: customCategories(db, req.params.id) });
  });

  router.post('/accounts', (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = `account_${Date.now()}`;
    db.prepare('INSERT INTO accounts (id, name) VALUES (?, ?)').run(id, name);
    res.status(201).json(accountRow(db, id));
  });

  router.patch('/accounts/:id/settings', requireAccount, (req, res) => {
    const { salaryPerson1, salaryPerson2, jointTargetAmount, name } = req.body;
    const current = accountRow(db, req.params.id);
    db.prepare(`
      UPDATE accounts SET salary_person1 = ?, salary_person2 = ?, joint_target_amount = ?, name = ?
      WHERE id = ?
    `).run(
      salaryPerson1 ?? current.salaryPerson1,
      salaryPerson2 ?? current.salaryPerson2,
      jointTargetAmount ?? current.jointTargetAmount,
      req.params.id === 'default' ? current.name : (name ?? current.name),
      req.params.id
    );
    res.json(accountRow(db, req.params.id));
  });

  router.delete('/accounts/:id', requireAccount, (req, res) => {
    if (req.params.id === 'default') {
      return res.status(400).json({ error: 'The default account cannot be deleted' });
    }
    db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
    res.status(204).end();
  });

  // --- Transactions ---

  router.post('/accounts/:id/transactions', requireAccount, (req, res) => {
    const { date, description = '', category = 'Uncategorized', amount = 0, type = '', state = 'COMPLETED' } = req.body;
    const amountNum = Number(amount);
    const info = db.prepare(`
      INSERT INTO transactions (account_id, date, description, category, amount, type, state, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
    `).run(
      req.params.id,
      String(date || todayIso()),
      String(description ?? ''),
      String(category ?? 'Uncategorized'),
      Number.isFinite(amountNum) ? amountNum : 0,
      String(type ?? ''),
      String(state ?? 'COMPLETED')
    );
    const tx = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(tx);
  });

  router.patch('/transactions/:txId', (req, res) => {
    const current = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(req.params.txId);
    if (!current) return res.status(404).json({ error: 'Transaction not found' });
    const { date, description, category, amount, learnRule } = req.body;
    const amountNum = Number(amount ?? current.amount);
    const next = {
      date: String(date ?? current.date),
      description: String(description ?? current.description),
      category: String(category ?? current.category),
      amount: Number.isFinite(amountNum) ? amountNum : current.amount,
    };
    db.prepare(`
      UPDATE transactions SET date = ?, description = ?, category = ?, amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(next.date, next.description, next.category, next.amount, req.params.txId);

    let rule = null;
    if (learnRule && next.description && next.category && next.category !== 'Uncategorized') {
      const pattern = next.description.toLowerCase().trim();
      db.prepare(`
        INSERT INTO category_rules (pattern, category) VALUES (?, ?)
        ON CONFLICT(pattern) DO UPDATE SET category = excluded.category
      `).run(pattern, next.category);
      rule = { pattern, category: next.category };
    }

    const tx = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(req.params.txId);
    res.json({ transaction: tx, rule });
  });

  router.delete('/transactions/:txId', (req, res) => {
    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.txId);
    res.status(204).end();
  });

  router.post('/transactions/batch', (req, res) => {
    const { ids = [], set = {} } = req.body;
    if (!ids.length || (set.description === undefined && set.category === undefined)) {
      return res.status(400).json({ error: 'ids and at least one field required' });
    }
    const update = db.prepare(`
      UPDATE transactions SET
        description = COALESCE(?, description),
        category = COALESCE(?, category),
        updated_at = datetime('now')
      WHERE id = ?
    `);
    let updated = 0;
    db.transaction(() => {
      for (const id of ids) {
        updated += update.run(set.description ?? null, set.category ?? null, id).changes;
      }
    })();
    res.json({ updated });
  });

  router.post('/transactions/batch-delete', (req, res) => {
    const { ids = [] } = req.body;
    const del = db.prepare('DELETE FROM transactions WHERE id = ?');
    let deleted = 0;
    db.transaction(() => {
      for (const id of ids) deleted += del.run(id).changes;
    })();
    res.json({ deleted });
  });

  // --- Import / export ---

  router.post('/accounts/:id/import', requireAccount, express.text({ type: 'text/csv', limit: '20mb' }), (req, res) => {
    const { rows, failedLines } = parseImportCsv(req.body || '');
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
    const rules = allRules(db);
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
    res.json(allRules(db));
  });

  router.post('/rules', (req, res) => {
    const pattern = (req.body.pattern || '').toLowerCase().trim();
    const category = (req.body.category || '').trim();
    if (!pattern || !category) return res.status(400).json({ error: 'pattern and category required' });
    db.prepare(`
      INSERT INTO category_rules (pattern, category) VALUES (?, ?)
      ON CONFLICT(pattern) DO UPDATE SET category = excluded.category
    `).run(pattern, category);
    res.status(201).json({ pattern, category });
  });

  router.post('/rules/batch', (req, res) => {
    const { patterns = [], category } = req.body;
    if (!patterns.length || !category) return res.status(400).json({ error: 'patterns and category required' });
    const update = db.prepare('UPDATE category_rules SET category = ? WHERE pattern = ?');
    let updated = 0;
    db.transaction(() => {
      for (const pattern of patterns) updated += update.run(category, pattern).changes;
    })();
    res.json({ updated });
  });

  router.post('/rules/delete', (req, res) => {
    const { patterns = [] } = req.body;
    const del = db.prepare('DELETE FROM category_rules WHERE pattern = ?');
    let deleted = 0;
    db.transaction(() => {
      for (const pattern of patterns) deleted += del.run(pattern).changes;
    })();
    res.json({ deleted });
  });

  // --- Categories (atomic propagation) ---

  router.post('/accounts/:id/categories', requireAccount, (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    db.prepare('INSERT OR IGNORE INTO custom_categories (account_id, name) VALUES (?, ?)')
      .run(req.params.id, name);
    res.status(201).json({ name });
  });

  router.post('/accounts/:id/categories/rename', requireAccount, (req, res) => {
    const { from, to } = req.body;
    if (!from || !to || !to.trim()) return res.status(400).json({ error: 'from and to required' });
    const target = to.trim();
    let transactions = 0;
    let rules = 0;
    db.transaction(() => {
      transactions = db.prepare(
        "UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE account_id = ? AND category = ?"
      ).run(target, req.params.id, from).changes;
      rules = db.prepare('UPDATE category_rules SET category = ? WHERE category = ?').run(target, from).changes;
      // a savings link follows the rename, even though other budget accounts keep `from`
      db.prepare('UPDATE savings_accounts SET category = ? WHERE category = ?').run(target, from);
      // delete-then-rename so a pre-existing custom entry for `target` doesn't collide on the PK
      db.prepare('DELETE FROM custom_categories WHERE account_id = ? AND name = ?').run(req.params.id, target);
      db.prepare('UPDATE custom_categories SET name = ? WHERE account_id = ? AND name = ?').run(target, req.params.id, from);
    })();
    res.json({ transactions, rules });
  });

  router.post('/accounts/:id/categories/delete', requireAccount, (req, res) => {
    const { category, replacement } = req.body;
    if (!category || !replacement || !replacement.trim()) {
      return res.status(400).json({ error: 'category and replacement required' });
    }
    let transactions = 0;
    let rules = 0;
    db.transaction(() => {
      const net = fedNet(db, category);
      transactions = db.prepare(
        "UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE account_id = ? AND category = ?"
      ).run(replacement.trim(), req.params.id, category).changes;
      rules = db.prepare('DELETE FROM category_rules WHERE category = ?').run(category).changes;
      db.prepare('DELETE FROM custom_categories WHERE account_id = ? AND name = ?').run(req.params.id, category);
      // A savings link holds while another budget account still has the category. Once it is
      // gone everywhere the account turns manual, keeping the balance it showed.
      const stillUsed = db.prepare('SELECT 1 FROM transactions WHERE category = ? UNION ALL SELECT 1 FROM custom_categories WHERE name = ? LIMIT 1')
        .get(category, category);
      if (!stillUsed) {
        db.prepare('UPDATE savings_accounts SET balance = ROUND(balance + ?, 2), category = NULL WHERE category = ?').run(net, category);
      }
    })();
    res.json({ transactions, rules });
  });

  // --- Savings ---

  router.get('/savings', (req, res) => {
    res.json(savingsPayload(db));
  });

  router.post('/savings', (req, res) => {
    const name = (req.body.name || '').trim();
    const balance = Number(req.body.balance);
    const category = String(req.body.category || '').trim() || null;
    if (!name || Number.isNaN(balance) || balance < 0) {
      return res.status(400).json({ error: 'name and non-negative balance required' });
    }
    const id = `savings_${Date.now()}`;
    db.prepare('INSERT INTO savings_accounts (id, name, balance, category) VALUES (?, ?, ?, ?)')
      .run(id, name, round2(balance - fedNet(db, category)), category);
    res.status(201).json(savingsRow(db, id));
  });

  // an omitted balance keeps the one shown, so relinking re-derives the opening rather than the total
  router.patch('/savings/:sid', (req, res) => {
    const current = savingsRow(db, req.params.sid);
    if (!current) return res.status(404).json({ error: 'Savings account not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : current.name;
    const balance = req.body.balance !== undefined ? Number(req.body.balance) : current.balance;
    const category = req.body.category !== undefined ? (String(req.body.category || '').trim() || null) : current.category;
    if (!name || Number.isNaN(balance) || (req.body.balance !== undefined && balance < 0)) {
      return res.status(400).json({ error: 'name and non-negative balance required' });
    }
    db.prepare('UPDATE savings_accounts SET name = ?, balance = ?, category = ? WHERE id = ?')
      .run(name, round2(balance - fedNet(db, category)), category, req.params.sid);
    res.json(savingsRow(db, req.params.sid));
  });

  router.delete('/savings/:sid', (req, res) => {
    db.prepare('DELETE FROM savings_accounts WHERE id = ?').run(req.params.sid);
    res.status(204).end();
  });

  router.post('/savings/:sid/recurring', (req, res) => {
    const account = db.prepare('SELECT id, category FROM savings_accounts WHERE id = ?').get(req.params.sid);
    if (!account) return res.status(404).json({ error: 'Savings account not found' });
    if (account.category) return res.status(400).json({ error: 'This savings account is fed by a category' });
    const amount = Number(req.body.amount);
    const day = Number(req.body.day);
    if (Number.isNaN(amount) || amount <= 0 || !Number.isInteger(day) || day < 1 || day > 28) {
      return res.status(400).json({ error: 'positive amount and day 1-28 required' });
    }
    const today = todayIso();
    const [y, m] = today.split('-').map(Number);
    let nextDate = monthDate(y, m, day);
    if (nextDate < today) nextDate = nextMonthDate(nextDate, day);
    const id = `rec_${Date.now()}`;
    db.prepare('INSERT INTO savings_recurring (id, savings_account_id, amount, day, next_date) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.params.sid, amount, day, nextDate);
    res.status(201).json({ id, amount, day, nextDate });
  });

  router.delete('/savings/recurring/:rid', (req, res) => {
    db.prepare('DELETE FROM savings_recurring WHERE id = ?').run(req.params.rid);
    res.status(204).end();
  });

  router.post('/savings/:sid/transactions', (req, res) => {
    const { type, amount } = req.body;
    const value = Number(amount);
    if (!['deposit', 'withdrawal'].includes(type) || Number.isNaN(value) || value <= 0) {
      return res.status(400).json({ error: 'type deposit|withdrawal and positive amount required' });
    }
    if (db.prepare('SELECT category FROM savings_accounts WHERE id = ?').get(req.params.sid)?.category) {
      return res.status(400).json({ error: 'This savings account is fed by a category' });
    }
    let result = null;
    db.transaction(() => {
      const account = db.prepare('SELECT id, name, balance FROM savings_accounts WHERE id = ?').get(req.params.sid);
      if (!account) return;
      const newBalance = type === 'deposit'
        ? account.balance + value
        : Math.max(0, account.balance - value);
      db.prepare('UPDATE savings_accounts SET balance = ? WHERE id = ?')
        .run(Number(newBalance.toFixed(2)), account.id);
      const entry = {
        id: `tx_${Date.now()}`,
        date: todayIso(),
        type,
        amount: value,
        timestamp: Date.now(),
      };
      db.prepare(
        'INSERT INTO savings_history (id, savings_account_id, date, type, amount, timestamp) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(entry.id, account.id, entry.date, entry.type, entry.amount, entry.timestamp);
      result = { account: { ...account, balance: Number(newBalance.toFixed(2)) }, entry };
    })();
    if (!result) return res.status(404).json({ error: 'Savings account not found' });
    res.json(result);
  });

  return router;
}
