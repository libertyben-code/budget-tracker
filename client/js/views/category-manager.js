import { esc, icons, toast } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { categories } from '../derive.js';
import { loadAccount } from '../app.js';

const STARTER_KEY = 'starterCategoriesOffered';

// ui.starterOffered keeps "Not now" for the session when localStorage is unavailable.
function starterOffered(state) {
  if (state.ui.starterOffered !== undefined) return state.ui.starterOffered;
  try {
    return localStorage.getItem(STARTER_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberStarterOffered(offered) {
  try {
    if (offered) localStorage.setItem(STARTER_KEY, '1');
    else localStorage.removeItem(STARTER_KEY);
  } catch {}
  setUi({ starterOffered: offered });
}

export function renderStarterOffer(state, t) {
  if (starterOffered(state) || categories(state).some(c => c !== 'Uncategorized')) return '';
  return `
  <div class="starter-offer">
    <p class="starter-title">${esc(t('categoryManager.starterTitle'))}</p>
    <p class="starter-names">${esc(t('categoryManager.starterNames'))}</p>
    <div class="row">
      <button class="btn small primary" data-action="add-starter-categories">${esc(t('categoryManager.starterAdd'))}</button>
      <button class="btn small ghost" data-action="dismiss-starter-categories">${esc(t('categoryManager.starterNotNow'))}</button>
    </div>
  </div>`;
}

function deleteRow(category, count, t) {
  return `
        <div class="panel-list-item delete-confirm" id="delete-cat-row" role="group" aria-labelledby="delete-cat-title" tabindex="-1">
          <h3 id="delete-cat-title">${esc(t('categoryManager.deleteTitle', { category }))}</h3>
          ${count > 0 ? `
          <p class="muted">${esc(t('categoryManager.hasTransactions', { count }))} ${esc(t('categoryManager.whatToDo'))}</p>
          <div class="delete-choices">
            <div class="delete-choice">
              <input type="radio" id="del-mode-uncategorized" name="del-mode" value="uncategorized" checked>
              <label for="del-mode-uncategorized">${esc(t('categoryManager.setUncategorized'))}</label>
            </div>
            <div class="delete-choice">
              <input type="radio" id="del-mode-new" name="del-mode" value="new">
              <label for="del-mode-new">${esc(t('categoryManager.enterNewCategory'))}</label>
            </div>
            <input id="del-replacement" aria-label="${esc(t('categoryManager.newCategoryName'))}" placeholder="${esc(t('categoryManager.newCategoryName'))}" data-action-input="pick-new-replacement" data-action-key="apply-delete-category">
          </div>` : `
          <p class="muted">${esc(t('categoryManager.emptyDelete'))}</p>`}
          <div class="row" style="justify-content:flex-end">
            <button class="btn" data-action="cancel-delete-category">${esc(t('common.cancel'))}</button>
            <button class="btn danger" data-action="apply-delete-category">${esc(t('categoryManager.deleteCategory'))}</button>
          </div>
        </div>`;
}

export function render(state, t) {
  if (state.ui.panel !== 'categories') return '';
  const counts = Object.fromEntries(state.categories.map(c => [c.name, c.count]));
  const cats = categories(state);
  const deleting = state.ui.deletingCategory;

  return `
  <div class="modal-backdrop" data-action="close-panel" data-self-only>
    <div class="modal">
      <div class="modal-head">
        <h2 style="margin:0">${esc(t('categoryManager.title'))}</h2>
        <button class="icon-btn" data-action="close-panel">✕</button>
      </div>
      <p class="muted">${esc(t('categoryManager.subtitle'))}</p>
      <div class="row" style="margin-bottom:12px">
        <input id="new-cat-input" class="grow" placeholder="${esc(t('categoryManager.newCategoryName'))}" data-action-key="add-category">
        <button class="btn primary" data-action="add-category">${esc(t('categoryManager.addCategory'))}</button>
      </div>
      ${renderStarterOffer(state, t)}
      <div class="panel-list">
        ${cats.map(c => state.ui.editingCategory === c ? `
        <div class="panel-list-item">
          <input id="rename-cat-input" class="grow" value="${esc(c)}" data-action-key="apply-rename-category" data-cat="${esc(c)}">
          <button class="btn small primary" data-action="apply-rename-category" data-cat="${esc(c)}">${esc(t('common.save'))}</button>
          <button class="btn small" data-action="cancel-rename-category">${esc(t('common.cancel'))}</button>
        </div>` : deleting === c ? deleteRow(c, counts[c] || 0, t) : `
        <div class="panel-list-item">
          <span class="grow">${esc(c)}</span>
          <span class="badge">${esc(t(counts[c] === 1 ? 'categoryManager.transactionCountOne' : 'categoryManager.transactionCount', { count: counts[c] || 0 }))}</span>
          <button class="icon-btn accent" data-action="start-rename-category" data-cat="${esc(c)}" title="${esc(t('categoryManager.renameCategory'))}">${icons.edit}</button>
          <button class="icon-btn danger" data-action="start-delete-category" data-cat="${esc(c)}" title="${esc(t('categoryManager.deleteCategoryTitle'))}">${icons.trash}</button>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

export const actions = {
  'add-starter-categories': async (el, ev, t) => {
    const names = t('categoryManager.starterNames').split(', ');
    await Promise.all(names.map(name => api.addCategory(name)));
    set({ categories: [...get().categories, ...names.map(name => ({ name, count: 0 }))] });
    rememberStarterOffered(true);
    toast(t('categoryManager.starterAdded', { count: names.length }), {
      type: 'success',
      action: {
        label: t('transactionTable.undo'),
        onClick: async () => {
          await Promise.all(names.map(name => api.deleteCategory(name, 'Uncategorized')));
          rememberStarterOffered(false);
          await loadAccount(get().activeAccountId);
        },
      },
    });
  },
  'dismiss-starter-categories': () => rememberStarterOffered(true),
  'add-category': async () => {
    const input = document.getElementById('new-cat-input');
    const name = input?.value.trim();
    if (!name) return;
    const state = get();
    if (categories(state).includes(name)) {
      if (input) input.value = '';
      return;
    }
    await api.addCategory(name);
    set({ categories: [...state.categories, { name, count: 0 }] });
  },
  'start-rename-category': (el) => setUi({ editingCategory: el.dataset.cat, deletingCategory: null }),
  'cancel-rename-category': () => setUi({ editingCategory: null }),
  'apply-rename-category': async (el) => {
    const from = el.dataset.cat;
    const to = document.getElementById('rename-cat-input')?.value.trim();
    if (!to || to === from) {
      setUi({ editingCategory: null });
      return;
    }
    const state = get();
    await api.renameCategory(from, to);
    state.ui.editingCategory = null;
    await loadAccount(state.activeAccountId);
  },
  'start-delete-category': (el) => {
    setUi({ deletingCategory: el.dataset.cat, editingCategory: null });
    const row = document.getElementById('delete-cat-row');
    row?.scrollIntoView({ block: 'nearest' });
    row?.focus({ preventScroll: true });
  },
  'cancel-delete-category': () => setUi({ deletingCategory: null }),
  'pick-new-replacement': () => {
    document.getElementById('del-mode-new').checked = true;
  },
  'apply-delete-category': async () => {
    const state = get();
    const category = state.ui.deletingCategory;
    const mode = document.querySelector('input[name="del-mode"]:checked')?.value;
    const replacement = mode === 'new'
      ? document.getElementById('del-replacement')?.value.trim()
      : 'Uncategorized';
    if (!replacement || replacement === category) {
      document.getElementById('del-replacement')?.focus();
      return;
    }
    await api.deleteCategory(category, replacement);
    state.ui.deletingCategory = null;
    await loadAccount(state.activeAccountId);
  },
};
