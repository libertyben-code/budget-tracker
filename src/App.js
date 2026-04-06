import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// Import utility functions
import { formatDateToDDMMYY } from './utils/dates';
import { autoCategorizeTrans } from './utils/categories';
import { buttonClasses, cardClasses, formClasses, textClasses } from './utils/tailwindClasses';
import { createTranslator } from './utils/i18n';

// Import components
import { AppShellHeader } from './components/AppShellHeader';
import { CategoryManagerPanel } from './components/CategoryManagerPanel';
import { CategoryRulesPanel } from './components/CategoryRulesPanel';
import { DashboardCharts } from './components/DashboardCharts';
import { JointSplitSection } from './components/JointSplitSection';
import { LoginScreen } from './components/LoginScreen';
import { SavingsSection } from './components/SavingsSection';
import { TransactionTable } from './components/TransactionTable';
import { ACTIONS, useAppState } from './hooks/useAppState';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

// Your Firebase configuration - using environment variables for security
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Firebase helper functions
const firebaseHelpers = {
  async signUp(email, password) {
    return await createUserWithEmailAndPassword(auth, email, password);
  },

  async signIn(email, password) {
    return await signInWithEmailAndPassword(auth, email, password);
  },

  async signOut() {
    return await signOut(auth);
  },

  async saveData(userId, data) {
    await setDoc(doc(db, 'users', userId), data, { merge: true });
  },

  async loadData(userId) {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() : null;
  }
};

export default function BudgetTracker() {
  const [appState, dispatch] = useAppState();
  const {
    user,
    authMode,
    email,
    password,
    authError,
    loading,
    initializing,
    userDataLoaded,
    accounts,
    activeAccountId,
    isAddingAccount,
    newAccountName,
    accountsData,
    transactions,
    categoryRules,
    editingId,
    editForm,
    filter,
    showRules,
    newRule,
    ruleFilter,
    selectedRules,
    showBatchRuleEdit,
    batchRuleCategory,
    showSettingsMenu,
    showCategoryManager,
    editingCategory,
    newCategoryName,
    deletingCategory,
    replacementCategory,
    isCreatingNewCategory,
    sortConfig,
    selectedTransactions,
    salaryInputs,
    jointTargetAmount,
    newSavingsTransaction,
    savingsAccounts,
    newSavingsAccount,
    editingSavingsId,
    editingSavingsForm,
    savingsTransactionHistory,
    darkMode
  } = appState;

  const makeSetter = (type, getCurrentValue) => (value) => {
    dispatch({
      type,
      payload: typeof value === 'function' ? value(getCurrentValue()) : value
    });
  };

  const setAuthMode = makeSetter(ACTIONS.SET_AUTH_MODE, () => authMode);
  const setEmail = makeSetter(ACTIONS.SET_EMAIL, () => email);
  const setPassword = makeSetter(ACTIONS.SET_PASSWORD, () => password);
  const setAuthError = makeSetter(ACTIONS.SET_AUTH_ERROR, () => authError);
  const setLoading = makeSetter(ACTIONS.SET_LOADING, () => loading);
  const setUserDataLoaded = makeSetter(ACTIONS.SET_USER_DATA_LOADED, () => userDataLoaded);
  const setAccounts = makeSetter(ACTIONS.SET_ACCOUNTS, () => accounts);
  const setActiveAccountId = makeSetter(ACTIONS.SET_ACTIVE_ACCOUNT_ID, () => activeAccountId);
  const setIsAddingAccount = makeSetter(ACTIONS.SET_IS_ADDING_ACCOUNT, () => isAddingAccount);
  const setNewAccountName = makeSetter(ACTIONS.SET_NEW_ACCOUNT_NAME, () => newAccountName);
  const setAccountsData = makeSetter(ACTIONS.SET_ACCOUNTS_DATA, () => accountsData);
  const setTransactions = makeSetter(ACTIONS.SET_TRANSACTIONS, () => transactions);
  const setCategoryRules = makeSetter(ACTIONS.SET_CATEGORY_RULES, () => categoryRules);
  const setEditingId = makeSetter(ACTIONS.SET_EDITING_ID, () => editingId);
  const setEditForm = makeSetter(ACTIONS.SET_EDIT_FORM, () => editForm);
  const setFilter = makeSetter(ACTIONS.SET_FILTER, () => filter);
  const setShowRules = makeSetter(ACTIONS.SET_SHOW_RULES, () => showRules);
  const setNewRule = makeSetter(ACTIONS.SET_NEW_RULE, () => newRule);
  const setRuleFilter = makeSetter(ACTIONS.SET_RULE_FILTER, () => ruleFilter);
  const setSelectedRules = makeSetter(ACTIONS.SET_SELECTED_RULES, () => selectedRules);
  const setShowBatchRuleEdit = makeSetter(ACTIONS.SET_SHOW_BATCH_RULE_EDIT, () => showBatchRuleEdit);
  const setBatchRuleCategory = makeSetter(ACTIONS.SET_BATCH_RULE_CATEGORY, () => batchRuleCategory);
  const setShowSettingsMenu = makeSetter(ACTIONS.SET_SHOW_SETTINGS_MENU, () => showSettingsMenu);
  const setShowCategoryManager = makeSetter(ACTIONS.SET_SHOW_CATEGORY_MANAGER, () => showCategoryManager);
  const setEditingCategory = makeSetter(ACTIONS.SET_EDITING_CATEGORY, () => editingCategory);
  const setNewCategoryName = makeSetter(ACTIONS.SET_NEW_CATEGORY_NAME, () => newCategoryName);
  const setDeletingCategory = makeSetter(ACTIONS.SET_DELETING_CATEGORY, () => deletingCategory);
  const setReplacementCategory = makeSetter(ACTIONS.SET_REPLACEMENT_CATEGORY, () => replacementCategory);
  const setIsCreatingNewCategory = makeSetter(ACTIONS.SET_IS_CREATING_NEW_CATEGORY, () => isCreatingNewCategory);
  const settingsMenuRef = useRef(null);
  const userDataJustLoaded = useRef(false);

  const setSortConfig = makeSetter(ACTIONS.SET_SORT_CONFIG, () => sortConfig);
  const setSelectedTransactions = makeSetter(ACTIONS.SET_SELECTED_TRANSACTIONS, () => selectedTransactions);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({ description: '', category: '' });
  const [newBatchCategoryName, setNewBatchCategoryName] = useState('');
  const setSalaryInputs = makeSetter(ACTIONS.SET_SALARY_INPUTS, () => salaryInputs);
  const setJointTargetAmount = makeSetter(ACTIONS.SET_JOINT_TARGET_AMOUNT, () => jointTargetAmount);
  const [activeMainTab, setActiveMainTab] = useState('dashboard');
  const [isMobileChart, setIsMobileChart] = useState(() => window.innerWidth < 640);
  const [categoryChartMode, setCategoryChartMode] = useState('stacked');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const t = useMemo(() => createTranslator(language), [language]);
  
  // Import error state
  const [importErrors, setImportErrors] = useState(null);

  const setNewSavingsTransaction = makeSetter(ACTIONS.SET_NEW_SAVINGS_TRANSACTION, () => newSavingsTransaction);
  const setSavingsAccounts = makeSetter(ACTIONS.SET_SAVINGS_ACCOUNTS, () => savingsAccounts);
  const setNewSavingsAccount = makeSetter(ACTIONS.SET_NEW_SAVINGS_ACCOUNT, () => newSavingsAccount);
  const setEditingSavingsId = makeSetter(ACTIONS.SET_EDITING_SAVINGS_ID, () => editingSavingsId);
  const setEditingSavingsForm = makeSetter(ACTIONS.SET_EDITING_SAVINGS_FORM, () => editingSavingsForm);
  const setSavingsTransactionHistory = makeSetter(ACTIONS.SET_SAVINGS_TRANSACTION_HISTORY, () => savingsTransactionHistory);
  const setDarkMode = makeSetter(ACTIONS.SET_DARK_MODE, () => darkMode);

  // Toggle dark mode
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        dispatch({ type: ACTIONS.SET_SHOW_SETTINGS_MENU, payload: false });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dispatch]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileChart(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setShowCategoryDropdown(false);
  }, [activeMainTab]);

  const loadUserData = useCallback(async (userId) => {
    try {
      const data = await firebaseHelpers.loadData(userId);
      if (data) {
        // Load global category rules (shared across all accounts)
        if (data.categoryRules) {
          dispatch({ type: ACTIONS.SET_CATEGORY_RULES, payload: data.categoryRules });
        }
        
        // Load accounts structure
        if (data.accounts) {
          dispatch({ type: ACTIONS.SET_ACCOUNTS, payload: data.accounts });
        }
        if (data.accountsData) {
          dispatch({ type: ACTIONS.SET_ACCOUNTS_DATA, payload: data.accountsData });
          // Set active account data
          const activeData = data.accountsData[data.activeAccountId || 'default'] || { transactions: [], savingsAllocations: {}, savingsAccounts: [] };
          dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: activeData.transactions || [] });
          dispatch({ type: ACTIONS.SET_SAVINGS_TRANSACTION_HISTORY, payload: activeData.savingsTransactionHistory || {} });
          dispatch({ type: ACTIONS.SET_SAVINGS_ACCOUNTS, payload: activeData.savingsAccounts || [] });
          dispatch({ type: ACTIONS.SET_SALARY_INPUTS, payload: activeData.salaryInputs || { person1: '', person2: '' } });
          dispatch({ type: ACTIONS.SET_JOINT_TARGET_AMOUNT, payload: activeData.jointTargetAmount || '2100' });
          dispatch({ type: ACTIONS.SET_ACTIVE_ACCOUNT_ID, payload: data.activeAccountId || 'default' });
        } else {
          // Legacy support: migrate old data to new structure
          dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: data.transactions || [] });
          dispatch({
            type: ACTIONS.SET_ACCOUNTS_DATA,
            payload: {
            'default': {
              transactions: data.transactions || [],
              savingsTransactionHistory: {},
              savingsAccounts: [],
              salaryInputs: { person1: '', person2: '' },
              jointTargetAmount: '2100'
            }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }, [dispatch]);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      const syncAuthState = async () => {
        dispatch({ type: ACTIONS.SET_USER, payload: nextUser });

        if (nextUser) {
          dispatch({ type: ACTIONS.SET_USER_DATA_LOADED, payload: false });
          await loadUserData(nextUser.uid);
          userDataJustLoaded.current = true;
          dispatch({ type: ACTIONS.SET_USER_DATA_LOADED, payload: true });
        } else {
          dispatch({ type: ACTIONS.SET_USER_DATA_LOADED, payload: false });
        }

        dispatch({ type: ACTIONS.SET_INITIALIZING, payload: false });
      };

      syncAuthState();
    });
    return unsubscribe;
  }, [dispatch, loadUserData]);

  const saveUserData = useCallback(async () => {
    if (!user) return;
    try {
      // Update current account data (without categoryRules)
      const updatedAccountsData = {
        ...accountsData,
        [activeAccountId]: {
          transactions,
          savingsAccounts,
          savingsTransactionHistory,
          salaryInputs,
          jointTargetAmount
        }
      };
      
      await firebaseHelpers.saveData(user.uid, {
        accounts,
        accountsData: updatedAccountsData,
        categoryRules, // Global category rules for all accounts
        activeAccountId,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }, [user, accountsData, activeAccountId, transactions, savingsAccounts, savingsTransactionHistory, salaryInputs, jointTargetAmount, accounts, categoryRules]);

  // Auto-save data when transactions, rules, accounts, or savings allocations change
  useEffect(() => {
    if (user && userDataLoaded) {
      if (userDataJustLoaded.current) {
        userDataJustLoaded.current = false;
        return; // skip redundant write immediately after load
      }
      if (
        transactions.length > 0 ||
        accounts.length > 1 ||
        savingsAccounts.length > 0 ||
        salaryInputs.person1 ||
        salaryInputs.person2 ||
        jointTargetAmount
      ) {
        saveUserData();
      }
    }
  }, [user, userDataLoaded, transactions, categoryRules, accounts, savingsAccounts, savingsTransactionHistory, salaryInputs, jointTargetAmount, saveUserData]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);

    try {
      if (authMode === 'signup') {
        await firebaseHelpers.signUp(email, password);
      } else {
        await firebaseHelpers.signIn(email, password);
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await firebaseHelpers.signOut();
    setUserDataLoaded(false);
    setTransactions([]);
    setCategoryRules({});
    setAccounts([{ id: 'default', name: 'Main Account' }]);
    setActiveAccountId('default');
    setAccountsData({ 'default': { transactions: [] } });
    setSavingsAccounts([]);
    setSavingsTransactionHistory({});
    setSalaryInputs({ person1: '', person2: '' });
    setJointTargetAmount('2100');
    setEmail('');
    setPassword('');
  };

  const switchAccount = (accountId) => {
    // Save current account data before switching (without categoryRules - they're global)
    const updatedAccountsData = {
      ...accountsData,
      [activeAccountId]: {
        transactions,
        savingsAccounts,
        savingsTransactionHistory,
        salaryInputs,
        jointTargetAmount
      }
    };
    setAccountsData(updatedAccountsData);

    // Load new account data (categoryRules stay the same - they're global)
    const newAccountData = updatedAccountsData[accountId] || { transactions: [], savingsAccounts: [], savingsTransactionHistory: {} };
    setTransactions(newAccountData.transactions);
    setSavingsAccounts(newAccountData.savingsAccounts || []);
    setSavingsTransactionHistory(newAccountData.savingsTransactionHistory || {});
    setSalaryInputs(newAccountData.salaryInputs || { person1: '', person2: '' });
    setJointTargetAmount(newAccountData.jointTargetAmount || '2100');
    setActiveAccountId(accountId);
    setEditingId(null);
    setEditForm({});
    setSelectedTransactions([]);
  };

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    
    const newAccountId = `account_${Date.now()}`;
    const newAccount = { id: newAccountId, name: newAccountName.trim() };
    
    setAccounts([...accounts, newAccount]);
    setAccountsData({
      ...accountsData,
      [newAccountId]: {
        transactions: [],
        savingsAccounts: [],
        savingsTransactionHistory: {},
        salaryInputs: { person1: '', person2: '' },
        jointTargetAmount: '2100'
      }
    });
    
    setNewAccountName('');
    setIsAddingAccount(false);
    switchAccount(newAccountId);
  };

  const deleteAccount = (accountId) => {
    if (accountId === 'default') {
      alert("Cannot delete the default account");
      return;
    }
    
    if (accounts.length <= 1) {
      alert("Cannot delete the last account");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this account? All transactions will be lost.")) {
      return;
    }

    const updatedAccounts = accounts.filter(acc => acc.id !== accountId);
    const updatedAccountsData = { ...accountsData };
    delete updatedAccountsData[accountId];

    setAccounts(updatedAccounts);
    setAccountsData(updatedAccountsData);

    // Switch to default if deleting active account
    if (activeAccountId === accountId) {
      switchAccount('default');
    }
  };

  // Savings transaction handlers
  const addSavingsTransaction = () => {
    if (!newSavingsTransaction.selectedAccountId || !newSavingsTransaction.amount || parseFloat(newSavingsTransaction.amount) <= 0) return;
    
    const accountId = newSavingsTransaction.selectedAccountId;
    const amount = parseFloat(newSavingsTransaction.amount);
    const type = newSavingsTransaction.type;
    
    // Update account balance
    setSavingsAccounts(savingsAccounts.map(account => {
      if (account.id === accountId) {
        const newBalance = type === 'deposit' 
          ? account.balance + amount 
          : Math.max(0, account.balance - amount);
        return { ...account, balance: parseFloat(newBalance.toFixed(2)) };
      }
      return account;
    }));
    
    // Add to transaction history
    const transaction = {
      id: `tx_${Date.now()}`,
      date: formatDateToDDMMYY(new Date()),
      type,
      amount: parseFloat(amount.toFixed(2)),
      timestamp: new Date().getTime()
    };
    
    setSavingsTransactionHistory({
      ...savingsTransactionHistory,
      [accountId]: [...(savingsTransactionHistory[accountId] || []), transaction]
    });
    
    setNewSavingsTransaction({ selectedAccountId: '', type: 'deposit', amount: '' });
  };

  const addSavingsAccount = () => {
    const name = newSavingsAccount.name.trim();
    const balance = parseFloat(newSavingsAccount.balance);

    if (!name || Number.isNaN(balance) || balance < 0) return;

    setSavingsAccounts([
      ...savingsAccounts,
      {
        id: `savings_${Date.now()}`,
        name,
        balance: parseFloat(balance.toFixed(2))
      }
    ]);
    setNewSavingsAccount({ name: '', balance: '' });
  };

  const startEditSavingsAccount = (account) => {
    setEditingSavingsId(account.id);
    setEditingSavingsForm({ name: account.name, balance: account.balance.toString() });
  };

  const saveSavingsAccount = () => {
    const name = editingSavingsForm.name.trim();
    const balance = parseFloat(editingSavingsForm.balance);

    if (!name || Number.isNaN(balance) || balance < 0) return;

    setSavingsAccounts(savingsAccounts.map(account => (
      account.id === editingSavingsId
        ? { ...account, name, balance: parseFloat(balance.toFixed(2)) }
        : account
    )));
    setEditingSavingsId(null);
    setEditingSavingsForm({ name: '', balance: '' });
  };

  const cancelEditSavingsAccount = () => {
    setEditingSavingsId(null);
    setEditingSavingsForm({ name: '', balance: '' });
  };

  const deleteSavingsAccount = (accountId) => {
    if (!window.confirm('Delete this savings account from the overview?')) return;
    setSavingsAccounts(savingsAccounts.filter(account => account.id !== accountId));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const failedLines = [];
    const parsed = [];
    const existingTransactionKeys = new Set(
      transactions.map((t) => {
        const date = (t.date || '').trim();
        const desc = (t.description || '').trim().toLowerCase();
        const amount = Number(t.amount || 0).toFixed(2);
        const type = (t.type || '').trim().toLowerCase();
        return `${date}|${desc}|${amount}|${type}`;
      })
    );
    const importedTransactionKeys = new Set();
    
    lines.slice(1).forEach((line, idx) => {
      if (!line.trim()) return;
      
      try {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, i) => {
          row[header] = values[i]?.trim() || '';
        });
        
        const description = row['Description'] || '';
        const autoCategory = autoCategorizeTrans(description, categoryRules);
        
        const transaction = {
          id: Date.now() + idx,
          date: formatDateToDDMMYY(row['Started Date'] || row.Date || ''),
          description: description,
          category: autoCategory,
          amount: parseFloat(row.Amount) || 0,
          type: row.Type || '',
          state: row.State || ''
        };
        
        // Skip reverted and pending transactions
        if (transaction.state === 'REVERTED' || transaction.state === 'PENDING') {
          failedLines.push(idx + 2); // +2 because of 0-index and header row
          return;
        }
        
        // Validate that we have minimum required data
        if (!transaction.description && transaction.amount === 0) {
          failedLines.push(idx + 2);
          return;
        }

        const transactionKey = `${(transaction.date || '').trim()}|${(transaction.description || '').trim().toLowerCase()}|${Number(transaction.amount || 0).toFixed(2)}|${(transaction.type || '').trim().toLowerCase()}`;
        if (existingTransactionKeys.has(transactionKey) || importedTransactionKeys.has(transactionKey)) {
          return;
        }

        importedTransactionKeys.add(transactionKey);
        
        parsed.push(transaction);
      } catch (error) {
        failedLines.push(idx + 2); // +2 because of 0-index and header row
      }
    });
    setTransactions([...parsed, ...transactions]);
    setSelectedTransactions([]);
    
    // Set import error message
    if (failedLines.length > 0) {
      setImportErrors({
        count: failedLines.length,
        lines: failedLines
      });
    } else {
      setImportErrors(null);
    }
    
    // Clear the file input
    e.target.value = '';
  };

  const handleEdit = (transaction) => {
    setEditingId(transaction.id);
    setEditForm(transaction);
  };

  const handleSave = () => {
    const updated = transactions.map(t => 
      t.id === editingId ? editForm : t
    );
    setTransactions(updated);
    
    if (editForm.description && editForm.category && editForm.category !== 'Uncategorized') {
      setCategoryRules({
        ...categoryRules,
        [editForm.description.toLowerCase().trim()]: editForm.category
      });
    }
    
    setEditingId(null);
    setEditForm({});
  };

  const handleDelete = (id) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const handleAdd = () => {
    const newId = Date.now();
    const newTransaction = {
      id: newId,
      date: formatDateToDDMMYY(new Date()),
      description: '',
      category: 'Uncategorized',
      amount: 0,
      type: 'Card Payment',
      state: 'COMPLETED'
    };
    setTransactions([newTransaction, ...transactions]);
    setEditingId(newId);
    setEditForm(newTransaction);
  };

  const handleAddRule = () => {
    if (newRule.pattern && newRule.category) {
      setCategoryRules({
        ...categoryRules,
        [newRule.pattern.toLowerCase().trim()]: newRule.category
      });
      setNewRule({ pattern: '', category: '' });
    }
  };

  const handleDeleteRule = (pattern) => {
    const updated = { ...categoryRules };
    delete updated[pattern];
    setCategoryRules(updated);
  };

  const toggleSelectRule = (pattern) => {
    setSelectedRules(prev => 
      prev.includes(pattern) ? prev.filter(p => p !== pattern) : [...prev, pattern]
    );
  };

  const toggleSelectAllRules = (filteredRules) => {
    const patterns = Object.keys(filteredRules);
    if (selectedRules.length === patterns.length) {
      setSelectedRules([]);
    } else {
      setSelectedRules(patterns);
    }
  };

  const handleBatchRuleEdit = () => {
    if (selectedRules.length === 0) return;
    setShowBatchRuleEdit(true);
    setBatchRuleCategory('');
  };

  const applyBatchRuleEdit = () => {
    if (!batchRuleCategory.trim()) return;
    
    const updatedRules = {...categoryRules};
    selectedRules.forEach(pattern => {
      updatedRules[pattern] = batchRuleCategory.trim();
    });
    
    setCategoryRules(updatedRules);
    setSelectedRules([]);
    setShowBatchRuleEdit(false);
    setBatchRuleCategory('');
  };

  const handleBatchRuleDelete = () => {
    if (selectedRules.length === 0) return;
    
    if (window.confirm(`Delete ${selectedRules.length} selected rule(s)?`)) {
      const updatedRules = {...categoryRules};
      selectedRules.forEach(pattern => {
        delete updatedRules[pattern];
      });
      setCategoryRules(updatedRules);
      setSelectedRules([]);
    }
  };

  const handleRenameCategory = (oldName, newName) => {
    if (!newName.trim() || oldName === newName) {
      setEditingCategory(null);
      setNewCategoryName('');
      return;
    }
    
    // Update all transactions with the old category name
    const updatedTransactions = transactions.map(t => ({
      ...t,
      category: t.category === oldName ? newName.trim() : t.category
    }));
    
    // Update category rules that reference the old category name
    const updatedRules = {};
    Object.entries(categoryRules).forEach(([pattern, category]) => {
      updatedRules[pattern] = category === oldName ? newName.trim() : category;
    });
    
    setTransactions(updatedTransactions);
    setCategoryRules(updatedRules);
    setEditingCategory(null);
    setNewCategoryName('');
  };

  const handleDeleteCategory = (categoryToDelete) => {
    const count = transactions.filter(t => t.category === categoryToDelete).length;
    if (count > 0) {
      // Show confirmation dialog
      setDeletingCategory(categoryToDelete);
      setReplacementCategory('Uncategorized');
      setIsCreatingNewCategory(false);
    } else {
      // No transactions with this category, just close
      setDeletingCategory(null);
    }
  };

  const confirmDeleteCategory = () => {
    if (!deletingCategory) return;
    
    let finalReplacementCategory = replacementCategory;
    
    // If creating new category, use the entered value
    if (isCreatingNewCategory && replacementCategory.trim()) {
      finalReplacementCategory = replacementCategory.trim();
    }
    
    // Update all transactions with the deleted category
    const updatedTransactions = transactions.map(t => ({
      ...t,
      category: t.category === deletingCategory ? finalReplacementCategory : t.category
    }));
    
    // Update category rules that reference the deleted category
    const updatedRules = {};
    Object.entries(categoryRules).forEach(([pattern, category]) => {
      updatedRules[pattern] = category === deletingCategory ? finalReplacementCategory : category;
    });
    
    setTransactions(updatedTransactions);
    setCategoryRules(updatedRules);
    
    // Close dialog
    setDeletingCategory(null);
    setReplacementCategory('Uncategorized');
    setIsCreatingNewCategory(false);
  };

  const cancelDeleteCategory = () => {
    setDeletingCategory(null);
    setReplacementCategory('Uncategorized');
    setIsCreatingNewCategory(false);
  };

  // Sorting function
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Multi-select functions
  const toggleSelectTransaction = (id) => {
    setSelectedTransactions(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedTransactions.length === filteredTransactions.length) {
      setSelectedTransactions([]);
    } else {
      setSelectedTransactions(filteredTransactions.map(t => t.id));
    }
  };

  const handleBatchEdit = () => {
    if (selectedTransactions.length === 0) return;
    setShowBatchEdit(true);
  };

  const applyBatchEdit = () => {
    const resolvedCategory = batchEditForm.category === '__new__' ? newBatchCategoryName : batchEditForm.category;
    const updatedTransactions = transactions.map(t => {
      if (selectedTransactions.includes(t.id)) {
        return {
          ...t,
          ...(batchEditForm.description && { description: batchEditForm.description }),
          ...(resolvedCategory && { category: resolvedCategory })
        };
      }
      return t;
    });
    setTransactions(updatedTransactions);
    setSelectedTransactions([]);
    setShowBatchEdit(false);
    setBatchEditForm({ description: '', category: '' });
    setNewBatchCategoryName('');
  };

  const cancelBatchEdit = () => {
    setShowBatchEdit(false);
    setBatchEditForm({ description: '', category: '' });
    setNewBatchCategoryName('');
  };

  const handleBatchDelete = () => {
    if (selectedTransactions.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedTransactions.length} transaction(s)?`)) {
      const updatedTransactions = transactions.filter(t => !selectedTransactions.includes(t.id));
      setTransactions(updatedTransactions);
      setSelectedTransactions([]);
    }
  };

  const isCurrentMonthTransaction = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return false;

    const parts = dateString.trim().split('/').map(part => part.trim());
    if (parts.length !== 3) return false;

    const monthNum = parseInt(parts[1], 10);
    const yearNum = parseInt(parts[2], 10);
    if (Number.isNaN(monthNum) || Number.isNaN(yearNum)) return false;

    const now = new Date();
    const currentMonthNum = now.getMonth() + 1;
    const currentYearShort = now.getFullYear() % 100;
    const transactionYearShort = yearNum % 100;

    return monthNum === currentMonthNum && transactionYearShort === currentYearShort;
  };

  const parseTransactionDate = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return null;

    const parts = dateString.trim().split('/').map(part => part.trim());
    if (parts.length !== 3) return null;

    const [dayRaw, monthRaw, yearRaw] = parts;
    const day = parseInt(dayRaw, 10);
    const month = parseInt(monthRaw, 10);
    const year = parseInt(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw, 10);

    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;

    return new Date(year, month - 1, day);
  };

  const getRelativeMonthBounds = (monthCount) => {
    const now = new Date();
    const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startMonth = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1), 1);
    return { startMonth, endMonth };
  };

  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Type', 'State'];
    const csv = [
      headers.join(','),
      ...transactions.map(t => 
        [t.date, t.description, t.category, t.amount, t.type, t.state].join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(t => {
      // Category filter (multiple selection)
      if (filter.categories.length > 0 && !filter.categories.includes(t.category)) return false;
      
      // Description filter (case-insensitive)
      if (filter.description && !t.description.toLowerCase().includes(filter.description.toLowerCase())) {
        return false;
      }
      
      // Category search filter (case-insensitive)
      if (filter.categorySearch && !t.category.toLowerCase().includes(filter.categorySearch.toLowerCase())) {
        return false;
      }
      
      // Date filters
      const txDate = parseTransactionDate(t.date);
      if (!txDate) return !filter.currentMonth;

      if (filter.currentMonth) {
        const now = new Date();
        if (txDate.getMonth() !== now.getMonth() || txDate.getFullYear() !== now.getFullYear()) {
          return false;
        }
      }
      
      if (filter.dateFilterType === 'year' && filter.year) {
        const txYear = txDate.getFullYear().toString();
        if (txYear !== filter.year) return false;
      } else if (filter.dateFilterType === 'month' && filter.month) {
        const txMonthStart = new Date(txDate.getFullYear(), txDate.getMonth(), 1);

        if (filter.month === '__last_month__') {
          const now = new Date();
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          if (
            txMonthStart.getMonth() !== lastMonth.getMonth() ||
            txMonthStart.getFullYear() !== lastMonth.getFullYear()
          ) {
            return false;
          }
        } else if (filter.month === '__last_3_months__') {
          const { startMonth, endMonth } = getRelativeMonthBounds(3);
          if (txMonthStart < startMonth || txMonthStart > endMonth) return false;
        } else if (filter.month === '__last_6_months__') {
          const { startMonth, endMonth } = getRelativeMonthBounds(6);
          if (txMonthStart < startMonth || txMonthStart > endMonth) return false;
        } else {
          const txMonth = `${txDate.getFullYear()}-${(txDate.getMonth() + 1).toString().padStart(2, '0')}`;
          if (txMonth !== filter.month) return false;
        }
      } else if (filter.dateFilterType === 'dateRange' && filter.startDate && filter.endDate) {
        const startDate = new Date(filter.startDate);
        const endDate = new Date(filter.endDate);
        if (txDate < startDate || txDate > endDate) return false;
      }
      
      return true;
    });

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'date') {
          // Parse dates for comparison
          const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split('/');
            return new Date(year, parseInt(month) - 1, parseInt(day));
          };
          aValue = parseDate(a.date);
          bValue = parseDate(b.date);
        } else if (sortConfig.key === 'amount') {
          aValue = a.amount;
          bValue = b.amount;
        } else if (sortConfig.key === 'category') {
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [transactions, filter, sortConfig]);

  const categories = useMemo(() => 
    [...new Set(transactions.map(t => t.category))].sort()
  , [transactions]);

  const months = useMemo(() => {
    const monthSet = new Set();
    transactions.forEach(t => {
      const txDate = parseTransactionDate(t.date);
      if (!txDate) return;
      const monthKey = `${txDate.getFullYear()}-${(txDate.getMonth() + 1).toString().padStart(2, '0')}`;
      monthSet.add(monthKey);
    });
    return [...monthSet].sort().reverse();
  }, [transactions]);

  const years = useMemo(() => {
    const yearSet = new Set();
    transactions.forEach(t => {
      const txDate = parseTransactionDate(t.date);
      if (txDate) yearSet.add(txDate.getFullYear().toString());
    });
    return [...yearSet].sort().reverse();
  }, [transactions]);

  // Helper function to format month as MMM-YYYY
  const formatMonthDisplay = (monthStr) => {
    const [year, month] = monthStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[parseInt(month) - 1]}-${year}`;
  };

  // Savings breakdown data


  const savingsAccountsTotal = useMemo(() => (
    savingsAccounts.reduce((sum, account) => sum + account.balance, 0)
  ), [savingsAccounts]);

  const savingsAccountsChartData = useMemo(() => (
    savingsAccounts
      .filter(account => account.balance > 0)
      .map(account => ({ name: account.name, value: account.balance }))
      .sort((a, b) => b.value - a.value)
  ), [savingsAccounts]);

  const categoryData = useMemo(() => {
    const spending = {};
    filteredTransactions.forEach(t => {
      if (t.amount < 0) {
        spending[t.category] = (spending[t.category] || 0) + Math.abs(t.amount);
      }
    });
    return Object.entries(spending)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // New data for categories by month chart
  const categoryByMonthData = useMemo(() => {
    const monthlyByCategory = {};
    
    filteredTransactions.forEach(t => {
      if (t.amount < 0) { // Only spending
        const [, month, year] = t.date.split('/');
        if (year && month) {
          const monthKey = `${year}-${month.padStart(2, '0')}`;
          if (!monthlyByCategory[monthKey]) {
            monthlyByCategory[monthKey] = { month: monthKey };
          }
          monthlyByCategory[monthKey][t.category] = 
            (monthlyByCategory[monthKey][t.category] || 0) + Math.abs(t.amount);
        }
      }
    });
    
    return Object.values(monthlyByCategory)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => {
        const formatted = { month: m.month };
        Object.keys(m).forEach(key => {
          if (key !== 'month') {
            formatted[key] = parseFloat(m[key].toFixed(2));
          }
        });
        return formatted;
      });
  }, [filteredTransactions]);

  const monthlyData = useMemo(() => {
    const monthly = {};
    
    filteredTransactions.forEach(t => {
      const [, month, year] = t.date.split('/');
      if (year && month) {
        const key = `${year}-${month}`;
        if (!monthly[key]) monthly[key] = { month: key, spending: 0, income: 0 };
        if (t.amount < 0) monthly[key].spending += Math.abs(t.amount);
        else monthly[key].income += t.amount;
      }
    });
    return Object.values(monthly)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => ({
        ...m,
        spending: parseFloat(m.spending.toFixed(2)),
        income: parseFloat(m.income.toFixed(2))
      }));
  }, [filteredTransactions]);

  const stats = useMemo(() => {
    const total = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
    const spending = filteredTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const income = filteredTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    return { total, spending, income };
  }, [filteredTransactions]);

  const currentMonthBillTransactions = useMemo(() => {
    return transactions.filter(t => {
      const category = (t.category || '').toLowerCase();
      return isCurrentMonthTransaction(formatDateToDDMMYY(t.date)) && category.includes('bill');
    });
  }, [transactions]);

  const currentMonthBillsTotal = useMemo(() => {
    return currentMonthBillTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  }, [currentMonthBillTransactions]);

  const currentMonthNonBillCount = useMemo(() => {
    return transactions.filter(t => {
      if (!isCurrentMonthTransaction(formatDateToDDMMYY(t.date))) return false;
      const category = (t.category || '').toLowerCase();
      return !category.includes('bill');
    }).length;
  }, [transactions]);

  const headerAccountsData = useMemo(() => ({
    ...accountsData,
    [activeAccountId]: {
      ...(accountsData[activeAccountId] || {}),
      transactions,
    },
  }), [accountsData, activeAccountId, transactions]);

  const parsedSalary1 = parseFloat(salaryInputs.person1) || 0;
  const parsedSalary2 = parseFloat(salaryInputs.person2) || 0;
  const parsedJointTargetAmount = parseFloat(jointTargetAmount) || 0;
  const totalToSplit = parsedJointTargetAmount > 0 ? parsedJointTargetAmount : currentMonthBillsTotal;
  const totalSalaries = parsedSalary1 + parsedSalary2;
  const person1Contribution = totalSalaries > 0 ? (totalToSplit * parsedSalary1) / totalSalaries : 0;
  const person2Contribution = totalSalaries > 0 ? (totalToSplit * parsedSalary2) / totalSalaries : 0;

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-2xl">{t('common.loading')}</div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return <LoginScreen
      authMode={authMode}
      setAuthMode={setAuthMode}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      authError={authError}
      loading={loading}
      handleAuth={handleAuth}
      darkMode={darkMode}
      setDarkMode={setDarkMode}
      language={language}
      setLanguage={setLanguage}
      t={t}
    />;
  }

  // Main App
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 sm:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        <AppShellHeader
          accounts={accounts}
          accountsData={headerAccountsData}
          activeAccountId={activeAccountId}
          activeMainTab={activeMainTab}
          addAccount={addAccount}
          categories={categories}
          categoryRules={categoryRules}
          darkMode={darkMode}
          deleteAccount={deleteAccount}
          exportCSV={exportCSV}
          handleFileUpload={handleFileUpload}
          handleLogout={handleLogout}
          importErrors={importErrors}
          isAddingAccount={isAddingAccount}
          newAccountName={newAccountName}
          setActiveMainTab={setActiveMainTab}
          setDarkMode={setDarkMode}
          setImportErrors={setImportErrors}
          setIsAddingAccount={setIsAddingAccount}
          setNewAccountName={setNewAccountName}
          setShowCategoryManager={setShowCategoryManager}
          setShowRules={setShowRules}
          setShowSettingsMenu={setShowSettingsMenu}
          settingsMenuRef={settingsMenuRef}
          showCategoryManager={showCategoryManager}
          showRules={showRules}
          showSettingsMenu={showSettingsMenu}
          switchAccount={switchAccount}
          transactions={transactions}
          userEmail={user.email}
          language={language}
          setLanguage={setLanguage}
          t={t}
        />

        <div className={(activeMainTab === 'joint' || activeMainTab === 'savings') ? '' : cardClasses.default}>

          {showRules && (
            <CategoryRulesPanel
              applyBatchRuleEdit={applyBatchRuleEdit}
              batchRuleCategory={batchRuleCategory}
              categories={categories}
              categoryRules={categoryRules}
              handleAddRule={handleAddRule}
              handleBatchRuleDelete={handleBatchRuleDelete}
              handleBatchRuleEdit={handleBatchRuleEdit}
              handleDeleteRule={handleDeleteRule}
              newRule={newRule}
              ruleFilter={ruleFilter}
              selectedRules={selectedRules}
              setBatchRuleCategory={setBatchRuleCategory}
              setNewRule={setNewRule}
              setRuleFilter={setRuleFilter}
              setShowBatchRuleEdit={setShowBatchRuleEdit}
              setShowRules={setShowRules}
              showBatchRuleEdit={showBatchRuleEdit}
              toggleSelectAllRules={toggleSelectAllRules}
              toggleSelectRule={toggleSelectRule}
              t={t}
            />
          )}

          {showCategoryManager && (
            <CategoryManagerPanel
              cancelDeleteCategory={cancelDeleteCategory}
              categories={categories}
              confirmDeleteCategory={confirmDeleteCategory}
              deletingCategory={deletingCategory}
              editingCategory={editingCategory}
              handleDeleteCategory={handleDeleteCategory}
              handleRenameCategory={handleRenameCategory}
              isCreatingNewCategory={isCreatingNewCategory}
              newCategoryName={newCategoryName}
              replacementCategory={replacementCategory}
              setEditingCategory={setEditingCategory}
              setIsCreatingNewCategory={setIsCreatingNewCategory}
              setNewCategoryName={setNewCategoryName}
              setReplacementCategory={setReplacementCategory}
              setShowCategoryManager={setShowCategoryManager}
              transactions={transactions}
              t={t}
            />
          )}

          {transactions.length > 0 && activeMainTab !== 'joint' && activeMainTab !== 'savings' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className={cardClasses.info}>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('app.totalBalance')}</div>
                  <div className={`text-2xl font-bold ${stats.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    €{stats.total.toFixed(2)}
                  </div>
                </div>
                <div className={cardClasses.danger}>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('app.totalSpending')}</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    €{stats.spending.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {/* Row 1: Date buttons + Current month + Clear */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className="flex items-center gap-2 min-w-0 overflow-x-auto pb-1">
                    {/* Date type button group */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0">
                        {[
                          { value: 'all', label: t('common.all') },
                          { value: 'year', label: t('common.year') },
                          { value: 'month', label: t('common.month') },
                          { value: 'dateRange', label: t('common.range') },
                          ].map(({ value, label }) => {
                            const isActive = value === 'all'
                              ? filter.dateFilterType === 'all' && !filter.currentMonth
                              : filter.dateFilterType === value;

                            return (
                              <button
                                key={value}
                                onClick={() => setFilter({
                                  ...filter,
                                  currentMonth: false,
                                  dateFilterType: value,
                                  year: '',
                                  month: '',
                                  startDate: '',
                                  endDate: ''
                                })}
                                className={`px-3 py-2 text-sm font-medium transition-colors border-r border-gray-300 dark:border-gray-600 last:border-r-0 ${
                                  isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    <button
                      onClick={() => setFilter({
                        ...filter,
                        currentMonth: true,
                        dateFilterType: 'all',
                        year: '',
                        month: '',
                        startDate: '',
                        endDate: ''
                      })}
                      className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg border border-gray-300 dark:border-gray-600 shrink-0 ${
                        filter.currentMonth
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t('app.currentMonth')}
                    </button>
                  </div>
                </div>

                {/* Row 2: Date sub-filters */}
                {filter.dateFilterType === 'year' && (
                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">{t('common.year')}:</label>
                    <select
                      value={filter.year}
                      onChange={(e) => setFilter({...filter, year: e.target.value})}
                      className={formClasses.selectSm}
                    >
                      <option value="">{t('app.selectYear')}</option>
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filter.dateFilterType === 'month' && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex gap-2 items-center w-full sm:w-auto">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">{t('common.month')}:</label>
                      <select
                        value={filter.month.startsWith('__') ? '' : filter.month}
                        onChange={(e) => setFilter({...filter, currentMonth: false, month: e.target.value})}
                        className={formClasses.selectSm}
                      >
                        <option value="">{t('app.selectMonth')}</option>
                        {months.map(month => (
                          <option key={month} value={month}>{formatMonthDisplay(month)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {[
                        { value: '__last_month__', label: t('app.lastMonth') },
                        { value: '__last_3_months__', label: t('app.last3Months') },
                        { value: '__last_6_months__', label: t('app.last6Months') },
                      ].map(({ value, label }) => {
                        const isActive = !filter.currentMonth && filter.month === value;

                        return (
                          <button
                            key={value}
                            onClick={() => setFilter({ ...filter, currentMonth: false, month: value })}
                            className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg border border-gray-300 dark:border-gray-600 whitespace-nowrap ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filter.dateFilterType === 'dateRange' && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 shrink-0">{t('common.from')}</label>
                      <input
                        type="date"
                        value={filter.startDate}
                        onChange={(e) => setFilter({...filter, startDate: e.target.value})}
                        className={`${formClasses.input} text-sm`}
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 shrink-0">{t('common.to')}</label>
                      <input
                        type="date"
                        value={filter.endDate}
                        onChange={(e) => setFilter({...filter, endDate: e.target.value})}
                        className={`${formClasses.input} text-sm`}
                      />
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </div>

        {activeMainTab === 'joint' && (
          <JointSplitSection
            currentMonthBillTransactions={currentMonthBillTransactions}
            currentMonthBillsTotal={currentMonthBillsTotal}
            currentMonthNonBillCount={currentMonthNonBillCount}
            formatDateToDDMMYY={formatDateToDDMMYY}
            jointTargetAmount={jointTargetAmount}
            person1Contribution={person1Contribution}
            person2Contribution={person2Contribution}
            salaryInputs={salaryInputs}
            setJointTargetAmount={setJointTargetAmount}
            setSalaryInputs={setSalaryInputs}
            totalSalaries={totalSalaries}
            totalToSplit={totalToSplit}
            t={t}
          />
        )}

        {activeMainTab === 'savings' && (
          <SavingsSection
            addSavingsAccount={addSavingsAccount}
            addSavingsTransaction={addSavingsTransaction}
            cancelEditSavingsAccount={cancelEditSavingsAccount}
            colors={COLORS}
            deleteSavingsAccount={deleteSavingsAccount}
            editingSavingsForm={editingSavingsForm}
            editingSavingsId={editingSavingsId}
            isMobileChart={isMobileChart}
            newSavingsAccount={newSavingsAccount}
            newSavingsTransaction={newSavingsTransaction}
            saveSavingsAccount={saveSavingsAccount}
            savingsAccounts={savingsAccounts}
            savingsAccountsChartData={savingsAccountsChartData}
            savingsAccountsTotal={savingsAccountsTotal}
            savingsTransactionHistory={savingsTransactionHistory}
            setEditingSavingsForm={setEditingSavingsForm}
            setNewSavingsAccount={setNewSavingsAccount}
            setNewSavingsTransaction={setNewSavingsTransaction}
            startEditSavingsAccount={startEditSavingsAccount}
            t={t}
          />
        )}

        {activeMainTab === 'dashboard' && transactions.length > 0 && (
          <DashboardCharts
            categories={categories}
            categoryByMonthData={categoryByMonthData}
            categoryChartMode={categoryChartMode}
            categoryData={categoryData}
            colors={COLORS}
            darkMode={darkMode}
            filter={filter}
            isMobileChart={isMobileChart}
            monthlyData={monthlyData}
            setCategoryChartMode={setCategoryChartMode}
            setFilter={setFilter}
            setShowCategoryDropdown={setShowCategoryDropdown}
            showCategoryDropdown={showCategoryDropdown}
            t={t}
            language={language}
          />
        )}

        {activeMainTab === 'graphs' && (
          <TransactionTable
            categories={categories}
            editForm={editForm}
            editingId={editingId}
            filter={filter}
            filteredTransactions={filteredTransactions}
            formatDateToDDMMYY={formatDateToDDMMYY}
            handleAdd={handleAdd}
            handleBatchDelete={handleBatchDelete}
            handleBatchEdit={handleBatchEdit}
            handleDelete={handleDelete}
            handleEdit={handleEdit}
            handleSave={handleSave}
            handleSort={handleSort}
            selectedTransactions={selectedTransactions}
            setEditForm={setEditForm}
            setEditingId={setEditingId}
            setFilter={setFilter}
            setSelectedTransactions={setSelectedTransactions}
            setShowCategoryDropdown={setShowCategoryDropdown}
            showCategoryDropdown={showCategoryDropdown}
            sortConfig={sortConfig}
            toggleSelectAll={toggleSelectAll}
            toggleSelectTransaction={toggleSelectTransaction}
            t={t}
          />
        )}



        {/* Batch Edit Modal */}
        {showBatchEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold dark:text-white">{t('app.batchEditTransactions')}</h2>
                  <button
                    onClick={cancelBatchEdit}
                    className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className={cardClasses.info}>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('app.editingTransactions', { count: selectedTransactions.length })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {t('app.leaveEmpty')}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('app.descriptionOptional')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('app.newDescriptionAll')}
                      value={batchEditForm.description}
                      onChange={(e) => setBatchEditForm({...batchEditForm, description: e.target.value})}
                      className={`${formClasses.inputLg} ${textClasses.placeholder}`}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('app.categoryOptional')}
                    </label>
                    <select
                      value={batchEditForm.category}
                      onChange={(e) => setBatchEditForm({...batchEditForm, category: e.target.value})}
                      className={formClasses.inputLg}
                    >
                      <option value="">{t('app.keepExistingCategories')}</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">{t('app.createNewCategory')}</option>
                    </select>
                    {batchEditForm.category === '__new__' && (
                      <input
                        type="text"
                        placeholder={t('app.enterNewCategoryName')}
                        value={newBatchCategoryName}
                        onChange={(e) => setNewBatchCategoryName(e.target.value)}
                        className={`${formClasses.inputLg} ${textClasses.placeholder} mt-2`}
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={cancelBatchEdit}
                    className={buttonClasses.secondary}
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={applyBatchEdit}
                    disabled={!batchEditForm.description && (batchEditForm.category === '__new__' ? !newBatchCategoryName : !batchEditForm.category)}
                    className={`${buttonClasses.primaryLg} disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed`}
                  >
                    {t('app.applyChanges')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}