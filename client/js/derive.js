import { monthKey, todayIso, relativeMonthStart } from '/shared/dates.js';

export function filteredTransactions(state, { ignoreTime = false } = {}) {
  const { filter, sort } = state;
  const nowMonth = monthKey(todayIso());

  const filtered = state.transactions.filter(t => {
    if (filter.categories.length > 0 && !filter.categories.includes(t.category)) return false;
    if (filter.description && !t.description.toLowerCase().includes(filter.description.toLowerCase())) return false;
    if (filter.categorySearch && !t.category.toLowerCase().includes(filter.categorySearch.toLowerCase())) return false;
    if (ignoreTime) return true;

    const txMonth = monthKey(t.date);
    if (filter.currentMonth && txMonth !== nowMonth) return false;

    if (filter.dateFilterType === 'year' && filter.year) {
      if (t.date.slice(0, 4) !== filter.year) return false;
    } else if (filter.dateFilterType === 'month' && filter.month) {
      if (filter.month === '__last_month__') {
        const now = new Date();
        const last = monthKey(`${new Date(now.getFullYear(), now.getMonth() - 1, 1).getFullYear()}-${String(new Date(now.getFullYear(), now.getMonth() - 1, 1).getMonth() + 1).padStart(2, '0')}-01`);
        if (txMonth !== last) return false;
      } else if (filter.month === '__last_3_months__') {
        if (txMonth < monthKey(relativeMonthStart(3)) || txMonth > nowMonth) return false;
      } else if (filter.month === '__last_6_months__') {
        if (txMonth < monthKey(relativeMonthStart(6)) || txMonth > nowMonth) return false;
      } else if (txMonth !== filter.month) {
        return false;
      }
    } else if (filter.dateFilterType === 'dateRange' && filter.startDate && filter.endDate) {
      if (t.date < filter.startDate || t.date > filter.endDate) return false;
    }

    return true;
  });

  if (sort.key) {
    const dir = sort.direction === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      let av;
      let bv;
      if (sort.key === 'date') { av = a.date; bv = b.date; }
      else if (sort.key === 'amount') { av = a.amount; bv = b.amount; }
      else { av = a.category.toLowerCase(); bv = b.category.toLowerCase(); }
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }

  return filtered;
}

export function categories(state) {
  return [...new Set([
    ...state.transactions.map(t => t.category),
    ...(state.customCategories || []),
  ])].sort();
}

export function months(state) {
  return [...new Set(state.transactions.map(t => monthKey(t.date)))].filter(Boolean).sort().reverse();
}

export function years(state) {
  return [...new Set(state.transactions.map(t => t.date.slice(0, 4)))].filter(Boolean).sort().reverse();
}

export function stats(filtered) {
  let total = 0;
  let spending = 0;
  let income = 0;
  for (const t of filtered) {
    total += t.amount;
    if (t.amount < 0) spending += Math.abs(t.amount);
    else income += t.amount;
  }
  return { total, spending, income };
}

export const OTHER = '__other__';

// Slots are assigned from the full dataset so filtering never repaints a
// surviving category. Past 8 spending categories, the smallest fold into OTHER.
export function categoryPalette(state) {
  const totals = {};
  for (const t of state.transactions) {
    if (t.amount >= 0) continue;
    totals[t.category] = (totals[t.category] || 0) + Math.abs(t.amount);
  }
  const ranked = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const kept = (ranked.length <= 8 ? ranked : ranked.slice(0, 7)).sort();
  return {
    slotIndex: new Map(kept.map((c, i) => [c, i])),
    fold: new Set(ranked.slice(kept.length)),
  };
}

export function categoryData(filtered, pieCategories, palette) {
  const spending = {};
  for (const t of filtered) {
    if (t.amount >= 0) continue;
    if (pieCategories.length > 0 && !pieCategories.includes(t.category)) continue;
    const name = palette.fold.has(t.category) ? OTHER : t.category;
    spending[name] = (spending[name] || 0) + Math.abs(t.amount);
  }
  return Object.entries(spending)
    .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
    .sort((a, b) => (a.name === OTHER) - (b.name === OTHER) || b.value - a.value);
}

export function categoryByMonthData(filtered, palette) {
  const byMonth = {};
  const cats = new Set();
  for (const t of filtered) {
    if (t.amount >= 0) continue;
    const m = monthKey(t.date);
    if (!m) continue;
    const cat = palette.fold.has(t.category) ? OTHER : t.category;
    byMonth[m] = byMonth[m] || {};
    byMonth[m][cat] = (byMonth[m][cat] || 0) + Math.abs(t.amount);
    cats.add(cat);
  }
  const monthKeys = Object.keys(byMonth).sort();
  const categories = [...cats].sort((a, b) => (a === OTHER) - (b === OTHER) || a.localeCompare(b));
  return { monthKeys, categories, byMonth };
}

export function monthlyData(filtered) {
  const monthly = {};
  for (const t of filtered) {
    const m = monthKey(t.date);
    if (!m) continue;
    monthly[m] = monthly[m] || { spending: 0, income: 0 };
    if (t.amount < 0) monthly[m].spending += Math.abs(t.amount);
    else monthly[m].income += t.amount;
  }
  const keys = Object.keys(monthly).sort();
  return {
    monthKeys: keys,
    spending: keys.map(k => Number(monthly[k].spending.toFixed(2))),
    income: keys.map(k => Number(monthly[k].income.toFixed(2))),
  };
}

export function jointData(state) {
  const nowMonth = monthKey(todayIso());
  const currentMonthTx = state.transactions.filter(t => monthKey(t.date) === nowMonth);
  const bills = currentMonthTx.filter(t => (t.category || '').toLowerCase().includes('bill'));
  const billsTotal = bills.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  const nonBillCount = currentMonthTx.length - bills.length;

  const account = state.accounts.find(a => a.id === state.activeAccountId) || {};
  const salary1 = parseFloat(account.salaryPerson1) || 0;
  const salary2 = parseFloat(account.salaryPerson2) || 0;
  const target = parseFloat(account.jointTargetAmount) || 0;
  const totalToSplit = target > 0 ? target : billsTotal;
  const totalSalaries = salary1 + salary2;

  return {
    bills,
    billsTotal,
    nonBillCount,
    salary1,
    salary2,
    totalToSplit,
    person1: totalSalaries > 0 ? (totalToSplit * salary1) / totalSalaries : 0,
    person2: totalSalaries > 0 ? (totalToSplit * salary2) / totalSalaries : 0,
    hasSalaries: totalSalaries > 0,
  };
}

export function monthLabel(m, lang) {
  const [year, month] = m.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  const name = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { month: 'short' }).format(date);
  return `${name.charAt(0).toUpperCase()}${name.slice(1).replace('.', '')}-${year.slice(-2)}`;
}
