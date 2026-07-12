import { esc, eur, chartColors } from '../dom.js';
import { setUi, get } from '../store.js';
import { filteredTransactions, categories, categoryPalette, categoryData, categoryByMonthData, monthlyData, monthLabel, OTHER } from '../derive.js';
import { render as renderFilters } from './filters.js';
import { renderTiles } from './transactions.js';

let charts = [];

const RANGE_MONTHS = { '6m': 6, '12m': 12, all: Infinity };

export function render(state, t) {
  const pieLabel = state.ui.pieCategories.length === 0
    ? t('dashboard.allCategories')
    : t('dashboard.selectedCount', { count: state.ui.pieCategories.length });
  const cats = categories(state);
  const rangeBtn = (id, label) => `<button class="${state.ui.chartRange === id ? 'active' : ''}" data-action="chart-range" data-range="${id}">${esc(label)}</button>`;

  return `
  <section class="view">
    ${renderTiles(state, t)}
    ${renderFilters(state, t)}
    <div class="charts">
      <div class="card">
        <div class="row" style="margin-bottom:8px">
          <h2 class="grow" style="margin:0">${esc(t('dashboard.spendingByCategory'))}</h2>
          <div class="dropdown">
            <button class="btn small select-btn" data-action="toggle-cat-dropdown" data-which="pie">${esc(pieLabel)}</button>
            ${state.ui.categoryDropdownOpen === 'pie' ? `
            <div class="dropdown-menu" data-keep-open>
              <label class="menu-item"><input type="checkbox" data-action-change="pie-cat-all" ${state.ui.pieCategories.length === 0 ? 'checked' : ''}> ${esc(t('dashboard.allCategories'))}</label>
              ${cats.map(c => `
              <label class="menu-item"><input type="checkbox" data-action-change="pie-cat" data-cat="${esc(c)}" ${state.ui.pieCategories.includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
            </div>` : ''}
          </div>
        </div>
        <div class="chart-box" id="hbar-box"><canvas id="chart-hbar"></canvas></div>
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
  for (const chart of charts) chart.destroy();
  charts = [];
  if (state.ui.tab !== 'dashboard' || typeof Chart === 'undefined') return;

  const colors = chartColors();
  const palette = categoryPalette(state);
  const colorFor = (name) => name === OTHER ? colors.other : colors.palette[palette.slotIndex.get(name) % colors.palette.length];
  const labelFor = (name) => name === OTHER ? t('dashboard.other') : name;
  const monthCount = RANGE_MONTHS[state.ui.chartRange] || 6;
  const filtered = filteredTransactions(state);
  const trendTx = filteredTransactions(state, { ignoreTime: true });
  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const hbarEl = document.getElementById('chart-hbar');
  if (hbarEl) {
    const data = categoryData(filtered, state.ui.pieCategories, palette);
    const hbarTotal = data.reduce((sum, d) => sum + d.value, 0);
    const box = document.getElementById('hbar-box');
    if (box) box.style.height = `${Math.max(data.length * 36 + 24, 120)}px`;
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
    charts.push(new Chart(hbarEl, {
      type: 'bar',
      plugins: [valueLabels],
      data: {
        labels: data.map(d => labelFor(d.name)),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => colorFor(d.name)),
          borderRadius: 4,
          borderSkipped: 'start',
          maxBarThickness: 22,
        }],
      },
      options: {
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
    }));
  }

  const flowEl = document.getElementById('chart-flow');
  if (flowEl) {
    const data = monthlyData(trendTx);
    const from = Math.max(data.monthKeys.length - monthCount, 0);
    charts.push(new Chart(flowEl, {
      type: 'bar',
      data: {
        labels: data.monthKeys.slice(from).map(m => monthLabel(m, state.ui.lang)),
        datasets: [
          { label: t('dashboard.income'), data: data.income.slice(from), backgroundColor: colors.palette[1] },
          { label: t('dashboard.spending'), data: data.spending.slice(from), backgroundColor: colors.palette[0] },
        ].map(d => ({ ...d, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 })),
      },
      options: {
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
    }));
  }

  const barEl = document.getElementById('chart-bar');
  if (barEl) {
    const { monthKeys, categories: barCats, byMonth } = categoryByMonthData(trendTx, palette);
    const shownMonths = monthKeys.slice(Math.max(monthKeys.length - monthCount, 0));
    const stacked = state.ui.chartMode === 'stacked';
    charts.push(new Chart(barEl, {
      type: 'bar',
      data: {
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
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: stacked ? { mode: 'index' } : undefined,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${eur(ctx.parsed.y)}`,
              footer: stacked ? (items) => `Total: ${eur(items.reduce((sum, i) => sum + i.parsed.y, 0))}` : undefined,
            },
          },
        },
        scales: {
          x: { stacked, grid: { display: false }, ticks: { maxRotation: 45 } },
          y: { stacked, beginAtZero: true },
        },
      },
    }));
  }
}

export const actions = {
  'chart-mode': (el) => setUi({ chartMode: el.dataset.mode }),
  'chart-range': (el) => setUi({ chartRange: el.dataset.range }),
  'pie-cat-all': () => setUi({ pieCategories: [] }),
  'pie-cat': (el) => {
    const current = get().ui.pieCategories;
    const cat = el.dataset.cat;
    setUi({ pieCategories: el.checked ? [...current, cat] : current.filter(c => c !== cat) });
  },
};
