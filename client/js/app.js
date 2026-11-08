import { get, set, setUi, subscribe } from './store.js';
import { api, net } from './api.js';
import { createTranslator } from './i18n.js';
import { debounce, esc, finder, icons, syncLayers, toast } from './dom.js';
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
import * as categorise from './views/categorise.js';

const views = { dashboard, transactions, joint: jointSplit, savings, categorise };
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
  ...categorise.actions,
  'retry-connection': retryConnection,
};

const appEl = document.getElementById('app');
const modalsEl = document.getElementById('modals');

function translator() {
  return createTranslator(get().ui.lang);
}

const FIELDS = 'input:not([type=file]):not([type=hidden]), select, textarea';
// A field whose change was handed to its data-action-change action: the state now owns its value,
// so a failed save (or runAction's offline rollback) shows the stored value again.
const committed = new WeakSet();

const isCheckable = el => el.type === 'checkbox' || el.type === 'radio';
const currentValue = el => (isCheckable(el) ? el.checked : el.value);

function renderedValue(el) {
  if (isCheckable(el)) return el.defaultChecked;
  if (el.tagName !== 'SELECT') return el.defaultValue;
  const options = [...el.options];
  return (options.findLast(o => o.defaultSelected) || options.find(o => !o.disabled))?.value;
}

// The nearest data-id tells apart forms that reuse ids, like one savings account's edit form after another's.
function fieldKey(el) {
  const scope = el.closest('[data-id]')?.dataset.id;
  if (el.id) return JSON.stringify([el.id, scope]);
  if (!el.name && !Object.keys(el.dataset).length) return null;
  return JSON.stringify([el.tagName, el.name, { ...el.dataset }, isCheckable(el) && el.value, scope]);
}

function fieldsByKey() {
  const fields = new Map();
  for (const el of [appEl, modalsEl].flatMap(root => [...root.querySelectorAll(FIELDS)])) {
    const key = fieldKey(el);
    if (key) fields.set(key, fields.has(key) ? null : el);
  }
  return fields;
}

const DIALOG = '[role="dialog"], [role="alertdialog"]';
const TABBABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';
// Where focus goes back to when a dialog closes, by dialog id.
const openers = new Map();

const openDialogs = () => [...modalsEl.querySelectorAll(DIALOG)];
const topLayer = () => [...document.querySelectorAll('.modal-backdrop')].at(-1);
const focusLost = () => !document.activeElement || document.activeElement === document.body;

// A dialog opened from a menu item that has closed returns focus to the menu's button.
function openerOf(el) {
  const toggle = el?.closest('.dropdown-menu') && el.closest('.dropdown').querySelector(':scope > [aria-expanded]');
  const [self, fallback] = [finder(el), finder(toggle)];
  return () => self() || fallback();
}

function syncDialogFocus(before, opener) {
  const open = openDialogs().map(d => d.id);
  for (const id of [...before].reverse()) {
    if (open.includes(id)) continue;
    const back = openers.get(id);
    openers.delete(id);
    if (focusLost()) back?.()?.focus();
  }
  for (const id of open) if (!before.has(id)) openers.set(id, opener);
  // While a dialog is open, focus stays in the topmost one (or on the toast's Undo).
  const layer = topLayer();
  if (layer && !layer.contains(document.activeElement) && !document.activeElement?.closest('.toast')) {
    (layer.querySelector(DIALOG) || layer).focus();
  }
}

function render() {
  const state = get();
  if (!state.loaded) return;
  const t = translator();
  document.documentElement.lang = state.ui.lang;
  // Theme actions call setUi() before applyTheme(); charts read their colours from CSS.
  header.applyTheme(state);

  // What the user typed and the state doesn't hold is carried over to the new fields, unless the
  // state rendered the field differently this time (a form reset or switched to another item).
  const edited = [...fieldsByKey()]
    .filter(([, el]) => el && !committed.has(el) && currentValue(el) !== renderedValue(el))
    .map(([key, el]) => [key, currentValue(el), renderedValue(el)]);
  const active = document.activeElement;
  const isField = active?.matches(FIELDS);
  const focusKey = isField ? fieldKey(active) : null;
  const refind = finder(active);
  const opener = openerOf(active);
  const dialogsBefore = new Set(openDialogs().map(d => d.id));
  const { selectionStart, selectionEnd } = active || {};

  const view = views[state.ui.tab] || views.dashboard;
  appEl.innerHTML = header.render(state, t) + connectionBanner(state.connection, t, state.ui.lang) + `<main>${view.render(state, t)}</main>` + header.renderNav(state, t);
  modalsEl.innerHTML = batchEditModal.render(state, t) + rulesPanel.render(state, t) + categoryManager.render(state, t) + bankSync.render(state, t) + filters.renderSheet(state, t) + transactions.renderSheet(state, t) + categoryPicker.render(state, t);

  const fields = fieldsByKey();
  for (const [key, value, rendered] of edited) {
    const el = fields.get(key);
    if (!el || renderedValue(el) !== rendered) continue;
    if (isCheckable(el)) el.checked = value;
    else el.value = value;
  }

  dashboard.afterRender(state, t);
  savings.afterRender(state);
  syncLayers();

  // A button keeps focus too, without scrolling to it ("Load more" has moved down by then).
  const target = (focusKey && fields.get(focusKey)) || refind();
  if (target) {
    target.focus(isField ? undefined : { preventScroll: true });
    if (selectionStart !== undefined && selectionStart !== null && typeof target.setSelectionRange === 'function') {
      try { target.setSelectionRange(selectionStart, selectionEnd); } catch {}
    }
  }
  syncDialogFocus(dialogsBefore, opener);
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
    if (!err.network) toast(err.message || t('common.error'));
    else if (net.failedWrites === failedWrites) toast(err.message, { type: 'info' });
  }
  if (net.failedWrites !== failedWrites) {
    // The write never reached the server: take back what the action showed before trying it.
    set(before);
    toast(t('connection.pausedToast'), { type: 'info' });
  }
}

function closeMenus() {
  const state = get();
  if (state.ui.settingsOpen) setUi({ settingsOpen: false });
  if (state.ui.categoryDropdownOpen) setUi({ categoryDropdownOpen: null });
  if (state.ui.accountMenuOpen) setUi({ accountMenuOpen: false });
  if (state.addingAccount) set({ addingAccount: false });
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!ev.target.closest('.dropdown') && !ev.target.closest('[data-keep-open]')) closeMenus();

  if (!el) return;
  if (el.dataset.selfOnly !== undefined && ev.target !== el) return;
  runAction(el.dataset.action, el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-action-change]');
  if (!el) return;
  committed.add(el);
  runAction(el.dataset.actionChange, el, ev);
});

const debouncedInput = debounce((name, el, ev) => runAction(name, el, ev), 200);
document.addEventListener('input', (ev) => {
  committed.delete(ev.target);
  const el = ev.target.closest('[data-action-input]');
  if (el) debouncedInput(el.dataset.actionInput, el, ev);
});

// Escape does what a tap outside does, to the topmost thing open: the picker over a sheet, a
// sheet or panel over the page, a confirm dialog over everything; with no dialog, an open menu.
function closeTopmost(ev) {
  const layer = topLayer();
  if (layer) {
    ev.preventDefault();
    layer.click();
    return;
  }
  const { settingsOpen, accountMenuOpen } = get().ui;
  if (!settingsOpen && !accountMenuOpen) return;
  ev.preventDefault();
  closeMenus();
  document.getElementById(settingsOpen ? 'settings-toggle' : 'account-toggle')?.focus();
}

// Tab past either end of the topmost dialog comes back round. Inside it the browser's own order
// stands (a date field's parts, a radio group). A toast's Undo after #modals is part of the round.
function trapFocus(ev) {
  const layer = topLayer();
  if (!layer) return;
  const dialog = layer.querySelector(DIALOG) || layer;
  const toasts = layer.parentElement === modalsEl ? [...document.querySelectorAll('.toast-action')] : [];
  const items = [...dialog.querySelectorAll(TABBABLE), ...toasts].filter(el =>
    !el.disabled && el.tabIndex >= 0 && el.getClientRects().length
    && (el.type !== 'radio' || el.checked || !dialog.querySelector(`input[type="radio"][name="${CSS.escape(el.name)}"]:checked`)));
  const at = items.indexOf(document.activeElement);
  const wrapTo = ev.shiftKey ? (at <= 0 && items.at(-1)) : ((at === -1 || at === items.length - 1) && items[0]);
  if (!items.length || wrapTo) {
    ev.preventDefault();
    (wrapTo || dialog).focus();
  }
}

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !ev.isComposing) return closeTopmost(ev);
  if (ev.key === 'Tab') return trapFocus(ev);
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
  document.documentElement.lang = get().ui.lang;
  document.querySelector('.boot-loading')?.setAttribute('aria-label', translator()('common.loading'));
  header.applyTheme(get());
  subscribe(render);
  await load();
  syncTabFromHash();
  if (!get().connection) handleBankReturn();
  bankSync.autoSync(translator());
  // An installed PWA is usually resumed from the background rather than started again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') bankSync.autoSync(translator());
  });

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
