import { esc } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { loadAccount } from '../app.js';

export function render(state, t) {
  if (state.ui.panel !== 'categories') return '';
  const counts = {};
  for (const tx of state.transactions) {
    counts[tx.category] = (counts[tx.category] || 0) + 1;
  }
  const cats = Object.keys(counts).sort();
  const deleting = state.ui.deletingCategory;

  return `
  <div class="modal-backdrop" data-action="close-panel" data-self-only>
    <div class="modal">
      <div class="modal-head">
        <h2 style="margin:0">${esc(t('categoryManager.title'))}</h2>
        <button class="icon-btn" data-action="close-panel">✕</button>
      </div>
      <p class="muted">${esc(t('categoryManager.subtitle'))}</p>
      <div class="panel-list">
        ${cats.map(c => state.ui.editingCategory === c ? `
        <div class="panel-list-item">
          <input id="rename-cat-input" class="grow" value="${esc(c)}" data-action-key="apply-rename-category" data-cat="${esc(c)}">
          <button class="btn small primary" data-action="apply-rename-category" data-cat="${esc(c)}">${esc(t('common.save'))}</button>
          <button class="btn small" data-action="cancel-rename-category">${esc(t('common.cancel'))}</button>
        </div>` : `
        <div class="panel-list-item">
          <span class="grow">${esc(c)}</span>
          <span class="badge">${esc(t('categoryManager.transactionCount', { count: counts[c], suffix: counts[c] > 1 ? 's' : '' }))}</span>
          <button class="icon-btn" data-action="start-rename-category" data-cat="${esc(c)}" title="${esc(t('categoryManager.renameCategory'))}">✏️</button>
          <button class="icon-btn danger" data-action="start-delete-category" data-cat="${esc(c)}" title="${esc(t('categoryManager.deleteCategoryTitle'))}">🗑️</button>
        </div>`).join('')}
      </div>
      ${deleting ? `
      <div class="card" style="margin-top:12px">
        <h3>${esc(t('categoryManager.deleteTitle', { category: deleting }))}</h3>
        <p class="muted">${esc(t('categoryManager.hasTransactions', { count: counts[deleting] || 0 }))} ${esc(t('categoryManager.whatToDo'))}</p>
        <div class="field">
          <label class="row" style="gap:6px"><input type="radio" name="del-mode" value="uncategorized" checked> ${esc(t('categoryManager.setUncategorized'))}</label>
          <label class="row" style="gap:6px"><input type="radio" name="del-mode" value="new"> ${esc(t('categoryManager.enterNewCategory'))}</label>
          <input id="del-replacement" placeholder="${esc(t('categoryManager.newCategoryName'))}">
        </div>
        <div class="row" style="justify-content:flex-end">
          <button class="btn" data-action="cancel-delete-category">${esc(t('common.cancel'))}</button>
          <button class="btn danger" data-action="apply-delete-category">${esc(t('categoryManager.deleteCategory'))}</button>
        </div>
      </div>` : ''}
    </div>
  </div>`;
}

export const actions = {
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
    await api.renameCategory(state.activeAccountId, from, to);
    state.ui.editingCategory = null;
    set({
      transactions: state.transactions.map(tx => tx.category === from ? { ...tx, category: to } : tx),
      rules: state.rules.map(r => r.category === from ? { ...r, category: to } : r),
    });
  },
  'start-delete-category': (el) => setUi({ deletingCategory: el.dataset.cat, editingCategory: null }),
  'cancel-delete-category': () => setUi({ deletingCategory: null }),
  'apply-delete-category': async () => {
    const state = get();
    const category = state.ui.deletingCategory;
    const mode = document.querySelector('input[name="del-mode"]:checked')?.value;
    const replacement = mode === 'new'
      ? document.getElementById('del-replacement')?.value.trim()
      : 'Uncategorized';
    if (!replacement) return;
    await api.deleteCategory(state.activeAccountId, category, replacement);
    state.ui.deletingCategory = null;
    await loadAccount(state.activeAccountId);
  },
};
