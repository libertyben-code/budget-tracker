export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function eur(value) {
  return `€${Number(value || 0).toFixed(2)}`;
}

export function eurSigned(value) {
  const n = Number(value || 0);
  return `${n > 0 ? '+' : n < 0 ? '-' : ''}€${Math.abs(n).toFixed(2)}`;
}

export function eurSpaced(value) {
  const fixed = Number(value || 0).toFixed(2);
  const [int, dec] = fixed.split('.');
  return `€${int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${dec}`;
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function chartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    palette: [1, 2, 3, 4, 5, 6, 7, 8].map(i => styles.getPropertyValue(`--chart-${i}`).trim()),
    text: styles.getPropertyValue('--muted').trim(),
    grid: styles.getPropertyValue('--border').trim(),
    danger: styles.getPropertyValue('--danger').trim(),
  };
}
