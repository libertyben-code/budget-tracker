// Manual-testing harness: a fake Enable Banking on one port and the real app on another,
// with a throwaway database and key. Lets you click through link → bank page → callback →
// sync without credentials or a real bank.
//
//   node server/tools/dev-harness.mjs        # app on http://localhost:3055, mock on :4545
//
// Lives outside test/ so `npm test` does not pick it up.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

const MOCK_PORT = Number(process.env.MOCK_PORT || 4545);
const APP_PORT = Number(process.env.PORT || 3055);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-dev-'));
const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyPath = path.join(dir, 'app.pem');
fs.writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));

// ---- fake provider ---------------------------------------------------------------------

const MERCHANTS = [
  ['CARREFOUR MARKET', 'DBIT', 45.2], ['SNCF CONNECT', 'DBIT', 32], ['NETFLIX', 'DBIT', 13.49],
  ['BOULANGERIE PAUL', 'DBIT', 4.8], ['TOTAL ENERGIES', 'DBIT', 61.3], ['PHARMACIE DU CENTRE', 'DBIT', 18.9],
  ['ACME SARL', 'CRDT', 2500], ['UBER EATS', 'DBIT', 27.5], ['EDF', 'DBIT', 74], ['AMAZON EU', 'DBIT', 39.99],
];

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function transactionsFor(uid) {
  const out = [];
  const seed = uid.startsWith('uid-A') ? 0 : 5;
  for (let i = 0; i < 24; i++) {
    const [name, indicator, amount] = MERCHANTS[(i + seed) % MERCHANTS.length];
    const date = isoDaysAgo(i * 2 + (seed ? 1 : 0));
    out.push({
      transaction_id: `${uid.slice(0, 5)}-${i}`,
      entry_reference: `${uid.slice(0, 5)}-${i}`,
      transaction_amount: { amount: amount.toFixed(2), currency: uid.startsWith('uid-A') ? 'EUR' : 'GBP' },
      credit_debit_indicator: indicator,
      status: i === 0 ? 'PENDING' : 'BOOK',
      booking_date: date,
      transaction_date: date,
      [indicator === 'DBIT' ? 'creditor' : 'debtor']: { name },
      remittance_information: indicator === 'CRDT' ? ['SALAIRE'] : [`${name} PARIS`],
      bank_transaction_code: { description: indicator === 'CRDT' ? 'Transfer' : 'Card payment' },
    });
  }
  return out;
}

const mock = express();
mock.use(express.json());
mock.use((req, res, next) => {
  if (req.path === '/authorize') return next();
  const [, header] = /^Bearer ([^.]+)\./.exec(req.headers.authorization || '') || [];
  if (!header || JSON.parse(Buffer.from(header, 'base64url')).kid !== 'app-dev') {
    return res.status(401).json({ code: 'UNAUTHORIZED', message: 'bad jwt' });
  }
  console.log(`[mock] ${req.method} ${req.originalUrl}${req.headers['psu-ip-address'] ? ' (psu present)' : ''}`);
  next();
});
mock.get('/aspsps', (req, res) => {
  res.json({ aspsps: [
    { name: 'Revolut', country: req.query.country, psu_types: ['personal', 'business'], maximum_consent_validity: 90 * 86400 },
    { name: 'Crédit Agricole', country: req.query.country, psu_types: ['personal'], maximum_consent_validity: 180 * 86400 },
    { name: 'BNP Paribas', country: req.query.country, psu_types: ['personal'], maximum_consent_validity: 180 * 86400 },
  ] });
});
mock.post('/auth', (req, res) => {
  const q = new URLSearchParams({ state: req.body.state, redirect: req.body.redirect_url, bank: req.body.aspsp.name });
  res.json({ url: `http://127.0.0.1:${MOCK_PORT}/authorize?${q}`, authorization_id: crypto.randomUUID() });
});
mock.get('/authorize', (req, res) => {
  const { state, redirect, bank } = req.query;
  const ok = `${redirect}?${new URLSearchParams({ code: 'good-code', state })}`;
  const no = `${redirect}?${new URLSearchParams({ error: 'access_denied', error_description: 'User refused', state })}`;
  res.send(`<!doctype html><html><body style="font-family:sans-serif;max-width:480px;margin:60px auto">
    <h1>${bank} (mock)</h1><p><b>Budget Tracker</b> asks to read your accounts and transactions for 90 days.</p>
    <p><a href="${ok}" style="padding:10px 16px;background:#1a7f4b;color:#fff;border-radius:6px;text-decoration:none">Approve</a>
       &nbsp; <a href="${no}">Deny</a></p></body></html>`);
});
let sessions = 0;
mock.post('/sessions', (req, res) => {
  if (req.body.code !== 'good-code') return res.status(400).json({ code: 'INVALID_CODE', message: 'bad code' });
  const n = ++sessions;
  res.json({
    session_id: `sess-${n}`,
    accounts: [
      { uid: `uid-A-${n}`, account_id: { iban: 'FR7612345678901234567890123' }, currency: 'EUR', name: 'Revolut EUR', identification_hash: 'hash-eur' },
      { uid: `uid-B-${n}`, account_id: { iban: 'GB29REVO00997012345678' }, currency: 'GBP', name: 'Revolut GBP', identification_hash: 'hash-gbp' },
    ],
    aspsp: { name: 'Revolut', country: 'FR' },
    psu_type: 'personal',
    access: { valid_until: new Date(Date.now() + 90 * 86400000).toISOString() },
  });
});
mock.get('/accounts/:uid/transactions', (req, res) => {
  const from = req.query.date_from || '0000-00-00';
  const all = transactionsFor(req.params.uid).filter(t => t.booking_date >= from);
  const page = req.query.continuation_key ? all.slice(10) : all.slice(0, 10);
  res.json({ transactions: page, continuation_key: !req.query.continuation_key && all.length > 10 ? 'p2' : undefined });
});
mock.delete('/sessions/:id', (req, res) => res.json({ message: 'OK' }));
mock.listen(MOCK_PORT, '127.0.0.1', () => console.log(`[mock] Enable Banking stand-in on http://127.0.0.1:${MOCK_PORT}`));

// ---- the real app, pointed at the fake -----------------------------------------------

process.env.PORT = String(APP_PORT);
process.env.HOST = '127.0.0.1';
process.env.DB_PATH = path.join(dir, 'budget.db');
process.env.EB_APP_ID = 'app-dev';
process.env.EB_PRIVATE_KEY_FILE = keyPath;
process.env.EB_API_BASE = `http://127.0.0.1:${MOCK_PORT}`;
delete process.env.EB_REDIRECT_URL;
await import('../src/index.js');
