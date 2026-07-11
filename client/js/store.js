const state = {
  loaded: false,
  offline: false,
  accounts: [],
  activeAccountId: localStorage.getItem('activeAccountId') || 'default',
  rules: [],
  transactions: [],
  savingsAccounts: [],
  savingsHistory: {},
  savingsRecurring: {},
  filter: {
    categories: [],
    description: '',
    categorySearch: '',
    currentMonth: true,
    dateFilterType: 'all',
    year: '',
    month: '',
    startDate: '',
    endDate: '',
  },
  sort: { key: null, direction: 'asc' },
  selection: new Set(),
  visibleCount: 100,
  editingId: null,
  addingAccount: false,
  ui: {
    tab: 'dashboard',
    dark: localStorage.getItem('darkMode') === 'true',
    lang: localStorage.getItem('language') || 'en',
    settingsOpen: false,
    categoryDropdownOpen: null,
    pieCategories: [],
    chartMode: 'stacked',
    chartRange: '6m',
    importErrors: null,
    panel: null,
    batchEditOpen: false,
    batchNewCategory: false,
    rulesFilter: '',
    ruleSelection: new Set(),
    ruleBatchOpen: false,
    editingCategory: null,
    deletingCategory: null,
    editingSavingsId: null,
    addingSavings: false,
    openHistoryIds: new Set(),
    openRecurringIds: new Set(),
  },
};

const listeners = new Set();

export function get() {
  return state;
}

export function set(patch) {
  Object.assign(state, patch);
  notify();
}

export function setUi(patch) {
  Object.assign(state.ui, patch);
  notify();
}

export function setFilter(patch) {
  Object.assign(state.filter, patch);
  state.visibleCount = 100;
  state.selection = new Set();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}
