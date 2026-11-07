import { esc, icons } from '../dom.js';
import { get, set, setUi } from '../store.js';
import { api } from '../api.js';
import { categories } from '../derive.js';
import { renderStarterOffer } from './category-manager.js';

const RECENT_KEY = 'recentCategories';
const SEARCH_ID = 'category-picker-search';

function readRecent() {
  try {
    const recent = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(recent) ? recent : [];
  } catch {
    return [];
  }
}

function remember(category) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([category, ...readRecent().filter(c => c !== category)].slice(0, 4)));
  } catch {}
}

function allCategories(state) {
  return ['Uncategorized', ...categories(state).filter(c => c !== 'Uncategorized')];
}

function matching(state, query) {
  const q = query.toLowerCase();
  return allCategories(state).filter(c => c.toLowerCase().includes(q));
}

// `onPick(category, t)` runs after the picker has closed; the picker itself never changes a transaction.
export function openCategoryPicker({ title, current, onPick }) {
  setUi({ categoryPicker: { title, current, onPick, search: '', creating: false } });
  document.getElementById(SEARCH_ID)?.focus();
}

function close() {
  setUi({ categoryPicker: null });
}

async function pick(category, t) {
  const { onPick } = get().ui.categoryPicker;
  if (category !== 'Uncategorized') remember(category);
  close();
  await onPick(category, t);
}

async function pickOrCreate(name, t) {
  const state = get();
  const existing = allCategories(state).find(c => c.toLowerCase() === name.toLowerCase());
  if (existing) return pick(existing, t);
  await api.addCategory(name);
  set({ categories: [...state.categories, { name, count: 0 }] });
  await pick(name, t);
}

document.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Escape' || !get().ui.categoryPicker) return;
  ev.preventDefault();
  close();
});

export function render(state, t) {
  const picker = state.ui.categoryPicker;
  if (!picker) return '';
  const query = picker.search.trim();
  const list = matching(state, query);
  const exact = list.some(c => c.toLowerCase() === query.toLowerCase());
  const all = allCategories(state);
  const recent = query ? [] : readRecent().filter(c => all.includes(c));
  const isCurrent = (c) => c === picker.current;

  const chip = (c) => `<button class="picker-chip${isCurrent(c) ? ' current' : ''}" data-action="category-picker-pick" data-category="${esc(c)}"${isCurrent(c) ? ' aria-current="true"' : ''}>${esc(c)}</button>`;
  const option = (c) => `<button class="picker-option${isCurrent(c) ? ' current' : ''}" data-action="category-picker-pick" data-category="${esc(c)}"${isCurrent(c) ? ' aria-current="true"' : ''}><span>${esc(c)}</span>${isCurrent(c) ? icons.check : ''}</button>`;
  const actionRow = (action, label) => `<button class="picker-option action" data-action="${action}"><span>＋ ${esc(label)}</span></button>`;

  return `
  <div class="modal-backdrop" data-action="category-picker-close" data-self-only>
    <div class="modal category-picker" role="dialog" aria-modal="true" aria-labelledby="category-picker-title">
      <div class="modal-head">
        <h2 id="category-picker-title">${esc(picker.title || t('common.category'))}</h2>
        <button class="icon-btn" data-action="category-picker-close" title="${esc(t('common.close'))}" aria-label="${esc(t('common.close'))}">✕</button>
      </div>
      <input id="${SEARCH_ID}" class="picker-search" type="search" enterkeyhint="go" autocomplete="off" value="${esc(picker.search)}"
        placeholder="${esc(t(picker.creating ? 'categoryPicker.newPlaceholder' : 'categoryPicker.search'))}"
        aria-label="${esc(t('categoryPicker.search'))}" data-action-input="category-picker-search" data-action-key="category-picker-enter">
      <div class="picker-body">
        ${query ? '' : renderStarterOffer(state, t)}
        ${recent.length ? `
        <h3 class="picker-label">${esc(t('categoryPicker.recent'))}</h3>
        <div class="picker-recent">${recent.map(chip).join('')}</div>` : ''}
        ${query ? '' : `<h3 class="picker-label">${esc(t('categoryPicker.all'))}</h3>${actionRow('category-picker-new', t('categoryPicker.newCategory'))}`}
        ${list.map(option).join('')}
        ${query && !exact ? actionRow('category-picker-create', t('categoryPicker.create', { name: query })) : ''}
      </div>
    </div>
  </div>`;
}

export const actions = {
  'category-picker-close': close,
  'category-picker-search': (el) => {
    const picker = get().ui.categoryPicker;
    if (picker) setUi({ categoryPicker: { ...picker, search: el.value } });
  },
  'category-picker-pick': (el, ev, t) => pick(el.dataset.category, t),
  'category-picker-new': () => {
    setUi({ categoryPicker: { ...get().ui.categoryPicker, creating: true } });
    document.getElementById(SEARCH_ID).focus();
  },
  // Both read the live field: the list is re-rendered on a debounce, so the state can lag the last keystrokes.
  'category-picker-create': (el, ev, t) => {
    const name = document.getElementById(SEARCH_ID).value.trim();
    if (name) return pickOrCreate(name, t);
  },
  'category-picker-enter': (el, ev, t) => {
    const query = el.value.trim();
    if (!query) return;
    const list = matching(get(), query);
    const choice = list.find(c => c.toLowerCase() === query.toLowerCase()) || list[0];
    return choice ? pick(choice, t) : pickOrCreate(query, t);
  },
};
