import { esc, eur, eurSpaced, chartColors, icons, toast } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { isoToDisplay } from '/shared/dates.js';

let chart = null;

export function render(state, t) {
  const accounts = state.savingsAccounts;
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);
  const withBalance = accounts.filter(a => a.balance > 0);

  return `
  <section class="view">
    <div class="card tile" style="text-align:center">
      <div class="label">${esc(t('savings.totalSaved'))}</div>
      <div class="value hero pos">${eurSpaced(total)}</div>
    </div>

    ${withBalance.length > 0 ? `
    <div class="card">
      <h2>${esc(t('savings.splitByAccount'))}</h2>
      <div class="chart-box" id="savings-chart-box"><canvas id="chart-savings"></canvas></div>
    </div>` : ''}

    <div class="row" style="margin:0">
      <h2 class="grow" style="margin:0">${esc(t('savings.accountsTitle'))}</h2>
      <button class="btn small primary" data-action="toggle-add-savings" title="${esc(t('savings.addAccount'))}" aria-label="${esc(t('savings.addAccount'))}">${state.ui.addingSavings ? '✕' : '＋'}</button>
    </div>
    ${state.ui.addingSavings ? `
    <div class="card">
      <div class="row">
        <input id="new-savings-name" class="grow" placeholder="${esc(t('savings.savingsAccountName'))}" data-action-key="add-savings">
        <input id="new-savings-balance" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('savings.initialBalance'))}" style="width:130px" data-action-key="add-savings">
        <button class="btn small primary" data-action="add-savings">${esc(t('common.save'))}</button>
      </div>
    </div>` : ''}
    ${accounts.map(a => renderAccount(a, state, t, total)).join('') || `<p class="muted">${esc(t('savings.noAccounts'))}</p>`}
  </section>`;
}

function renderAccount(a, state, t, total) {
  const history = state.savingsHistory[a.id] || [];
  const recurring = state.savingsRecurring[a.id] || [];
  const historyOpen = state.ui.openHistoryIds.has(a.id);
  const recurringOpen = state.ui.openRecurringIds.has(a.id);
  const pct = total > 0 ? ((a.balance / total) * 100).toFixed(1) : '0.0';

  if (state.ui.editingSavingsId === a.id) {
    return `
    <div class="card savings-account">
      <div class="row">
        <input id="edit-savings-name" class="grow" value="${esc(a.name)}" placeholder="${esc(t('savings.name'))}">
        <input id="edit-savings-balance" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(a.balance)}" style="width:130px">
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
        <div class="muted" style="font-size:0.8rem">${esc(t('savings.percentOfTotal', { percent: pct }))}</div>
      </div>
      <span class="num" style="font-weight:650">${eur(a.balance)}</span>
      <button class="icon-btn accent" data-action="edit-savings" data-id="${esc(a.id)}" title="${esc(t('common.edit'))}">${icons.edit}</button>
      <button class="icon-btn danger" data-action="delete-savings" data-id="${esc(a.id)}" title="${esc(t('common.delete'))}">${icons.trash}</button>
    </div>
    <div class="row">
      <input id="sav-amount-${esc(a.id)}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('common.amount'))}" class="grow" style="max-width:160px">
      <button class="btn small" data-action="savings-op" data-id="${esc(a.id)}" data-type="deposit">＋ ${esc(t('savings.deposit'))}</button>
      <button class="btn small" data-action="savings-op" data-id="${esc(a.id)}" data-type="withdrawal">− ${esc(t('savings.withdraw'))}</button>
    </div>
    <div class="row" style="gap:12px">
      <button class="btn small ghost" data-action="toggle-recurring" data-id="${esc(a.id)}">
        ${recurringOpen ? '▾' : '▸'} ${icons.repeat} ${esc(t('savings.recurring'))}${recurring.length ? ` (${recurring.length})` : ''}
      </button>
      ${history.length > 0 ? `
      <button class="btn small ghost" data-action="toggle-history" data-id="${esc(a.id)}">
        ${historyOpen ? '▾' : '▸'} ${esc(t('savings.transactionHistory', { count: history.length }))}
      </button>` : ''}
    </div>
    ${recurringOpen ? `
    <div class="recurring-box">
      ${recurring.map(r => `
      <div class="panel-list-item">
        <span class="grow">${eur(r.amount)} · ${esc(t('savings.monthlyOnDay', { day: r.day }))}</span>
        <span class="muted" style="font-size:0.8rem">${esc(t('savings.nextOn', { date: isoToDisplay(r.nextDate) }))}</span>
        <button class="icon-btn danger" data-action="delete-recurring" data-id="${esc(r.id)}" data-sid="${esc(a.id)}" title="${esc(t('common.delete'))}">${icons.trash}</button>
      </div>`).join('')}
      <div class="row">
        <input id="rec-amount-${esc(a.id)}" type="number" inputmode="decimal" min="0" step="0.01" placeholder="${esc(t('common.amount'))}" class="grow" style="max-width:140px">
        <label class="row" style="gap:6px">${esc(t('savings.day'))}
          <select id="rec-day-${esc(a.id)}">
            ${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${i === 0 ? 'selected' : ''}>${i + 1}</option>`).join('')}
          </select>
        </label>
        <button class="btn small primary" data-action="add-recurring" data-id="${esc(a.id)}">＋</button>
      </div>
    </div>` : ''}
    ${historyOpen && history.length > 0 ? `
    <ul class="history-list">
      ${history.map(h => `
      <li>
        <span class="muted">${esc(isoToDisplay(h.date))} · ${esc(t(h.type === 'deposit' ? 'savings.deposit' : 'savings.withdraw'))}${h.id.startsWith('rec_') ? ' ↻' : ''}</span>
        <span class="${h.type === 'deposit' ? 'pos' : 'neg'}">${h.type === 'deposit' ? '+' : '-'}${eur(h.amount)}</span>
      </li>`).join('')}
    </ul>` : ''}
  </div>`;
}

export function afterRender(state) {
  if (chart) { chart.destroy(); chart = null; }
  if (state.ui.tab !== 'savings' || typeof Chart === 'undefined') return;
  const el = document.getElementById('chart-savings');
  if (!el) return;
  const colors = chartColors();
  // slot by stable account order so filters/deletions elsewhere never repaint survivors
  const slotByName = new Map(state.savingsAccounts.map((a, i) => [a.name, i]));
  const data = state.savingsAccounts
    .filter(a => a.balance > 0)
    .map(a => ({ name: a.name, value: a.balance }))
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const box = document.getElementById('savings-chart-box');
  if (box) box.style.height = `${Math.max(data.length * 36 + 24, 120)}px`;
  const valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw(c) {
      const { ctx } = c;
      const meta = c.getDatasetMeta(0);
      ctx.save();
      ctx.font = `600 11px ${Chart.defaults.font.family}`;
      ctx.fillStyle = colors.text;
      ctx.textBaseline = 'middle';
      meta.data.forEach((bar, i) => ctx.fillText(eur(c.data.datasets[0].data[i]), bar.x + 6, bar.y));
      ctx.restore();
    },
  };
  chart = new Chart(el, {
    type: 'bar',
    plugins: [valueLabels],
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: data.map(d => colors.palette[slotByName.get(d.name) % colors.palette.length]),
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 64 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${eur(ctx.parsed.x)} (${total > 0 ? ((ctx.parsed.x / total) * 100).toFixed(1) : 0}%)`,
          },
        },
      },
      scales: {
        x: { display: false, beginAtZero: true },
        y: { grid: { display: false }, ticks: { autoSkip: false } },
      },
    },
  });
}

export const actions = {
  'toggle-add-savings': () => setUi({ addingSavings: !get().ui.addingSavings }),
  'add-savings': async () => {
    const name = document.getElementById('new-savings-name')?.value.trim();
    const balance = parseFloat(document.getElementById('new-savings-balance')?.value) || 0;
    if (!name || balance < 0) return;
    const state = get();
    const account = await api.createSavings(state.activeAccountId, name, balance);
    state.ui.addingSavings = false;
    set({ savingsAccounts: [...state.savingsAccounts, account] });
  },
  'edit-savings': (el) => setUi({ editingSavingsId: el.dataset.id }),
  'cancel-edit-savings': () => setUi({ editingSavingsId: null }),
  'save-savings': async (el) => {
    const name = document.getElementById('edit-savings-name')?.value.trim();
    const balance = parseFloat(document.getElementById('edit-savings-balance')?.value);
    if (!name || Number.isNaN(balance) || balance < 0) return;
    const updated = await api.patchSavings(el.dataset.id, { name, balance });
    const state = get();
    state.ui.editingSavingsId = null;
    set({ savingsAccounts: state.savingsAccounts.map(a => a.id === updated.id ? updated : a) });
  },
  'delete-savings': async (el, ev, t) => {
    if (!window.confirm(t('savings.confirmDelete'))) return;
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
  'savings-op': async (el) => {
    const id = el.dataset.id;
    const amount = parseFloat(document.getElementById(`sav-amount-${id}`)?.value);
    if (Number.isNaN(amount) || amount <= 0) return;
    try {
      const result = await api.savingsTransaction(id, el.dataset.type, amount);
      const state = get();
      set({
        savingsAccounts: state.savingsAccounts.map(a => a.id === id ? result.account : a),
        savingsHistory: {
          ...state.savingsHistory,
          [id]: [result.entry, ...(state.savingsHistory[id] || [])],
        },
      });
    } catch (err) {
      toast(err.message);
    }
  },
  'add-recurring': async (el) => {
    const id = el.dataset.id;
    const amount = parseFloat(document.getElementById(`rec-amount-${id}`)?.value);
    const day = Number(document.getElementById(`rec-day-${id}`)?.value);
    if (Number.isNaN(amount) || amount <= 0) return;
    try {
      const rule = await api.createSavingsRecurring(id, amount, day);
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
    if (!window.confirm(t('savings.confirmDeleteRecurring'))) return;
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
