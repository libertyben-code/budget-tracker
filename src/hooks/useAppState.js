import { useReducer } from 'react';

// Initial state shape
export const initialState = {
  // Auth state
  user: null,
  authMode: 'login',
  email: '',
  password: '',
  authError: '',
  loading: false,
  initializing: true,
  userDataLoaded: false,
  
  // Account state
  accounts: [{ id: 'default', name: 'Main Account' }],
  activeAccountId: 'default',
  isAddingAccount: false,
  newAccountName: '',
  accountsData: { 'default': { transactions: [] } },
  
  // Transaction state
  transactions: [],
  editingId: null,
  editForm: {},
  selectedTransactions: [],
  sortConfig: { key: null, direction: 'asc' },
  
  // Filter state
  filter: {
    categories: [],
    description: '',
    categorySearch: '',
    currentMonth: true,
    dateFilterType: 'all',
    year: '',
    month: '',
    startDate: '',
    endDate: ''
  },
  
  // Category Rules state
  categoryRules: {},
  showRules: false,
  newRule: { pattern: '', category: '' },
  ruleFilter: '',
  selectedRules: [],
  showBatchRuleEdit: false,
  batchRuleCategory: '',
  
  // Category Manager state
  showSettingsMenu: false,
  showCategoryManager: false,
  editingCategory: null,
  newCategoryName: '',
  deletingCategory: null,
  replacementCategory: 'Uncategorized',
  isCreatingNewCategory: false,
  
  // Savings state
  newSavingsTransaction: { selectedAccountId: '', type: 'deposit', amount: '' },
  newSavingsAccount: { name: '', balance: '' },
  editingSavingsId: null,
  editingSavingsForm: { name: '', balance: '' },
  savingsAccounts: [],
  savingsTransactionHistory: {},
  salaryInputs: { person1: '', person2: '' },
  jointTargetAmount: '2100',
  
  // UI state
  darkMode: localStorage.getItem('darkMode') === 'true',
  showJointSplitTab: localStorage.getItem('showJointSplitTab') !== 'false'
};

// Action types
export const ACTIONS = {
  // Auth
  SET_USER: 'SET_USER',
  SET_AUTH_MODE: 'SET_AUTH_MODE',
  SET_EMAIL: 'SET_EMAIL',
  SET_PASSWORD: 'SET_PASSWORD',
  SET_AUTH_ERROR: 'SET_AUTH_ERROR',
  SET_LOADING: 'SET_LOADING',
  SET_INITIALIZING: 'SET_INITIALIZING',
  SET_USER_DATA_LOADED: 'SET_USER_DATA_LOADED',
  
  // Accounts
  SET_ACCOUNTS: 'SET_ACCOUNTS',
  SET_ACTIVE_ACCOUNT_ID: 'SET_ACTIVE_ACCOUNT_ID',
  SET_IS_ADDING_ACCOUNT: 'SET_IS_ADDING_ACCOUNT',
  SET_NEW_ACCOUNT_NAME: 'SET_NEW_ACCOUNT_NAME',
  SET_ACCOUNTS_DATA: 'SET_ACCOUNTS_DATA',
  
  // Transactions
  SET_TRANSACTIONS: 'SET_TRANSACTIONS',
  SET_EDITING_ID: 'SET_EDITING_ID',
  SET_EDIT_FORM: 'SET_EDIT_FORM',
  SET_SELECTED_TRANSACTIONS: 'SET_SELECTED_TRANSACTIONS',
  SET_SORT_CONFIG: 'SET_SORT_CONFIG',
  
  // Filter
  SET_FILTER: 'SET_FILTER',
  UPDATE_FILTER_FIELD: 'UPDATE_FILTER_FIELD',
  
  // Rules
  SET_CATEGORY_RULES: 'SET_CATEGORY_RULES',
  SET_SHOW_RULES: 'SET_SHOW_RULES',
  SET_NEW_RULE: 'SET_NEW_RULE',
  SET_RULE_FILTER: 'SET_RULE_FILTER',
  SET_SELECTED_RULES: 'SET_SELECTED_RULES',
  SET_SHOW_BATCH_RULE_EDIT: 'SET_SHOW_BATCH_RULE_EDIT',
  SET_BATCH_RULE_CATEGORY: 'SET_BATCH_RULE_CATEGORY',
  
  // Category Manager
  SET_SHOW_SETTINGS_MENU: 'SET_SHOW_SETTINGS_MENU',
  SET_SHOW_CATEGORY_MANAGER: 'SET_SHOW_CATEGORY_MANAGER',
  SET_EDITING_CATEGORY: 'SET_EDITING_CATEGORY',
  SET_NEW_CATEGORY_NAME: 'SET_NEW_CATEGORY_NAME',
  SET_DELETING_CATEGORY: 'SET_DELETING_CATEGORY',
  SET_REPLACEMENT_CATEGORY: 'SET_REPLACEMENT_CATEGORY',
  SET_IS_CREATING_NEW_CATEGORY: 'SET_IS_CREATING_NEW_CATEGORY',
  
  // Savings
  SET_NEW_SAVINGS_TRANSACTION: 'SET_NEW_SAVINGS_TRANSACTION',
  SET_NEW_SAVINGS_ACCOUNT: 'SET_NEW_SAVINGS_ACCOUNT',
  SET_EDITING_SAVINGS_ID: 'SET_EDITING_SAVINGS_ID',
  SET_EDITING_SAVINGS_FORM: 'SET_EDITING_SAVINGS_FORM',
  SET_SAVINGS_ACCOUNTS: 'SET_SAVINGS_ACCOUNTS',
  SET_SAVINGS_TRANSACTION_HISTORY: 'SET_SAVINGS_TRANSACTION_HISTORY',
  SET_SALARY_INPUTS: 'SET_SALARY_INPUTS',
  SET_JOINT_TARGET_AMOUNT: 'SET_JOINT_TARGET_AMOUNT',
  
  // UI
  SET_DARK_MODE: 'SET_DARK_MODE',
  SET_SHOW_JOINT_SPLIT_TAB: 'SET_SHOW_JOINT_SPLIT_TAB',
  
  // Bulk operations
  RESET_STATE: 'RESET_STATE',
  LOAD_USER_DATA: 'LOAD_USER_DATA'
};

// Reducer function
function appReducer(state, action) {
  switch (action.type) {
    // Auth actions
    case ACTIONS.SET_USER:
      return { ...state, user: action.payload };
    case ACTIONS.SET_AUTH_MODE:
      return { ...state, authMode: action.payload };
    case ACTIONS.SET_EMAIL:
      return { ...state, email: action.payload };
    case ACTIONS.SET_PASSWORD:
      return { ...state, password: action.payload };
    case ACTIONS.SET_AUTH_ERROR:
      return { ...state, authError: action.payload };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.SET_INITIALIZING:
      return { ...state, initializing: action.payload };
    case ACTIONS.SET_USER_DATA_LOADED:
      return { ...state, userDataLoaded: action.payload };
    
    // Account actions
    case ACTIONS.SET_ACCOUNTS:
      return { ...state, accounts: action.payload };
    case ACTIONS.SET_ACTIVE_ACCOUNT_ID:
      return { ...state, activeAccountId: action.payload };
    case ACTIONS.SET_IS_ADDING_ACCOUNT:
      return { ...state, isAddingAccount: action.payload };
    case ACTIONS.SET_NEW_ACCOUNT_NAME:
      return { ...state, newAccountName: action.payload };
    case ACTIONS.SET_ACCOUNTS_DATA:
      return { ...state, accountsData: action.payload };
    
    // Transaction actions
    case ACTIONS.SET_TRANSACTIONS:
      return { ...state, transactions: action.payload };
    case ACTIONS.SET_EDITING_ID:
      return { ...state, editingId: action.payload };
    case ACTIONS.SET_EDIT_FORM:
      return { ...state, editForm: action.payload };
    case ACTIONS.SET_SELECTED_TRANSACTIONS:
      return { ...state, selectedTransactions: action.payload };
    case ACTIONS.SET_SORT_CONFIG:
      return { ...state, sortConfig: action.payload };
    
    // Filter actions
    case ACTIONS.SET_FILTER:
      return { ...state, filter: action.payload };
    case ACTIONS.UPDATE_FILTER_FIELD:
      return { ...state, filter: { ...state.filter, ...action.payload } };
    
    // Rule actions
    case ACTIONS.SET_CATEGORY_RULES:
      return { ...state, categoryRules: action.payload };
    case ACTIONS.SET_SHOW_RULES:
      return { ...state, showRules: action.payload };
    case ACTIONS.SET_NEW_RULE:
      return { ...state, newRule: action.payload };
    case ACTIONS.SET_RULE_FILTER:
      return { ...state, ruleFilter: action.payload };
    case ACTIONS.SET_SELECTED_RULES:
      return { ...state, selectedRules: action.payload };
    case ACTIONS.SET_SHOW_BATCH_RULE_EDIT:
      return { ...state, showBatchRuleEdit: action.payload };
    case ACTIONS.SET_BATCH_RULE_CATEGORY:
      return { ...state, batchRuleCategory: action.payload };
    
    // Category Manager actions
    case ACTIONS.SET_SHOW_SETTINGS_MENU:
      return { ...state, showSettingsMenu: action.payload };
    case ACTIONS.SET_SHOW_CATEGORY_MANAGER:
      return { ...state, showCategoryManager: action.payload };
    case ACTIONS.SET_EDITING_CATEGORY:
      return { ...state, editingCategory: action.payload };
    case ACTIONS.SET_NEW_CATEGORY_NAME:
      return { ...state, newCategoryName: action.payload };
    case ACTIONS.SET_DELETING_CATEGORY:
      return { ...state, deletingCategory: action.payload };
    case ACTIONS.SET_REPLACEMENT_CATEGORY:
      return { ...state, replacementCategory: action.payload };
    case ACTIONS.SET_IS_CREATING_NEW_CATEGORY:
      return { ...state, isCreatingNewCategory: action.payload };
    
    // Savings actions
    case ACTIONS.SET_NEW_SAVINGS_TRANSACTION:
      return { ...state, newSavingsTransaction: action.payload };
    case ACTIONS.SET_NEW_SAVINGS_ACCOUNT:
      return { ...state, newSavingsAccount: action.payload };
    case ACTIONS.SET_EDITING_SAVINGS_ID:
      return { ...state, editingSavingsId: action.payload };
    case ACTIONS.SET_EDITING_SAVINGS_FORM:
      return { ...state, editingSavingsForm: action.payload };
    case ACTIONS.SET_SAVINGS_ACCOUNTS:
      return { ...state, savingsAccounts: action.payload };
    case ACTIONS.SET_SAVINGS_TRANSACTION_HISTORY:
      return { ...state, savingsTransactionHistory: action.payload };
    case ACTIONS.SET_SALARY_INPUTS:
      return { ...state, salaryInputs: action.payload };
    case ACTIONS.SET_JOINT_TARGET_AMOUNT:
      return { ...state, jointTargetAmount: action.payload };
    
    // UI actions
    case ACTIONS.SET_DARK_MODE:
      return { ...state, darkMode: action.payload };
    case ACTIONS.SET_SHOW_JOINT_SPLIT_TAB:
      return { ...state, showJointSplitTab: action.payload };
    
    // Bulk operations
    case ACTIONS.LOAD_USER_DATA:
      return { ...state, ...action.payload };
    case ACTIONS.RESET_STATE:
      return initialState;
    
    default:
      return state;
  }
}

// Custom hook
export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return [state, dispatch];
}
