import { esc, eur, chartColors } from '../dom.js';
import { setUi, setFilter, get } from '../store.js';
import { filteredTransactions, categories, categoryData, categoryByMonthData, monthlyData, monthLabel } from '../derive.js';
import { render as renderFilters } from './filters.js';
import { renderTiles } from './transactions.js';

let charts = [];

export function render(state, t) {
  const pieLabel = state.ui.pieCategories.length === 0
    ? t('dashboard.allCategories')
    : t('dashboard.selectedCount', { count: state.ui.pieCategories.length });
  const cats = categories(state);

  return `
  <section class="view">
    ${renderTiles(state, t)}
    ${renderFilters(state, t)}
    <div class="charts">
      <div class="card">
        <div class="row" style="margin-bottom:8px">
          <h2 class="grow" style="margin:0">${esc(t('dashboard.spendingByCategory'))}</h2>
          <div class="dropdown">
            <button class="btn small" data-action="toggle-cat-dropdown" data-which="pie">${esc(pieLabel)} ▾</button>
            ${state.ui.categoryDropdownOpen === 'pie' ? `
            <div class="dropdown-menu" data-keep-open>
              <label class="menu-item"><input type="checkbox" data-action-change="pie-cat-all" ${state.ui.pieCategories.length === 0 ? 'checked' : ''}> ${esc(t('dashboard.allCategories'))}</label>
              ${cats.map(c => `
              <label class="menu-item"><input type="checkbox" data-action-change="pie-cat" data-cat="${esc(c)}" ${state.ui.pieCategories.includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
            </div>` : ''}
          </div>
        </div>
        <div class="chart-box"><canvas id="chart-pie"></canvas></div>
      </div>
      <div class="card">
        <h2>${esc(t('dashboard.monthlyOverview'))}</h2>
        <div class="chart-box"><canvas id="chart-line"></canvas></div>
      </div>
      <div class="card chart-wide">
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
        <div class="chart-scroll"><div class="chart-box" id="bar-box"><canvas id="chart-bar"></canvas></div></div>
      </div>
    </div>
  </section>`;
}

export function afterRender(state, t) {
  for (const chart of charts) chart.destroy();
  charts = [];
  if (state.ui.tab !== 'dashboard' || typeof Chart === 'undefined') return;

  const colors = chartColors();
  const filtered = filteredTransactions(state);
  Chart.defaults.color = colors.text;
  Chart.defaults.borderColor = colors.grid;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;

  const pieEl = document.getElementById('chart-pie');
  if (pieEl) {
    const data = categoryData(filtered, state.ui.pieCategories);
    const total = data.reduce((sum, d) => sum + d.value, 0);
    charts.push(new Chart(pieEl, {
      type: 'pie',
      data: {
        labels: data.map(d => d.name),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map((_, i) => colors.palette[i % colors.palette.length]),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: window.innerWidth < 640 ? 'bottom' : 'right' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${eur(ctx.parsed)} (${total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0}%)`,
            },
          },
        },
      },
    }));
  }

  const lineEl = document.getElementById('chart-line');
  if (lineEl) {
    const data = monthlyData(filtered);
    charts.push(new Chart(lineEl, {
      type: 'line',
      data: {
        labels: data.monthKeys.map(m => monthLabel(m, state.ui.lang)),
        datasets: [{
          label: t('dashboard.spending'),
          data: data.spending,
          borderColor: colors.danger,
          backgroundColor: colors.danger + '33',
          fill: true,
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur(ctx.parsed.y)}` } } },
        scales: { y: { beginAtZero: true } },
      },
    }));
  }

  const barEl = document.getElementById('chart-bar');
  if (barEl) {
    const { monthKeys, categories: barCats, byMonth } = categoryByMonthData(filtered);
    const stacked = state.ui.chartMode === 'stacked';
    const box = document.getElementById('bar-box');
    if (box) box.style.minWidth = `${Math.max(monthKeys.length * 72, 280)}px`;
    charts.push(new Chart(barEl, {
      type: 'bar',
      data: {
        labels: monthKeys.map(m => monthLabel(m, state.ui.lang)),
        datasets: barCats.map((cat, i) => ({
          label: cat,
          data: monthKeys.map(m => Number((byMonth[m][cat] || 0).toFixed(2))),
          backgroundColor: colors.palette[i % colors.palette.length],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${eur(ctx.parsed.y)}` } } },
        scales: {
          x: { stacked, ticks: { maxRotation: 60, minRotation: 45 } },
          y: { stacked, beginAtZero: true },
        },
      },
    }));
  }
}

export const actions = {
  'chart-mode': (el) => setUi({ chartMode: el.dataset.mode }),
  'pie-cat-all': () => setUi({ pieCategories: [] }),
  'pie-cat': (el) => {
    const current = get().ui.pieCategories;
    const cat = el.dataset.cat;
    setUi({ pieCategories: el.checked ? [...current, cat] : current.filter(c => c !== cat) });
  },
};
