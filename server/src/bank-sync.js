// Turns provider transactions into app rows and drives one bank account's sync.
// Pure helpers first (unit-testable), the DB-touching orchestration at the bottom.
import { importTransactions } from './routes/api.js';
import { todayIso } from '../../shared/dates.js';

// Re-fetch this many days before the last cursor: banks book late, and a booked row that
// was pending last time is not a duplicate of anything we stored (pending rows are skipped).
const OVERLAP_DAYS = 7;
// First sync asks for this much history; banks answer with whatever they allow.
const DEFAULT_HISTORY_DAYS = 730;
// If the bank rejects the wide window outright, this is the range every bank accepts.
const FALLBACK_HISTORY_DAYS = 89;

export function shiftDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isBooked(tx) {
  return !tx?.status || tx.status === 'BOOK';
}

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

// Counterparty first, then remittance lines that add something the counterparty did not
// already say — rules match on substrings of this, so richer is better than terse.
export function buildDescription(tx) {
  const indicator = tx.credit_debit_indicator;
  const counterparty = clean(indicator === 'DBIT' ? tx.creditor?.name : tx.debtor?.name)
    || clean(tx.creditor?.name) || clean(tx.debtor?.name);
  const remittance = Array.isArray(tx.remittance_information)
    ? tx.remittance_information
    : (tx.remittance_information ? [tx.remittance_information] : []);
  const parts = [];
  for (const raw of [counterparty, ...remittance]) {
    const part = clean(raw);
    if (!part) continue;
    const lower = part.toLowerCase();
    if (parts.some(p => p.toLowerCase().includes(lower))) continue; // already covered
    const narrower = parts.findIndex(p => lower.includes(p.toLowerCase()));
    if (narrower >= 0) parts[narrower] = part; // this one says more, keep it instead
    else parts.push(part);
  }
  if (parts.length) return parts.join(' - ');
  return clean(tx.bank_transaction_code?.description) || (indicator === 'DBIT' ? 'Debit' : 'Credit');
}

export function mapTransaction(tx, bankAccountId) {
  const raw = Number(tx?.transaction_amount?.amount);
  if (!Number.isFinite(raw)) return null;
  const indicator = tx.credit_debit_indicator;
  const signed = indicator === 'DBIT' ? -Math.abs(raw) : indicator === 'CRDT' ? Math.abs(raw) : raw;
  // transaction_date is when the user acted (what a Revolut CSV calls "Started Date");
  // booking_date is when the bank posted it. Prefer the former for continuity with CSV imports.
  const date = String(tx.transaction_date || tx.booking_date || tx.value_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ref = clean(tx.entry_reference || tx.transaction_id);
  const code = tx.bank_transaction_code;
  return {
    date,
    description: buildDescription(tx),
    amount: Math.round(signed * 100) / 100,
    type: clean(code?.description || code?.code || indicator || ''),
    state: 'COMPLETED',
    externalId: ref ? `${bankAccountId}:${ref}` : null,
  };
}

export function syncWindow(bankAccount, today = todayIso()) {
  let from = bankAccount.synced_to
    ? shiftDays(bankAccount.synced_to, -OVERLAP_DAYS)
    : shiftDays(today, -DEFAULT_HISTORY_DAYS);
  if (bankAccount.sync_from && from < bankAccount.sync_from) from = bankAccount.sync_from;
  if (from > today) from = today;
  return { from, to: today };
}

function retryable(err, from, fallback) {
  return Boolean(err?.status) && err.status < 500 && err.code !== 'ASPSP_RATE_LIMIT_EXCEEDED' && from < fallback;
}

export async function syncBankAccount(db, client, bankAccount, { psu, today = todayIso() } = {}) {
  const { from, to } = syncWindow(bankAccount, today);
  const setStatus = db.prepare('UPDATE bank_accounts SET last_sync_at = ?, last_sync_status = ? WHERE id = ?');
  try {
    let raw;
    try {
      raw = await client.fetchTransactions(bankAccount.uid, { dateFrom: from, dateTo: to, psu });
    } catch (err) {
      const fallback = shiftDays(today, -FALLBACK_HISTORY_DAYS);
      if (!retryable(err, from, fallback)) throw err;
      raw = await client.fetchTransactions(bankAccount.uid, { dateFrom: fallback, dateTo: to, psu });
    }
    const rows = raw.filter(isBooked).map(tx => mapTransaction(tx, bankAccount.id)).filter(Boolean);
    const result = importTransactions(db, bankAccount.account_id, rows, { source: 'bank' });
    db.prepare('UPDATE bank_accounts SET synced_to = ?, last_sync_at = ?, last_sync_status = ? WHERE id = ?')
      .run(to, new Date().toISOString(), 'ok', bankAccount.id);
    return { bankAccountId: bankAccount.id, fetched: raw.length, ...result };
  } catch (err) {
    const message = err.code === 'ASPSP_RATE_LIMIT_EXCEEDED'
      ? 'Bank rate limit reached, try again in a few hours'
      : String(err.message || err).slice(0, 200);
    setStatus.run(new Date().toISOString(), `error: ${message}`, bankAccount.id);
    return { bankAccountId: bankAccount.id, fetched: 0, imported: 0, skippedDuplicates: 0, error: message };
  }
}

// Every enabled, mapped account (optionally one connection's). One failing account is
// reported in its result rather than aborting the rest.
export async function syncAll(db, client, { connectionId, psu, today } = {}) {
  const rows = db.prepare(`
    SELECT id, uid, account_id, sync_from, synced_to FROM bank_accounts
    WHERE enabled = 1 AND account_id IS NOT NULL ${connectionId ? 'AND connection_id = ?' : ''}
    ORDER BY rowid
  `).all(...(connectionId ? [connectionId] : []));
  const results = [];
  for (const row of rows) results.push(await syncBankAccount(db, client, row, { psu, today }));
  return results;
}
