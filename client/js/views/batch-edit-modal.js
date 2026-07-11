import { esc } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { categories } from '../derive.js';

export function render(state, t) {
  if (!state.ui.batchEditOpen) return '';
  const cats = categories(state);
  return `
  <div class="modal-backdrop" data-action="close-batch-edit" data-self-only>
    <div class="modal">
      <div class="modal-head">
        <h2 style="margin:0">${esc(t('app.batchEditTransactions'))}</h2>
        <button class="icon-btn" data-action="close-batch-edit">✕</button>
      </div>
      <p class="muted">${esc(t('app.editingTransactions', { count: state.selection.size }))} — ${esc(t('app.leaveEmpty'))}</p>
      <div class="field">
        <label>${esc(t('app.descriptionOptional'))}</label>
        <input id="batch-desc" placeholder="${esc(t('app.newDescriptionAll'))}">
      </div>
      <div class="field">
        <label>${esc(t('app.categoryOptional'))}</label>
        <select id="batch-cat" data-action-change="batch-cat-select">
          <option value="">${esc(t('app.keepExistingCategories'))}</option>
          ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
          <option value="__new__" ${state.ui.batchNewCategory ? 'selected' : ''}>${esc(t('app.createNewCategory'))}</option>
        </select>
      </div>
      ${state.ui.batchNewCategory ? `
      <div class="field">
        <input id="batch-new-cat" placeholder="${esc(t('app.enterNewCategoryName'))}">
      </div>` : ''}
      <div class="row" style="justify-content:flex-end">
        <button class="btn" data-action="close-batch-edit">${esc(t('common.cancel'))}</button>
        <button class="btn primary" data-action="apply-batch-edit">${esc(t('app.applyChanges'))}</button>
      </div>
    </div>
  </div>`;
}

export const actions = {
  'close-batch-edit': () => setUi({ batchEditOpen: false, batchNewCategory: false }),
  'batch-cat-select': (el) => {
    const isNew = el.value === '__new__';
    if (isNew !== get().ui.batchNewCategory) setUi({ batchNewCategory: isNew });
  },
  'apply-batch-edit': async () => {
    const state = get();
    const description = document.getElementById('batch-desc')?.value.trim();
    const selectValue = document.getElementById('batch-cat')?.value;
    const category = selectValue === '__new__'
      ? document.getElementById('batch-new-cat')?.value.trim()
      : selectValue;
    const setFields = {};
    if (description) setFields.description = description;
    if (category) setFields.category = category;
    if (Object.keys(setFields).length === 0) return;
    const ids = [...state.selection];
    await api.batchEdit(ids, setFields);
    set({
      transactions: state.transactions.map(tx =>
        state.selection.has(tx.id) ? { ...tx, ...setFields } : tx),
      selection: new Set(),
    });
    setUi({ batchEditOpen: false, batchNewCategory: false });
  },
};
