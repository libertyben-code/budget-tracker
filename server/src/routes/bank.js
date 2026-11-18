import crypto from 'node:crypto';
import express from 'express';
import { ApiError } from '../enablebanking.js';
import { syncAll } from '../bank-sync.js';
import { requireSession } from '../middleware/auth.js';

const LINK_TTL_MS = 15 * 60 * 1000;
const MAX_CONSENT_SECONDS = 180 * 24 * 3600; // PSD2 ceiling; banks may allow less

// The OAuth-style `state` handed to the provider maps back to what the user chose in the
// link form. In-memory is enough: the server is a single process and a link is a minute's work.
const pendingLinks = new Map();

function rememberLink(details) {
  for (const [key, value] of pendingLinks) {
    if (Date.now() - value.createdAt > LINK_TTL_MS) pendingLinks.delete(key);
  }
  const state = crypto.randomUUID();
  pendingLinks.set(state, { ...details, createdAt: Date.now() });
  return state;
}

function psuFromRequest(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = (forwarded || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const userAgent = req.headers['user-agent'] || '';
  return ip && userAgent ? { ip, userAgent } : null;
}

// Explicit config wins; otherwise derive from the request so the same build works on the
// tailnet (behind `tailscale serve`, which forwards proto and host) and on localhost.
function redirectUrlFor(req, config) {
  if (config.redirectUrl) return config.redirectUrl;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/bank/callback`;
}

function rfc3339(msFromNow) {
  return new Date(Date.now() + msFromNow).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function bankAccountRows(db, connectionId) {
  return db.prepare(`
    SELECT id, uid, iban, name, currency, kind, account_id AS accountId, savings_account_id AS savingsAccountId,
           enabled, sync_from AS syncFrom, synced_to AS syncedTo, last_sync_at AS lastSyncAt,
           last_sync_status AS lastSyncStatus
    FROM bank_accounts WHERE connection_id = ? ORDER BY rowid
  `).all(connectionId).map(r => ({ ...r, enabled: Boolean(r.enabled) }));
}

function statusPayload(db, config, req) {
  const ws = req.user.workspaceId;
  const connections = db.prepare(`
    SELECT id, provider, aspsp_name AS aspspName, aspsp_country AS country, psu_type AS psuType,
           valid_until AS validUntil, created_at AS createdAt
    FROM bank_connections WHERE workspace_id = ? ORDER BY created_at
  `).all(ws).map(c => ({ ...c, accounts: bankAccountRows(db, c.id) }));
  // every savings account, so the panel can offer them as targets
  const savingsAccounts = db.prepare('SELECT id, name, balance FROM savings_accounts WHERE workspace_id = ? ORDER BY name').all(ws);
  return {
    configured: config.configured,
    redirectUrl: config.configured ? redirectUrlFor(req, config) : '',
    connections,
    savingsAccounts,
  };
}

// A bank that leaves the currency blank (or says XXX, "no currency") is taken to match.
function sameCurrency(bankCurrency, budgetCurrency) {
  return !bankCurrency || bankCurrency === 'XXX' || bankCurrency.toUpperCase() === budgetCurrency;
}

// Reuses a budget account of that name and currency, so linking again after an unlink lands
// the rows where they went before (where the provider ids dedupe them) rather than in a copy.
function budgetAccountFor(db, ws, name, currency) {
  const existing = db.prepare('SELECT id FROM accounts WHERE name = ? AND currency = ? AND workspace_id = ?').get(name, currency, ws);
  if (existing) return { id: existing.id, created: false };
  const id = `account_${crypto.randomUUID()}`;
  db.prepare('INSERT INTO accounts (id, name, currency, workspace_id) VALUES (?, ?, ?, ?)').run(id, name, currency, ws);
  return { id, created: true };
}

const OWN_CONNECTION = 'connection_id IN (SELECT id FROM bank_connections WHERE workspace_id = ?)';

// Upserts by the provider's stable account hash: a renewal re-points existing rows at the new
// session and keeps their mapping and cursor; anything newly exposed gets a first target.
// Connections left with no accounts are stale and dropped. The hash is one row for the whole
// server, so an account another household already linked is left with them, untouched.
function storeSession(db, session, link) {
  const ws = link.workspaceId;
  const connectionId = crypto.randomUUID();
  const orphaned = [];
  const created = [];
  const bankName = session.aspsp?.name || link.aspspName;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO bank_connections (id, session_id, aspsp_name, aspsp_country, psu_type, valid_until, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      connectionId,
      session.session_id,
      bankName,
      session.aspsp?.country || link.country,
      session.psu_type || link.psuType,
      session.access?.valid_until || '',
      ws
    );
    const update = db.prepare(
      `UPDATE bank_accounts SET connection_id = ?, uid = ?, iban = ?, name = ?, currency = ?, kind = ? WHERE id = ? AND ${OWN_CONNECTION}`
    );
    const insert = db.prepare(`
      INSERT INTO bank_accounts (id, connection_id, account_id, uid, iban, name, currency, kind, enabled, sync_from)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);
    const accounts = (session.accounts || []).map(acc => ({
      acc,
      id: acc.identification_hash || acc.account_id?.iban || acc.uid,
    }));
    const known = db.prepare(`SELECT id FROM bank_accounts WHERE id = ? AND ${OWN_CONNECTION}`);
    const elsewhere = db.prepare(`SELECT id FROM bank_accounts WHERE id = ? AND NOT ${OWN_CONNECTION}`);
    const renewal = accounts.some(a => known.get(a.id, ws));
    const budgetCurrency = db.prepare('SELECT currency FROM accounts WHERE id = ?').get(link.accountId).currency;
    for (const { acc, id } of accounts) {
      const iban = acc.account_id?.iban || '';
      const name = acc.name || acc.product || '';
      const currency = (acc.currency || '').toUpperCase();
      const kind = acc.cash_account_type || '';
      if (elsewhere.get(id, ws)) continue;
      if (update.run(connectionId, acc.uid, iban, name, currency, kind, id, ws).changes === 0) {
        // Starts unmapped when it is a savings-type account (a livret, a pocket: its movements
        // do not belong in the budget's transactions) or when it is new on a renewed consent
        // (the user ticked more accounts at the bank; where they go is their call, and a
        // pocket's internal transfers imported as spending would double-count). Only a first
        // link maps current accounts: into the chosen budget account when the currency
        // matches; otherwise its amounts would be summed as the wrong currency, so it gets a
        // budget account of its own if the user asked for that, else stays unmapped.
        let target = null;
        let syncFrom = link.syncFrom || null;
        if (kind !== 'SVGS' && !renewal) {
          if (sameCurrency(currency, budgetCurrency)) {
            target = link.accountId;
          } else if (link.otherCurrencies === 'import') {
            const own = budgetAccountFor(db, ws, `${bankName} ${currency}`, currency);
            target = own.id;
            if (own.created) created.push(own.id);
            syncFrom = null; // the cutover was picked against the chosen account's rows
          }
        }
        insert.run(id, connectionId, target, acc.uid, iban, name, currency, kind, syncFrom);
      }
    }
    const stale = 'SELECT id FROM bank_connections WHERE workspace_id = ? AND id NOT IN (SELECT DISTINCT connection_id FROM bank_accounts)';
    orphaned.push(...db.prepare(`SELECT id, session_id AS sessionId FROM bank_connections WHERE id IN (${stale})`).all(ws));
    db.prepare(`DELETE FROM bank_connections WHERE id IN (${stale})`).run(ws);
  })();
  return { connectionId, orphaned, created };
}

function redirectWith(res, params) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  res.redirect(302, `/?${query}`);
}

export function createBankRouter(db, { config, client }) {
  const router = express.Router();
  const session = requireSession(db);
  // The bank's redirect may land in a browser that holds no session (not the installed app), so
  // the callback is reached without one: the link's `state`, made behind a login, names the household.
  router.use((req, res, next) => (req.method === 'GET' && req.path === '/callback' ? next() : session(req, res, next)));

  router.get('/status', (req, res) => {
    res.json(statusPayload(db, config, req));
  });

  if (!config.configured || !client) {
    router.use((req, res) => res.status(503).json({ error: 'Bank sync is not configured on the server' }));
    return router;
  }

  router.get('/aspsps', async (req, res) => {
    const country = String(req.query.country || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return res.status(400).json({ error: 'country must be a two-letter code' });
    const data = await client.listAspsps(country);
    const aspsps = (data?.aspsps || [])
      .map(a => ({
        name: a.name,
        country: a.country,
        logo: a.logo || '',
        psuTypes: Array.isArray(a.psu_types) && a.psu_types.length ? a.psu_types : ['personal'],
        maxConsentDays: a.maximum_consent_validity ? Math.floor(a.maximum_consent_validity / 86400) : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ aspsps });
  });

  router.post('/link', async (req, res) => {
    const aspspName = String(req.body.aspspName || '').trim();
    const country = String(req.body.country || '').toUpperCase();
    const psuType = req.body.psuType === 'business' ? 'business' : 'personal';
    const accountId = String(req.body.accountId || '');
    const syncFrom = String(req.body.syncFrom || '').slice(0, 10);
    const language = /^[a-z]{2}$/.test(req.body.language || '') ? req.body.language : undefined;
    const otherCurrencies = req.body.otherCurrencies === 'skip' ? 'skip' : 'import';
    if (!aspspName || !/^[A-Z]{2}$/.test(country)) return res.status(400).json({ error: 'aspspName and country required' });
    const ws = req.user.workspaceId;
    if (!db.prepare('SELECT id FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, ws)) return res.status(400).json({ error: 'Unknown budget account' });
    if (syncFrom && !/^\d{4}-\d{2}-\d{2}$/.test(syncFrom)) return res.status(400).json({ error: 'syncFrom must be YYYY-MM-DD' });

    const listed = (await client.listAspsps(country))?.aspsps?.find(a => a.name === aspspName);
    if (!listed) return res.status(400).json({ error: `Bank "${aspspName}" is not available in ${country}` });
    const validitySeconds = Math.min(Number(listed.maximum_consent_validity) || MAX_CONSENT_SECONDS, MAX_CONSENT_SECONDS);

    const redirectUrl = redirectUrlFor(req, config);
    const state = rememberLink({ workspaceId: ws, aspspName, country, psuType, accountId, syncFrom, otherCurrencies });
    const auth = await client.startAuth({
      access: { valid_until: rfc3339(validitySeconds * 1000) },
      aspsp: { name: aspspName, country },
      state,
      redirect_url: redirectUrl,
      psu_type: psuType,
      ...(language ? { language } : {}),
    });
    res.json({ url: auth.url, redirectUrl });
  });

  // The bank sends the browser back here. Always answers with a redirect into the app: the
  // outcome travels in the query string, and the client opens the panel on it.
  router.get('/callback', async (req, res) => {
    const state = String(req.query.state || '');
    const link = pendingLinks.get(state);
    if (!link || Date.now() - link.createdAt > LINK_TTL_MS) return redirectWith(res, { bank: 'error', reason: 'expired' });
    pendingLinks.delete(state);
    if (req.query.error) {
      return redirectWith(res, { bank: 'error', reason: String(req.query.error_description || req.query.error).slice(0, 120) });
    }
    const code = String(req.query.code || '');
    if (!code) return redirectWith(res, { bank: 'error', reason: 'missing code' });

    let session;
    try {
      session = await client.createSession(code);
    } catch (err) {
      return redirectWith(res, { bank: 'error', reason: String(err.message || err).slice(0, 120) });
    }
    const { connectionId, orphaned, created } = storeSession(db, session, link);
    for (const old of orphaned) client.deleteSession(old.sessionId).catch(() => {});

    // Some banks (Revolut) only expose full history in the first minutes after consent —
    // the initial fetch has to happen here, not on a later button press.
    const results = await syncAll(db, client, { workspaceId: link.workspaceId, connectionId, psu: psuFromRequest(req) });
    const summary = {
      connection: connectionId,
      created,
      accounts: results.map(r => ({
        id: r.bankAccountId,
        imported: r.imported || 0,
        skipped: r.skippedDuplicates || 0,
        ...(r.error ? { error: r.error } : {}),
      })),
    };
    redirectWith(res, { bank: 'linked', summary: JSON.stringify(summary) });
  });

  router.post('/sync', async (req, res) => {
    const connectionId = req.body?.connectionId ? String(req.body.connectionId) : undefined;
    const bankAccountId = req.body?.bankAccountId ? String(req.body.bankAccountId) : undefined;
    const results = await syncAll(db, client, { workspaceId: req.user.workspaceId, connectionId, bankAccountId, psu: psuFromRequest(req) });
    res.json({ results, status: statusPayload(db, config, req) });
  });

  router.patch('/accounts/:id', (req, res) => {
    const ws = req.user.workspaceId;
    const current = db.prepare(`SELECT id, name, currency, account_id, savings_account_id, enabled, sync_from FROM bank_accounts WHERE id = ? AND ${OWN_CONNECTION}`)
      .get(req.params.id, ws);
    if (!current) return res.status(404).json({ error: 'Bank account not found' });
    const { accountId, savingsAccountId, enabled, syncFrom } = req.body;
    // A bank account feeds either a budget account (transactions) or a savings account
    // (balance + history), never both; setting one clears the other.
    let nextAccount = current.account_id;
    let nextSavings = current.savings_account_id;
    if (accountId !== undefined) {
      const target = accountId ? db.prepare('SELECT id, name, currency FROM accounts WHERE id = ? AND workspace_id = ?').get(accountId, ws) : null;
      if (accountId && !target) return res.status(400).json({ error: 'Unknown budget account' });
      if (target && target.id !== current.account_id && !sameCurrency(current.currency, target.currency)) {
        return res.status(400).json({
          error: `${current.name || 'This bank account'} is in ${current.currency}, ${target.name} is in ${target.currency}`,
        });
      }
      nextAccount = accountId || null;
      if (nextAccount) nextSavings = null;
    }
    if (savingsAccountId !== undefined) {
      if (savingsAccountId && !db.prepare('SELECT id FROM savings_accounts WHERE id = ? AND workspace_id = ?').get(savingsAccountId, ws)) {
        return res.status(400).json({ error: 'Unknown savings account' });
      }
      nextSavings = savingsAccountId || null;
      if (nextSavings) nextAccount = null;
    }
    let nextFrom = current.sync_from;
    if (syncFrom !== undefined) {
      const value = String(syncFrom || '').slice(0, 10);
      if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return res.status(400).json({ error: 'syncFrom must be YYYY-MM-DD' });
      nextFrom = value || null;
    }
    let moved = 0;
    db.transaction(() => {
      db.prepare('UPDATE bank_accounts SET account_id = ?, savings_account_id = ?, enabled = ?, sync_from = ? WHERE id = ?')
        .run(nextAccount, nextSavings, enabled === undefined ? current.enabled : (enabled ? 1 : 0), nextFrom, current.id);
      // a new savings target wants the history from the cutover, not just the last week
      if (nextSavings && nextSavings !== current.savings_account_id) {
        db.prepare('UPDATE bank_accounts SET synced_to = NULL WHERE id = ?').run(current.id);
      }
      // A bank account's rows are recognisable by their external_id prefix, so re-mapping it
      // carries what was already imported along rather than stranding it in the old account.
      if (nextAccount && nextAccount !== current.account_id) {
        const prefix = `${current.id}:`;
        moved = db.prepare(`
          UPDATE transactions SET account_id = ?, updated_at = datetime('now')
          WHERE external_id IS NOT NULL AND substr(external_id, 1, ?) = ? AND account_id != ?
            AND account_id IN (SELECT id FROM accounts WHERE workspace_id = ?)
            AND NOT EXISTS (SELECT 1 FROM transactions t2 WHERE t2.account_id = ? AND t2.external_id = transactions.external_id)
        `).run(nextAccount, prefix.length, prefix, nextAccount, ws, nextAccount).changes;
      }
    })();
    res.json({ ...statusPayload(db, config, req), moved });
  });

  router.delete('/connections/:id', async (req, res) => {
    const conn = db.prepare('SELECT id, session_id AS sessionId FROM bank_connections WHERE id = ? AND workspace_id = ?')
      .get(req.params.id, req.user.workspaceId);
    if (!conn) return res.status(404).json({ error: 'Connection not found' });
    await client.deleteSession(conn.sessionId, psuFromRequest(req)).catch(() => {});
    db.prepare('DELETE FROM bank_connections WHERE id = ?').run(conn.id);
    res.status(204).end();
  });

  // Provider failures surface as a gateway error carrying the provider's message; anything
  // else is ours.
  router.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof ApiError) {
      return res.status(502).json({ error: `Enable Banking: ${err.message}`, code: err.code || undefined });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });

  return router;
}
