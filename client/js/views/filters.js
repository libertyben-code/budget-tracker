import { esc, checkRow, categoryName } from '../dom.js';
import { get, setFilter, setUi } from '../store.js';
import { categories, months, years, monthTitle, filteredTransactions } from '../derive.js';
import { todayIso } from '/shared/dates.js';

const slidersIcon = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>';

const noDates = { currentMonth: false, dateFilterType: 'all', year: '', month: '', startDate: '', endDate: '' };
const presets = {
  current: { ...noDates, currentMonth: true },
  lastMonth: { ...noDates, dateFilterType: 'month', month: '__last_month__' },
  last3: { ...noDates, dateFilterType: 'month', month: '__last_3_months__' },
  last6: { ...noDates, dateFilterType: 'month', month: '__last_6_months__' },
  all: noDates,
};
const presetLabels = {
  current: 'filters.thisMonth',
  lastMonth: 'filters.lastMonth',
  last3: 'filters.last3Months',
  last6: 'filters.last6Months',
  all: 'filters.allTime',
};

// Month, year and range start on a value, so the chip never selects a filter that shows everything.
function pickerPatch(which, state) {
  if (which === 'month') return { ...noDates, dateFilterType: 'month', month: months(state)[0] || '' };
  if (which === 'year') return { ...noDates, dateFilterType: 'year', year: years(state)[0] || '' };
  const today = todayIso();
  return { ...noDates, dateFilterType: 'dateRange', startDate: `${today.slice(0, 8)}01`, endDate: today };
}

function activePeriod(f) {
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

function isDefault(f) {
  return f.currentMonth && f.categories.length === 0;
}

function rangeLabel(start, end, lang) {
  const year = todayIso().slice(0, 4);
  const thisYear = start.startsWith(year) && end.startsWith(year);
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) });
  return `${fmt.format(new Date(`${start}T00:00`))} – ${fmt.format(new Date(`${end}T00:00`))}`;
}

// What the list actually shows: a month, year or range chip without its value filters nothing.
function periodLabel(f, t, lang) {
  const period = activePeriod(f);
  if (period === 'month' && f.month) return monthTitle(f.month, lang);
  if (period === 'year' && f.year) return f.year;
  if (period === 'range' && f.startDate && f.endDate) return rangeLabel(f.startDate, f.endDate, lang);
  return t(presetLabels[period] || presetLabels.all);
}

function categoryLabel(f, t) {
  if (f.categories.length === 0) return '';
  return f.categories.length === 1 ? categoryName(f.categories[0], t) : t('filters.categoryCount', { count: f.categories.length });
}

export function render(state, t) {
  const f = state.filter;
  const period = periodLabel(f, t, state.ui.lang);
  const cats = categoryLabel(f, t);
  const filtered = !isDefault(f);

  return `
  <div class="filter-bar">
    <input id="filter-desc" type="search" enterkeyhint="search" autocomplete="off" placeholder="${esc(t('filters.search'))}"
           aria-label="${esc(t('filters.searchLabel'))}" value="${esc(f.description)}" data-action-input="filter-description">
    <div class="filter-pill ${filtered ? 'active' : ''}">
      <button id="filter-open" class="filter-btn" data-action="filter-sheet-open" aria-haspopup="dialog"
              aria-label="${esc(t('filters.open', { summary: [period, cats].filter(Boolean).join(', ') }))}">
        ${slidersIcon}<span class="filter-period">${esc(period)}</span>${cats ? `<span class="filter-cats">· ${esc(cats)}</span>` : ''}
      </button>
      ${filtered ? `<button class="filter-clear" data-action="filter-clear" title="${esc(t('filters.clear'))}" aria-label="${esc(t('filters.clear'))}">✕</button>` : ''}
    </div>
  </div>`;
}

// Drawn in #modals with the other dialogs, for the Transactions tab's filter bar.
export function renderSheet(state, t) {
  if (!state.ui.filterSheet || state.ui.tab !== 'transactions') return '';
  const f = state.filter;
  const lang = state.ui.lang;
  const active = activePeriod(f);
  const count = filteredTransactions(state).length;
  const chip = (id, label) => `<button id="filter-chip-${id}" class="chip-btn ${active === id ? 'active' : ''}" data-action="filter-period" data-which="${id}" aria-pressed="${active === id}">${esc(label)}</button>`;

  return `
  <div class="modal-backdrop" data-action="filter-sheet-close" data-self-only>
    <div class="modal filter-sheet" id="filter-sheet" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title" tabindex="-1">
      <div class="modal-head">
        <h2 id="filter-sheet-title">${esc(t('filters.title'))}</h2>
        <button class="icon-btn" data-action="filter-sheet-close" title="${esc(t('common.close'))}" aria-label="${esc(t('common.close'))}">✕</button>
      </div>
      <div class="filter-sheet-body">
        <h3 class="picker-label">${esc(t('filters.period'))}</h3>
        <div class="chip-wrap">
          ${Object.keys(presets).filter(id => id !== 'all').map(id => chip(id, t(presetLabels[id]))).join('')}
          ${chip('month', t('filters.month'))}
          ${chip('year', t('filters.year'))}
          ${chip('range', t('filters.range'))}
          ${chip('all', t(presetLabels.all))}
        </div>
        ${active === 'month' ? `
        <select id="filter-month" class="filter-detail" aria-label="${esc(t('common.month'))}" data-action-change="filter-month">
          ${months(state).map(m => `<option value="${m}" ${f.month === m ? 'selected' : ''}>${esc(monthTitle(m, lang))}</option>`).join('')}
        </select>` : ''}
        ${active === 'year' ? `
        <select id="filter-year" class="filter-detail" aria-label="${esc(t('common.year'))}" data-action-change="filter-year">
          ${years(state).map(y => `<option value="${y}" ${f.year === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>` : ''}
        ${active === 'range' ? `
        <div class="filter-range">
          <label>${esc(t('common.from'))}<input id="filter-start" type="date" value="${esc(f.startDate)}" data-action-change="filter-start-date"></label>
          <label>${esc(t('common.to'))}<input id="filter-end" type="date" value="${esc(f.endDate)}" data-action-change="filter-end-date"></label>
        </div>` : ''}
        <h3 class="picker-label">${esc(t('filters.categories'))}</h3>
        ${checkRow({ on: f.categories.length === 0, action: 'filter-cat-all', label: t('filters.allCategories'), data: 'id="filter-cat-all"' })}
        ${categories(state).map((c, i) => checkRow({ on: f.categories.includes(c), action: 'filter-cat', label: categoryName(c, t), data: `id="filter-cat-${i}" data-cat="${esc(c)}"` })).join('')}
      </div>
      <div class="filter-sheet-foot">
        <button id="filter-reset" class="btn ghost" data-action="filter-clear">${esc(t('filters.reset'))}</button>
        <button class="btn primary" data-action="filter-sheet-close">${esc(count === 1 ? t('filters.showOne') : t('filters.show', { count }))}</button>
      </div>
    </div>
  </div>`;
}

// Every change re-renders the sheet from a string, which would jump its list back to the top.
function setFilterKeepingScroll(patch) {
  const top = document.querySelector('.filter-sheet-body')?.scrollTop || 0;
  setFilter(patch);
  const body = document.querySelector('.filter-sheet-body');
  if (body) body.scrollTop = top;
}

function closeSheet() {
  setUi({ filterSheet: false });
  document.getElementById('filter-open')?.focus();
}

export const actions = {
  'filter-sheet-open': () => {
    setUi({ filterSheet: true });
    document.querySelector('.filter-sheet .chip-btn.active')?.focus();
  },
  'filter-sheet-close': closeSheet,
  'filter-clear': () => {
    setFilterKeepingScroll({ ...presets.current, categories: [] });
    if (!get().ui.filterSheet) document.getElementById('filter-open')?.focus();
  },
  'filter-cat-all': () => setFilterKeepingScroll({ categories: [] }),
  'filter-cat': (el) => {
    const current = get().filter.categories;
    const cat = el.dataset.cat;
    setFilterKeepingScroll({ categories: current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat] });
  },
  'filter-description': (el) => setFilter({ description: el.value }),
  'filter-period': (el) => {
    const which = el.dataset.which;
    setFilterKeepingScroll(presets[which] || pickerPatch(which, get()));
  },
  'filter-year': (el) => setFilterKeepingScroll({ year: el.value }),
  'filter-month': (el) => setFilterKeepingScroll({ month: el.value }),
  'filter-start-date': (el) => setFilterKeepingScroll({ startDate: el.value }),
  'filter-end-date': (el) => setFilterKeepingScroll({ endDate: el.value }),
};
