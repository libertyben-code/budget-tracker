export function displayToIso(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return toIso(d);
}

export function isoToDisplay(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

export function toIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayIso() {
  return toIso(new Date());
}

export function monthKey(iso) {
  return iso ? iso.slice(0, 7) : '';
}

export function isCurrentMonth(iso) {
  return monthKey(iso) === monthKey(todayIso());
}

export function relativeMonthStart(monthCount) {
  const now = new Date();
  return toIso(new Date(now.getFullYear(), now.getMonth() - monthCount + 1, 1));
}
