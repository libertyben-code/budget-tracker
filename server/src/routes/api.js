import express from 'express';
import { autoCategorize, guessCategory, dedupKey } from '../../../shared/categorize.js';
import { parseImportCsv, toExportCsv } from '../../../shared/csv.js';
import { isoToDisplay, todayIso } from '../../../shared/dates.js';

const txColumns = 'id, account_id AS accountId, date, description, category, amount, type, state';

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

function allRules(db) {
  return db.prepare('SELECT pattern, category FROM category_rules ORDER BY id').all();
}

export function importTransactions(db, accountId, rows) {
  const rules = allRules(db);
  const categories = accountCategories(db, accountId);
  const existingKeys = new Set(
    db.prepare('SELECT date, description, amount, type FROM transactions WHERE account_id = ?')
      .all(accountId).map(dedupKey)
  );
  const batchKeys = new Set();
  const insert = db.prepare(`
    INSERT INTO transactions (account_id, date, description, category, amount, type, state)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let skippedDuplicates = 0;
  db.transaction(() => {
    for (const row of rows) {
      const key = dedupKey(row);
      if (existingKeys.has(key) || batchKeys.has(key)) {
        skippedDuplicates++;
        continue;
      }
      batchKeys.add(key);
      const ruleCategory = autoCategorize(row.description, rules);
      const category = ruleCategory !== 'Uncategorized'
        ? ruleCategory
        : guessCategory(row.description, categories);
      insert.run(accountId, row.date, row.description, category, row.amount, row.type, row.state);
      imported++;
    }
  })();

  return { imported, skippedDuplicates };
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

  router.get('/accounts/:id/data', requireAccount, (req, res) => {
    const transactions = db.prepare(`SELECT ${txColumns} FROM transactions WHERE account_id = ? ORDER BY date DESC, id DESC`)
      .all(req.params.id);
    const savingsAccounts = db.prepare('SELECT id, name, balance FROM savings_accounts WHERE account_id = ?')
      .all(req.params.id);
    const savingsHistory = {};
    for (const s of savingsAccounts) {
      savingsHistory[s.id] = db.prepare(
        'SELECT id, date, type, amount, timestamp FROM savings_history WHERE savings_account_id = ? ORDER BY timestamp DESC'
      ).all(s.id);
    }
    res.json({ transactions, savingsAccounts, savingsHistory });
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
    const info = db.prepare(`
      INSERT INTO transactions (account_id, date, description, category, amount, type, state)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, date || todayIso(), description, category, amount, type, state);
    const tx = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(info.lastInsertRowid);
    res.status(201).json(tx);
  });

  router.patch('/transactions/:txId', (req, res) => {
    const current = db.prepare(`SELECT ${txColumns} FROM transactions WHERE id = ?`).get(req.params.txId);
    if (!current) return res.status(404).json({ error: 'Transaction not found' });
    const { date, description, category, amount, learnRule } = req.body;
    const next = {
      date: date ?? current.date,
      description: description ?? current.description,
      category: category ?? current.category,
      amount: amount ?? current.amount,
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

  router.post('/accounts/:id/import', requireAccount, express.text({ type: '*/*', limit: '20mb' }), (req, res) => {
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

  router.post('/accounts/:id/autocategorize', requireAccount, (req, res) => {
    const rules = allRules(db);
    const uncategorized = db.prepare(
      "SELECT id, description FROM transactions WHERE account_id = ? AND category = 'Uncategorized'"
    ).all(req.params.id);
    const update = db.prepare("UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE id = ?");
    let updated = 0;
    db.transaction(() => {
      for (const t of uncategorized) {
        const category = autoCategorize(t.description, rules);
        if (category !== 'Uncategorized') {
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

  router.post('/accounts/:id/categories/rename', requireAccount, (req, res) => {
    const { from, to } = req.body;
    if (!from || !to || !to.trim()) return res.status(400).json({ error: 'from and to required' });
    let transactions = 0;
    let rules = 0;
    db.transaction(() => {
      transactions = db.prepare(
        "UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE account_id = ? AND category = ?"
      ).run(to.trim(), req.params.id, from).changes;
      rules = db.prepare('UPDATE category_rules SET category = ? WHERE category = ?').run(to.trim(), from).changes;
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
      transactions = db.prepare(
        "UPDATE transactions SET category = ?, updated_at = datetime('now') WHERE account_id = ? AND category = ?"
      ).run(replacement.trim(), req.params.id, category).changes;
      rules = db.prepare('DELETE FROM category_rules WHERE category = ?').run(category).changes;
    })();
    res.json({ transactions, rules });
  });

  // --- Savings ---

  router.post('/accounts/:id/savings', requireAccount, (req, res) => {
    const name = (req.body.name || '').trim();
    const balance = Number(req.body.balance);
    if (!name || Number.isNaN(balance) || balance < 0) {
      return res.status(400).json({ error: 'name and non-negative balance required' });
    }
    const id = `savings_${Date.now()}`;
    db.prepare('INSERT INTO savings_accounts (id, account_id, name, balance) VALUES (?, ?, ?, ?)')
      .run(id, req.params.id, name, Number(balance.toFixed(2)));
    res.status(201).json({ id, name, balance: Number(balance.toFixed(2)) });
  });

  router.patch('/savings/:sid', (req, res) => {
    const current = db.prepare('SELECT id, name, balance FROM savings_accounts WHERE id = ?').get(req.params.sid);
    if (!current) return res.status(404).json({ error: 'Savings account not found' });
    const name = req.body.name !== undefined ? String(req.body.name).trim() : current.name;
    const balance = req.body.balance !== undefined ? Number(req.body.balance) : current.balance;
    if (!name || Number.isNaN(balance) || balance < 0) {
      return res.status(400).json({ error: 'name and non-negative balance required' });
    }
    db.prepare('UPDATE savings_accounts SET name = ?, balance = ? WHERE id = ?')
      .run(name, Number(balance.toFixed(2)), req.params.sid);
    res.json({ id: current.id, name, balance: Number(balance.toFixed(2)) });
  });

  router.delete('/savings/:sid', (req, res) => {
    db.prepare('DELETE FROM savings_accounts WHERE id = ?').run(req.params.sid);
    res.status(204).end();
  });

  router.post('/savings/:sid/transactions', (req, res) => {
    const { type, amount } = req.body;
    const value = Number(amount);
    if (!['deposit', 'withdrawal'].includes(type) || Number.isNaN(value) || value <= 0) {
      return res.status(400).json({ error: 'type deposit|withdrawal and positive amount required' });
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
