import { esc, eur, icons, toast } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { filteredTransactions, categories, stats } from '../derive.js';
import { isoToDisplay, todayIso } from '/shared/dates.js';
import { render as renderFilters } from './filters.js';

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
  const editRow = (tx) => `
    <div class="tx-edit-grid" data-editing="${tx.id}">
      <input id="edit-date" type="date" value="${esc(tx.date)}">
      <input id="edit-amount" type="number" inputmode="decimal" step="0.01" value="${esc(tx.amount)}">
      <input id="edit-desc" class="span2" placeholder="${esc(t('common.description'))}" value="${esc(tx.description)}">
      <select id="edit-cat" class="span2">
        ${editCats.map(c => `<option value="${esc(c)}" ${tx.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select>
      <button class="btn primary" data-action="save-tx" data-id="${tx.id}">${esc(t('common.save'))}</button>
      <button class="btn" data-action="cancel-edit">${esc(t('common.cancel'))}</button>
    </div>`;

  const catSelect = (tx) => `<select class="chip-select" data-action="noop" data-action-change="set-category" data-id="${tx.id}" aria-label="${esc(t('common.category'))}">${editCats.map(c => `<option value="${esc(c)}" ${tx.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`;

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
      <label class="row" style="gap:6px;font-size:0.85rem;color:var(--muted)">
        <input type="checkbox" data-action-change="select-all" ${allVisibleSelected ? 'checked' : ''}> ${esc(t('common.all'))}
      </label>
      <button class="btn primary" data-action="add-tx" title="${esc(t('transactionTable.addTransaction'))}" aria-label="${esc(t('transactionTable.addTransaction'))}">＋</button>
    </div>
    <div class="tx-cards">${cards || `<p class="muted">${esc(t('transactionTable.title', { count: 0 }))}</p>`}</div>
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
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    ${filtered.length > state.visibleCount ? `
    <div class="row" style="justify-content:center;flex-direction:column;align-items:center">
      <button class="btn" data-action="load-more">${esc(t('transactionTable.loadMore'))}</button>
      <span class="muted" style="font-size:0.85rem">${esc(t('transactionTable.showing', { visible: visible.length, total: filtered.length }))}</span>
    </div>` : ''}
  </section>`;
}

function readEditForm() {
  return {
    date: document.getElementById('edit-date')?.value || todayIso(),
    amount: parseFloat(document.getElementById('edit-amount')?.value) || 0,
    description: document.getElementById('edit-desc')?.value.trim() || '',
    category: document.getElementById('edit-cat')?.value || 'Uncategorized',
  };
}

export const actions = {
  'add-tx': async () => {
    const state = get();
    const tx = await api.createTransaction(state.activeAccountId, {
      date: todayIso(),
      description: '',
      category: 'Uncategorized',
      amount: 0,
      type: 'Card Payment',
      state: 'COMPLETED',
    });
    set({
      transactions: [tx, ...state.transactions],
      editingId: tx.id,
      filter: { ...state.filter },
    });
  },
  'edit-tx': (el) => set({ editingId: Number(el.dataset.id) }),
  'cancel-edit': () => set({ editingId: null }),
  'noop': () => {},
  'set-category': async (el) => {
    const id = Number(el.dataset.id);
    const category = el.value;
    const state = get();
    const tx = state.transactions.find(t => t.id === id);
    if (!tx || tx.category === category) return;
    const learnRule = Boolean(tx.description && category !== 'Uncategorized');
    set({ transactions: state.transactions.map(t => t.id === id ? { ...t, category } : t) });
    try {
      const result = await api.patchTransaction(id, { category, learnRule });
      if (result.rule) {
        const rules = get().rules.filter(r => r.pattern !== result.rule.pattern);
        set({ rules: [...rules, result.rule] });
      }
    } catch (err) {
      toast(err.message);
      await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
    }
  },
  'save-tx': async (el) => {
    const id = Number(el.dataset.id);
    const form = readEditForm();
    const state = get();
    const learnRule = Boolean(form.description && form.category && form.category !== 'Uncategorized');
    set({
      editingId: null,
      transactions: state.transactions.map(tx => tx.id === id ? { ...tx, ...form } : tx),
    });
    try {
      const result = await api.patchTransaction(id, { ...form, learnRule });
      if (result.rule) {
        const rules = get().rules.filter(r => r.pattern !== result.rule.pattern);
        set({ rules: [...rules, result.rule] });
      }
    } catch (err) {
      toast(err.message);
      await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
    }
  },
  'delete-tx': async (el, ev, t) => {
    if (!window.confirm(t('transactionTable.confirmDelete'))) return;
    const id = Number(el.dataset.id);
    const state = get();
    const selection = new Set(state.selection);
    selection.delete(id);
    set({ transactions: state.transactions.filter(tx => tx.id !== id), selection });
    try {
      await api.deleteTransaction(id);
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
  'select-all': (el) => {
    const filtered = filteredTransactions(get());
    set({ selection: el.checked ? new Set(filtered.map(tx => tx.id)) : new Set() });
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
    if (!window.confirm(t('transactionTable.confirmBatchDelete', { count: ids.length }))) return;
    await api.batchDelete(ids);
    set({
      transactions: state.transactions.filter(tx => !state.selection.has(tx.id)),
      selection: new Set(),
    });
  },
  'open-batch-edit': () => setUi({ batchEditOpen: true, batchNewCategory: false }),
};
