import { esc, eur } from '../dom.js';
import { get, set } from '../store.js';
import { api } from '../api.js';
import { jointData } from '../derive.js';
import { isoToDisplay } from '/shared/dates.js';

export function render(state, t) {
  const account = state.accounts.find(a => a.id === state.activeAccountId) || {};
  const joint = jointData(state);

  return `
  <section class="view">
    <div class="card">
      <h2>${esc(t('joint.title'))}</h2>
      <div class="field">
        <label>${esc(t('joint.targetJointDeposit'))}</label>
        <input id="joint-target" type="number" inputmode="decimal" step="0.01" value="${esc(account.jointTargetAmount ?? '2100')}" data-action-change="joint-target">
        <span class="muted" style="font-size:0.8rem">${esc(t('joint.billsReference', { amount: joint.billsTotal.toFixed(2) }))}</span>
      </div>
      <div class="tiles" style="margin-bottom:0">
        <div class="field" style="margin:0">
          <label>${esc(t('joint.salaryPerson1'))}</label>
          <input type="number" inputmode="decimal" step="0.01" value="${esc(account.salaryPerson1 ?? '')}" data-action-change="joint-salary1">
        </div>
        <div class="field" style="margin:0">
          <label>${esc(t('joint.salaryPerson2'))}</label>
          <input type="number" inputmode="decimal" step="0.01" value="${esc(account.salaryPerson2 ?? '')}" data-action-change="joint-salary2">
        </div>
      </div>
      <div class="tiles" style="grid-template-columns:1fr 1fr;margin-top:var(--space-4);margin-bottom:0">
        <div class="tile card total-tile" style="box-shadow:none">
          <div class="label">${esc(t('joint.person1Contribution'))}</div>
          <div class="value pos">${eur(joint.person1)}</div>
        </div>
        <div class="tile card total-tile" style="box-shadow:none">
          <div class="label">${esc(t('joint.person2Contribution'))}</div>
          <div class="value pos">${eur(joint.person2)}</div>
        </div>
      </div>
      ${joint.hasSalaries ? '' : `<p class="muted" style="margin:var(--space-3) 0 0">${esc(t('joint.enterSalaries'))}</p>`}
    </div>
    <div class="card">
      <div class="row" style="margin-bottom:8px">
        <h2 class="grow" style="margin:0">${esc(t('joint.includedTransactions', { count: joint.bills.length }))}</h2>
        <span class="num neg" style="font-weight:650">${eur(joint.billsTotal)}</span>
      </div>
      <p class="muted">${esc(t('joint.subtitle'))}</p>
      ${joint.bills.length === 0 ? `<p class="muted">${esc(t('joint.noTransactions'))}</p>` : `
      <div class="panel-list">
        ${joint.bills.map(tx => `
        <div class="panel-list-item">
          <span class="num muted">${esc(isoToDisplay(tx.date))}</span>
          <span class="grow">${esc(tx.description)}</span>
          <span class="chip">${esc(tx.category)}</span>
          <span class="num neg">${eur(tx.amount)}</span>
        </div>`).join('')}
      </div>`}
    </div>
  </section>`;
}

async function saveSetting(patch) {
  const state = get();
  const updated = await api.patchAccountSettings(state.activeAccountId, patch);
  set({ accounts: state.accounts.map(a => a.id === updated.id ? { ...a, ...updated } : a) });
}

export const actions = {
  'joint-target': (el) => saveSetting({ jointTargetAmount: el.value }),
  'joint-salary1': (el) => saveSetting({ salaryPerson1: el.value }),
  'joint-salary2': (el) => saveSetting({ salaryPerson2: el.value }),
};
