import { esc, eur, icons, checkPill, toast, confirmDialog } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { filteredTransactions, categories, stats } from '../derive.js';
import { isoToDisplay, todayIso } from '/shared/dates.js';
import { render as renderFilters } from './filters.js';
import { openCategoryPicker } from './category-picker.js';

export function renderTiles(state, t) {
  const s = stats(filteredTransactions(state));
  return `
  <div class="tiles">
    <div class="card tile total-tile">
      <div class="label">${esc(t('app.totalBalance'))}</div>
      <div class="value big ${s.total >= 0 ? 'pos' : 'neg'}">${eur(s.total)}</div>
    </div>
    <div class="card tile total-tile">
      <div class="label">${esc(t('app.totalSpending'))}</div>
      <div class="value big neg">${eur(s.spending)}</div>
    </div>
  </div>`;
}

export function render(state, t) {
  const filtered = filteredTransactions(state);
  const visible = filtered.slice(0, state.visibleCount);
  const cats = categories(state);
  const selection = state.selection;
  const allVisibleSelected = filtered.length > 0 && filtered.every(tx => selection.has(tx.id));
  const sortIndicator = (key) => state.sort.key === key ? (state.sort.direction === 'asc' ? ' ▲' : ' ▼') : '';

  const editCats = cats.includes('Uncategorized') ? cats : ['Uncategorized', ...cats];
  const editField = (label, control, span2 = false) => `<div class="tx-field${span2 ? ' span2' : ''}"><label><span>${esc(label)}</span>${control}</label></div>`;
  const editRow = (tx, isNew = false) => `
    <div class="tx-edit-grid" data-editing="${isNew ? 'new' : tx.id}">
      ${editField(t('common.date'), `<input name="date" type="date" value="${esc(tx.date)}">`)}
      ${editField(t('common.amount'), `<input name="amount" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${esc(tx.amount)}">`)}
      ${editField(t('common.description'), `<input name="description" value="${esc(tx.description)}">`, true)}
      ${editField(t('common.category'), `<select name="category">${editCats.map(c => `<option value="${esc(c)}" ${tx.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`, true)}
      <button class="btn primary" data-action="${isNew ? 'save-new-tx' : 'save-tx'}" ${isNew ? '' : `data-id="${tx.id}"`}>${esc(t('common.save'))}</button>
      <button class="btn" data-action="${isNew ? 'cancel-create' : 'cancel-edit'}">${esc(t('common.cancel'))}</button>
    </div>`;
  const draftTx = { date: todayIso(), amount: '', description: '', category: 'Uncategorized' };
  const draftCard = state.creatingTx ? `<div class="card tx-card editing">${editRow(draftTx, true)}</div>` : '';
  const draftRow = state.creatingTx ? `<tr><td colspan="5">${editRow(draftTx, true)}</td></tr>` : '';

  const catSelect = (tx) => `<button class="chip-select" data-action="pick-tx-category" data-id="${tx.id}" aria-haspopup="dialog" aria-label="${esc(t('categoryPicker.trigger', { category: tx.category }))}">${esc(tx.category)}</button>`;

  const cards = visible.map(tx => state.editingId === tx.id
    ? `<div class="card tx-card editing">${editRow(tx)}</div>`
    : `
    <div class="card tx-card selectable ${selection.has(tx.id) ? 'selected' : ''}" data-action="toggle-select" data-id="${tx.id}">
      <div class="tx-row-top">
        <span class="tx-desc">${esc(tx.description) || '<span class="muted">—</span>'}</span>
        <span class="tx-amount ${tx.amount >= 0 ? 'pos' : 'neg'}">${eur(tx.amount)}</span>
      </div>
      <div class="tx-row-bottom">
        <span class="tx-date">${esc(isoToDisplay(tx.date))}</span>
        ${catSelect(tx)}
        <span class="tx-actions">
          <button class="icon-btn accent" data-action="edit-tx" data-id="${tx.id}" title="${esc(t('common.edit'))}">${icons.edit}</button>
          <button class="icon-btn danger" data-action="delete-tx" data-id="${tx.id}" title="${esc(t('common.delete'))}">${icons.trash}</button>
        </span>
      </div>
    </div>`).join('');

  const tableRows = visible.map(tx => state.editingId === tx.id
    ? `<tr><td colspan="5">${editRow(tx)}</td></tr>`
    : `
    <tr class="selectable ${selection.has(tx.id) ? 'selected' : ''}" data-action="toggle-select" data-id="${tx.id}">
      <td class="num">${esc(isoToDisplay(tx.date))}</td>
      <td>${esc(tx.description)}</td>
      <td>${catSelect(tx)}</td>
      <td class="amount ${tx.amount >= 0 ? 'pos' : 'neg'}">${eur(tx.amount)}</td>
      <td style="white-space:nowrap">
        <button class="icon-btn accent" data-action="edit-tx" data-id="${tx.id}" title="${esc(t('common.edit'))}">${icons.edit}</button>
        <button class="icon-btn danger" data-action="delete-tx" data-id="${tx.id}" title="${esc(t('common.delete'))}">${icons.trash}</button>
      </td>
    </tr>`).join('');

  return `
  <section class="view ${selection.size > 0 ? 'has-selection' : ''}">
    ${renderTiles(state, t)}
    ${renderFilters(state, t)}
    ${selection.size > 0 ? `
    <div class="selection-bar">
      <span class="grow">${esc(t('transactionTable.selectedCount', { count: selection.size }))}</span>
      <button class="btn small primary" data-action="open-batch-edit">${esc(t('transactionTable.batchEdit'))}</button>
      <button class="btn small danger" data-action="batch-delete" title="${esc(t('common.delete'))}" aria-label="${esc(t('common.delete'))}">${icons.trash}</button>
      <button class="btn small ghost" data-action="clear-selection" title="${esc(t('transactionTable.clear'))}" aria-label="${esc(t('transactionTable.clear'))}">✕</button>
    </div>` : ''}
    <div class="row" style="align-items:center">
      <h2 class="grow" style="margin:0">${esc(t('transactionTable.title', { count: filtered.length }))}</h2>
      ${checkPill({ on: allVisibleSelected, action: 'select-all', label: t('common.all') })}
      <button class="btn primary" data-action="add-tx" title="${esc(t('transactionTable.addTransaction'))}" aria-label="${esc(t('transactionTable.addTransaction'))}">＋</button>
    </div>
    <div class="tx-cards">${draftCard + cards || `<p class="muted">${esc(t('transactionTable.title', { count: 0 }))}</p>`}</div>
    <div class="card tx-table">
      <table>
        <thead>
          <tr>
            <th class="sortable" data-action="sort" data-key="date">${esc(t('common.date'))}${sortIndicator('date')}</th>
            <th>${esc(t('common.description'))}</th>
            <th class="sortable" data-action="sort" data-key="category">${esc(t('common.category'))}${sortIndicator('category')}</th>
            <th class="sortable" data-action="sort" data-key="amount" style="text-align:right">${esc(t('common.amount'))}${sortIndicator('amount')}</th>
            <th>${esc(t('common.actions'))}</th>
          </tr>
        </thead>
        <tbody>${draftRow}${tableRows}</tbody>
      </table>
    </div>
    ${filtered.length > state.visibleCount ? `
    <div class="row" style="justify-content:center;flex-direction:column;align-items:center">
      <button class="btn" data-action="load-more">${esc(t('transactionTable.loadMore'))}</button>
      <span class="muted" style="font-size:0.85rem">${esc(t('transactionTable.showing', { visible: visible.length, total: filtered.length }))}</span>
    </div>` : ''}
  </section>`;
}

function clearFieldError(input) {
  input.closest('.tx-field').querySelector('.field-error')?.remove();
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
}

let fieldErrorCount = 0;
// Errors are written straight into the DOM: a set() would re-render and drop what was typed.
function showFieldError(input, message) {
  const error = document.createElement('p');
  error.className = 'field-error';
  error.id = `tx-field-error-${++fieldErrorCount}`;
  error.setAttribute('role', 'alert');
  error.textContent = message;
  input.closest('.tx-field').append(error);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', error.id);
  input.addEventListener('input', () => clearFieldError(input), { once: true });
}

// The form is rendered twice (cards + table, one hidden by CSS), so read the copy the clicked button sits in.
// Returns null, with the problems shown next to their fields, when it can't be saved.
function readEditForm(button, t) {
  const grid = button.closest('.tx-edit-grid');
  const input = (name) => grid.querySelector(`[name="${name}"]`);
  const amount = Number(input('amount').value);
  const description = input('description').value.trim();
  const problems = [];
  if (!Number.isFinite(amount) || amount === 0) problems.push([input('amount'), t('transactionTable.amountInvalid')]);
  if (!description) problems.push([input('description'), t('transactionTable.descriptionRequired')]);
  for (const name of ['amount', 'description']) clearFieldError(input(name));
  if (problems.length) {
    for (const [field, message] of problems) showFieldError(field, message);
    problems[0][0].focus();
    return null;
  }
  return {
    date: input('date').value || todayIso(),
    amount,
    description,
    category: input('category').value || 'Uncategorized',
  };
}

async function setCategory(id, category, t) {
  const state = get();
  const tx = state.transactions.find(row => row.id === id);
  if (!tx || tx.category === category) return;
  const learnRule = Boolean(tx.description && category !== 'Uncategorized');
  set({ transactions: state.transactions.map(row => row.id === id ? { ...row, category } : row) });
  try {
    const result = await api.patchTransaction(state.activeAccountId, id, { category, learnRule });
    if (result.rule) showLearnedRule(result, tx.description, t);
  } catch (err) {
    toast(err.message);
    await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
  }
}

function showLearnedRule({ rule, applied }, description, t) {
  const ids = new Set(applied.ids);
  const withCategory = (category, from) => get().transactions.map(tx =>
    ids.has(tx.id) && (!from || tx.category === from) ? { ...tx, category } : tx);
  set({
    rules: [...get().rules.filter(r => r.pattern !== rule.pattern), rule],
    transactions: withCategory(rule.category),
  });
  const vars = { count: applied.count, category: rule.category, description };
  if (!applied.count) {
    toast(t('transactionTable.ruleSaved', vars), { type: 'success' });
    return;
  }
  toast(t(applied.count === 1 ? 'transactionTable.appliedOne' : 'transactionTable.appliedMany', vars), {
    type: 'success',
    action: {
      label: t('transactionTable.undo'),
      onClick: async () => {
        await api.uncategorize(applied.ids, rule.category);
        set({ transactions: withCategory('Uncategorized', rule.category) });
      },
    },
  });
}

export const actions = {
  'add-tx': () => set({ creatingTx: true, editingId: null }),
  'cancel-create': () => set({ creatingTx: false }),
  'save-new-tx': async (el, ev, t) => {
    const form = readEditForm(el, t);
    if (!form) return;
    const state = get();
    const tx = await api.createTransaction(state.activeAccountId, {
      ...form,
      type: 'Card Payment',
      state: 'COMPLETED',
    });
    set({
      transactions: [tx, ...state.transactions],
      creatingTx: false,
      filter: { ...state.filter },
    });
  },
  'edit-tx': (el) => set({ editingId: Number(el.dataset.id), creatingTx: false }),
  'cancel-edit': () => set({ editingId: null }),
  'pick-tx-category': (el) => {
    const id = Number(el.dataset.id);
    const tx = get().transactions.find(row => row.id === id);
    openCategoryPicker({ title: tx.description, current: tx.category, onPick: (category, t) => setCategory(id, category, t) });
  },
  'save-tx': async (el, ev, t) => {
    const id = Number(el.dataset.id);
    const form = readEditForm(el, t);
    if (!form) return;
    const state = get();
    const learnRule = Boolean(form.description && form.category && form.category !== 'Uncategorized');
    set({
      editingId: null,
      transactions: state.transactions.map(tx => tx.id === id ? { ...tx, ...form } : tx),
    });
    try {
      const result = await api.patchTransaction(state.activeAccountId, id, { ...form, learnRule });
      if (result.rule) showLearnedRule(result, form.description, t);
    } catch (err) {
      toast(err.message);
      await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
    }
  },
  'delete-tx': async (el, ev, t) => {
    if (!(await confirmDialog(t('transactionTable.confirmDelete'), { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true }))) return;
    const id = Number(el.dataset.id);
    const state = get();
    const selection = new Set(state.selection);
    selection.delete(id);
    set({ transactions: state.transactions.filter(tx => tx.id !== id), selection });
    try {
      await api.deleteTransaction(state.activeAccountId, id);
    } catch (err) {
      toast(err.message);
      await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
    }
  },
  'toggle-select': (el) => {
    const selection = new Set(get().selection);
    const id = Number(el.dataset.id);
    if (selection.has(id)) selection.delete(id);
    else selection.add(id);
    set({ selection });
  },
  'select-all': () => {
    const state = get();
    const filtered = filteredTransactions(state);
    const allSelected = filtered.length > 0 && filtered.every(tx => state.selection.has(tx.id));
    set({ selection: allSelected ? new Set() : new Set(filtered.map(tx => tx.id)) });
  },
  'clear-selection': () => set({ selection: new Set() }),
  'sort': (el) => {
    const { sort } = get();
    const key = el.dataset.key;
    set({
      sort: {
        key,
        direction: sort.key === key && sort.direction === 'asc' ? 'desc' : 'asc',
      },
    });
  },
  'load-more': () => set({ visibleCount: get().visibleCount + 100 }),
  'batch-delete': async (el, ev, t) => {
    const state = get();
    const ids = [...state.selection];
    if (!(await confirmDialog(t('transactionTable.confirmBatchDelete', { count: ids.length }), { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true }))) return;
    await api.batchDelete(state.activeAccountId, ids);
    set({
      transactions: state.transactions.filter(tx => !state.selection.has(tx.id)),
      selection: new Set(),
    });
  },
  'open-batch-edit': () => setUi({ batchEditOpen: true, batchNewCategory: false }),
};
