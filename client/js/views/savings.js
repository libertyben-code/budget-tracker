import { esc, eur, eurSpaced, chartColors, toast } from '../dom.js';
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
    <div class="card">
      <h2>${esc(t('savings.overview'))}</h2>
      <p class="muted">${esc(t('savings.subtitle'))}</p>
      <div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="tile card" style="box-shadow:none">
          <div class="label">${esc(t('savings.totalSaved'))}</div>
          <div class="value pos">${eurSpaced(total)}</div>
        </div>
        <div class="tile card" style="box-shadow:none">
          <div class="label">${esc(t('savings.savingsAccounts'))}</div>
          <div class="value">${accounts.length}</div>
        </div>
      </div>
      <div class="row">
        <input id="new-savings-name" class="grow" placeholder="${esc(t('savings.savingsAccountName'))}">
        <input id="new-savings-balance" type="number" min="0" step="0.01" placeholder="${esc(t('savings.initialBalance'))}" style="width:130px">
        <button class="btn primary" data-action="add-savings">${esc(t('savings.addAccount'))}</button>
      </div>
    </div>

    <div class="card">
      <h2>${esc(t('savings.addWithdraw'))}</h2>
      <div class="row">
        <select id="savings-op-account" class="grow">
          <option value="">${esc(t('savings.selectAccount'))}</option>
          ${accounts.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
        </select>
        <select id="savings-op-type">
          <option value="deposit">${esc(t('savings.deposit'))}</option>
          <option value="withdrawal">${esc(t('savings.withdraw'))}</option>
        </select>
        <input id="savings-op-amount" type="number" min="0" step="0.01" placeholder="${esc(t('common.amount'))}" style="width:120px">
        <button class="btn primary" data-action="apply-savings-op">${esc(t('savings.apply'))}</button>
      </div>
    </div>

    <div class="card">
      <h2>${esc(t('savings.accountsTitle'))}</h2>
      ${accounts.map(a => {
        const history = state.savingsHistory[a.id] || [];
        const open = state.ui.openHistoryIds.has(a.id);
        const pct = total > 0 ? ((a.balance / total) * 100).toFixed(1) : '0.0';
        if (state.ui.editingSavingsId === a.id) {
          return `
          <div class="savings-account">
            <div class="row">
              <input id="edit-savings-name" class="grow" value="${esc(a.name)}" placeholder="${esc(t('savings.name'))}">
              <input id="edit-savings-balance" type="number" min="0" step="0.01" value="${esc(a.balance)}" style="width:130px">
              <button class="btn small primary" data-action="save-savings" data-id="${esc(a.id)}">${esc(t('common.save'))}</button>
              <button class="btn small" data-action="cancel-edit-savings">${esc(t('common.cancel'))}</button>
            </div>
          </div>`;
        }
        return `
        <div class="savings-account">
          <div class="row">
            <div class="grow">
              <strong>${esc(a.name)}</strong>
              <div class="muted" style="font-size:0.8rem">${esc(t('savings.percentOfTotal', { percent: pct }))}</div>
            </div>
            <span class="num" style="font-weight:650">${eur(a.balance)}</span>
            <button class="icon-btn" data-action="edit-savings" data-id="${esc(a.id)}" title="${esc(t('common.edit'))}">✏️</button>
            <button class="icon-btn danger" data-action="delete-savings" data-id="${esc(a.id)}" title="${esc(t('common.delete'))}">🗑️</button>
          </div>
          ${history.length > 0 ? `
          <button class="btn small ghost" data-action="toggle-history" data-id="${esc(a.id)}" style="align-self:flex-start">
            ${open ? '▾' : '▸'} ${esc(t('savings.transactionHistory', { count: history.length }))}
          </button>
          ${open ? `
          <ul class="history-list">
            ${history.map(h => `
            <li>
              <span class="muted">${esc(isoToDisplay(h.date))} · ${esc(t(h.type === 'deposit' ? 'savings.deposit' : 'savings.withdraw'))}</span>
              <span class="${h.type === 'deposit' ? 'pos' : 'neg'}">${h.type === 'deposit' ? '+' : '-'}${eur(h.amount)}</span>
            </li>`).join('')}
          </ul>` : ''}` : ''}
        </div>`;
      }).join('') || '<p class="muted">—</p>'}
    </div>

    ${withBalance.length > 0 ? `
    <div class="card">
      <h2>${esc(t('savings.splitByAccount'))}</h2>
      <div class="chart-box"><canvas id="chart-savings"></canvas></div>
    </div>` : ''}
  </section>`;
}

export function afterRender(state) {
  if (chart) { chart.destroy(); chart = null; }
  if (state.ui.tab !== 'savings' || typeof Chart === 'undefined') return;
  const el = document.getElementById('chart-savings');
  if (!el) return;
  const colors = chartColors();
  const data = state.savingsAccounts
    .filter(a => a.balance > 0)
    .map(a => ({ name: a.name, value: a.balance }))
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  chart = new Chart(el, {
    type: 'pie',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.value),
        backgroundColor: data.map((_, i) => colors.palette[i % colors.palette.length]),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: window.innerWidth < 640 ? 'bottom' : 'right' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${eur(ctx.parsed)} (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0}%)`,
          },
        },
      },
    },
  });
}

export const actions = {
  'add-savings': async () => {
    const name = document.getElementById('new-savings-name')?.value.trim();
    const balance = parseFloat(document.getElementById('new-savings-balance')?.value);
    if (!name || Number.isNaN(balance) || balance < 0) return;
    const state = get();
    const account = await api.createSavings(state.activeAccountId, name, balance);
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
  'apply-savings-op': async () => {
    const id = document.getElementById('savings-op-account')?.value;
    const type = document.getElementById('savings-op-type')?.value;
    const amount = parseFloat(document.getElementById('savings-op-amount')?.value);
    if (!id || Number.isNaN(amount) || amount <= 0) return;
    try {
      const result = await api.savingsTransaction(id, type, amount);
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
};
