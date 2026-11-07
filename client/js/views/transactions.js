import { esc, eur, eurSigned, icons, checkPill, toast } from '../dom.js';
import { get, set, setUi, setFilter } from '../store.js';
import { api } from '../api.js';
import { filteredTransactions, stats, accountBalance, dayTitle, monthTitle } from '../derive.js';
import { isoToDisplay, todayIso, toIso } from '/shared/dates.js';
import { render as renderFilters } from './filters.js';
import { openCategoryPicker } from './category-picker.js';

function periodLabel(state, t) {
  const f = state.filter;
  if (f.currentMonth) return t('app.thisMonth');
  if (f.dateFilterType === 'year' && f.year) return f.year;
  if (f.dateFilterType === 'month' && f.month) {
    const named = { __last_month__: 'app.lastMonth', __last_3_months__: 'app.last3Months', __last_6_months__: 'app.last6Months' }[f.month];
    return named ? t(named) : monthTitle(f.month, state.ui.lang);
  }
  if (f.dateFilterType === 'dateRange' && f.startDate && f.endDate) return `${isoToDisplay(f.startDate)} – ${isoToDisplay(f.endDate)}`;
  return t('app.allTime');
}

const localeOf = (lang) => lang === 'fr' ? 'fr-FR' : 'en-GB';

function dayHeading(iso, lang, t) {
  const today = todayIso();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === today) return t('transactionTable.today');
  if (iso === toIso(yesterday)) return t('transactionTable.yesterday');
  const [year, month, day] = iso.split('-').map(Number);
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  const name = new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
    .format(new Date(year, month - 1, day));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function longDate(iso, lang) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(localeOf(lang), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, day));
}

function emptyMessage(f, lang, t) {
  if (f.description.trim() || f.categories.length) return t('transactionTable.emptyFiltered');
  if (f.currentMonth) return t('transactionTable.emptyThisMonth');
  if (f.dateFilterType === 'year' && f.year) return t('transactionTable.emptyIn', { period: f.year });
  if (f.dateFilterType === 'dateRange' && f.startDate && f.endDate) {
    const day = new Intl.DateTimeFormat(localeOf(lang), { day: 'numeric', month: 'short', year: 'numeric' });
    return t('transactionTable.emptyRange', { start: day.format(new Date(`${f.startDate}T00:00`)), end: day.format(new Date(`${f.endDate}T00:00`)) });
  }
  if (f.dateFilterType === 'month' && f.month) {
    const named = { __last_month__: 'emptyLastMonth', __last_3_months__: 'emptyLast3Months', __last_6_months__: 'emptyLast6Months' }[f.month];
    if (named) return t(`transactionTable.${named}`);
    const [year, month] = f.month.split('-').map(Number);
    return t('transactionTable.emptyIn', { period: new Intl.DateTimeFormat(localeOf(lang), { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)) });
  }
  return t('transactionTable.emptyFiltered');
}

export function renderTiles(state, rows, t) {
  const s = stats(rows);
  const balance = accountBalance(state);
  let balanceBody;
  if (balance.amount !== null) {
    balanceBody = `
      <div class="value ${balance.amount < 0 ? 'neg' : ''}">${balance.amount < 0 ? eurSigned(balance.amount) : eur(balance.amount)}</div>
      <div class="tile-meta">${esc(balance.asOf === todayIso() ? t('app.asOfToday') : t('app.asOf', { date: dayTitle(balance.asOf, state.ui.lang) }))}</div>`;
  } else if (balance.source === 'bank') {
    balanceBody = `<div class="value muted">—</div><div class="tile-meta">${esc(t('app.balancePending'))}</div>`;
  } else {
    balanceBody = `<div class="value muted">—</div><button class="btn small" data-action="open-set-balance">${esc(t('header.setBalance'))}</button>`;
  }
  return `
  <div class="tiles">
    <div class="card tile total-tile">
      <div class="label">${esc(t('app.balance'))}</div>
      ${balanceBody}
    </div>
    <div class="card tile total-tile">
      <div class="label">${esc(t('app.netPeriod', { period: periodLabel(state, t) }))}</div>
      <div class="value ${s.total >= 0 ? 'pos' : 'neg'}">${eurSigned(s.total)}</div>
      <div class="tile-meta">
        <span>${esc(t('app.moneyIn'))} <span class="pos">${eur(s.income)}</span></span>
        <span>${esc(t('app.moneyOut'))} <span class="neg">${eur(s.spending)}</span></span>
      </div>
    </div>
  </div>`;
}

const editField = (label, control, span2 = false) => `<div class="tx-field${span2 ? ' span2' : ''}"><label><span>${esc(label)}</span>${control}</label></div>`;

export function render(state, t) {
  const filtered = filteredTransactions(state);
  const visible = filtered.slice(0, state.visibleCount);
  const selection = state.selection;
  const selecting = Boolean(state.selecting) || selection.size > 0;
  const allVisibleSelected = filtered.length > 0 && filtered.every(tx => selection.has(tx.id));
  const sortIndicator = (key) => state.sort.key === key ? (state.sort.direction === 'asc' ? ' ▲' : ' ▼') : '';
  const rowAction = selecting ? 'toggle-select' : 'open-tx';
  const opensSheet = selecting ? '' : ' aria-haspopup="dialog"';

  const draft = state.txDraft || { date: todayIso(), amount: '', description: '', category: 'Uncategorized' };
  const createForm = `
    <div class="tx-edit-grid">
      ${editField(t('common.date'), `<input name="date" type="date" value="${esc(draft.date)}">`)}
      ${editField(t('common.amount'), `<input name="amount" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${esc(draft.amount)}">`)}
      ${editField(t('common.description'), `<input name="description" value="${esc(draft.description)}">`, true)}
      ${editField(t('common.category'), `<input type="hidden" name="category" value="${esc(draft.category)}"><button type="button" class="chip-select" data-action="pick-form-category" aria-haspopup="dialog">${esc(draft.category)}</button>`, true)}
      <button class="btn primary" data-action="save-new-tx">${esc(t('common.save'))}</button>
      <button class="btn" data-action="cancel-create">${esc(t('common.cancel'))}</button>
    </div>`;
  const draftItem = state.creatingTx ? `<div class="card tx-item editing">${createForm}</div>` : '';
  const draftRow = state.creatingTx ? `<tr><td colspan="5">${createForm}</td></tr>` : '';

  const catSelect = (tx) => `<button class="chip-select" data-action="pick-tx-category" data-id="${tx.id}" aria-haspopup="dialog" aria-label="${esc(t('categoryPicker.trigger', { category: tx.category }))}">${esc(tx.category)}</button>`;

  const item = (tx) => {
    const on = selection.has(tx.id);
    return `
      <button type="button" class="tx-item${on ? ' selected' : ''}" data-action="${rowAction}" data-id="${tx.id}"${selecting ? ` aria-pressed="${on}"` : opensSheet}>
        ${selecting ? `<span class="check-box" aria-hidden="true">${icons.check}</span>` : ''}
        <span class="tx-item-main">
          <span class="tx-desc">${esc(tx.description) || '—'}</span>
          <span class="tx-cat${tx.category === 'Uncategorized' ? ' uncat' : ''}">${esc(tx.category)}</span>
        </span>
        <span class="tx-amount ${tx.amount >= 0 ? 'pos' : 'neg'}">${eurSigned(tx.amount)}</span>
      </button>`;
  };
  const days = [];
  for (const tx of visible) {
    const last = days[days.length - 1];
    if (last?.date === tx.date) last.rows.push(tx);
    else days.push({ date: tx.date, rows: [tx] });
  }
  const dayList = days.map(day => `
    <section class="tx-day">
      <h3 class="tx-day-title">${esc(dayHeading(day.date, state.ui.lang, t))}</h3>
      <div class="card tx-day-rows">${day.rows.map(item).join('')}</div>
    </section>`).join('');

  let empty = '';
  if (!state.creatingTx && state.transactions.length === 0) {
    empty = `
    <div class="card tx-empty">
      <p>${esc(t('transactionTable.emptyAll'))}</p>
      <button class="btn primary" data-action="add-tx">＋ ${esc(t('transactionTable.addTransaction'))}</button>
    </div>`;
  } else if (!state.creatingTx && filtered.length === 0) {
    empty = `
    <div class="card tx-empty">
      <p>${esc(emptyMessage(state.filter, state.ui.lang, t))}</p>
      <button class="btn" data-action="tx-show-all">${esc(t('transactionTable.showAll'))}</button>
    </div>`;
  }

  const listActions = selecting
    ? `${checkPill({ on: allVisibleSelected, action: 'select-all', label: t('common.all') })}
      <button class="btn" data-action="tx-select-cancel">${esc(t('common.cancel'))}</button>`
    : `${filtered.length ? `<button class="btn" data-action="tx-select-mode">${esc(t('transactionTable.select'))}</button>` : ''}
      <button class="btn primary" data-action="add-tx" title="${esc(t('transactionTable.addTransaction'))}" aria-label="${esc(t('transactionTable.addTransaction'))}">＋</button>`;

  const checkButton = (on, action, label, data = '') =>
    `<button class="check-box-btn${on ? ' on' : ''}" data-action="${action}" ${data} role="checkbox" aria-checked="${on}" aria-label="${esc(label)}"><span class="check-box">${icons.check}</span></button>`;

  const tableRows = visible.map(tx => {
    const on = selection.has(tx.id);
    return `
    <tr class="selectable ${on ? 'selected' : ''}" data-action="${rowAction}" data-id="${tx.id}">
      <td class="check-cell">${checkButton(on, 'toggle-select', t('transactionTable.selectRow', { description: tx.description }), `data-id="${tx.id}"`)}</td>
      <td class="num">${esc(isoToDisplay(tx.date))}</td>
      <td><button class="tx-open" data-action="${rowAction}" data-id="${tx.id}"${opensSheet}>${esc(tx.description) || '—'}</button></td>
      <td>${catSelect(tx)}</td>
      <td class="amount ${tx.amount >= 0 ? 'pos' : 'neg'}">${eur(tx.amount)}</td>
    </tr>`;
  }).join('');

  return `
  <section class="view ${selection.size > 0 ? 'has-selection' : ''}">
    ${renderTiles(state, filtered, t)}
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
      ${listActions}
    </div>
    ${empty || `
    <div class="tx-list">${draftItem}${dayList}</div>
    <div class="card tx-table">
      <table>
        <thead>
          <tr>
            <th class="check-cell">${checkButton(allVisibleSelected, 'select-all', t('transactionTable.selectAll'))}</th>
            <th class="sortable" data-action="sort" data-key="date">${esc(t('common.date'))}${sortIndicator('date')}</th>
            <th>${esc(t('common.description'))}</th>
            <th class="sortable" data-action="sort" data-key="category">${esc(t('common.category'))}${sortIndicator('category')}</th>
            <th class="sortable" data-action="sort" data-key="amount" style="text-align:right">${esc(t('common.amount'))}${sortIndicator('amount')}</th>
          </tr>
        </thead>
        <tbody>${draftRow}${tableRows}</tbody>
      </table>
    </div>`}
    ${filtered.length > state.visibleCount ? `
    <div class="row" style="justify-content:center;flex-direction:column;align-items:center">
      <button class="btn" data-action="load-more">${esc(t('transactionTable.loadMore'))}</button>
      <span class="muted" style="font-size:0.85rem">${esc(t('transactionTable.showing', { visible: visible.length, total: filtered.length }))}</span>
    </div>` : ''}
  </section>`;
}

// The detail sheet lives in `#modals`. Its state is `ui.txSheet = { id, draft }`; `draft` is set while editing.
export function renderSheet(state, t) {
  const sheet = state.ui.txSheet;
  const tx = sheet && state.transactions.find(row => row.id === sheet.id);
  if (!tx) return '';
  const head = (title) => `
    <div class="modal-head">
      <h2 id="tx-sheet-title">${esc(title)}</h2>
      <button class="icon-btn" id="tx-sheet-close" data-action="tx-sheet-close" title="${esc(t('common.close'))}" aria-label="${esc(t('common.close'))}">✕</button>
    </div>`;

  let body;
  if (sheet.draft) {
    const v = sheet.draft;
    body = `
      ${head(t('transactionDetail.editTitle'))}
      <div class="tx-edit-grid">
        ${editField(t('common.description'), `<input id="tx-sheet-description" name="description" value="${esc(v.description)}" data-action-key="save-tx">`, true)}
        ${editField(t('common.amount'), `<input id="tx-sheet-amount" name="amount" type="number" inputmode="decimal" step="0.01" placeholder="0.00" value="${esc(v.amount)}" data-action-key="save-tx">`)}
        ${editField(t('common.date'), `<input id="tx-sheet-date" name="date" type="date" value="${esc(v.date)}" data-action-key="save-tx">`)}
        ${editField(t('common.category'), `<input type="hidden" name="category" value="${esc(v.category)}"><button type="button" id="tx-sheet-category" class="chip-select" data-action="tx-sheet-pick-category" aria-haspopup="dialog">${esc(v.category)}</button>`, true)}
        <button class="btn" id="tx-sheet-cancel" data-action="tx-sheet-cancel">${esc(t('common.cancel'))}</button>
        <button class="btn primary" id="tx-sheet-save" data-action="save-tx">${esc(t('common.save'))}</button>
      </div>`;
  } else {
    const account = state.accounts.find(a => a.id === state.activeAccountId);
    body = `
      ${head(tx.description || t('transactionDetail.title'))}
      <p class="tx-sheet-amount ${tx.amount >= 0 ? 'pos' : 'neg'}">${eurSigned(tx.amount)}</p>
      <dl class="tx-sheet-facts">
        <div><dt>${esc(t('common.date'))}</dt><dd>${esc(longDate(tx.date, state.ui.lang))}</dd></div>
        <div>
          <dt>${esc(t('common.category'))}</dt>
          <dd><button id="tx-sheet-category" class="chip-select" data-action="pick-tx-category" data-id="${tx.id}" aria-haspopup="dialog" aria-label="${esc(t('categoryPicker.trigger', { category: tx.category }))}">${esc(tx.category)}</button></dd>
        </div>
        <div><dt>${esc(t('transactionDetail.account'))}</dt><dd>${esc(account?.name)}</dd></div>
      </dl>
      <div class="tx-sheet-actions">
        <button class="btn tx-sheet-delete" id="tx-sheet-delete" data-action="delete-tx" data-id="${tx.id}">${icons.trash}${esc(t('common.delete'))}</button>
        <button class="btn primary" id="tx-sheet-edit" data-action="tx-sheet-edit">${icons.edit}${esc(t('common.edit'))}</button>
      </div>`;
  }

  return `
  <div class="modal-backdrop" data-action="tx-sheet-close" data-self-only>
    <div class="modal tx-sheet" id="tx-sheet" role="dialog" aria-modal="true" aria-labelledby="tx-sheet-title" tabindex="-1">${body}</div>
  </div>`;
}

// Rows are rendered twice (phone list and desktop table, one hidden by CSS): focus the visible one.
function focusRow(id) {
  [...document.querySelectorAll(`.tx-item[data-id="${id}"], .tx-open[data-id="${id}"]`)].find(el => el.offsetParent)?.focus();
}

function openSheet(id) {
  setUi({ txSheet: { id, draft: null } });
  document.getElementById('tx-sheet')?.focus();
}

function closeSheet() {
  const sheet = get().ui.txSheet;
  setUi({ txSheet: null });
  if (sheet) focusRow(sheet.id);
}

document.addEventListener('keydown', (ev) => {
  // The category picker above the sheet takes the Escape first and marks it handled.
  if (ev.key !== 'Escape' || ev.defaultPrevented || !get().ui.txSheet) return;
  ev.preventDefault();
  closeSheet();
});

// What is typed goes into the draft without a re-render, so the next render (the picker opening,
// a toast's Undo) rebuilds the form with it instead of dropping it.
document.addEventListener('input', (ev) => {
  const draft = get().ui.txSheet?.draft;
  if (draft && ev.target.closest('#tx-sheet') && ev.target.name in draft) draft[ev.target.name] = ev.target.value;
});

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

// The add form is rendered twice (list + table, one hidden by CSS), so read the copy the clicked button sits in.
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

// A delete waits for its Undo snackbar to run out before reaching the server. At most one is pending:
// the next toast replaces the snackbar, which sends it.
let pendingDelete = null;

function deleteWithUndo(ids, t) {
  const state = get();
  const remove = new Set(ids);
  const visible = filteredTransactions(state).slice(0, state.visibleCount);
  const at = visible.findIndex(tx => remove.has(tx.id));
  const neighbour = at < 0 ? null : visible.slice(at).find(tx => !remove.has(tx.id)) || visible[at - 1];
  const rows = state.transactions.flatMap((tx, index) => remove.has(tx.id) ? [{ tx, index }] : []);
  set({ transactions: state.transactions.filter(tx => !remove.has(tx.id)), selection: new Set(), selecting: false });
  if (neighbour) focusRow(neighbour.id);

  const pending = { accountId: state.activeAccountId, rows };
  pending.dismiss = toast(t(rows.length === 1 ? 'transactionTable.deletedOne' : 'transactionTable.deletedMany', { count: rows.length }), {
    type: 'success',
    action: {
      label: t('transactionTable.undo'),
      onClick: () => {
        restoreRows(pending);
        focusRow(rows[0].tx.id);
      },
    },
    onExpire: () => sendDelete(pending, t),
  });
  pendingDelete = pending;
}

function restoreRows(pending) {
  if (pendingDelete === pending) pendingDelete = null;
  const state = get();
  if (state.activeAccountId !== pending.accountId) return;
  const transactions = [...state.transactions];
  for (const { tx, index } of pending.rows) {
    if (!transactions.some(row => row.id === tx.id)) transactions.splice(index, 0, tx);
  }
  set({ transactions });
}

async function sendDelete(pending, t) {
  if (pendingDelete === pending) pendingDelete = null;
  const ids = pending.rows.map(row => row.tx.id);
  try {
    await api.batchDelete(pending.accountId, ids);
  } catch (err) {
    restoreRows(pending);
    toast(t('transactionTable.notDeleted', { message: err.message }), { type: err.network ? 'info' : 'error' });
    return;
  }
  // An account reload inside the Undo window brings the rows back from the server.
  const gone = new Set(ids);
  if (get().transactions.some(tx => gone.has(tx.id))) set({ transactions: get().transactions.filter(tx => !gone.has(tx.id)) });
}

// Leaving or closing the app inside the Undo window would lose the delete: send it now, with
// keepalive so the request outlives the page.
function sendPendingDeleteNow() {
  const pending = pendingDelete;
  if (!pending) return;
  pendingDelete = null;
  pending.dismiss();
  fetch(`/api/accounts/${pending.accountId}/transactions/batch-delete`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: pending.rows.map(row => row.tx.id) }),
  }).then(res => {
    if (!res.ok) throw new Error(res.status);
  }).catch(() => restoreRows(pending));
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') sendPendingDeleteNow();
});
window.addEventListener('pagehide', sendPendingDeleteNow);

export const actions = {
  'add-tx': () => set({ creatingTx: true, txDraft: null }),
  'cancel-create': () => set({ creatingTx: false, txDraft: null }),
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
      txDraft: null,
      filter: { ...state.filter },
    });
  },
  // Opening the picker re-renders the app, which would rebuild the add form and drop what was typed: keep it as a draft.
  'pick-form-category': (el, ev, t) => {
    const grid = el.closest('.tx-edit-grid');
    const value = (name) => grid.querySelector(`[name="${name}"]`).value;
    set({ txDraft: { date: value('date'), amount: value('amount'), description: value('description'), category: value('category') } });
    openCategoryPicker({
      title: value('description') || t('common.category'),
      current: value('category'),
      onPick: (category) => set({ txDraft: { ...get().txDraft, category } }),
    });
  },
  'pick-tx-category': (el) => {
    const id = Number(el.dataset.id);
    const tx = get().transactions.find(row => row.id === id);
    openCategoryPicker({
      title: tx.description,
      current: tx.category,
      onPick: (category, t) => {
        document.getElementById('tx-sheet-category')?.focus();
        return setCategory(id, category, t);
      },
    });
  },
  'open-tx': (el) => openSheet(Number(el.dataset.id)),
  'tx-sheet-close': closeSheet,
  'tx-sheet-edit': () => {
    const sheet = get().ui.txSheet;
    const tx = get().transactions.find(row => row.id === sheet.id);
    setUi({ txSheet: { ...sheet, draft: { description: tx.description, amount: tx.amount, date: tx.date, category: tx.category } } });
    document.getElementById('tx-sheet-description').focus();
  },
  'tx-sheet-cancel': () => {
    setUi({ txSheet: { ...get().ui.txSheet, draft: null } });
    document.getElementById('tx-sheet-edit').focus();
  },
  'tx-sheet-pick-category': (el, ev, t) => {
    const { draft } = get().ui.txSheet;
    openCategoryPicker({
      title: draft.description || t('common.category'),
      current: draft.category,
      onPick: (category) => {
        const sheet = get().ui.txSheet;
        if (sheet?.draft) setUi({ txSheet: { ...sheet, draft: { ...sheet.draft, category } } });
        document.getElementById('tx-sheet-category')?.focus();
      },
    });
  },
  'save-tx': async (el, ev, t) => {
    const form = readEditForm(el, t);
    if (!form) return;
    const state = get();
    const { id } = state.ui.txSheet;
    const learnRule = form.category !== 'Uncategorized';
    set({ transactions: state.transactions.map(tx => tx.id === id ? { ...tx, ...form } : tx) });
    setUi({ txSheet: { id, draft: null } });
    document.getElementById('tx-sheet-edit')?.focus();
    try {
      const result = await api.patchTransaction(state.activeAccountId, id, { ...form, learnRule });
      if (result.rule) showLearnedRule(result, form.description, t);
    } catch (err) {
      toast(err.message);
      await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
    }
  },
  'delete-tx': (el, ev, t) => {
    setUi({ txSheet: null });
    deleteWithUndo([Number(el.dataset.id)], t);
  },
  'batch-delete': (el, ev, t) => deleteWithUndo([...get().selection], t),
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
  'clear-selection': () => set({ selection: new Set(), selecting: false }),
  'tx-select-mode': () => set({ selecting: true, creatingTx: false, txDraft: null }),
  'tx-select-cancel': () => set({ selection: new Set(), selecting: false }),
  'tx-show-all': () => setFilter({ currentMonth: false, dateFilterType: 'all', year: '', month: '', startDate: '', endDate: '', categories: [], description: '' }),
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
  'open-batch-edit': () => setUi({ batchEditOpen: true, batchNewCategory: false }),
};
