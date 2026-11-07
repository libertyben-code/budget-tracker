import { esc, eur, chartColors } from '../dom.js';
import { get, setUi } from '../store.js';
import {
  categoryPalette, categoryData, categoryByMonthData, monthlyData, monthLabel, monthTitle, OTHER,
  addMonths, dashboardMonth, monthTransactions, transactionsUpTo, months,
} from '../derive.js';
import { monthKey, todayIso } from '/shared/dates.js';
import { renderTiles } from './transactions.js';

const kept = new Map();

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

export function render(state, t) {
  const month = dashboardMonth(state);
  const rangeBtn = (id, label) => `<button class="${state.ui.chartRange === id ? 'active' : ''}" data-action="chart-range" data-range="${id}">${esc(label)}</button>`;

  return `
  <section class="view">
    ${renderMonthStepper(state, t, month)}
    ${renderTiles(monthTransactions(state, month), t)}
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
  if (state.ui.tab !== 'dashboard' || typeof Chart === 'undefined') {
    for (const { chart } of kept.values()) chart.destroy();
    kept.clear();
    return;
  }

  const colors = chartColors();
  const palette = categoryPalette(state);
  const colorFor = (name) => name === OTHER ? colors.other : colors.palette[palette.slotIndex.get(name) % colors.palette.length];
  const labelFor = (name) => name === OTHER ? t('dashboard.other') : name;
  const monthCount = RANGE_MONTHS[state.ui.chartRange] || 6;
  const month = dashboardMonth(state);
  const trendTx = transactionsUpTo(state, month);
  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  const motion = matchMedia('(prefers-reduced-motion: reduce)').matches ? { animation: false } : {};
  const shared = [colors, Chart.defaults.font.family, state.ui.lang, motion];

  const hbar = categoryData(monthTransactions(state, month), [], palette);
  const hbarTotal = hbar.reduce((sum, d) => sum + d.value, 0);
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
  keepOrBuild('chart-hbar', JSON.stringify([shared, hbarData]), (canvas) => {
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
          ctx.fillText(`${eur(value)} · ${pct}%`, bar.x + 6, bar.y);
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
              label: (ctx) => `${eur(ctx.parsed.x)} (${hbarTotal > 0 ? ((ctx.parsed.x / hbarTotal) * 100).toFixed(1) : 0}%)`,
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
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur(ctx.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true },
        },
      },
    });
  });

  const { monthKeys, categories: barCats, byMonth } = categoryByMonthData(trendTx, palette);
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
              label: (ctx) => `${ctx.dataset.label}: ${eur(ctx.parsed.y)}`,
              footer: stacked ? (items) => t('dashboard.total', { amount: eur(items.reduce((sum, i) => sum + i.parsed.y, 0)) }) : undefined,
            },
          },
        },
        scales: {
          x: { stacked, grid: { display: false }, ticks: { maxRotation: 45 } },
          y: { stacked, beginAtZero: true },
        },
      },
    });
  });
}

export const actions = {
  'chart-mode': (el) => setUi({ chartMode: el.dataset.mode }),
  'chart-range': (el) => setUi({ chartRange: el.dataset.range }),
  'dash-month-step': (el) => {
    const next = addMonths(dashboardMonth(get()), Number(el.dataset.step));
    setUi({ dashMonth: next >= monthKey(todayIso()) ? '' : next });
  },
  'dash-month-now': () => setUi({ dashMonth: '' }),
};
