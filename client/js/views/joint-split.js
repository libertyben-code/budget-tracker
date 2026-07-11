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
      <p class="muted">${esc(t('joint.subtitle'))}</p>
      <div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="field" style="margin:0">
          <label>${esc(t('joint.targetJointDeposit'))}</label>
          <input id="joint-target" type="number" step="0.01" value="${esc(account.jointTargetAmount ?? '2100')}" data-action-change="joint-target">
          <span class="muted" style="font-size:0.8rem">${esc(t('joint.billsReference', { amount: joint.billsTotal.toFixed(2) }))}</span>
        </div>
        <div class="tile card" style="box-shadow:none">
          <div class="label">${esc(t('joint.totalToPut'))}</div>
          <div class="value">${eur(joint.totalToSplit)}</div>
        </div>
      </div>
      <div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="field" style="margin:0">
          <label>${esc(t('joint.salaryPerson1'))}</label>
          <input type="number" step="0.01" value="${esc(account.salaryPerson1 ?? '')}" data-action-change="joint-salary1">
        </div>
        <div class="field" style="margin:0">
          <label>${esc(t('joint.salaryPerson2'))}</label>
          <input type="number" step="0.01" value="${esc(account.salaryPerson2 ?? '')}" data-action-change="joint-salary2">
        </div>
      </div>
      ${joint.hasSalaries ? `
      <div class="tiles" style="grid-template-columns:1fr 1fr">
        <div class="tile card" style="box-shadow:none">
          <div class="label">${esc(t('joint.person1Contribution'))}</div>
          <div class="value pos">${eur(joint.person1)}</div>
        </div>
        <div class="tile card" style="box-shadow:none">
          <div class="label">${esc(t('joint.person2Contribution'))}</div>
          <div class="value pos">${eur(joint.person2)}</div>
        </div>
      </div>` : `<p class="muted">${esc(t('joint.enterSalaries'))}</p>`}
    </div>
    <div class="card">
      <h2>${esc(t('joint.includedTransactions', { count: joint.bills.length }))}</h2>
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
      ${joint.nonBillCount > 0 ? `<p class="muted" style="margin-top:8px">${esc(t('joint.otherNotIncluded', { count: joint.nonBillCount }))}</p>` : ''}
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
