import { esc, money, toast } from '../dom.js';
import { get, set } from '../store.js';
import { api } from '../api.js';
import { jointData } from '../derive.js';

const amountValue = (amount) => (amount === null ? '' : String(amount));

function person(n, joint, t) {
  return `
        <fieldset class="joint-person">
          <legend>${esc(t(`joint.person${n}`))}</legend>
          <div class="field">
            <label for="joint-name${n}">${esc(t('joint.name'))}</label>
            <input id="joint-name${n}" type="text" maxlength="40" autocomplete="off" value="${esc(joint[`name${n}`])}" placeholder="${esc(t(`joint.person${n}`))}" data-action-change="joint-name${n}">
          </div>
          <div class="field">
            <label for="joint-salary${n}">${esc(t('joint.salary'))}</label>
            <input id="joint-salary${n}" type="number" inputmode="decimal" min="0" step="0.01" value="${amountValue(joint[`salary${n}`])}" data-action-change="joint-salary${n}" data-key="salary${n}">
          </div>
        </fieldset>`;
}

// One split for every budget account, so in euros rather than the shown account's currency.
function payTile(name, amount, t) {
  return `
        <div class="tile card total-tile" style="box-shadow:none">
          <div class="label">${esc(t('joint.pays', { name }))}</div>
          <div class="value pos">${money(amount, { currency: 'EUR' })}</div>
        </div>`;
}

export function render(state, t) {
  const { joint } = state;
  const split = jointData(state);

  return `
  <section class="view">
    <div class="card">
      <h2>${esc(t('joint.title'))}</h2>
      <div class="field">
        <label for="joint-wanted">${esc(t('joint.wanted'))}</label>
        <input id="joint-wanted" type="number" inputmode="decimal" min="0" step="0.01" value="${amountValue(joint.wanted)}" data-action-change="joint-wanted" data-key="wanted">
      </div>
      <div class="salary-row">${person(1, joint, t)}${person(2, joint, t)}
      </div>
      <div class="tiles" style="grid-template-columns:1fr 1fr;margin-top:var(--space-4);margin-bottom:0">${payTile(joint.name1 || t('joint.person1'), split.person1, t)}${payTile(joint.name2 || t('joint.person2'), split.person2, t)}
      </div>
      <p class="muted" style="margin:var(--space-3) 0 0">${esc(t('joint.rule'))}${split.ready ? '' : ` ${esc(t('joint.enterFigures'))}`}</p>
    </div>
  </section>`;
}

async function save(patch, t) {
  set({ joint: await api.patchJointSettings(patch) });
  toast(t('joint.saved'), { type: 'success' });
}

function saveAmount(el, t) {
  if (el.validity.badInput || el.validity.rangeUnderflow) {
    el.value = amountValue(get().joint[el.dataset.key]);
    toast(t('joint.invalidAmount'));
    return;
  }
  return save({ [el.dataset.key]: el.value }, t);
}

export const actions = {
  'joint-wanted': (el, ev, t) => saveAmount(el, t),
  'joint-salary1': (el, ev, t) => saveAmount(el, t),
  'joint-salary2': (el, ev, t) => saveAmount(el, t),
  'joint-name1': (el, ev, t) => save({ name1: el.value }, t),
  'joint-name2': (el, ev, t) => save({ name2: el.value }, t),
};
