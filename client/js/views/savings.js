import { esc, money, categoryName, chartColors, icons, toast, confirmDialog, resetFields } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { refreshSavings } from '../app.js';
import { categories } from '../derive.js';
import { isoToDisplay } from '/shared/dates.js';

// Savings accounts have no currency of their own.
const currency = 'EUR';
let kept = null;

export function render(state, t) {
  const accounts = state.savingsAccounts;
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const withBalance = accounts.filter(a => a.balance > 0);

  return `
  <section class="view">
    <div class="card tile" style="text-align:center">
      <div class="label">${esc(t('savings.totalSaved'))}</div>
      <div class="value hero pos">${money(total, { currency })}</div>
    </div>

    ${withBalance.length > 0 ? `
    <div class="card">
      <h2>${esc(t('savings.splitByAccount'))}</h2>
      <div class="chart-box"><canvas id="chart-savings"></canvas></div>
    </div>` : ''}

    <div class="row" style="margin:0">
      <h2 class="grow" style="margin:0">${esc(t('savings.accountsTitle'))}</h2>
      <button class="btn small primary" id="savings-add-toggle" data-action="toggle-add-savings" title="${esc(t('savings.addAccount'))}" aria-label="${esc(t('savings.addAccount'))}" aria-expanded="${state.ui.addingSavings}">${state.ui.addingSavings ? '✕' : '＋'}</button>
    </div>
    ${state.ui.addingSavings ? `
    <div class="card savings-account">
      <div class="row">
        <input id="new-savings-name" class="grow" placeholder="${esc(t('savings.savingsAccountName'))}" aria-label="${esc(t('savings.savingsAccountName'))}" data-action-key="add-savings">
        <input id="new-savings-balance" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('savings.initialBalance'))}" aria-label="${esc(t('savings.initialBalance'))}" style="width:130px" data-action-key="add-savings">
      </div>
      <div class="row">
        ${categorySelect('new-savings-category', '', state, t)}
        <button class="btn small primary" data-action="add-savings">${esc(t('common.save'))}</button>
      </div>
    </div>` : ''}
    ${accounts.map(a => renderAccount(a, state, t, total)).join('') || `<p class="muted">${esc(t('savings.noAccounts'))}</p>`}
  </section>`;
}

function categorySelect(id, selected, state, t) {
  return `
        <label class="row grow" style="gap:6px"><span class="muted" style="font-size:0.8rem;white-space:nowrap">${esc(t('savings.fedBy'))}</span>
          <select id="${id}" class="grow">
            <option value="">${esc(t('savings.manual'))}</option>
            ${categories(state).map(c => `<option value="${esc(c)}" ${c === selected ? 'selected' : ''}>${esc(categoryName(c, t))}</option>`).join('')}
          </select>
        </label>`;
}

function renderAccount(a, state, t, total) {
  const history = state.savingsHistory[a.id] || [];
  const recurring = state.savingsRecurring[a.id] || [];
  const historyOpen = state.ui.openHistoryIds.has(a.id);
  const recurringOpen = state.ui.openRecurringIds.has(a.id);
  const pct = total > 0 ? ((a.balance / total) * 100).toFixed(1) : '0.0';

  if (state.ui.editingSavingsId === a.id) {
    return `
    <div class="card savings-account" data-id="${esc(a.id)}">
      <div class="row">
        <input id="edit-savings-name" class="grow" value="${esc(a.name)}" placeholder="${esc(t('savings.name'))}" aria-label="${esc(t('savings.name'))}">
        <input id="edit-savings-balance" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(a.balance)}" aria-label="${esc(t('savings.balance'))}" style="width:130px">
      </div>
      <div class="row">
        ${categorySelect('edit-savings-category', a.category || '', state, t)}
        <button class="btn small primary" data-action="save-savings" data-id="${esc(a.id)}">${esc(t('common.save'))}</button>
        <button class="btn small" data-action="cancel-edit-savings">${esc(t('common.cancel'))}</button>
      </div>
    </div>`;
  }

  return `
  <div class="card savings-account">
    <div class="row">
      <div class="grow">
        <strong>${esc(a.name)}</strong>
        <div class="muted" style="font-size:0.8rem">${esc(t('savings.percentOfTotal', { percent: pct }))}${a.category ? ` · ${esc(t('savings.fedByCategory', { category: categoryName(a.category, t) }))}` : ''}</div>
      </div>
      <span class="num" style="font-weight:650">${money(a.balance, { currency })}</span>
      <button class="icon-btn accent" data-action="edit-savings" data-id="${esc(a.id)}" title="${esc(t('common.edit'))}" aria-label="${esc(t('savings.editNamed', { name: a.name }))}">${icons.edit}</button>
      <button class="icon-btn danger" data-action="delete-savings" data-id="${esc(a.id)}" title="${esc(t('common.delete'))}" aria-label="${esc(t('savings.deleteNamed', { name: a.name }))}">${icons.trash}</button>
    </div>
    ${a.category ? '' : `
    <div class="row">
      <input id="sav-amount-${esc(a.id)}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('common.amount'))}" aria-label="${esc(t('savings.amountFor', { name: a.name }))}" class="grow" style="max-width:160px">
      <button class="btn small" data-action="savings-op" data-id="${esc(a.id)}" data-type="deposit">＋ ${esc(t('savings.deposit'))}</button>
      <button class="btn small" data-action="savings-op" data-id="${esc(a.id)}" data-type="withdrawal">− ${esc(t('savings.withdraw'))}</button>
    </div>`}
    <div class="row" style="gap:12px">
      ${a.category ? '' : `
      <button class="btn small ghost" data-action="toggle-recurring" data-id="${esc(a.id)}" aria-expanded="${recurringOpen}">
        <span aria-hidden="true">${recurringOpen ? '▾' : '▸'}</span> ${icons.repeat} ${esc(t('savings.recurring'))}${recurring.length ? ` (${recurring.length})` : ''}
      </button>`}
      ${history.length > 0 ? `
      <button class="btn small ghost" data-action="toggle-history" data-id="${esc(a.id)}" aria-expanded="${historyOpen}">
        <span aria-hidden="true">${historyOpen ? '▾' : '▸'}</span> ${esc(t('savings.transactionHistory', { count: history.length }))}
      </button>` : ''}
    </div>
    ${recurringOpen ? `
    <div class="recurring-box">
      ${recurring.map(r => `
      <div class="panel-list-item">
        <span class="grow">${money(r.amount, { currency })} · ${esc(t('savings.monthlyOnDay', { day: r.day }))}</span>
        <span class="muted" style="font-size:0.8rem">${esc(t('savings.nextOn', { date: isoToDisplay(r.nextDate) }))}</span>
        <button class="icon-btn danger" data-action="delete-recurring" data-id="${esc(r.id)}" data-sid="${esc(a.id)}" title="${esc(t('common.delete'))}" aria-label="${esc(t('savings.deleteRecurring'))}">${icons.trash}</button>
      </div>`).join('')}
      <div class="row">
        <input id="rec-amount-${esc(a.id)}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('common.amount'))}" aria-label="${esc(t('savings.recurringAmount'))}" class="grow" style="max-width:140px">
        <label class="row" style="gap:6px">${esc(t('savings.day'))}
          <select id="rec-day-${esc(a.id)}">
            ${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${i === 0 ? 'selected' : ''}>${i + 1}</option>`).join('')}
          </select>
        </label>
        <button class="btn small primary" data-action="add-recurring" data-id="${esc(a.id)}" title="${esc(t('savings.addRecurring'))}" aria-label="${esc(t('savings.addRecurring'))}">＋</button>
      </div>
    </div>` : ''}
    ${historyOpen && history.length > 0 ? `
    <ul class="history-list">
      ${history.map(h => `
      <li>
        <span class="muted grow">${esc(isoToDisplay(h.date))} · ${esc(t(h.type === 'deposit' ? 'savings.deposit' : 'savings.withdraw'))}${h.id.startsWith('rec_') ? ' ↻' : ''}</span>
        <span class="${h.type === 'deposit' ? 'pos' : 'neg'}">${money(h.type === 'deposit' ? h.amount : -h.amount, { currency, signed: true })}</span>
        ${a.category || h.id.startsWith('bank_') ? '' : `
        <button class="icon-btn danger" data-action="remove-savings-entry" data-id="${esc(h.id)}" data-sid="${esc(a.id)}" title="${esc(t('savings.removeEntry'))}" aria-label="${esc(t('savings.removeEntry'))}">${icons.trash}</button>`}
      </li>`).join('')}
    </ul>` : ''}
  </div>`;
}

export function afterRender(state) {
  const el = state.ui.tab === 'savings' && typeof Chart !== 'undefined' && document.getElementById('chart-savings');
  if (!el) {
    kept?.chart.destroy();
    kept = null;
    return;
  }
  const colors = chartColors();
  // slot by stable account order so filters/deletions elsewhere never repaint survivors
  const slotByName = new Map(state.savingsAccounts.map((a, i) => [a.name, i]));
  const data = state.savingsAccounts
    .map(a => ({ name: a.name, value: a.balance }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? { animation: false } : {};
  const chartData = {
    labels: data.map(d => d.name),
    datasets: [{
      data: data.map(d => d.value),
      backgroundColor: data.map(d => colors.palette[slotByName.get(d.name) % colors.palette.length]),
      borderRadius: 4,
      borderSkipped: 'start',
      maxBarThickness: 22,
    }],
  };
  const key = JSON.stringify([chartData, colors, Chart.defaults.font.family, state.ui.lang, motion]);
  // Same reuse as the dashboard: move the old box (Chart.js observes the canvas's parent).
  if (kept?.key === key) {
    el.parentElement.replaceWith(kept.box);
    return;
  }
  kept?.chart.destroy();
  el.parentElement.style.height = `${Math.max(data.length * 36 + 24, 120)}px`;
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(c) {
      const { ctx } = c;
      const meta = c.getDatasetMeta(0);
      ctx.save();
      ctx.font = `600 11px ${Chart.defaults.font.family}`;
      ctx.fillStyle = colors.text;
      ctx.textBaseline = 'middle';
      meta.data.forEach((bar, i) => ctx.fillText(money(c.data.datasets[0].data[i], { currency }), bar.x + 6, bar.y));
      ctx.restore();
    },
  };
  const chart = new Chart(el, {
    type: 'bar',
    plugins: [valueLabels],
    data: chartData,
    options: {
      ...motion,
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 80 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${money(ctx.parsed.x, { currency })} (${total > 0 ? ((ctx.parsed.x / total) * 100).toFixed(1) : 0}%)`,
          },
        },
      },
      scales: {
        x: { display: false, beginAtZero: true },
        y: { grid: { display: false }, ticks: { autoSkip: false } },
      },
    },
  });
  kept = { key, box: el.parentElement, chart };
}

function clearFieldError(input) {
  document.getElementById(`${input.id}-error`)?.remove();
  input.removeAttribute('aria-invalid');
  input.removeAttribute('aria-describedby');
}

// Messages are written straight into the DOM, under the input's row: a set() would re-render
// and drop what was typed. False when there were problems to show.
function validate(inputs, problems) {
  inputs.forEach(clearFieldError);
  for (const [input, message] of problems) {
    let anchor = input.closest('.row');
    while (anchor.nextElementSibling?.classList.contains('field-error')) anchor = anchor.nextElementSibling;
    const error = document.createElement('p');
    error.className = 'field-error';
    error.id = `${input.id}-error`;
    error.setAttribute('role', 'alert');
    error.textContent = message;
    anchor.after(error);
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', error.id);
    input.addEventListener('input', () => clearFieldError(input), { once: true });
  }
  problems[0]?.[0].focus();
  return problems.length === 0;
}

async function removeEntry(sid, hid) {
  const { account } = await api.deleteSavingsEntry(sid, hid);
  const state = get();
  set({
    savingsAccounts: state.savingsAccounts.map(a => a.id === sid ? account : a),
    savingsHistory: { ...state.savingsHistory, [sid]: (state.savingsHistory[sid] || []).filter(h => h.id !== hid) },
  });
}

export const actions = {
  'toggle-add-savings': () => setUi({ addingSavings: !get().ui.addingSavings }),
  'add-savings': async (el, ev, t) => {
    const nameInput = document.getElementById('new-savings-name');
    const balanceInput = document.getElementById('new-savings-balance');
    const name = nameInput.value.trim();
    const balance = Number(balanceInput.value);
    const problems = [];
    if (!name) problems.push([nameInput, t('savings.nameRequired')]);
    if (balanceInput.validity.badInput || balance < 0) problems.push([balanceInput, t('savings.balanceInvalid')]);
    if (!validate([nameInput, balanceInput], problems)) return;
    const category = document.getElementById('new-savings-category').value || null;
    // a fed account's history comes from the server, so reload rather than append
    await api.createSavings(name, balance, category);
    get().ui.addingSavings = false;
    await refreshSavings();
  },
  'edit-savings': (el) => setUi({ editingSavingsId: el.dataset.id }),
  'cancel-edit-savings': () => setUi({ editingSavingsId: null }),
  'save-savings': async (el, ev, t) => {
    const nameInput = document.getElementById('edit-savings-name');
    const balanceInput = document.getElementById('edit-savings-balance');
    const name = nameInput.value.trim();
    const balance = Number(balanceInput.value);
    const problems = [];
    if (!name) problems.push([nameInput, t('savings.nameRequired')]);
    if (balanceInput.value === '' || balance < 0) problems.push([balanceInput, t('savings.balanceInvalid')]);
    if (!validate([nameInput, balanceInput], problems)) return;
    const category = document.getElementById('edit-savings-category').value || null;
    await api.patchSavings(el.dataset.id, { name, balance, category });
    get().ui.editingSavingsId = null;
    await refreshSavings();
  },
  'delete-savings': async (el, ev, t) => {
    if (!(await confirmDialog(t('savings.confirmDelete'), { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true }))) return;
    await api.deleteSavings(el.dataset.id);
    const state = get();
    set({ savingsAccounts: state.savingsAccounts.filter(a => a.id !== el.dataset.id) });
  },
  'toggle-history': (el) => {
    const open = new Set(get().ui.openHistoryIds);
    if (open.has(el.dataset.id)) open.delete(el.dataset.id);
    else open.add(el.dataset.id);
    setUi({ openHistoryIds: open });
  },
  'toggle-recurring': (el) => {
    const open = new Set(get().ui.openRecurringIds);
    if (open.has(el.dataset.id)) open.delete(el.dataset.id);
    else open.add(el.dataset.id);
    setUi({ openRecurringIds: open });
  },
  'savings-op': async (el, ev, t) => {
    const { id, type } = el.dataset;
    const input = document.getElementById(`sav-amount-${id}`);
    const amount = Number(input.value);
    const account = get().savingsAccounts.find(a => a.id === id);
    const problems = [];
    if (input.value === '' || amount <= 0) problems.push([input, t('savings.amountInvalid')]);
    else if (type === 'withdrawal' && amount > account.balance) {
      problems.push([input, t('savings.moreThanBalance', { balance: money(account.balance, { currency }) })]);
    }
    if (!validate([input], problems)) return;
    const result = await api.savingsTransaction(id, type, amount);
    resetFields(`sav-amount-${id}`);
    const state = get();
    set({
      savingsAccounts: state.savingsAccounts.map(a => a.id === id ? result.account : a),
      savingsHistory: {
        ...state.savingsHistory,
        [id]: [result.entry, ...(state.savingsHistory[id] || [])],
      },
    });
    toast(t(type === 'deposit' ? 'savings.deposited' : 'savings.withdrawn', { amount: money(amount, { currency }), name: account.name }), {
      type: 'success',
      action: { label: t('savings.undo'), onClick: () => removeEntry(id, result.entry.id) },
    });
  },
  'remove-savings-entry': async (el, ev, t) => {
    const { id, sid } = el.dataset;
    const state = get();
    const account = state.savingsAccounts.find(a => a.id === sid);
    const entry = state.savingsHistory[sid].find(h => h.id === id);
    const balance = Math.max(0, account.balance + (entry.type === 'deposit' ? -entry.amount : entry.amount));
    const message = t(entry.type === 'deposit' ? 'savings.confirmRemoveDeposit' : 'savings.confirmRemoveWithdrawal', {
      amount: money(entry.amount, { currency }),
      balance: money(balance, { currency }),
    });
    if (!(await confirmDialog(message, { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true }))) return;
    await removeEntry(sid, id);
  },
  'add-recurring': async (el, ev, t) => {
    const id = el.dataset.id;
    const input = document.getElementById(`rec-amount-${id}`);
    const amount = Number(input.value);
    const day = Number(document.getElementById(`rec-day-${id}`).value);
    if (!validate([input], input.value === '' || amount <= 0 ? [[input, t('savings.amountInvalid')]] : [])) return;
    try {
      const rule = await api.createSavingsRecurring(id, amount, day);
      resetFields(`rec-amount-${id}`, `rec-day-${id}`);
      const state = get();
      set({
        savingsRecurring: {
          ...state.savingsRecurring,
          [id]: [...(state.savingsRecurring[id] || []), rule],
        },
      });
    } catch (err) {
      toast(err.message);
    }
  },
  'delete-recurring': async (el, ev, t) => {
    if (!(await confirmDialog(t('savings.confirmDeleteRecurring'), { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true }))) return;
    await api.deleteSavingsRecurring(el.dataset.id);
    const state = get();
    const sid = el.dataset.sid;
    set({
      savingsRecurring: {
        ...state.savingsRecurring,
        [sid]: (state.savingsRecurring[sid] || []).filter(r => r.id !== el.dataset.id),
      },
    });
  },
};
