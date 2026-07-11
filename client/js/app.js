import { get, set, setUi, subscribe } from './store.js';
import { api } from './api.js';
import { createTranslator } from './i18n.js';
import { debounce, toast } from './dom.js';
import * as header from './views/header.js';
import * as filters from './views/filters.js';
import * as transactions from './views/transactions.js';
import * as batchEditModal from './views/batch-edit-modal.js';
import * as rulesPanel from './views/rules-panel.js';
import * as categoryManager from './views/category-manager.js';
import * as dashboard from './views/dashboard.js';
import * as jointSplit from './views/joint-split.js';
import * as savings from './views/savings.js';

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

  const active = document.activeElement;
  const focusId = active?.id;
  const selStart = active?.selectionStart;

  const view = views[state.ui.tab] || views.dashboard;
  appEl.innerHTML = header.render(state, t) + `<main>${view.render(state, t)}</main>`;
  modalsEl.innerHTML = batchEditModal.render(state, t) + rulesPanel.render(state, t) + categoryManager.render(state, t);

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

async function runAction(name, el, ev) {
  const action = actions[name];
  if (!action) return;
  try {
    await action(el, ev, translator());
  } catch (err) {
    toast(err.message || 'Error');
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  const state = get();

  if (!ev.target.closest('.dropdown') && !ev.target.closest('[data-keep-open]')) {
    if (state.ui.settingsOpen) setUi({ settingsOpen: false });
    if (state.ui.categoryDropdownOpen) setUi({ categoryDropdownOpen: null });
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
window.addEventListener('hashchange', syncTabFromHash);

export async function refreshBootstrap() {
  const boot = await api.bootstrap();
  set({ accounts: boot.accounts, rules: boot.rules });
}

export async function loadAccount(accountId) {
  const data = await api.accountData(accountId);
  set({
    activeAccountId: accountId,
    transactions: data.transactions,
    savingsAccounts: data.savingsAccounts,
    savingsHistory: data.savingsHistory,
    savingsRecurring: data.savingsRecurring,
    selection: new Set(),
    editingId: null,
    visibleCount: 100,
  });
  await refreshBootstrap();
}

function setOffline(offline) {
  if (get().offline !== offline) set({ offline });
}
window.addEventListener('online', () => setOffline(false));
window.addEventListener('offline', () => setOffline(true));

async function boot() {
  document.documentElement.dataset.theme = get().ui.dark ? 'dark' : 'light';
  subscribe(render);

  try {
    const bootData = await api.bootstrap();
    let accountId = get().activeAccountId;
    if (!bootData.accounts.some(a => a.id === accountId)) accountId = 'default';
    const data = await api.accountData(accountId);
    set({
      loaded: true,
      offline: false,
      accounts: bootData.accounts,
      rules: bootData.rules,
      activeAccountId: accountId,
      transactions: data.transactions,
      savingsAccounts: data.savingsAccounts,
      savingsHistory: data.savingsHistory,
      savingsRecurring: data.savingsRecurring,
    });
  } catch {
    set({ loaded: true, offline: true });
  }

  syncTabFromHash();

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
