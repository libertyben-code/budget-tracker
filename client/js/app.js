import { get, set, setUi, subscribe } from './store.js';
import { api, net } from './api.js';
import { createTranslator } from './i18n.js';
import { debounce, esc, icons, toast } from './dom.js';
import * as header from './views/header.js';
import * as filters from './views/filters.js';
import * as transactions from './views/transactions.js';
import * as batchEditModal from './views/batch-edit-modal.js';
import * as rulesPanel from './views/rules-panel.js';
import * as categoryManager from './views/category-manager.js';
import * as dashboard from './views/dashboard.js';
import * as jointSplit from './views/joint-split.js';
import * as savings from './views/savings.js';
import * as bankSync from './views/bank-sync.js';
import * as categoryPicker from './views/category-picker.js';

const views = { dashboard, transactions, joint: jointSplit, savings };
const actions = {
  ...header.actions,
  ...filters.actions,
  ...transactions.actions,
  ...batchEditModal.actions,
  ...rulesPanel.actions,
  ...categoryManager.actions,
  ...dashboard.actions,
  ...jointSplit.actions,
  ...savings.actions,
  ...bankSync.actions,
  ...categoryPicker.actions,
  'retry-connection': retryConnection,
};

const appEl = document.getElementById('app');
const modalsEl = document.getElementById('modals');

function translator() {
  return createTranslator(get().ui.lang);
}

function render() {
  const state = get();
  if (!state.loaded) return;
  const t = translator();
  // Theme actions call setUi() before applyTheme(); charts read their colours from CSS.
  header.applyTheme(state);

  const active = document.activeElement;
  const focusId = active?.id;
  const selStart = active?.selectionStart;

  const view = views[state.ui.tab] || views.dashboard;
  appEl.innerHTML = header.render(state, t) + connectionBanner(state.connection, t, state.ui.lang) + `<main>${view.render(state, t)}</main>` + header.renderNav(state, t);
  modalsEl.innerHTML = batchEditModal.render(state, t) + rulesPanel.render(state, t) + categoryManager.render(state, t) + bankSync.render(state, t) + categoryPicker.render(state, t);

  dashboard.afterRender(state, t);
  savings.afterRender(state);

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) {
      el.focus();
      if (selStart !== undefined && selStart !== null && typeof el.setSelectionRange === 'function') {
        try { el.setSelectionRange(selStart, selStart); } catch {}
      }
    }
  }
}

function connectionBanner(connection, t, lang) {
  if (!connection) return '';
  const text = connection.down
    ? [t('connection.unreachable'), connection.asOf && t('connection.asOf', { when: formatTime(connection.asOf, t, lang) }), t('connection.paused')].filter(Boolean).join(' ')
    : t('connection.loadFailed', { message: connection.error });
  return `
  <div class="banner connection">
    ${icons.offline}
    <span class="grow">${esc(text)}</span>
    <button class="btn small" data-action="retry-connection" ${connection.retrying ? 'disabled' : ''}>${esc(t('connection.retry'))}</button>
  </div>`;
}

function formatTime(time, t, lang) {
  const locale = lang === 'fr' ? 'fr-FR' : 'en-GB';
  const date = new Date(time);
  const clock = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === new Date().toDateString()) return t('connection.today', { time: clock });
  if (date.toDateString() === yesterday.toDateString()) return t('connection.yesterday', { time: clock });
  return `${date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ${clock}`;
}

async function runAction(name, el, ev) {
  const action = actions[name];
  if (!action) return;
  const t = translator();
  net.message = t('connection.unreachable');
  const { connection, ...before } = get();
  const failedWrites = net.failedWrites;
  try {
    await action(el, ev, t);
  } catch (err) {
    if (!err.network) toast(err.message || 'Error');
    else if (net.failedWrites === failedWrites) toast(err.message, { type: 'info' });
  }
  if (net.failedWrites !== failedWrites) {
    // The write never reached the server: take back what the action showed before trying it.
    set(before);
    toast(t('connection.pausedToast'), { type: 'info' });
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  const state = get();

  if (!ev.target.closest('.dropdown') && !ev.target.closest('[data-keep-open]')) {
    if (state.ui.settingsOpen) setUi({ settingsOpen: false });
    if (state.ui.categoryDropdownOpen) setUi({ categoryDropdownOpen: null });
    if (state.ui.accountMenuOpen) setUi({ accountMenuOpen: false });
    if (state.addingAccount) set({ addingAccount: false });
  }

  if (!el) return;
  if (el.dataset.selfOnly !== undefined && ev.target !== el) return;
  runAction(el.dataset.action, el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-action-change]');
  if (el) runAction(el.dataset.actionChange, el, ev);
});

const debouncedInput = debounce((name, el, ev) => runAction(name, el, ev), 200);
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-action-input]');
  if (el) debouncedInput(el.dataset.actionInput, el, ev);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Enter') return;
  const el = ev.target.closest('[data-action-key]');
  if (el) {
    ev.preventDefault();
    runAction(el.dataset.actionKey, el, ev);
  }
});

function syncTabFromHash() {
  const tab = location.hash.replace('#/', '') || 'dashboard';
  setUi({ tab: views[tab] ? tab : 'dashboard' });
}
window.addEventListener('hashchange', () => {
  syncTabFromHash();
  // fed balances are derived server-side from every budget account, so re-read them on entry
  if (get().ui.tab === 'savings' && get().loaded && !get().connection) refreshSavings().catch(() => {});
});

export async function refreshBootstrap() {
  const boot = await api.bootstrap();
  set({ accounts: boot.accounts, rules: boot.rules, joint: boot.joint });
}

function savingsState(data) {
  return {
    savingsAccounts: data.savingsAccounts,
    savingsHistory: data.savingsHistory,
    savingsRecurring: data.savingsRecurring,
  };
}

export async function refreshCategories() {
  set({ categories: await api.categories() });
}

export async function refreshSavings() {
  set(savingsState(await api.savings()));
}

export async function loadAccount(accountId) {
  // A failed write reloads its account to undo itself. While the server is down that would show an
  // older cached copy instead, so runAction undoes it.
  if (get().connection?.down && accountId === get().activeAccountId) return;
  const data = await api.accountData(accountId);
  set({
    activeAccountId: accountId,
    transactions: data.transactions,
    categories: data.categories,
    ...savingsState(data),
    selection: new Set(),
    editingId: null,
    visibleCount: 100,
  });
  await refreshBootstrap();
}

// The bank's redirect lands on `/?bank=linked|error&...` (see server routes/bank.js): open
// the panel on the link's summary (or an error toast), and scrub the query so a reload does
// not repeat it.
function handleBankReturn() {
  const params = new URLSearchParams(location.search);
  if (!params.has('bank')) return;
  history.replaceState(null, '', location.pathname + location.hash);
  const t = translator();
  let bankSummary = null;
  if (params.get('bank') === 'linked') {
    try {
      bankSummary = JSON.parse(params.get('summary'));
    } catch {
      bankSummary = null; // a hand-edited URL: the panel still opens on the connection list
    }
  } else {
    toast(t('bank.linkError', { reason: params.get('reason') || '' }));
  }
  // On a phone the bank's redirect usually lands in a browser tab, not in the installed app;
  // say so, or the browser's "open in app" bar reads as a broken layout.
  if ('ontouchstart' in window && !window.matchMedia('(display-mode: standalone)').matches) {
    setTimeout(() => toast(t('bank.openInApp'), { type: 'info' }), 3600);
  }
  setUi({ panel: 'bank', bankSummary });
  bankSync.loadStatus();
}

// `asOf` is the oldest time the data on screen was fetched from the server.
function markDown(time) {
  const times = [get().connection?.asOf, time].filter(Boolean);
  net.paused = true;
  set({ connection: { down: true, asOf: times.length ? Math.min(...times) : null } });
}
net.onDown = markDown;
net.onCached = markDown;

function recheck() {
  if (get().connection?.down) load();
}
window.addEventListener('online', recheck);
window.addEventListener('offline', () => markDown(net.heardAt));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') recheck();
});

async function retryConnection(el, ev, t) {
  set({ connection: { ...get().connection, retrying: true } });
  await load();
  if (get().connection?.down) toast(t('connection.stillDown'), { type: 'info' });
}

async function load() {
  try {
    const bootData = await api.bootstrap();
    let accountId = get().activeAccountId;
    if (!bootData.accounts.some(a => a.id === accountId)) accountId = 'default';
    const data = await api.accountData(accountId);
    set({
      loaded: true,
      accounts: bootData.accounts,
      rules: bootData.rules,
      joint: bootData.joint,
      activeAccountId: accountId,
      transactions: data.transactions,
      categories: data.categories,
      ...savingsState(data),
    });
    if (!net.cachedAt) {
      net.paused = false;
      set({ connection: null });
    }
  } catch (err) {
    if (err.network) return set({ loaded: true });
    // An HTTP error (a future 401 among them) means the server answered: not the offline state.
    net.paused = false;
    set({ loaded: true, connection: { error: err.message } });
  }
}

async function boot() {
  header.applyTheme(get());
  subscribe(render);
  await load();
  syncTabFromHash();
  if (!get().connection) handleBankReturn();

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.register('/sw.js').catch(() => null);
    if (registration) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    }
  }
}

boot();
