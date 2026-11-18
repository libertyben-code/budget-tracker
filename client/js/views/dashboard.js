import { esc, money, categoryName, chartColors, checkRow, icons } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { renderStarterOffer } from './category-manager.js';
import { slidersIcon } from './filters.js';
import { openInbox } from './categorise.js';
import {
  categoryPalette, categoryData, categoryByMonthData, monthlyData, monthLabel, monthTitle, dayTitle, OTHER,
  addMonths, dashboardMonth, monthTransactions, transactionsUpTo, months, stats, accountBalance, accountCurrency, lastBankSync, bankSyncFailed,
} from '../derive.js';
import { monthKey, todayIso } from '/shared/dates.js';

const kept = new Map();
let bankStatusAsked = false;

const RANGE_MONTHS = { '6m': 6, '12m': 12, all: Infinity };

const chevron = (d) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

function renderMonthStepper(state, t, month) {
  const isNow = month === monthKey(todayIso());
  const earliest = months(state).at(-1);
  return `
  <div class="month-stepper">
    <button class="icon-btn" data-action="dash-month-step" data-step="-1" aria-label="${esc(t('dashboard.prevMonth'))}" ${!earliest || month <= earliest ? 'disabled' : ''}>${chevron('m15 18-6-6 6-6')}</button>
    <button class="month-label ${isNow ? '' : 'past'}" data-action="dash-month-now" aria-live="polite" ${isNow ? '' : `title="${esc(t('dashboard.backToThisMonth'))}"`}>${esc(monthTitle(month, state.ui.lang))}</button>
    <button class="icon-btn" data-action="dash-month-step" data-step="1" aria-label="${esc(t('dashboard.nextMonth'))}" ${isNow ? 'disabled' : ''}>${chevron('m9 18 6-6-6-6')}</button>
  </div>`;
}

function renderBalance(state, t) {
  const { amount, asOf, source } = accountBalance(state);
  const lang = state.ui.lang;
  const failed = source === 'bank' && bankSyncFailed(state);
  let value = '<div class="glance-value muted">—</div>';
  let meta = '';
  if (amount !== null) {
    const when = asOf === todayIso() ? t('app.asOfToday') : t('app.asOf', { date: dayTitle(asOf, lang) });
    const sync = source === 'bank' ? lastBankSync(state) : null;
    value = `<div class="glance-value ${amount < 0 ? 'neg' : ''}">${money(amount, { currency: accountCurrency(state) })}</div>`;
    meta = sync
      ? [asOf === todayIso() ? '' : when, t('bank.lastSync', { date: new Date(sync).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) })].filter(Boolean).join(' · ')
      : `${t(source === 'bank' ? 'app.fromBank' : 'app.fromOpening')} · ${when}`;
  } else if (source === 'bank') {
    meta = t('app.balancePending');
  } else {
    value += `<button class="btn small" data-action="open-set-balance">${esc(t('header.setBalance'))}</button>`;
  }
  if (source === 'bank' && state.ui.bankBusy) meta = t('bank.syncing');
  else if (failed) meta = t('bank.couldNotUpdate');
  return `
  <div class="card glance-card glance-balance">
    <div class="glance-balance-row">
      <div class="glance-label">${esc(t('app.balance'))}</div>
      ${value}
    </div>
    ${meta ? `<div class="glance-meta ${failed && !state.ui.bankBusy ? 'danger-text' : ''}">${esc(meta)}</div>` : ''}
  </div>`;
}

function renderMonth(rows, t, currency) {
  const s = stats(rows);
  return `
  <div class="card glance-card">
    <div class="glance-label">${esc(t('app.net'))}</div>
    <div class="glance-value ${s.total >= 0 ? 'pos' : 'neg'}">${money(s.total, { currency, signed: true })}</div>
    <div class="glance-flows">
      <div><span class="glance-label">${esc(t('app.moneyIn'))}</span><span class="pos">${money(s.income, { currency })}</span></div>
      <div><span class="glance-label">${esc(t('app.moneyOut'))}</span><span class="neg">${money(s.spending, { currency })}</span></div>
    </div>
  </div>`;
}

function renderToCategorise(state, t) {
  const count = state.transactions.filter(tx => tx.category === 'Uncategorized').length;
  if (!count) return '';
  return `
  <div class="card glance-todo">
    <span class="grow">${esc(count === 1 ? t('dashboard.toCategoriseOne') : t('dashboard.toCategoriseMany', { count }))}</span>
    <button class="btn small primary" data-action="dash-categorise">${esc(t('dashboard.categorise'))}</button>
  </div>`;
}

// render() replaces the whole DOM; an unchanged chart moves its old box into the new
// placeholder. The box, not just the canvas: Chart.js's ResizeObserver watches the canvas's parent.
function keepOrBuild(id, key, build) {
  const canvas = document.getElementById(id);
  const prev = kept.get(id);
  if (prev?.key === key) {
    canvas.parentElement.replaceWith(prev.box);
    return;
  }
  prev?.chart.destroy();
  kept.set(id, { key, box: canvas.parentElement, chart: build(canvas) });
}

function renderWelcome(state, t) {
  const account = state.accounts.find(a => a.id === state.activeAccountId);
  const title = state.accounts.length > 1 && account ? t('dashboard.emptyTitle', { account: account.name }) : t('dashboard.welcomeTitle');
  return `
  <div class="card welcome-card">
    <h2>${esc(title)}</h2>
    <p class="muted">${esc(t('dashboard.welcomeText'))}</p>
    <div class="welcome-actions">
      <button class="btn primary" data-action="open-bank-sync">${icons.bank} ${esc(t('bank.linkBank'))}</button>
      <button class="btn" data-action="welcome-import-csv">${icons.import} ${esc(t('header.importCsv'))}</button>
      <input type="file" id="welcome-csv-file" accept=".csv" data-action-change="import-csv" hidden>
      <button class="btn" data-action="welcome-add-tx">＋ ${esc(t('dashboard.welcomeAdd'))}</button>
    </div>
    ${renderStarterOffer(state, t)}
  </div>`;
}

const seriesLabel = (name, t) => (name === OTHER ? t('dashboard.other') : categoryName(name, t));

// The choices are the charts' own series: a category folded into Other has no colour of its own
// to be drawn in alone. A pick that no longer names a series (another account) is dropped.
function chartFilter(state, palette = categoryPalette(state)) {
  const options = [...palette.slotIndex.keys(), ...(palette.fold.size ? [OTHER] : [])];
  const picked = state.ui.chartCategories.filter(c => options.includes(c));
  return { options, picked, shows: name => !picked.length || picked.includes(name) };
}

function renderChartFilter(state, t) {
  const { options, picked } = chartFilter(state);
  if (options.length < 2) return '';
  const label = !picked.length ? t('dashboard.allCategories')
    : picked.length === 1 ? seriesLabel(picked[0], t)
    : t('dashboard.selectedCount', { count: picked.length });
  return `
    <div class="row" style="margin-bottom:var(--space-3)">
      <div class="filter-pill ${picked.length ? 'active' : ''}">
        <button id="chart-filter-open" class="filter-btn" data-action="chart-filter-open" aria-haspopup="dialog"
                aria-label="${esc(t('dashboard.chartFilterOpen', { summary: label }))}">
          ${slidersIcon}<span class="filter-cats">${esc(label)}</span>
        </button>
        ${picked.length ? `<button class="filter-clear" data-action="chart-filter-clear" title="${esc(t('filters.clear'))}" aria-label="${esc(t('filters.clear'))}">✕</button>` : ''}
      </div>
    </div>`;
}

export function render(state, t) {
  if (!state.transactions.length) {
    return `
  <section class="view">
    ${accountBalance(state).amount !== null ? renderBalance(state, t) : ''}
    ${renderWelcome(state, t)}
  </section>`;
  }
  const month = dashboardMonth(state);
  const rangeBtn = (id, label) => `<button class="${state.ui.chartRange === id ? 'active' : ''}" data-action="chart-range" data-range="${id}">${esc(label)}</button>`;

  return `
  <section class="view">
    ${renderBalance(state, t)}
    ${renderMonthStepper(state, t, month)}
    ${renderMonth(monthTransactions(state, month), t, accountCurrency(state))}
    ${renderToCategorise(state, t)}
    ${renderChartFilter(state, t)}
    <div class="charts">
      <div class="card">
        <h2 style="margin:0 0 8px">${esc(t('dashboard.spendingByCategory'))}</h2>
        <div class="chart-box"><canvas id="chart-hbar"></canvas></div>
      </div>
      <div class="card chart-wide">
        <div class="chart-split">
          <div class="chart-pane">
            <div class="row" style="margin-bottom:8px">
              <h2 class="grow" style="margin:0">${esc(t('dashboard.monthlyOverview'))}</h2>
              <div class="seg">
                ${rangeBtn('6m', '6M')}
                ${rangeBtn('12m', '12M')}
                ${rangeBtn('all', t('common.all'))}
              </div>
            </div>
            <div class="chart-box"><canvas id="chart-flow"></canvas></div>
          </div>
          <div class="chart-pane">
            <div class="row" style="margin-bottom:8px">
              <div class="grow">
                <h2 style="margin:0">${esc(t('dashboard.spendingByCategoryMonth'))}</h2>
                <span class="muted" style="font-size:0.85rem">${esc(t('dashboard.trends'))}</span>
              </div>
              <div class="seg">
                <button class="${state.ui.chartMode === 'stacked' ? 'active' : ''}" data-action="chart-mode" data-mode="stacked">${esc(t('dashboard.stacked'))}</button>
                <button class="${state.ui.chartMode === 'grouped' ? 'active' : ''}" data-action="chart-mode" data-mode="grouped">${esc(t('dashboard.grouped'))}</button>
              </div>
            </div>
            <div class="chart-box"><canvas id="chart-bar"></canvas></div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

export function afterRender(state, t) {
  // The Balance card's last sync time comes from the bank status, otherwise loaded only by the bank panel.
  if (state.ui.tab === 'dashboard' && !bankStatusAsked && !state.ui.bankStatus && accountBalance(state).source === 'bank') {
    bankStatusAsked = true;
    api.bankStatus().then(bankStatus => setUi({ bankStatus }), () => {});
  }
  if (state.ui.tab !== 'dashboard' || typeof Chart === 'undefined' || !state.transactions.length) {
    for (const { chart } of kept.values()) chart.destroy();
    kept.clear();
    return;
  }

  const colors = chartColors();
  const palette = categoryPalette(state);
  const colorFor = (name) => name === OTHER ? colors.other : colors.palette[palette.slotIndex.get(name) % colors.palette.length];
  const labelFor = (name) => seriesLabel(name, t);
  const { shows } = chartFilter(state, palette);
  const currency = accountCurrency(state);
  const axisTick = (value) => money(value, { currency, compact: true });
  const monthCount = RANGE_MONTHS[state.ui.chartRange] || 6;
  const month = dashboardMonth(state);
  const trendTx = transactionsUpTo(state, month);
  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? { animation: false } : {};
  const shared = [colors, Chart.defaults.font.family, state.ui.lang, currency, motion];

  // Percentages stay a share of the whole month's spending, so hiding a category doesn't inflate the rest.
  const monthSpending = categoryData(monthTransactions(state, month), palette);
  const hbar = monthSpending.filter(d => shows(d.name));
  const hbarTotal = monthSpending.reduce((sum, d) => sum + d.value, 0);
  const hbarData = {
    labels: hbar.map(d => labelFor(d.name)),
    datasets: [{
      data: hbar.map(d => d.value),
      backgroundColor: hbar.map(d => colorFor(d.name)),
      borderRadius: 4,
      borderSkipped: 'start',
      maxBarThickness: 22,
    }],
  };
  keepOrBuild('chart-hbar', JSON.stringify([shared, hbarData, hbarTotal]), (canvas) => {
    canvas.parentElement.style.height = `${Math.max(hbar.length * 36 + 24, 120)}px`;
    const valueLabels = {
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const meta = chart.getDatasetMeta(0);
        ctx.save();
        ctx.font = `600 11px ${Chart.defaults.font.family}`;
        ctx.fillStyle = colors.text;
        ctx.textBaseline = 'middle';
        meta.data.forEach((bar, i) => {
          const value = chart.data.datasets[0].data[i];
          const pct = hbarTotal > 0 ? Math.round((value / hbarTotal) * 100) : 0;
          ctx.fillText(`${money(value, { currency })} · ${pct}%`, bar.x + 6, bar.y);
        });
        ctx.restore();
      },
    };
    return new Chart(canvas, {
      type: 'bar',
      plugins: [valueLabels],
      data: hbarData,
      options: {
        ...motion,
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 104 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${money(ctx.parsed.x, { currency })} (${hbarTotal > 0 ? ((ctx.parsed.x / hbarTotal) * 100).toFixed(1) : 0}%)`,
            },
          },
        },
        scales: {
          x: { display: false, beginAtZero: true },
          y: { grid: { display: false }, ticks: { autoSkip: false } },
        },
      },
    });
  });

  const flow = monthlyData(trendTx);
  const from = Math.max(flow.monthKeys.length - monthCount, 0);
  const flowData = {
    labels: flow.monthKeys.slice(from).map(m => monthLabel(m, state.ui.lang)),
    datasets: [
      { label: t('dashboard.income'), data: flow.income.slice(from), backgroundColor: colors.palette[1] },
      { label: t('dashboard.spending'), data: flow.spending.slice(from), backgroundColor: colors.palette[0] },
    ].map(d => ({ ...d, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 })),
  };
  keepOrBuild('chart-flow', JSON.stringify([shared, flowData]), (canvas) => {
    return new Chart(canvas, {
      type: 'bar',
      data: flowData,
      options: {
        ...motion,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y, { currency })}` } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: axisTick } },
        },
      },
    });
  });

  const { monthKeys, categories, byMonth } = categoryByMonthData(trendTx, palette);
  const barCats = categories.filter(shows);
  const shownMonths = monthKeys.slice(Math.max(monthKeys.length - monthCount, 0));
  const stacked = state.ui.chartMode === 'stacked';
  const barData = {
    labels: shownMonths.map(m => monthLabel(m, state.ui.lang)),
    datasets: barCats.map(cat => ({
      label: labelFor(cat),
      data: shownMonths.map(m => Number((byMonth[m][cat] || 0).toFixed(2))),
      backgroundColor: colorFor(cat),
      borderColor: colors.surface,
      borderWidth: stacked ? 1 : 0,
      borderRadius: stacked ? 0 : 2,
      maxBarThickness: 40,
    })),
  };
  keepOrBuild('chart-bar', JSON.stringify([shared, barData, stacked]), (canvas) => {
    return new Chart(canvas, {
      type: 'bar',
      data: barData,
      options: {
        ...motion,
        responsive: true,
        maintainAspectRatio: false,
        interaction: stacked ? { mode: 'index' } : undefined,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${money(ctx.parsed.y, { currency })}`,
              footer: stacked ? (items) => t('dashboard.total', { amount: money(items.reduce((sum, i) => sum + i.parsed.y, 0), { currency }) }) : undefined,
            },
          },
        },
        scales: {
          x: { stacked, grid: { display: false }, ticks: { maxRotation: 45 } },
          y: { stacked, beginAtZero: true, ticks: { callback: axisTick } },
        },
      },
    });
  });
}

// Drawn in #modals with the other dialogs.
export function renderSheet(state, t) {
  if (!state.ui.chartFilterSheet || state.ui.tab !== 'dashboard') return '';
  const { options, picked } = chartFilter(state);
  return `
  <div class="modal-backdrop" data-action="chart-filter-close" data-self-only>
    <div class="modal filter-sheet" id="chart-filter-sheet" role="dialog" aria-modal="true" aria-labelledby="chart-filter-title" tabindex="-1">
      <div class="modal-head">
        <h2 id="chart-filter-title">${esc(t('dashboard.chartFilterTitle'))}</h2>
        <button class="icon-btn" data-action="chart-filter-close" title="${esc(t('common.close'))}" aria-label="${esc(t('common.close'))}">✕</button>
      </div>
      <div class="filter-sheet-body">
        <p class="muted" style="margin:0 0 var(--space-2);font-size:0.85rem">${esc(t('dashboard.chartFilterHint'))}</p>
        ${checkRow({ on: picked.length === 0, action: 'chart-cat-all', label: t('dashboard.allCategories'), data: 'id="chart-cat-all"' })}
        ${options.map((c, i) => checkRow({ on: picked.includes(c), action: 'chart-cat', label: seriesLabel(c, t), data: `id="chart-cat-${i}" data-cat="${esc(c)}"` })).join('')}
      </div>
      <div class="filter-sheet-foot">
        <button class="btn ghost" data-action="chart-filter-clear">${esc(t('filters.reset'))}</button>
        <button class="btn primary" data-action="chart-filter-close">${esc(t('common.done'))}</button>
      </div>
    </div>
  </div>`;
}

// Every change re-renders the sheet from a string, which would jump its list back to the top.
function setChartCategories(chartCategories) {
  const top = document.querySelector('.filter-sheet-body')?.scrollTop || 0;
  setUi({ chartCategories });
  const body = document.querySelector('.filter-sheet-body');
  if (body) body.scrollTop = top;
}

export const actions = {
  'chart-mode': (el) => setUi({ chartMode: el.dataset.mode }),
  'chart-range': (el) => setUi({ chartRange: el.dataset.range }),
  'chart-filter-open': () => {
    setUi({ chartFilterSheet: true });
    document.querySelector('#chart-filter-sheet .check-row.on')?.focus();
  },
  'chart-filter-close': () => {
    setUi({ chartFilterSheet: false });
    document.getElementById('chart-filter-open')?.focus();
  },
  'chart-filter-clear': () => {
    setChartCategories([]);
    if (!get().ui.chartFilterSheet) document.getElementById('chart-filter-open')?.focus();
  },
  'chart-cat-all': () => setChartCategories([]),
  // Ticking the last one left out means every category again, so "All" comes back on.
  'chart-cat': (el) => {
    const { options, picked } = chartFilter(get());
    const cat = el.dataset.cat;
    const next = picked.includes(cat) ? picked.filter(c => c !== cat) : [...picked, cat];
    setChartCategories(next.length === options.length ? [] : next);
  },
  'dash-month-step': (el) => {
    const next = addMonths(dashboardMonth(get()), Number(el.dataset.step));
    setUi({ dashMonth: next >= monthKey(todayIso()) ? '' : next });
  },
  'dash-month-now': () => setUi({ dashMonth: '' }),
  'dash-categorise': openInbox,
  'welcome-import-csv': () => document.getElementById('welcome-csv-file').click(),
  'welcome-add-tx': () => {
    set({ creatingTx: true });
    location.hash = '#/transactions';
  },
  'open-set-balance': () => {
    setUi({ accountMenuOpen: true, settingsOpen: false, balanceFormOpen: true });
    document.getElementById('opening-balance').focus();
  },
};
