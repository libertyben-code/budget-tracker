import { esc } from '../dom.js';
import { get, setFilter, setUi } from '../store.js';
import { categories, months, years, monthLabel } from '../derive.js';

export function render(state, t) {
  const f = state.filter;
  const cats = categories(state);
  const catLabel = f.categories.length === 0
    ? t('transactionTable.allCategories')
    : t('transactionTable.selectedCount', { count: f.categories.length });

  return `
  <div class="filter-bar card">
    <div class="filter-row">
      <div class="dropdown">
        <button class="btn" data-action="toggle-cat-dropdown" data-which="filter">${esc(catLabel)} ▾</button>
        ${state.ui.categoryDropdownOpen === 'filter' ? `
        <div class="dropdown-menu left" data-keep-open>
          <label class="menu-item"><input type="checkbox" data-action-change="filter-cat-all" ${f.categories.length === 0 ? 'checked' : ''}> ${esc(t('transactionTable.allCategories'))}</label>
          ${cats.map(c => `
          <label class="menu-item"><input type="checkbox" data-action-change="filter-cat" data-cat="${esc(c)}" ${f.categories.includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
        </div>` : ''}
      </div>
      <input id="filter-desc" class="grow" type="search" placeholder="${esc(t('transactionTable.searchDescription'))}"
             value="${esc(f.description)}" data-action-input="filter-description">
    </div>
    <div class="filter-row">
      <div class="seg">
        <button class="${f.dateFilterType === 'all' ? 'active' : ''}" data-action="filter-date-type" data-type="all">${esc(t('common.all'))}</button>
        <button class="${f.dateFilterType === 'year' ? 'active' : ''}" data-action="filter-date-type" data-type="year">${esc(t('common.year'))}</button>
        <button class="${f.dateFilterType === 'month' ? 'active' : ''}" data-action="filter-date-type" data-type="month">${esc(t('common.month'))}</button>
        <button class="${f.dateFilterType === 'dateRange' ? 'active' : ''}" data-action="filter-date-type" data-type="dateRange">${esc(t('common.range'))}</button>
      </div>
      <button class="btn ${f.currentMonth ? 'active' : ''}" data-action="filter-current-month">${esc(t('app.currentMonth'))}</button>
    </div>
    ${f.dateFilterType === 'year' ? `
    <div class="filter-row">
      <select data-action-change="filter-year">
        <option value="">${esc(t('app.selectYear'))}</option>
        ${years(state).map(y => `<option value="${y}" ${f.year === y ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>` : ''}
    ${f.dateFilterType === 'month' ? `
    <div class="filter-row">
      <select data-action-change="filter-month">
        <option value="">${esc(t('app.selectMonth'))}</option>
        ${months(state).map(m => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${esc(monthLabel(m, state.ui.lang))}</option>`).join('')}
      </select>
      <button class="btn small ${f.month === '__last_month__' ? 'active' : ''}" data-action="filter-month-preset" data-preset="__last_month__">${esc(t('app.lastMonth'))}</button>
      <button class="btn small ${f.month === '__last_3_months__' ? 'active' : ''}" data-action="filter-month-preset" data-preset="__last_3_months__">${esc(t('app.last3Months'))}</button>
      <button class="btn small ${f.month === '__last_6_months__' ? 'active' : ''}" data-action="filter-month-preset" data-preset="__last_6_months__">${esc(t('app.last6Months'))}</button>
    </div>` : ''}
    ${f.dateFilterType === 'dateRange' ? `
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
    setFilter({ categories: el.checked ? [...current, cat] : current.filter(c => c !== cat) });
  },
  'filter-description': (el) => setFilter({ description: el.value }),
  'filter-date-type': (el) => setFilter({ dateFilterType: el.dataset.type, year: '', month: '', startDate: '', endDate: '' }),
  'filter-current-month': () => setFilter({ currentMonth: !get().filter.currentMonth }),
  'filter-year': (el) => setFilter({ year: el.value }),
  'filter-month': (el) => setFilter({ month: el.value }),
  'filter-month-preset': (el) => {
    const current = get().filter.month;
    setFilter({ month: current === el.dataset.preset ? '' : el.dataset.preset });
  },
  'filter-start-date': (el) => setFilter({ startDate: el.value }),
  'filter-end-date': (el) => setFilter({ endDate: el.value }),
};
