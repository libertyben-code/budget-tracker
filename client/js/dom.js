import { get } from './store.js';

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const moneyFormats = new Map();

// narrowSymbol: French otherwise writes the pound "£GB".
function moneyFormat(currency, options = {}) {
  const locale = get().ui.lang === 'fr' ? 'fr-FR' : 'en-GB';
  const key = JSON.stringify([locale, currency, options]);
  if (!moneyFormats.has(key)) {
    moneyFormats.set(key, new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...options }));
  }
  return moneyFormats.get(key);
}

// Rounded first: a float sum like -0.0000001 would otherwise show as "-€0.00".
export function money(value, { currency, signed = false, compact = false }) {
  const format = moneyFormat(currency, { ...(signed && { signDisplay: 'exceptZero' }), ...(compact && { notation: 'compact' }) });
  return format.format(Math.round(Number(value || 0) * 100) / 100 || 0);
}

export function currencySymbol(currency) {
  return moneyFormat(currency).formatToParts(0).find(part => part.type === 'currency').value;
}

// The stored name stays 'Uncategorized' whatever the language.
export function categoryName(name, t) {
  return name === 'Uncategorized' ? t('common.uncategorized') : name;
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// render() carries typed values over to the next render, so a form that stays open after a
// submit puts its fields back to how they were rendered. Looked up by id: a render during the
// request may have replaced them.
export function resetFields(...ids) {
  for (const el of ids.map(id => document.getElementById(id))) {
    if (el instanceof HTMLSelectElement) for (const option of el.options) option.selected = option.defaultSelected;
    else if (el) el.value = el.defaultValue;
  }
}

// A way back to an element after render() has replaced it: by id, else by its tag and data-*
// attributes (the same match by position, as rows can be drawn twice).
export function finder(el) {
  if (!(el instanceof HTMLElement) || el === document.body) return () => null;
  const id = el.id;
  if (id) return () => (el.isConnected ? el : document.getElementById(id));
  const attrs = [...el.attributes].filter(a => a.name.startsWith('data-'));
  if (!attrs.length) return () => (el.isConnected ? el : null);
  const selector = el.tagName + attrs.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
  const index = [...document.querySelectorAll(selector)].indexOf(el);
  return () => (el.isConnected ? el : document.querySelectorAll(selector)[index] || null);
}

// Dialogs stack in document order (#modals, then a confirm dialog on <body>). Only the topmost
// can be reached: the page and every dialog under it are inert.
export function syncLayers() {
  const layers = [...document.querySelectorAll('.modal-backdrop')];
  const top = layers.at(-1) || null;
  for (const layer of layers) layer.inert = layer !== top;
  document.getElementById('app').inert = Boolean(top);
  return top;
}

function liveRegion(attrs) {
  const el = document.createElement('div');
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  document.body.appendChild(el);
  return el;
}

// A live region is only announced when its content changes after it is in the page, so both
// exist from load, outside the re-rendered roots, and each toast goes into the one for its type.
const toastRegions = {
  polite: liveRegion({ role: 'status', 'aria-live': 'polite' }),
  alert: liveRegion({ role: 'alert' }),
};
let dismissCurrentToast = () => {};

// type: 'error' (default) | 'success' | 'info'. action: { label, onClick } adds a button.
// onExpire runs when the toast runs out or the next toast replaces it, not after its action or
// the returned dismiss().
export function toast(message, { type = 'error', action, onExpire } = {}) {
  dismissCurrentToast();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  if (type === 'success') el.insertAdjacentHTML('beforeend', icons.check);
  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  let timer;
  let open = true;
  const dismiss = () => {
    const wasOpen = open;
    open = false;
    clearTimeout(timer);
    el.remove();
    return wasOpen;
  };
  const expire = () => { if (dismiss()) onExpire?.(); };
  const arm = () => { timer = setTimeout(expire, action ? 6000 : 3500); };
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      dismiss();
      Promise.resolve().then(action.onClick).catch(err => toast(err.message || 'Error'));
    });
    el.appendChild(button);
    el.addEventListener('focusin', () => clearTimeout(timer));
    el.addEventListener('focusout', arm);
  }
  (type === 'error' ? toastRegions.alert : toastRegions.polite).appendChild(el);
  dismissCurrentToast = expire;
  arm();
  return dismiss;
}

// styled replacement for window.confirm — resolves true on confirm, false on cancel/escape/backdrop.
// Escape and the focus trap are app.js's: it treats this like any other dialog.
export function confirmDialog(message, { confirmLabel = 'OK', cancelLabel = 'Cancel', danger = false, title } = {}) {
  return new Promise((resolve) => {
    const opener = finder(document.activeElement);
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    // Not a tap outside the menu it was opened from: that menu stays open behind it.
    backdrop.dataset.keepOpen = '';
    const modal = document.createElement('div');
    modal.className = 'modal confirm-modal';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');
    modal.tabIndex = -1;

    if (title) {
      const head = document.createElement('div');
      head.className = 'modal-head';
      const h = document.createElement('h2');
      h.id = 'confirm-title';
      h.style.margin = '0';
      h.textContent = title;
      head.appendChild(h);
      modal.appendChild(head);
    }

    const body = document.createElement('p');
    body.id = 'confirm-message';
    body.className = 'confirm-message';
    body.textContent = message;
    modal.appendChild(body);
    modal.setAttribute('aria-labelledby', title ? 'confirm-title' : 'confirm-message');
    if (title) modal.setAttribute('aria-describedby', 'confirm-message');

    const row = document.createElement('div');
    row.className = 'row';
    row.style.justifyContent = 'flex-end';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn';
    cancelBtn.textContent = cancelLabel;
    const confirmBtn = document.createElement('button');
    confirmBtn.className = danger ? 'btn danger' : 'btn primary';
    confirmBtn.textContent = confirmLabel;
    row.append(cancelBtn, confirmBtn);
    modal.appendChild(row);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    syncLayers();
    confirmBtn.focus();

    const close = (result) => {
      backdrop.remove();
      syncLayers();
      opener()?.focus();
      resolve(result);
    };
    cancelBtn.addEventListener('click', () => close(false));
    confirmBtn.addEventListener('click', () => close(true));
    backdrop.addEventListener('click', (ev) => { if (ev.target === backdrop) close(false); });
  });
}

const svg = (paths) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const icons = {
  edit: svg('<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>'),
  trash: svg('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  moon: svg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
  gear: svg('<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>'),
  wallet: svg('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
  import: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>'),
  export: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>'),
  sparkles: svg('<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>'),
  tag: svg('<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>'),
  folder: svg('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
  globe: svg('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
  offline: svg('<path d="m2 2 20 20"/><path d="M5 12.55a11 11 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><path d="M12 20h.01"/>'),
  repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>'),
  check: svg('<polyline points="20 6 9 17 4 12"/>'),
  bank: svg('<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M12 2 2 8h20z"/>'),
  palette: svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
};

// Bottom navigation. Sized larger than the 18px `icons` set — a tab bar reads by
// its glyph first and its label second, so the glyph carries the weight.
const navSvg = (paths) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export const navIcons = {
  dashboard: navSvg('<line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/>'),
  transactions: navSvg('<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>'),
  joint: navSvg('<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>'),
  savings: navSvg('<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5Z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><circle cx="16" cy="10" r=".5" fill="currentColor"/>'),
};

// A tick as a full-width tappable row, for lists. `role=checkbox` rather than a
// real <input>: the box is drawn, so the semantics have to be declared.
export function checkRow({ on, action, label, data = '' }) {
  return `
  <button class="check-row ${on ? 'on' : ''}" data-action="${action}" ${data} role="checkbox" aria-checked="${on}">
    <span class="check-box">${icons.check}</span>
    <span class="grow">${esc(label)}</span>
  </button>`;
}

export function checkPill({ on, action, label }) {
  return `
  <button class="check-pill ${on ? 'on' : ''}" data-action="${action}" role="checkbox" aria-checked="${on}">
    <span class="check-box">${icons.check}</span>${esc(label)}
  </button>`;
}

export function chartColors() {
  const styles = getComputedStyle(document.documentElement);
  return {
    palette: [1, 2, 3, 4, 5, 6, 7, 8].map(i => styles.getPropertyValue(`--chart-${i}`).trim()),
    other: styles.getPropertyValue('--chart-other').trim(),
    text: styles.getPropertyValue('--muted').trim(),
    grid: styles.getPropertyValue('--border').trim(),
    surface: styles.getPropertyValue('--surface').trim(),
    danger: styles.getPropertyValue('--danger').trim(),
  };
}
