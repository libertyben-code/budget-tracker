import { esc, icons, toast, confirmDialog } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { loadAccount } from '../app.js';
import { isoToDisplay } from '/shared/dates.js';

const COUNTRIES = ['FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'LU', 'PT', 'IE', 'AT', 'LT', 'GB'];
const EXPIRY_WARNING_DAYS = 14;

function daysLeft(validUntil) {
  const ms = Date.parse(validUntil);
  return Number.isFinite(ms) ? Math.ceil((ms - Date.now()) / 86400000) : null;
}

export async function loadStatus() {
  try {
    setUi({ bankStatus: await api.bankStatus() });
  } catch (err) {
    toast(err.message);
  }
}

async function loadAspsps(country) {
  setUi({ bankAspsps: null, bankAspspsCountry: country });
  try {
    const { aspsps } = await api.bankAspsps(country);
    if (get().ui.bankCountry === country) setUi({ bankAspsps: aspsps });
  } catch (err) {
    setUi({ bankAspsps: [] });
    toast(err.message);
  }
}

// Only the active account's transactions are loaded, so the default cutover is only known
// for that one; anything else starts empty and the hint explains what to type.
function latestTxDate(state, accountId) {
  if (accountId !== state.activeAccountId) return '';
  return state.transactions.reduce((max, t) => (t.date > max ? t.date : max), '');
}

function consentChip(conn, t) {
  const days = daysLeft(conn.validUntil);
  if (days === null) return '';
  if (days <= 0) return `<span class="chip danger">${esc(t('bank.consentExpired'))}</span>`;
  const cls = days <= EXPIRY_WARNING_DAYS ? 'warning' : 'ok';
  return `<span class="chip ${cls}" title="${esc(t('bank.consentUntil', { date: isoToDisplay(conn.validUntil.slice(0, 10)) }))}">${esc(t('bank.consentDays', { days }))}</span>`;
}

function targetSelect(acc, state, t) {
  const savings = state.ui.bankStatus?.savingsAccounts || [];
  const target = acc.savingsAccountId ? `savings:${acc.savingsAccountId}` : acc.accountId ? `account:${acc.accountId}` : '';
  const opt = (value, label) => `<option value="${esc(value)}" ${value === target ? 'selected' : ''}>${esc(label)}</option>`;
  return `
      <select data-action-change="bank-map-target" data-id="${esc(acc.id)}">
        ${opt('', t('bank.notSynced'))}
        <optgroup label="${esc(t('bank.accountsGroup'))}">
          ${state.accounts.map(a => opt(`account:${a.id}`, a.name)).join('')}
          <option value="__new__">${esc(t('bank.newAccount'))}</option>
        </optgroup>
        <optgroup label="${esc(t('bank.savingsGroup'))}">
          ${savings.map(s => opt(`savings:${s.id}`, s.name)).join('')}
          <option value="__newsavings__">${esc(t('bank.newSavings'))}</option>
        </optgroup>
      </select>`;
}

function inlineCreate(acc, t, { inputId, placeholder, action }) {
  return `
    <div class="controls">
      <input id="${inputId}" class="grow" placeholder="${esc(placeholder)}" data-action-key="${action}" data-id="${esc(acc.id)}">
      <button class="btn small primary" data-action="${action}" data-id="${esc(acc.id)}">${esc(t('common.save'))}</button>
      <button class="btn small" data-action="bank-cancel-new-account">${esc(t('common.cancel'))}</button>
    </div>`;
}

function accountRow(acc, state, t) {
  const last = acc.lastSyncAt
    ? t('bank.lastSync', { date: new Date(acc.lastSyncAt).toLocaleString(state.ui.lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) })
    : t('bank.never');
  const failed = acc.lastSyncStatus && acc.lastSyncStatus !== 'ok';
  const kind = acc.kind === 'SVGS' ? ` <span class="chip">${esc(t('bank.kindSavings'))}</span>` : '';
  return `
  <div class="bank-acct ${acc.enabled ? '' : 'off'}">
    <div class="grow">
      <div><strong>${esc(acc.name || acc.iban || acc.id)}</strong> <span class="muted">${esc(acc.currency === 'XXX' ? '' : acc.currency)}</span>${kind}</div>
      ${acc.iban && acc.name ? `<div class="muted small">${esc(acc.iban)}</div>` : ''}
      <div class="muted small">${esc(last)}${failed ? ` · <span class="danger-text">${esc(acc.lastSyncStatus)}</span>` : ''}</div>
    </div>
    <button class="check-box-btn ${acc.enabled ? 'on' : ''}" data-action="bank-toggle-enabled" data-id="${esc(acc.id)}"
            role="checkbox" aria-checked="${acc.enabled}" title="${esc(t('bank.enabled'))}" aria-label="${esc(t('bank.enabled'))}">
      <span class="check-box">${icons.check}</span>
    </button>
    ${state.ui.bankNewAccountFor === acc.id
      ? inlineCreate(acc, t, { inputId: 'bank-new-account-name', placeholder: t('header.accountName'), action: 'bank-create-account' })
      : state.ui.bankNewSavingsFor === acc.id
        ? inlineCreate(acc, t, { inputId: 'bank-new-savings-name', placeholder: t('bank.savingsName'), action: 'bank-create-savings' })
        : `
    <div class="controls">
      <label class="muted small">${esc(t('bank.target'))}</label>
      ${targetSelect(acc, state, t)}
      <label class="muted small">${esc(t('bank.syncFrom'))}</label>
      <input type="date" value="${esc(acc.syncFrom || '')}" data-action-change="bank-sync-from" data-id="${esc(acc.id)}">
    </div>`}
  </div>`;
}

function connectionCard(conn, state, t) {
  const busy = state.ui.bankBusy;
  return `
  <div class="card bank-conn">
    <div class="row">
      <div class="grow">
        <strong>${esc(conn.aspspName)}</strong>
        <span class="muted">${esc(conn.country)} · ${esc(t(`bank.${conn.psuType === 'business' ? 'business' : 'personal'}`))}</span>
      </div>
      ${consentChip(conn, t)}
    </div>
    ${conn.accounts.map(acc => accountRow(acc, state, t)).join('')}
    <div class="row">
      <button class="btn small primary" data-action="bank-sync" data-id="${esc(conn.id)}" ${busy ? 'disabled' : ''}>${icons.repeat} ${esc(t(busy ? 'bank.syncing' : 'bank.syncNow'))}</button>
      <button class="btn small" data-action="bank-renew" data-id="${esc(conn.id)}" ${busy ? 'disabled' : ''}>${esc(t('bank.renew'))}</button>
      <button class="btn small danger" data-action="bank-unlink" data-id="${esc(conn.id)}" data-name="${esc(conn.aspspName)}" ${busy ? 'disabled' : ''}>${esc(t('bank.unlink'))}</button>
    </div>
  </div>`;
}

function linkForm(state, t) {
  const ui = state.ui;
  const aspsps = ui.bankAspsps;
  const selected = aspsps?.find(a => a.name === ui.bankLinkAspsp);
  const psuChoice = selected && selected.psuTypes.length > 1;
  return `
  <div class="card bank-link">
    <h3>${esc(t('bank.linkBank'))}</h3>
    <div class="field">
      <label>${esc(t('bank.country'))}</label>
      <select data-action-change="bank-country">
        ${COUNTRIES.map(c => `<option value="${c}" ${c === ui.bankCountry ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>${esc(t('bank.bank'))}</label>
      <select data-action-change="bank-link-aspsp" ${aspsps ? '' : 'disabled'}>
        <option value="">${esc(t(aspsps ? 'bank.chooseBank' : 'bank.loadingBanks'))}</option>
        ${(aspsps || []).map(a => `<option value="${esc(a.name)}" ${a.name === ui.bankLinkAspsp ? 'selected' : ''}>${esc(a.name)}${a.maxConsentDays ? ` (${esc(t('bank.maxConsent', { days: a.maxConsentDays }))})` : ''}</option>`).join('')}
      </select>
    </div>
    ${psuChoice ? `
    <div class="field">
      <label>${esc(t('bank.accountType'))}</label>
      <select data-action-change="bank-link-psu-type">
        ${selected.psuTypes.map(p => `<option value="${esc(p)}" ${p === ui.bankLinkPsuType ? 'selected' : ''}>${esc(t(`bank.${p === 'business' ? 'business' : 'personal'}`))}</option>`).join('')}
      </select>
    </div>` : ''}
    <div class="field">
      <label>${esc(t('bank.budgetAccount'))}</label>
      <select data-action-change="bank-link-account">
        ${state.accounts.map(a => `<option value="${esc(a.id)}" ${a.id === ui.bankLinkAccountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>${esc(t('bank.syncFrom'))}</label>
      <input type="date" value="${esc(ui.bankLinkSyncFrom)}" data-action-change="bank-link-sync-from">
      <div class="muted small">${esc(t('bank.syncFromHint'))}</div>
    </div>
    <div class="row">
      <button class="btn primary" data-action="bank-connect" ${ui.bankLinkAspsp && !ui.bankBusy ? '' : 'disabled'}>${esc(t(ui.bankBusy ? 'bank.redirecting' : 'bank.connect'))}</button>
      <button class="btn" data-action="bank-toggle-link">${esc(t('common.cancel'))}</button>
    </div>
  </div>`;
}

export function render(state, t) {
  if (state.ui.panel !== 'bank') return '';
  const status = state.ui.bankStatus;
  let body;
  if (!status) {
    body = `<p class="muted">${esc(t('bank.loading'))}</p>`;
  } else if (!status.configured) {
    body = `<div class="banner warning"><div class="grow">${esc(t('bank.notConfigured'))}</div></div>`;
  } else {
    body = `
      ${status.connections.map(c => connectionCard(c, state, t)).join('') || `<p class="muted">${esc(t('bank.noConnections'))}</p>`}
      ${state.ui.bankLinkOpen
        ? linkForm(state, t)
        : `<button class="btn primary" data-action="bank-toggle-link">＋ ${esc(t('bank.linkBank'))}</button>`}
      <p class="muted small" style="margin-top:12px">${esc(t('bank.redirectHint', { url: status.redirectUrl }))}</p>`;
  }

  return `
  <div class="modal-backdrop" data-action="close-panel" data-self-only>
    <div class="modal">
      <div class="modal-head">
        <h2 style="margin:0">${esc(t('bank.title'))}</h2>
        <button class="icon-btn" data-action="close-panel">✕</button>
      </div>
      <p class="muted">${esc(t('bank.subtitle'))}</p>
      ${body}
    </div>
  </div>`;
}

function summarize(results, t) {
  const imported = results.reduce((n, r) => n + (r.imported || 0), 0);
  const skipped = results.reduce((n, r) => n + (r.skippedDuplicates || 0), 0);
  const savings = results.filter(r => r.mode === 'savings' && !r.error).length;
  const failed = results.filter(r => r.error);
  let message = t('bank.syncResult', { imported, skipped });
  if (savings) message += `, ${t('bank.savingsSynced', { count: savings })}`;
  if (failed.length) message += ` — ${t('bank.syncFailed', { count: failed.length, message: failed[0].error })}`;
  return message;
}

// patch: { accountId } or { savingsAccountId } (either may be null to unmap)
async function remap(bankAccountId, patch, t) {
  const status = await api.bankPatchAccount(bankAccountId, patch);
  setUi({ bankStatus: status, bankNewAccountFor: null, bankNewSavingsFor: null });
  if (status.moved) toast(t('bank.moved', { count: status.moved }));
  await loadAccount(get().activeAccountId);
}

function bankAccount(id) {
  return get().ui.bankStatus?.connections.flatMap(c => c.accounts).find(a => a.id === id);
}

async function startLink(payload) {
  setUi({ bankBusy: true });
  try {
    const { url } = await api.bankLink(payload);
    window.location.assign(url);
  } catch (err) {
    setUi({ bankBusy: false });
    throw err;
  }
}

export const actions = {
  'open-bank-sync': () => {
    setUi({ settingsOpen: false, panel: 'bank', bankLinkOpen: false, bankBusy: false });
    loadStatus();
  },
  'bank-toggle-link': () => {
    const state = get();
    const open = !state.ui.bankLinkOpen;
    const accountId = state.activeAccountId;
    setUi({
      bankLinkOpen: open,
      bankLinkAspsp: '',
      bankLinkPsuType: 'personal',
      bankLinkAccountId: accountId,
      bankLinkSyncFrom: latestTxDate(state, accountId),
    });
    if (open && state.ui.bankAspspsCountry !== state.ui.bankCountry) loadAspsps(state.ui.bankCountry);
  },
  'bank-country': (el) => {
    setUi({ bankCountry: el.value, bankLinkAspsp: '' });
    loadAspsps(el.value);
  },
  'bank-link-aspsp': (el) => setUi({ bankLinkAspsp: el.value, bankLinkPsuType: 'personal' }),
  'bank-link-psu-type': (el) => setUi({ bankLinkPsuType: el.value }),
  'bank-link-account': (el) => setUi({ bankLinkAccountId: el.value, bankLinkSyncFrom: latestTxDate(get(), el.value) }),
  'bank-link-sync-from': (el) => setUi({ bankLinkSyncFrom: el.value }),
  'bank-connect': async () => {
    const ui = get().ui;
    if (!ui.bankLinkAspsp || ui.bankBusy) return;
    await startLink({
      aspspName: ui.bankLinkAspsp,
      country: ui.bankCountry,
      psuType: ui.bankLinkPsuType,
      accountId: ui.bankLinkAccountId,
      syncFrom: ui.bankLinkSyncFrom,
      language: ui.lang,
    });
  },
  // Same authorisation flow as a first link; the server matches the accounts it gets back
  // to the existing rows, so mapping and cursor survive.
  'bank-renew': async (el) => {
    const state = get();
    const conn = state.ui.bankStatus?.connections.find(c => c.id === el.dataset.id);
    if (!conn || state.ui.bankBusy) return;
    await startLink({
      aspspName: conn.aspspName,
      country: conn.country,
      psuType: conn.psuType,
      accountId: conn.accounts.find(a => a.accountId)?.accountId || state.activeAccountId,
      syncFrom: '',
      language: state.ui.lang,
    });
  },
  'bank-sync': async (el, ev, t) => {
    if (get().ui.bankBusy) return;
    setUi({ bankBusy: true });
    try {
      const { results, status } = await api.bankSync(el.dataset.id || undefined);
      setUi({ bankStatus: status });
      toast(summarize(results, t));
      if (results.some(r => r.imported > 0 || r.mode === 'savings')) await loadAccount(get().activeAccountId);
    } finally {
      setUi({ bankBusy: false });
    }
  },
  'bank-unlink': async (el, ev, t) => {
    const ok = await confirmDialog(t('bank.confirmUnlink', { name: el.dataset.name }), {
      confirmLabel: t('bank.unlink'), cancelLabel: t('common.cancel'), danger: true,
    });
    if (!ok) return;
    await api.bankUnlink(el.dataset.id);
    await loadStatus();
  },
  'bank-map-target': async (el, ev, t) => {
    const value = el.value;
    if (value === '__new__') return setUi({ bankNewAccountFor: el.dataset.id, bankNewSavingsFor: null });
    if (value === '__newsavings__') return setUi({ bankNewSavingsFor: el.dataset.id, bankNewAccountFor: null });
    if (value.startsWith('account:')) return remap(el.dataset.id, { accountId: value.slice(8) }, t);
    if (value.startsWith('savings:')) return remap(el.dataset.id, { savingsAccountId: value.slice(8) }, t);
    return remap(el.dataset.id, { accountId: null, savingsAccountId: null }, t);
  },
  // Creating the target here rather than via the header switcher or the Savings tab keeps
  // the user in the panel; the new account is mapped straight away and, for a budget
  // account, the rows already imported follow.
  'bank-create-account': async (el, ev, t) => {
    const name = document.getElementById('bank-new-account-name')?.value.trim();
    if (!name) return;
    const account = await api.createAccount(name);
    set({ accounts: [...get().accounts, account] });
    await remap(el.dataset.id, { accountId: account.id }, t);
  },
  'bank-create-savings': async (el, ev, t) => {
    const name = document.getElementById('bank-new-savings-name')?.value.trim();
    if (!name) return;
    const created = await api.createSavings(name, 0);
    await remap(el.dataset.id, { savingsAccountId: created.id }, t);
  },
  'bank-cancel-new-account': () => setUi({ bankNewAccountFor: null, bankNewSavingsFor: null }),
  'bank-toggle-enabled': async (el) => {
    const acc = bankAccount(el.dataset.id);
    if (!acc) return;
    setUi({ bankStatus: await api.bankPatchAccount(acc.id, { enabled: !acc.enabled }) });
  },
  'bank-sync-from': async (el) => {
    setUi({ bankStatus: await api.bankPatchAccount(el.dataset.id, { syncFrom: el.value }) });
  },
};
