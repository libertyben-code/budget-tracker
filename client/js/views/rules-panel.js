import { esc, icons, confirmDialog } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { categories } from '../derive.js';

export function render(state, t) {
  if (state.ui.panel !== 'rules') return '';
  const ruleCats = [...new Set(state.rules.map(r => r.category))].sort();
  const filter = state.ui.rulesFilter;
  const rules = filter ? state.rules.filter(r => r.category === filter) : state.rules;
  const selection = state.ui.ruleSelection;
  const allSelected = rules.length > 0 && rules.every(r => selection.has(r.pattern));
  const cats = categories(state);

  return `
  <div class="modal-backdrop" data-action="close-panel" data-self-only>
    <div class="modal">
      <div class="modal-head">
        <h2 style="margin:0">${esc(t('categoryRules.title'))}</h2>
        <button class="icon-btn" data-action="close-panel">✕</button>
      </div>
      <p class="muted">${esc(t('categoryRules.subtitle'))}</p>
      <div class="row" style="margin-bottom:12px">
        <input id="rule-pattern" class="grow" placeholder="${esc(t('categoryRules.patternPlaceholder'))}">
        <input id="rule-category" class="grow" list="rule-cat-list" placeholder="${esc(t('categoryRules.categoryPlaceholder'))}">
        <datalist id="rule-cat-list">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <button class="btn primary" data-action="add-rule">${esc(t('categoryRules.addRule'))}</button>
      </div>
      <div class="row" style="margin-bottom:8px">
        <label class="muted">${esc(t('categoryRules.filterByCategory'))}</label>
        <select data-action-change="rules-filter">
          <option value="">${esc(t('categoryRules.allCategories'))}</option>
          ${ruleCats.map(c => `<option value="${esc(c)}" ${filter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <label class="row" style="gap:6px;margin-left:auto;font-size:0.85rem;color:var(--muted)">
          <input type="checkbox" data-action-change="rules-select-all" ${allSelected ? 'checked' : ''}> ${esc(t('common.all'))}
        </label>
      </div>
      ${selection.size > 0 ? `
      <div class="selection-bar">
        <span class="grow">${esc(t('categoryRules.selectedRules', { count: selection.size, suffix: selection.size > 1 ? 's' : '' }))}</span>
        <button class="btn small primary" data-action="open-rule-batch">${esc(t('categoryRules.changeCategory'))}</button>
        <button class="btn small danger" data-action="delete-selected-rules">${esc(t('common.delete'))}</button>
      </div>` : ''}
      ${state.ui.ruleBatchOpen ? `
      <div class="card" style="margin-bottom:12px">
        <h3>${esc(t('categoryRules.batchTitle', { count: selection.size }))}</h3>
        <div class="row">
          <input id="rule-batch-cat" class="grow" list="rule-cat-list" placeholder="${esc(t('categoryRules.enterCategoryName'))}">
          <button class="btn primary" data-action="apply-rule-batch">${esc(t('categoryRules.applyToRules', { count: selection.size }))}</button>
          <button class="btn" data-action="close-rule-batch">${esc(t('common.cancel'))}</button>
        </div>
      </div>` : ''}
      <div class="panel-list">
        ${rules.map(r => `
        <div class="panel-list-item">
          <input type="checkbox" data-action-change="select-rule" data-pattern="${esc(r.pattern)}" ${selection.has(r.pattern) ? 'checked' : ''}>
          <span class="grow">${esc(r.pattern)}</span>
          <span class="chip">${esc(r.category)}</span>
          <button class="icon-btn danger" data-action="delete-rule" data-pattern="${esc(r.pattern)}">${icons.trash}</button>
        </div>`).join('') || `<p class="muted">—</p>`}
      </div>
    </div>
  </div>`;
}

export const actions = {
  'close-panel': () => setUi({ panel: null, ruleBatchOpen: false }),
  'add-rule': async () => {
    const pattern = document.getElementById('rule-pattern')?.value.trim();
    const category = document.getElementById('rule-category')?.value.trim();
    if (!pattern || !category) return;
    const rule = await api.addRule(pattern, category);
    const rules = get().rules.filter(r => r.pattern !== rule.pattern);
    set({ rules: [...rules, rule] });
  },
  'rules-filter': (el) => setUi({ rulesFilter: el.value, ruleSelection: new Set() }),
  'select-rule': (el) => {
    const selection = new Set(get().ui.ruleSelection);
    if (el.checked) selection.add(el.dataset.pattern);
    else selection.delete(el.dataset.pattern);
    setUi({ ruleSelection: selection });
  },
  'rules-select-all': (el) => {
    const state = get();
    const filter = state.ui.rulesFilter;
    const rules = filter ? state.rules.filter(r => r.category === filter) : state.rules;
    setUi({ ruleSelection: el.checked ? new Set(rules.map(r => r.pattern)) : new Set() });
  },
  'delete-rule': async (el) => {
    await api.deleteRules([el.dataset.pattern]);
    const state = get();
    const selection = new Set(state.ui.ruleSelection);
    selection.delete(el.dataset.pattern);
    state.ui.ruleSelection = selection;
    set({ rules: state.rules.filter(r => r.pattern !== el.dataset.pattern) });
  },
  'delete-selected-rules': async (el, ev, t) => {
    const state = get();
    const patterns = [...state.ui.ruleSelection];
    if (!(await confirmDialog(t('categoryRules.confirmDelete', { count: patterns.length }), { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), danger: true }))) return;
    await api.deleteRules(patterns);
    state.ui.ruleSelection = new Set();
    set({ rules: state.rules.filter(r => !patterns.includes(r.pattern)) });
  },
  'open-rule-batch': () => setUi({ ruleBatchOpen: true }),
  'close-rule-batch': () => setUi({ ruleBatchOpen: false }),
  'apply-rule-batch': async () => {
    const category = document.getElementById('rule-batch-cat')?.value.trim();
    if (!category) return;
    const state = get();
    const patterns = [...state.ui.ruleSelection];
    await api.batchRules(patterns, category);
    state.ui.ruleSelection = new Set();
    state.ui.ruleBatchOpen = false;
    set({ rules: state.rules.map(r => patterns.includes(r.pattern) ? { ...r, category } : r) });
  },
};
