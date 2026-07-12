import { esc, icons, toast } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { categories } from '../derive.js';
import { loadAccount, refreshBootstrap } from '../app.js';

export function render(state, t) {
  const cats = categories(state);
  const activeAccount = state.accounts.find(a => a.id === state.activeAccountId) || state.accounts[0] || { name: '' };
  const importErrors = state.ui.importErrors;
  const shownLines = importErrors ? importErrors.lines.slice(0, 20).join(', ') : '';

  return `
  <header class="app-header">
    <div class="header-top">
      <h1>${icons.wallet} Budget Tracker</h1>
      <button class="icon-btn" data-action="toggle-dark" title="${esc(t(state.ui.dark ? 'header.light' : 'header.dark'))}">${state.ui.dark ? icons.sun : icons.moon}</button>
      <div class="dropdown">
        <button class="icon-btn" data-action="toggle-settings" aria-label="${esc(t('header.openSettings'))}">${icons.gear}</button>
        ${state.ui.settingsOpen ? `
        <div class="dropdown-menu" data-keep-open>
          <label class="menu-item" style="cursor:pointer">
            ${icons.import} ${esc(t('header.importCsv'))}
            <input type="file" accept=".csv" data-action-change="import-csv" hidden>
          </label>
          <button class="menu-item" data-action="export-csv" ${state.transactions.length === 0 ? 'disabled' : ''}>${icons.export} ${esc(t('header.exportCsv'))}</button>
          <button class="menu-item" data-action="auto-categorize">${icons.sparkles} ${esc(t('header.autoCategorize'))}</button>
          <div class="menu-sep"></div>
          <button class="menu-item" data-action="open-rules">${icons.tag} ${esc(t('header.categoryRules', { count: state.rules.length }))}</button>
          <button class="menu-item" data-action="open-category-manager">${icons.folder} ${esc(t('header.manageCategories', { count: cats.length }))}</button>
          <div class="menu-sep"></div>
          <button class="menu-item" data-action="toggle-lang">${icons.globe} ${esc(t('common.language'))}: ${state.ui.lang === 'en' ? esc(t('common.english')) : esc(t('common.french'))}</button>
        </div>` : ''}
      </div>
    </div>
    <div class="account-switcher">
      <div class="dropdown">
        <button class="btn select-btn account-btn" data-action="toggle-account-menu"><span class="account-name">${esc(activeAccount.name)}</span></button>
        ${state.ui.accountMenuOpen ? `
        <div class="dropdown-menu left" data-keep-open>
          ${state.accounts.map(a => `
          <div class="menu-item account-item ${a.id === state.activeAccountId ? 'active' : ''}" data-action="switch-account" data-id="${esc(a.id)}">
            <span class="grow">${esc(a.name)}</span>
            ${a.id !== 'default' ? `<span class="badge">${a.txCount}</span>` : ''}
            ${a.id !== 'default' ? `<button class="icon-btn danger" data-action="delete-account" data-id="${esc(a.id)}" title="${esc(t('header.deleteAccountTitle'))}">${icons.trash}</button>` : ''}
          </div>`).join('')}
          <div class="menu-sep"></div>
          ${state.addingAccount ? `
          <div class="account-add">
            <input id="new-account-name" class="grow" placeholder="${esc(t('header.accountName'))}" data-action-key="create-account">
            <button class="btn small primary" data-action="create-account">${esc(t('common.save'))}</button>
          </div>` : `
          <button class="menu-item" data-action="start-add-account">＋ ${esc(t('header.newAccount'))}</button>`}
        </div>` : ''}
      </div>
    </div>
    <nav class="tabs">
      <button class="tab ${state.ui.tab === 'dashboard' ? 'active' : ''}" data-action="nav" data-tab="dashboard">${esc(t('header.dashboard'))}</button>
      <button class="tab ${state.ui.tab === 'transactions' ? 'active' : ''}" data-action="nav" data-tab="transactions">${esc(t('header.transactions'))}</button>
      <button class="tab ${state.ui.tab === 'joint' ? 'active' : ''}" data-action="nav" data-tab="joint">${esc(t('header.jointSplit'))}</button>
      <button class="tab ${state.ui.tab === 'savings' ? 'active' : ''}" data-action="nav" data-tab="savings">${esc(t('header.savings'))}</button>
    </nav>
  </header>
  ${state.offline ? `<div class="banner offline" style="margin:12px 16px 0">${icons.offline} ${esc(t('common.offline'))}</div>` : ''}
  ${importErrors ? `
  <div class="banner warning" style="margin:12px 16px 0">
    <div class="grow">
      <strong>${esc(t('header.importWarning', { count: importErrors.count, suffix: importErrors.count > 1 ? 's' : '' }))}</strong>
      <div>${esc(t('header.importWarningDesc'))}</div>
      <div>${esc(t('header.lines', { lines: shownLines }))}${importErrors.lines.length > 20 ? esc(t('header.andMore', { count: importErrors.lines.length - 20 })) : ''}</div>
    </div>
    <button class="icon-btn" data-action="dismiss-import-errors">✕</button>
  </div>` : ''}`;
}

export const actions = {
  'toggle-dark': () => {
    const dark = !get().ui.dark;
    localStorage.setItem('darkMode', String(dark));
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    setUi({ dark });
  },
  'toggle-lang': () => {
    const lang = get().ui.lang === 'en' ? 'fr' : 'en';
    localStorage.setItem('language', lang);
    setUi({ lang });
  },
  'toggle-settings': () => setUi({ settingsOpen: !get().ui.settingsOpen, accountMenuOpen: false }),
  'toggle-account-menu': () => {
    const open = get().ui.accountMenuOpen;
    if (open) set({ addingAccount: false });
    setUi({ accountMenuOpen: !open, settingsOpen: false });
  },
  'nav': (el) => {
    location.hash = `#/${el.dataset.tab}`;
  },
  'switch-account': async (el) => {
    setUi({ accountMenuOpen: false });
    if (el.dataset.id === get().activeAccountId) return;
    localStorage.setItem('activeAccountId', el.dataset.id);
    await loadAccount(el.dataset.id);
  },
  'start-add-account': () => set({ addingAccount: true }),
  'cancel-add-account': () => set({ addingAccount: false }),
  'create-account': async () => {
    const name = document.getElementById('new-account-name')?.value.trim();
    if (!name) return;
    const account = await api.createAccount(name);
    localStorage.setItem('activeAccountId', account.id);
    setUi({ accountMenuOpen: false });
    set({ addingAccount: false, accounts: [...get().accounts, account] });
    await loadAccount(account.id);
  },
  'delete-account': async (el, ev) => {
    ev.stopPropagation();
    const state = get();
    const account = state.accounts.find(a => a.id === el.dataset.id);
    if (!window.confirm(`Delete "${account?.name}"? All its transactions will be lost.`)) return;
    setUi({ accountMenuOpen: false });
    await api.deleteAccount(el.dataset.id);
    localStorage.setItem('activeAccountId', 'default');
    set({ accounts: state.accounts.filter(a => a.id !== el.dataset.id) });
    await loadAccount('default');
  },
  'import-csv': async (el) => {
    const file = el.files[0];
    if (!file) return;
    const text = await file.text();
    const state = get();
    const result = await api.importCsv(state.activeAccountId, text);
    el.value = '';
    setUi({
      settingsOpen: false,
      importErrors: result.failedLines.length > 0 ? { count: result.failedLines.length, lines: result.failedLines } : null,
    });
    toast(createImportMessage(result));
    await loadAccount(state.activeAccountId);
    await refreshBootstrap();
  },
  'export-csv': () => {
    setUi({ settingsOpen: false });
    const a = document.createElement('a');
    a.href = `/api/accounts/${get().activeAccountId}/export.csv`;
    a.download = '';
    a.click();
  },
  'auto-categorize': async () => {
    const state = get();
    await api.autocategorize(state.activeAccountId);
    setUi({ settingsOpen: false });
    await loadAccount(state.activeAccountId);
  },
  'open-rules': () => setUi({ settingsOpen: false, panel: 'rules', ruleSelection: new Set(), rulesFilter: '' }),
  'open-category-manager': () => setUi({ settingsOpen: false, panel: 'categories', editingCategory: null, deletingCategory: null }),
  'dismiss-import-errors': () => setUi({ importErrors: null }),
};

function createImportMessage(result) {
  return `Imported ${result.imported}, skipped ${result.skippedDuplicates} duplicate(s)`;
}
