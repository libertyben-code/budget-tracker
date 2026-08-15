import { esc, checkRow } from '../dom.js';
import { get, setFilter, setUi } from '../store.js';
import { categories, months, years, monthLabel } from '../derive.js';

const presets = {
  all: { currentMonth: false, dateFilterType: 'all', year: '', month: '', startDate: '', endDate: '' },
  current: { currentMonth: true, dateFilterType: 'all', year: '', month: '', startDate: '', endDate: '' },
  lastMonth: { currentMonth: false, dateFilterType: 'month', year: '', month: '__last_month__', startDate: '', endDate: '' },
  last3: { currentMonth: false, dateFilterType: 'month', year: '', month: '__last_3_months__', startDate: '', endDate: '' },
  last6: { currentMonth: false, dateFilterType: 'month', year: '', month: '__last_6_months__', startDate: '', endDate: '' },
};

function activeChip(f) {
  if (f.currentMonth) return 'current';
  if (f.dateFilterType === 'year') return 'year';
  if (f.dateFilterType === 'dateRange') return 'range';
  if (f.dateFilterType === 'month') {
    if (f.month === '__last_month__') return 'lastMonth';
    if (f.month === '__last_3_months__') return 'last3';
    if (f.month === '__last_6_months__') return 'last6';
    return 'month';
  }
  return 'all';
}

export function render(state, t) {
  const f = state.filter;
  const cats = categories(state);
  const catLabel = f.categories.length === 0
    ? t('transactionTable.allCategories')
    : t('transactionTable.selectedCount', { count: f.categories.length });
  const active = activeChip(f);
  const chip = (id, label) => `<button class="chip-btn ${active === id ? 'active' : ''}" data-action="${presets[id] ? 'filter-preset' : 'filter-mode'}" data-which="${id}">${esc(label)}</button>`;

  return `
  <div class="filter-bar card">
    <div class="filter-row">
      <div class="dropdown">
        <button class="btn select-btn" data-action="toggle-cat-dropdown" data-which="filter">${esc(catLabel)}</button>
        ${state.ui.categoryDropdownOpen === 'filter' ? `
        <div class="dropdown-menu left" data-keep-open>
          ${checkRow({ on: f.categories.length === 0, action: 'filter-cat-all', label: t('transactionTable.allCategories') })}
          ${cats.map(c => checkRow({ on: f.categories.includes(c), action: 'filter-cat', label: c, data: `data-cat="${esc(c)}"` })).join('')}
        </div>` : ''}
      </div>
      <input id="filter-desc" class="grow" type="search" placeholder="${esc(t('transactionTable.searchDescription'))}"
             value="${esc(f.description)}" data-action-input="filter-description">
    </div>
    <div class="chip-row">
      ${chip('current', t('app.thisMonth'))}
      ${chip('lastMonth', t('app.lastMonth'))}
      ${chip('last3', t('app.last3Months'))}
      ${chip('last6', t('app.last6Months'))}
      ${chip('month', `${t('common.month')}…`)}
      ${chip('year', `${t('common.year')}…`)}
      ${chip('range', `${t('common.range')}…`)}
      ${chip('all', t('common.all'))}
    </div>
    ${active === 'year' ? `
    <div class="filter-row">
      <select data-action-change="filter-year">
        <option value="">${esc(t('app.selectYear'))}</option>
        ${years(state).map(y => `<option value="${y}" ${f.year === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>` : ''}
    ${active === 'month' ? `
    <div class="filter-row">
      <select data-action-change="filter-month">
        <option value="">${esc(t('app.selectMonth'))}</option>
        ${months(state).map(m => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${esc(monthLabel(m, state.ui.lang))}</option>`).join('')}
      </select>
    </div>` : ''}
    ${active === 'range' ? `
    <div class="filter-row">
      <label>${esc(t('common.from'))} <input type="date" value="${esc(f.startDate)}" data-action-change="filter-start-date"></label>
      <label>${esc(t('common.to'))} <input type="date" value="${esc(f.endDate)}" data-action-change="filter-end-date"></label>
    </div>` : ''}
  </div>`;
}

export const actions = {
  'toggle-cat-dropdown': (el) => {
    const open = get().ui.categoryDropdownOpen;
    setUi({ categoryDropdownOpen: open === el.dataset.which ? null : el.dataset.which });
  },
  'filter-cat-all': () => setFilter({ categories: [] }),
  'filter-cat': (el) => {
    const current = get().filter.categories;
    const cat = el.dataset.cat;
    setFilter({ categories: current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat] });
  },
  'filter-description': (el) => setFilter({ description: el.value }),
  'filter-preset': (el) => setFilter({ ...presets[el.dataset.which] }),
  'filter-mode': (el) => setFilter({
    currentMonth: false,
    dateFilterType: el.dataset.which === 'range' ? 'dateRange' : el.dataset.which,
    year: '',
    month: '',
    startDate: '',
    endDate: '',
  }),
  'filter-year': (el) => setFilter({ year: el.value }),
  'filter-month': (el) => setFilter({ month: el.value }),
  'filter-start-date': (el) => setFilter({ startDate: el.value }),
  'filter-end-date': (el) => setFilter({ endDate: el.value }),
};
