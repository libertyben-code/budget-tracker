import { esc, money, toast } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { dayTitle, accountCurrency } from '../derive.js';
import { normalizeDescription } from '/shared/categorize.js';
import { openCategoryPicker } from './category-picker.js';

const PAGE = 100;
const BACK_KEYS = { dashboard: 'categorise.backDashboard', transactions: 'categorise.backTransactions' };
const chevronLeft = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';

// The tab it was opened from rides on the history entry, so Back pops it, and the phone's back
// button and a reload agree with it.
export function openInbox() {
  history.pushState({ inboxFrom: get().ui.tab }, '', '#/categorise');
  setUi({ tab: 'categorise', inboxLimit: PAGE });
}

function backKey() {
  return BACK_KEYS[history.state?.inboxFrom] || BACK_KEYS.dashboard;
}

const displayName = (description) => (description || '').trim().replace(/\s+/g, ' ');

function pending(state) {
  return state.transactions
    .filter(tx => tx.category === 'Uncategorized')
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

function groupsOf(rows) {
  const groups = new Map();
  for (const tx of rows) {
    const key = normalizeDescription(tx.description);
    if (!groups.has(key)) groups.set(key, { key, name: displayName(tx.description), rows: [], total: 0 });
    const group = groups.get(key);
    group.rows.push(tx);
    group.total += tx.amount;
  }
  return [...groups.values()].sort((a, b) =>
    b.rows.length - a.rows.length || Math.abs(b.total) - Math.abs(a.total) || a.name.localeCompare(b.name));
}

function focusItem(index) {
  const items = document.querySelectorAll('.inbox-list .tx-item');
  (items[Math.min(index, items.length - 1)] || document.getElementById('inbox-done-back'))?.focus();
}

// Learns the rule from the first row, so M1's apply-to-similar also moves matching rows in every
// account. Rows the rule misses (a description differing only in spacing) are set directly.
async function categorise(rows, title, category, index, t) {
  if (category === 'Uncategorized') return;
  const { activeAccountId: accountId, rules: rulesBefore } = get();
  const ids = new Set(rows.map(tx => tx.id));
  const withCategory = (to, from) => get().transactions.map(tx => ids.has(tx.id) && tx.category === from ? { ...tx, category: to } : tx);
  set({ transactions: withCategory(category, 'Uncategorized') });
  focusItem(index);

  let result;
  try {
    result = await api.patchTransaction(accountId, rows[0].id, { category, learnRule: true });
    const covered = new Set([rows[0].id, ...(result.applied?.ids || [])]);
    const rest = rows.filter(tx => !covered.has(tx.id)).map(tx => tx.id);
    if (rest.length) await api.batchEdit(accountId, rest, { category });
  } catch (err) {
    toast(err.message);
    await import('../app.js').then(m => m.loadAccount(get().activeAccountId));
    return;
  }

  const { rule, applied } = result;
  for (const id of applied?.ids || []) ids.add(id);
  const before = rule && rulesBefore.find(r => r.pattern === rule.pattern);
  const withRule = (replacement) => [...get().rules.filter(r => r.pattern !== rule.pattern), ...(replacement ? [replacement] : [])];
  set({ rules: rule ? withRule(rule) : get().rules, transactions: withCategory(category, 'Uncategorized') });

  toast(t(ids.size === 1 ? 'categorise.setOne' : 'categorise.setMany', { category, count: ids.size, description: title }), {
    type: 'success',
    action: {
      label: t('categorise.undo'),
      onClick: async () => {
        await api.uncategorize([...ids], category);
        if (rule) await (before ? api.addRule(before.pattern, before.category) : api.deleteRules([rule.pattern]));
        set({ rules: rule ? withRule(before) : get().rules, transactions: withCategory('Uncategorized', category) });
      },
    },
  });
}

export function render(state, t) {
  const rows = pending(state);
  const lang = state.ui.lang;
  const currency = accountCurrency(state);
  const byDate = state.ui.inboxMode === 'date';
  const items = byDate ? rows : groupsOf(rows);
  const limit = state.ui.inboxLimit || PAGE;
  const count = (n) => t(n === 1 ? 'categorise.countOne' : 'categorise.countMany', { count: n });
  const back = esc(t(backKey()));

  const head = `
    <div class="inbox-head">
      <button id="inbox-back" class="icon-btn" data-action="inbox-back" aria-label="${back}" title="${back}">${chevronLeft}</button>
      <div class="grow">
        <h2>${esc(t('categorise.title'))}</h2>
        ${rows.length ? `<p>${esc(count(rows.length))}</p>` : ''}
      </div>
    </div>`;

  if (!rows.length) {
    return `
  <section class="view">
    ${head}
    <div class="card tx-empty">
      <h3>${esc(t('categorise.doneTitle'))}</h3>
      <p>${esc(t('categorise.doneText'))}</p>
      <button id="inbox-done-back" class="btn primary" data-action="inbox-back">${back}</button>
    </div>
  </section>`;
  }

  const modeBtn = (mode, label) => {
    const on = byDate === (mode === 'date');
    return `<button id="inbox-mode-${mode}" class="${on ? 'active' : ''}" data-action="inbox-mode" data-mode="${mode}" aria-pressed="${on}">${esc(t(label))}</button>`;
  };
  const item = (it, i) => {
    const [label, meta, amount, data] = byDate
      ? [displayName(it.description), dayTitle(it.date, lang), it.amount, `data-id="${it.id}"`]
      : [it.name, count(it.rows.length), it.total, `data-key="${esc(it.key)}"`];
    return `
      <button type="button" id="inbox-item-${i}" class="tx-item" data-action="inbox-pick" data-index="${i}" ${data} aria-haspopup="dialog">
        <span class="tx-item-main">
          <span class="tx-desc">${esc(label || t('categorise.noDescription'))}</span>
          <span class="inbox-meta">${esc(meta)}</span>
        </span>
        <span class="tx-amount ${amount >= 0 ? 'pos' : 'neg'}">${money(amount, { currency, signed: true })}</span>
      </button>`;
  };

  return `
  <section class="view">
    ${head}
    <div class="seg inbox-seg" role="group" aria-label="${esc(t('categorise.view'))}">
      ${modeBtn('merchant', 'categorise.byMerchant')}
      ${modeBtn('date', 'categorise.byDate')}
    </div>
    <p class="inbox-hint">${esc(t('categorise.hint'))}</p>
    <div class="card inbox-list">${items.slice(0, limit).map(item).join('')}</div>
    ${items.length > limit ? `<button class="btn inbox-more" data-action="inbox-more">${esc(t('categorise.showMore'))}</button>` : ''}
  </section>`;
}

export const actions = {
  'inbox-back': () => history.state?.inboxFrom ? history.back() : location.replace('#/dashboard'),
  'inbox-mode': (el) => setUi({ inboxMode: el.dataset.mode, inboxLimit: PAGE }),
  'inbox-more': () => setUi({ inboxLimit: (get().ui.inboxLimit || PAGE) + PAGE }),
  'inbox-pick': (el, ev, t) => {
    const rows = pending(get());
    const picked = el.dataset.id
      ? rows.filter(tx => tx.id === Number(el.dataset.id))
      : groupsOf(rows).find(g => g.key === el.dataset.key)?.rows;
    if (!picked?.length) return;
    const title = displayName(picked[0].description) || t('categorise.noDescription');
    const index = Number(el.dataset.index);
    openCategoryPicker({
      title,
      current: 'Uncategorized',
      onPick: (category, t) => categorise(picked, title, category, index, t),
    });
  },
};
