import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Download, Edit2, Trash2, Plus, Save, X, Settings, LogOut, Moon, Sun } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

// Utility function to format date to dd/mm/yy
const formatDateToDDMMYY = (date) => {
  if (!date) return '';
  
  // If it's already in dd/mm/yy format (8 chars with slashes at positions 2 and 5)
  if (typeof date === 'string' && date.length === 8 && date[2] === '/' && date[5] === '/') {
    return date;
  }
  
  // If it's in dd/mm/yyyy format
  if (typeof date === 'string' && date.length === 10 && date[2] === '/' && date[5] === '/') {
    const parts = date.split('/');
    return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
  }
  
  // If it's a Date object or parseable string
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return date.toString();
  }
};

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
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [userDataLoaded, setUserDataLoaded] = useState(false);

  // Multi-account state
  const [accounts, setAccounts] = useState([{ id: 'default', name: 'Main Account' }]);
  const [activeAccountId, setActiveAccountId] = useState('default');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [accountsData, setAccountsData] = useState({
    'default': { transactions: [] }
  });

  const [transactions, setTransactions] = useState([]);
  const [categoryRules, setCategoryRules] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState({ 
    categories: [], // Changed to array for multi-select
    description: '',
    categorySearch: '',
    currentMonth: true,
    dateFilterType: 'all', // 'all', 'year', 'month', 'dateRange'
    year: '',
    month: '',
    startDate: '',
    endDate: ''
  });
  const [showRules, setShowRules] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', category: '' });
  const [ruleFilter, setRuleFilter] = useState('');
  const [selectedRules, setSelectedRules] = useState([]);
  const [showBatchRuleEdit, setShowBatchRuleEdit] = useState(false);
  const [batchRuleCategory, setBatchRuleCategory] = useState('');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [replacementCategory, setReplacementCategory] = useState('Uncategorized');
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const settingsMenuRef = useRef(null);
  const userDataJustLoaded = useRef(false);
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Multi-select state
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [showBatchEdit, setShowBatchEdit] = useState(false);
  const [batchEditForm, setBatchEditForm] = useState({ description: '', category: '' });
  const [newBatchCategoryName, setNewBatchCategoryName] = useState('');
  const [salaryInputs, setSalaryInputs] = useState({ person1: '', person2: '' });
  const [jointTargetAmount, setJointTargetAmount] = useState('2100');
  const [activeMainTab, setActiveMainTab] = useState('dashboard');
  const [isMobileChart, setIsMobileChart] = useState(() => window.innerWidth < 640);
  const [categoryChartMode, setCategoryChartMode] = useState('stacked');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Import error state
  const [importErrors, setImportErrors] = useState(null);
  
  // Savings allocation state
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [selectedSavingsTransaction, setSelectedSavingsTransaction] = useState(null);
  const [savingsAllocations, setSavingsAllocations] = useState({});
  const [newAllocation, setNewAllocation] = useState({ purpose: '', amount: 0 });
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

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
    const handleClickOutside = (event) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      const syncAuthState = async () => {
        setUser(nextUser);

        if (nextUser) {
          setUserDataLoaded(false);
          await loadUserData(nextUser.uid);
          userDataJustLoaded.current = true;
          setUserDataLoaded(true);
        } else {
          setUserDataLoaded(false);
        }

        setInitializing(false);
      };

      syncAuthState();
    });
    return unsubscribe;
  }, []);

  const loadUserData = async (userId) => {
    try {
      const data = await firebaseHelpers.loadData(userId);
      if (data) {
        // Load global category rules (shared across all accounts)
        if (data.categoryRules) {
          setCategoryRules(data.categoryRules);
        }
        
        // Load accounts structure
        if (data.accounts) {
          setAccounts(data.accounts);
        }
        if (data.accountsData) {
          setAccountsData(data.accountsData);
          // Set active account data
          const activeData = data.accountsData[data.activeAccountId || 'default'] || { transactions: [], savingsAllocations: {} };
          setTransactions(activeData.transactions || []);
          setSavingsAllocations(activeData.savingsAllocations || {});
          setSalaryInputs(activeData.salaryInputs || { person1: '', person2: '' });
          setJointTargetAmount(activeData.jointTargetAmount || '2100');
          setActiveAccountId(data.activeAccountId || 'default');
        } else {
          // Legacy support: migrate old data to new structure
          setTransactions(data.transactions || []);
          setAccountsData({
            'default': {
              transactions: data.transactions || [],
              savingsAllocations: {},
              salaryInputs: { person1: '', person2: '' },
              jointTargetAmount: '2100'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveUserData = useCallback(async () => {
    if (!user) return;
    try {
      // Update current account data (without categoryRules)
      const updatedAccountsData = {
        ...accountsData,
        [activeAccountId]: {
          transactions,
          savingsAllocations,
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
  }, [user, accountsData, activeAccountId, transactions, savingsAllocations, salaryInputs, jointTargetAmount, accounts, categoryRules]);

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
        Object.keys(savingsAllocations).length > 0 ||
        salaryInputs.person1 ||
        salaryInputs.person2 ||
        jointTargetAmount
      ) {
        saveUserData();
      }
    }
  }, [user, userDataLoaded, transactions, categoryRules, accounts, savingsAllocations, salaryInputs, jointTargetAmount, saveUserData]);

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
        savingsAllocations,
        salaryInputs,
        jointTargetAmount
      }
    };
    setAccountsData(updatedAccountsData);

    // Load new account data (categoryRules stay the same - they're global)
    const newAccountData = updatedAccountsData[accountId] || { transactions: [], savingsAllocations: {} };
    setTransactions(newAccountData.transactions);
    setSavingsAllocations(newAccountData.savingsAllocations || {});
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
        savingsAllocations: {},
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

  // Savings allocation handlers
  const openSavingsModal = (transaction) => {
    setSelectedSavingsTransaction(transaction);
    setShowSavingsModal(true);
  };

  const addSavingsAllocation = () => {
    if (!newAllocation.purpose.trim() || newAllocation.amount <= 0) return;
    
    const transactionId = selectedSavingsTransaction.id;
    const currentAllocations = savingsAllocations[transactionId] || [];
    const currentTotal = currentAllocations.reduce((sum, alloc) => sum + alloc.amount, 0);
    const newTotal = currentTotal + newAllocation.amount;
    
    // Check if new allocation would exceed transaction amount
    if (newTotal > selectedSavingsTransaction.amount) {
      alert(`Cannot allocate €${newAllocation.amount.toFixed(2)}. Only €${(selectedSavingsTransaction.amount - currentTotal).toFixed(2)} remaining.`);
      return;
    }
    
    setSavingsAllocations({
      ...savingsAllocations,
      [transactionId]: [...currentAllocations, { ...newAllocation }]
    });
    
    setNewAllocation({ purpose: '', amount: 0 });
  };

  const deleteSavingsAllocation = (transactionId, index) => {
    const currentAllocations = savingsAllocations[transactionId] || [];
    const updatedAllocations = currentAllocations.filter((_, i) => i !== index);
    
    if (updatedAllocations.length === 0) {
      const updated = { ...savingsAllocations };
      delete updated[transactionId];
      setSavingsAllocations(updated);
    } else {
      setSavingsAllocations({
        ...savingsAllocations,
        [transactionId]: updatedAllocations
      });
    }
  };

  const getTotalAllocated = (transactionId) => {
    const allocations = savingsAllocations[transactionId] || [];
    return allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  };

  const autoCategorizeTrans = (description) => {
    const desc = description.toLowerCase();
    for (const [pattern, category] of Object.entries(categoryRules)) {
      if (desc.includes(pattern.toLowerCase())) {
        return category;
      }
    }
    return 'Uncategorized';
  };

  const learnCategoryFromTransactions = (transactions) => {
    const newRules = { ...categoryRules };
    transactions.forEach(t => {
      if (t.description && t.category && t.category !== 'Uncategorized') {
        const desc = t.description.toLowerCase().trim();
        if (!newRules[desc]) {
          newRules[desc] = t.category;
        }
      }
    });
    setCategoryRules(newRules);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const failedLines = [];
    const parsed = [];
    
    lines.slice(1).forEach((line, idx) => {
      if (!line.trim()) return;
      
      try {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, i) => {
          row[header] = values[i]?.trim() || '';
        });
        
        const description = row['Description'] || '';
        const existingCategory = row['Categories'] || row['Category'] || '';
        const autoCategory = autoCategorizeTrans(description);
        
        const transaction = {
          id: Date.now() + idx,
          date: formatDateToDDMMYY(row['Started Date'] || row.Date || ''),
          description: description,
          category: existingCategory || autoCategory,
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
        
        parsed.push(transaction);
      } catch (error) {
        failedLines.push(idx + 2); // +2 because of 0-index and header row
      }
    });

    learnCategoryFromTransactions(parsed);
    setTransactions(parsed);
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

  const reapplyRules = () => {
    const updated = transactions.map(t => ({
      ...t,
      category: t.category === 'Uncategorized' ? autoCategorizeTrans(t.description) : t.category
    }));
    setTransactions(updated);
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
  const savingsBreakdownData = useMemo(() => {
    const breakdown = {};
    
    // Get all savings transactions (categories containing "savings")
    const savingsTransactions = filteredTransactions.filter(t => 
      t.category.toLowerCase().includes('savings') && t.amount > 0
    );
    
    savingsTransactions.forEach(t => {
      const allocations = savingsAllocations[t.id] || [];
      allocations.forEach(alloc => {
        breakdown[alloc.purpose] = (breakdown[alloc.purpose] || 0) + alloc.amount;
      });
      
      // Add unallocated amount if any
      const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
      const unallocated = t.amount - totalAllocated;
      if (unallocated > 0) {
        breakdown['Unallocated'] = (breakdown['Unallocated'] || 0) + unallocated;
      }
    });
    
    return Object.entries(breakdown)
      .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, savingsAllocations]);

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
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md relative">
          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-600" />}
          </button>
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Budget Tracker</h1>
            <p className="text-gray-600 dark:text-gray-300">Sign in to access your budget</p>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                authMode === 'login' 
                  ? 'bg-blue-500 dark:bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                authMode === 'signup' 
                  ? 'bg-blue-500 dark:bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            
            {authError && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
                {authError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 dark:bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 dark:hover:bg-blue-700 transition disabled:bg-gray-400 dark:disabled:bg-gray-600"
            >
              {loading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main App
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-2 sm:p-6 transition-colors">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-white">Budget Tracker</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate max-w-[200px] sm:max-w-none">Logged in as: {user.email}</p>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="flex items-center gap-2 px-2 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                title="Toggle dark mode"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                <span className="hidden sm:inline">{darkMode ? 'Light' : 'Dark'}</span>
              </button>
              <div ref={settingsMenuRef} className="relative">
                <button
                  onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                  className="flex items-center gap-2 px-2 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                  title="Open settings menu"
                >
                  <Settings size={20} />
                  <span className="hidden sm:inline">Settings</span>
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                    <div className="p-2 space-y-1">
                      <label className="flex items-center gap-3 w-full px-3 py-2 rounded-lg cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                        <Upload size={18} />
                        <span>Import CSV</span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={(e) => {
                            handleFileUpload(e);
                            setShowSettingsMenu(false);
                          }}
                          className="hidden"
                        />
                      </label>

                      <button
                        onClick={() => {
                          exportCSV();
                          setShowSettingsMenu(false);
                        }}
                        disabled={transactions.length === 0}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download size={18} />
                        <span>Export CSV</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowRules(!showRules);
                          setShowSettingsMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <Settings size={18} />
                        <span>Category Rules ({Object.keys(categoryRules).length})</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowCategoryManager(!showCategoryManager);
                          setShowSettingsMenu(false);
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      >
                        <Edit2 size={18} />
                        <span>Manage Categories ({categories.length})</span>
                      </button>

                      <button
                        onClick={() => {
                          reapplyRules();
                          setShowSettingsMenu(false);
                        }}
                        disabled={transactions.length === 0}
                        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save size={18} />
                        <span>Auto-Categorize</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-2 sm:px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition"
              >
                <LogOut size={20} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
          
          {/* Account Tabs */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-3">
              {accounts.map(account => (
                <div key={account.id} className="group relative">
                  <button
                    onClick={() => switchAccount(account.id)}
                    className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                      activeAccountId === account.id
                        ? 'bg-blue-500 dark:bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {account.name}
                    {accountsData[account.id] && (
                      <span className="ml-2 text-xs opacity-75">
                        ({accountsData[account.id].transactions?.length || 0})
                      </span>
                    )}
                  </button>
                  {account.id !== 'default' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAccount(account.id);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 dark:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                      title="Delete account"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              
              {!isAddingAccount ? (
                <button
                  onClick={() => setIsAddingAccount(true)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-t-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-1"
                >
                  <Plus size={16} />
                  New Account
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addAccount()}
                    placeholder="Account name"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    autoFocus
                  />
                  <button
                    onClick={addAccount}
                    className="p-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingAccount(false);
                      setNewAccountName('');
                    }}
                    className="p-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setActiveMainTab('dashboard')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeMainTab === 'dashboard'
                  ? 'bg-blue-500 dark:bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveMainTab('joint')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeMainTab === 'joint'
                  ? 'bg-blue-500 dark:bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Joint Split
            </button>
            <button
              onClick={() => setActiveMainTab('graphs')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeMainTab === 'graphs'
                  ? 'bg-blue-500 dark:bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Transactions
            </button>
          </div>

          {importErrors && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Import Warning: {importErrors.count} line{importErrors.count > 1 ? 's' : ''} not imported
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                    The following lines were skipped (REVERTED, PENDING, or invalid data):
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-mono">
                    Lines: {importErrors.lines.slice(0, 20).join(', ')}
                    {importErrors.lines.length > 20 && ` ... and ${importErrors.lines.length - 20} more`}
                  </p>
                </div>
                <button
                  onClick={() => setImportErrors(null)}
                  className="text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-800 p-1 rounded"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {showRules && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold dark:text-white">Category Auto-Assignment Rules</h3>
                <button
                  onClick={() => setShowRules(false)}
                  className="text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Rules are automatically learned when you set categories.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Description pattern"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({...newRule, pattern: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newRule.category}
                  onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 w-full sm:w-auto"
                >
                  Add Rule
                </button>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Filter by Category:
                </label>
                <select
                  value={ruleFilter}
                  onChange={(e) => setRuleFilter(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {(() => {
                const filteredRules = ruleFilter 
                  ? Object.fromEntries(Object.entries(categoryRules).filter(([_, cat]) => cat === ruleFilter))
                  : categoryRules;
                
                return (
                  <>
                    {selectedRules.length > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                          {selectedRules.length} rule{selectedRules.length > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                          <button
                            onClick={handleBatchRuleEdit}
                            className="flex items-center justify-center gap-1 px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 text-sm w-full sm:w-auto"
                          >
                            <Edit2 size={14} />
                            Change Category
                          </button>
                          <button
                            onClick={handleBatchRuleDelete}
                            className="flex items-center justify-center gap-1 px-3 py-1 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 text-sm w-full sm:w-auto"
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="md:hidden space-y-2 max-h-80 overflow-y-auto">
                      {Object.entries(filteredRules).map(([pattern, category]) => (
                        <div key={pattern} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedRules.includes(pattern)}
                                onChange={() => toggleSelectRule(pattern)}
                                className="cursor-pointer mt-0.5"
                              />
                              <div className="min-w-0">
                                <div className="font-mono text-xs break-all dark:text-gray-300">{pattern}</div>
                                <span className="inline-block mt-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                                  {category}
                                </span>
                              </div>
                            </label>
                            <button
                              onClick={() => handleDeleteRule(pattern)}
                              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded flex-shrink-0"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden md:block max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="text-center py-2 px-2 dark:text-white w-10">
                              <input
                                type="checkbox"
                                checked={selectedRules.length === Object.keys(filteredRules).length && Object.keys(filteredRules).length > 0}
                                onChange={() => toggleSelectAllRules(filteredRules)}
                                className="cursor-pointer"
                              />
                            </th>
                            <th className="text-left p-2 dark:text-white">Pattern</th>
                            <th className="text-left p-2 dark:text-white">Category</th>
                            <th className="text-center p-2 dark:text-white">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(filteredRules).map(([pattern, category]) => (
                            <tr key={pattern} className="border-t border-gray-200 dark:border-gray-700">
                              <td className="text-center py-2 px-2">
                                <input
                                  type="checkbox"
                                  checked={selectedRules.includes(pattern)}
                                  onChange={() => toggleSelectRule(pattern)}
                                  className="cursor-pointer"
                                />
                              </td>
                              <td className="p-2 font-mono text-xs dark:text-gray-300">{pattern}</td>
                              <td className="p-2">
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                                  {category}
                                </span>
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  onClick={() => handleDeleteRule(pattern)}
                                  className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {showBatchRuleEdit && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold mb-4 dark:text-white">Change Category for {selectedRules.length} Rule(s)</h3>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Category:
                  </label>
                  <input
                    type="text"
                    value={batchRuleCategory}
                    onChange={(e) => setBatchRuleCategory(e.target.value)}
                    placeholder="Enter category name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    list="batch-rule-categories-list"
                  />
                  <datalist id="batch-rule-categories-list">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowBatchRuleEdit(false);
                      setBatchRuleCategory('');
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyBatchRuleEdit}
                    disabled={!batchRuleCategory.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Apply to {selectedRules.length} Rule(s)
                  </button>
                </div>
              </div>
            </div>
          )}

          {showCategoryManager && (
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold dark:text-white">Category Manager</h3>
                <button
                  onClick={() => setShowCategoryManager(false)}
                  className="text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Rename categories to update all transactions using that category.
              </p>
              
              <div className="md:hidden space-y-2 max-h-80 overflow-y-auto">
                {categories.map(category => {
                  const count = transactions.filter(t => t.category === category).length;
                  return (
                    <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          {editingCategory === category ? (
                            <input
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleRenameCategory(category, newCategoryName);
                                }
                              }}
                              onBlur={() => handleRenameCategory(category, newCategoryName)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              autoFocus
                            />
                          ) : (
                            <span className="inline-block px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs break-words max-w-full">
                              {category}
                            </span>
                          )}
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {count} transaction{count !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingCategory(category);
                              setNewCategoryName(category);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 p-1 rounded"
                            title="Rename category"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category)}
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded"
                            title="Delete category"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden md:block max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="text-left p-2 dark:text-white">Category Name</th>
                      <th className="text-center p-2 dark:text-white">Count</th>
                      <th className="text-center p-2 dark:text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(category => {
                      const count = transactions.filter(t => t.category === category).length;
                      return (
                        <tr key={category} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="p-2">
                            {editingCategory === category ? (
                              <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleRenameCategory(category, newCategoryName);
                                  }
                                }}
                                onBlur={() => handleRenameCategory(category, newCategoryName)}
                                className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                autoFocus
                              />
                            ) : (
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs">
                                {category}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-center text-gray-600 dark:text-gray-400">{count}</td>
                          <td className="p-2 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => {
                                  setEditingCategory(category);
                                  setNewCategoryName(category);
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 p-1 rounded"
                                title="Rename category"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category)}
                                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded"
                                title="Delete category"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {deletingCategory && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-xl font-bold mb-4 dark:text-white">Delete Category: {deletingCategory}</h3>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  There are {transactions.filter(t => t.category === deletingCategory).length} transaction(s) with this category.
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  What would you like to do with these transactions?
                </p>
                
                <div className="mb-4">
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isCreatingNewCategory}
                      onChange={() => {
                        setIsCreatingNewCategory(false);
                        setReplacementCategory('Uncategorized');
                      }}
                      className="cursor-pointer"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Set to Uncategorized</span>
                  </label>
                  
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isCreatingNewCategory}
                      onChange={() => {
                        setIsCreatingNewCategory(true);
                        setReplacementCategory('');
                      }}
                      className="cursor-pointer"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Enter a new category</span>
                  </label>
                  
                  {isCreatingNewCategory && (
                    <div className="ml-6 mt-2">
                      <input
                        type="text"
                        value={replacementCategory}
                        onChange={(e) => setReplacementCategory(e.target.value)}
                        placeholder="New category name"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={cancelDeleteCategory}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    disabled={isCreatingNewCategory && !replacementCategory.trim()}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Delete Category
                  </button>
                </div>
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Balance</div>
                  <div className={`text-2xl font-bold ${stats.total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    €{stats.total.toFixed(2)}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Spending</div>
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
                          { value: 'all', label: 'All' },
                          { value: 'year', label: 'Year' },
                          { value: 'month', label: 'Month' },
                          { value: 'dateRange', label: 'Range' },
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
                      Current Month
                    </button>
                  </div>
                </div>

                {/* Row 2: Date sub-filters */}
                {filter.dateFilterType === 'year' && (
                  <div className="flex gap-2 items-center">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Year:</label>
                    <select
                      value={filter.year}
                      onChange={(e) => setFilter({...filter, year: e.target.value})}
                      className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      <option value="">Select Year</option>
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filter.dateFilterType === 'month' && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="flex gap-2 items-center w-full sm:w-auto">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">Month:</label>
                      <select
                        value={filter.month.startsWith('__') ? '' : filter.month}
                        onChange={(e) => setFilter({...filter, currentMonth: false, month: e.target.value})}
                        className="flex-1 min-w-[170px] sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">Select Month</option>
                        {months.map(month => (
                          <option key={month} value={month}>{formatMonthDisplay(month)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                      {[
                        { value: '__last_month__', label: 'Last Month' },
                        { value: '__last_3_months__', label: 'Last 3 Months' },
                        { value: '__last_6_months__', label: 'Last 6 Months' },
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
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 shrink-0">From:</label>
                      <input
                        type="date"
                        value={filter.startDate}
                        onChange={(e) => setFilter({...filter, startDate: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 shrink-0">To:</label>
                      <input
                        type="date"
                        value={filter.endDate}
                        onChange={(e) => setFilter({...filter, endDate: e.target.value})}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                  </div>
                )}

              </div>
            </>
          )}
        </div>

        {activeMainTab === 'joint' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Joint Account Split</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically includes current-month transactions where category contains "bill".
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600 dark:text-gray-400">Target Joint Deposit</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">EUR {totalToSplit.toFixed(2)}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bills reference: EUR {currentMonthBillsTotal.toFixed(2)}</div>
              </div>
            </div>

            <div className="mb-4 max-w-sm">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total to Put in Joint Account</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={jointTargetAmount}
                onChange={(e) => setJointTargetAmount(e.target.value)}
                placeholder="2100"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary Person 1</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryInputs.person1}
                  onChange={(e) => setSalaryInputs({ ...salaryInputs, person1: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary Person 2</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={salaryInputs.person2}
                  onChange={(e) => setSalaryInputs({ ...salaryInputs, person2: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {totalSalaries > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Person 1 Contribution</div>
                  <div className="text-xl font-bold text-blue-700 dark:text-blue-300">EUR {person1Contribution.toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Person 2 Contribution</div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">EUR {person2Contribution.toFixed(2)}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
                Enter both salaries (or at least one) to calculate each person&apos;s pro-rate contribution.
              </div>
            )}

            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                Included Transactions ({currentMonthBillTransactions.length})
              </h3>
              {currentMonthBillTransactions.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  No transactions found for this month with a category containing "bill".
                </div>
              ) : (
                <>
                <div className="md:hidden space-y-2">
                  {currentMonthBillTransactions.map(transaction => (
                    <div key={transaction.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateToDDMMYY(transaction.date)}</span>
                        <span className="font-semibold text-sm text-red-600 dark:text-red-400">
                          EUR {Math.abs(transaction.amount || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm dark:text-gray-300 truncate">{transaction.description}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs flex-shrink-0 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {transaction.category}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-2 px-2 dark:text-gray-300">Date</th>
                        <th className="text-left py-2 px-2 dark:text-gray-300">Description</th>
                        <th className="text-left py-2 px-2 dark:text-gray-300">Category</th>
                        <th className="text-right py-2 px-2 dark:text-gray-300">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentMonthBillTransactions.map(transaction => (
                        <tr key={transaction.id} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 px-2 dark:text-gray-300">{formatDateToDDMMYY(transaction.date)}</td>
                          <td className="py-2 px-2 dark:text-gray-300">{transaction.description}</td>
                          <td className="py-2 px-2 dark:text-gray-300">{transaction.category}</td>
                          <td className="py-2 px-2 text-right font-semibold text-red-600 dark:text-red-400">
                            EUR {Math.abs(transaction.amount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </div>

            {currentMonthNonBillCount > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {currentMonthNonBillCount} other current-month transaction(s) are not included because their category does not contain "bill".
              </p>
            )}
          </div>
        )}

        {activeMainTab === 'dashboard' && transactions.length > 0 && (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
              <div className="relative w-full mb-4">
                <button
                  onClick={() => setShowCategoryDropdown(prev => !prev)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition flex items-center justify-between"
                >
                  <span>{filter.categories.length === 0 ? 'All Categories' : `${filter.categories.length} selected`}</span>
                  <span>▼</span>
                </button>
                <div className={`${showCategoryDropdown ? 'block' : 'hidden'} absolute top-full mt-1 left-0 right-0 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto`}>
                  <div className="p-2">
                    <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filter.categories.length === 0}
                        onChange={() => setFilter({...filter, categories: []})}
                        className="cursor-pointer"
                      />
                      <span className="text-sm dark:text-white">All Categories</span>
                    </label>
                    {categories.map(cat => (
                      <label key={cat} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.categories.includes(cat)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFilter({...filter, categories: [...filter.categories, cat]});
                            } else {
                              setFilter({...filter, categories: filter.categories.filter(c => c !== cat)});
                            }
                          }}
                          className="cursor-pointer"
                        />
                        <span className="text-sm dark:text-white">{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <h2 className="text-xl font-bold mb-4 dark:text-white">Spending by Category</h2>
              <ResponsiveContainer width="100%" height={isMobileChart ? 320 : 380}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={!isMobileChart}
                    label={isMobileChart ? false : ({ name }) => name}
                    outerRadius={isMobileChart ? 90 : 120}
                    fill="#8884d8"
                    dataKey="value"
                    animationBegin={0}
                    animationDuration={800}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name, item) => {
                      const percent = (item && typeof item.percent === 'number') ? item.percent * 100 : 0;
                      return [`€${value.toFixed(2)} (${percent.toFixed(1)}%)`, name];
                    }}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                  />
                  {isMobileChart && (
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ fontSize: '11px' }}
                    />
                  )}
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <h2 className="text-xl font-bold dark:text-white">Spending by Category per Month</h2>
                <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden self-start sm:self-auto">
                  <button
                    onClick={() => setCategoryChartMode('stacked')}
                    className={`px-3 py-1.5 text-sm font-medium transition ${
                      categoryChartMode === 'stacked'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    Stacked (Recommended)
                  </button>
                  <button
                    onClick={() => setCategoryChartMode('grouped')}
                    className={`px-3 py-1.5 text-sm font-medium transition border-l border-gray-300 dark:border-gray-600 ${
                      categoryChartMode === 'grouped'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    Grouped
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">View spending trends across categories over time</p>
              <div className="overflow-x-auto">
                <div
                  style={{
                    minWidth: `${Math.max(640, categoryByMonthData.length * (isMobileChart ? 140 : 120))}px`,
                    height: isMobileChart ? 360 : 440,
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categoryByMonthData}
                      margin={{ top: 20, right: 20, left: 10, bottom: 65 }}
                      barCategoryGap={categoryChartMode === 'stacked' ? '8%' : (categoryByMonthData.length === 1 ? '0%' : '3%')}
                      barSize={categoryChartMode === 'stacked' ? undefined : (categoryByMonthData.length === 1 ? (isMobileChart ? 38 : 78) : (isMobileChart ? 26 : 46))}
                      barGap={0}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#e0e0e0"} />
                      <XAxis
                        dataKey="month"
                        angle={-35}
                        textAnchor="end"
                        height={70}
                        tick={{ fontSize: 12, fill: darkMode ? "#e5e7eb" : "#374151" }}
                        tickFormatter={(value) => {
                          const [year, month] = value.split('-');
                          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                          return `${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`;
                        }}
                      />
                      <YAxis
                        width={64}
                        tick={{ fontSize: 12, fill: darkMode ? "#e5e7eb" : "#374151" }}
                        tickFormatter={(value) => `€${value}`}
                      />
                      <Tooltip
                        formatter={(value, name) => [`€${value.toFixed(2)}`, name]}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {categories.map((category, index) => (
                        <Bar
                          key={category}
                          dataKey={category}
                          fill={COLORS[index % COLORS.length]}
                          stackId={categoryChartMode === 'stacked' ? 'total' : undefined}
                          animationBegin={0}
                          animationDuration={800}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold dark:text-white">Monthly Overview</h2>
              </div>
              <ResponsiveContainer width="100%" height={isMobileChart ? 320 : 380}>
                <LineChart data={monthlyData} margin={{ top: 20, right: isMobileChart ? 10 : 30, left: isMobileChart ? 0 : 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#374151" : "#e0e0e0"} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: isMobileChart ? 10 : 12, fill: darkMode ? "#e5e7eb" : "#374151" }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return `${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`;
                    }}
                  />
                  <YAxis 
                    width={isMobileChart ? 42 : 60}
                    tick={{ fontSize: isMobileChart ? 10 : 12, fill: darkMode ? "#e5e7eb" : "#374151" }}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [`€${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px', fontSize: isMobileChart ? '11px' : '12px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="spending" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    dot={{ fill: '#ef4444', r: 4 }}
                    activeDot={{ r: 6 }}
                    animationBegin={0}
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {savingsBreakdownData.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
                <h2 className="text-xl font-bold mb-4 dark:text-white">Savings Breakdown</h2>
                <ResponsiveContainer width="100%" height={isMobileChart ? 320 : 380}>
                  <PieChart>
                    <Pie
                      data={savingsBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={!isMobileChart}
                      label={isMobileChart ? false : ({ name }) => name}
                      outerRadius={isMobileChart ? 90 : 120}
                      fill="#8884d8"
                      dataKey="value"
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {savingsBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, item) => {
                        const percent = (item && typeof item.percent === 'number') ? item.percent * 100 : 0;
                        return [`€${value.toFixed(2)} (${percent.toFixed(1)}%)`, name];
                      }}
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                    />
                    {isMobileChart && (
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {activeMainTab === 'graphs' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold dark:text-white">Transactions ({filteredTransactions.length})</h2>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 transition"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">Add Transaction</span>
            </button>
          </div>
          
          {/* Transaction Search Filters */}
          <div className="mb-4 space-y-3">
            <div className="relative w-full">
              <button
                onClick={() => setShowCategoryDropdown(prev => !prev)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition flex items-center justify-between"
              >
                <span>{filter.categories.length === 0 ? 'All Categories' : `${filter.categories.length} selected`}</span>
                <span>▼</span>
              </button>
              <div className={`${showCategoryDropdown ? 'block' : 'hidden'} absolute top-full mt-1 left-0 right-0 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto`}>
                <div className="p-2">
                  <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.categories.length === 0}
                      onChange={() => setFilter({...filter, categories: []})}
                      className="cursor-pointer"
                    />
                    <span className="text-sm dark:text-white">All Categories</span>
                  </label>
                  {categories.map(cat => (
                    <label key={cat} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filter.categories.includes(cat)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilter({...filter, categories: [...filter.categories, cat]});
                          } else {
                            setFilter({...filter, categories: filter.categories.filter(c => c !== cat)});
                          }
                        }}
                        className="cursor-pointer"
                      />
                      <span className="text-sm dark:text-white">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                placeholder="Search Description..."
                value={filter.description}
                onChange={(e) => setFilter({...filter, description: e.target.value})}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          </div>
          
          {/* Batch Edit Controls */}
          {selectedTransactions.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex flex-wrap gap-2 items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {selectedTransactions.length} transaction(s) selected
              </span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleBatchEdit}
                  className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition text-sm"
                >
                  Batch Edit
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition text-sm"
                >
                  Delete
                </button>
                <button
                  onClick={() => setSelectedTransactions([])}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
          
          <div className="md:hidden space-y-2">
            {filteredTransactions.map(transaction => (
              <div key={transaction.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.includes(transaction.id)}
                      onChange={() => toggleSelectTransaction(transaction.id)}
                      className="cursor-pointer"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDateToDDMMYY(transaction.date)}</span>
                  </div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${
                    transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    €{transaction.amount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="min-w-0">
                    <div className="text-sm dark:text-gray-300 truncate">{transaction.description}</div>
                    <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${
                      transaction.category === 'Uncategorized'
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    }`}>
                      {transaction.category}
                    </span>
                  </div>
                  <div className="flex justify-center gap-2 flex-shrink-0">
                    {transaction.category.toLowerCase().includes('savings') && transaction.amount > 0 && (
                      <button
                        onClick={() => openSavingsModal(transaction)}
                        className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 rounded"
                        title="Allocate savings"
                      >
                        <Settings size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(transaction.id)}
                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-center py-2 px-2 w-10">
                    <input
                      type="checkbox"
                      checked={selectedTransactions.length === filteredTransactions.length && filteredTransactions.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th 
                    className="text-left py-2 px-2 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1">
                      Date
                      {sortConfig.key === 'date' && (
                        <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th className="text-left py-2 px-2 dark:text-gray-300">Description</th>
                  <th 
                    className="text-left py-2 px-2 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Category
                      {sortConfig.key === 'category' && (
                        <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-right py-2 px-2 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Amount
                      {sortConfig.key === 'amount' && (
                        <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                  <th className="text-center py-2 px-2 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(transaction => (
                  <tr key={transaction.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="text-center py-2 px-2">
                      <input
                        type="checkbox"
                        checked={selectedTransactions.includes(transaction.id)}
                        onChange={() => toggleSelectTransaction(transaction.id)}
                        className="cursor-pointer"
                      />
                    </td>
                    {editingId === transaction.id ? (
                      <>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={editForm.date}
                            onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={editForm.category}
                            onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            list="categories-list"
                          />
                          <datalist id="categories-list">
                            {categories.map(cat => (
                              <option key={cat} value={cat} />
                            ))}
                          </datalist>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editForm.amount}
                            onChange={(e) => setEditForm({...editForm, amount: parseFloat(e.target.value)})}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={handleSave}
                              className="p-1 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 rounded"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-2 text-sm dark:text-gray-300">{formatDateToDDMMYY(transaction.date)}</td>
                        <td className="py-2 px-2 text-sm dark:text-gray-300">{transaction.description}</td>
                        <td className="py-2 px-2 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            transaction.category === 'Uncategorized' 
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' 
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          }`}>
                            {transaction.category}
                          </span>
                        </td>
                        <td className={`py-2 px-2 text-sm text-right font-semibold ${
                          transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          €{transaction.amount.toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center gap-2">
                            {transaction.category.toLowerCase().includes('savings') && transaction.amount > 0 && (
                              <button
                                onClick={() => openSavingsModal(transaction)}
                                className="p-1 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 rounded"
                                title="Allocate savings"
                              >
                                <Settings size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 rounded"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}

        {/* Savings Allocation Modal */}
        {showSavingsModal && selectedSavingsTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold dark:text-white">Allocate Savings</h2>
                  <button
                    onClick={() => setShowSavingsModal(false)}
                    className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Transaction</p>
                  <p className="font-semibold dark:text-white">{selectedSavingsTransaction.description}</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">€{selectedSavingsTransaction.amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Allocated: €{getTotalAllocated(selectedSavingsTransaction.id).toFixed(2)} | 
                    Remaining: €{(selectedSavingsTransaction.amount - getTotalAllocated(selectedSavingsTransaction.id)).toFixed(2)}
                  </p>
                </div>

                {/* Current Allocations */}
                {savingsAllocations[selectedSavingsTransaction.id]?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3 dark:text-white">Current Allocations</h3>
                    <div className="space-y-2">
                      {savingsAllocations[selectedSavingsTransaction.id].map((alloc, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div>
                            <p className="font-medium dark:text-white">{alloc.purpose}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">€{alloc.amount.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => deleteSavingsAllocation(selectedSavingsTransaction.id, index)}
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-2 rounded"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add New Allocation */}
                <div className="space-y-4">
                  <h3 className="font-semibold dark:text-white">Add Allocation</h3>
                  <div className="flex gap-3 flex-wrap">
                    <input
                      type="text"
                      placeholder="Purpose (e.g., Traveling, Emergency Fund)"
                      value={newAllocation.purpose}
                      onChange={(e) => setNewAllocation({...newAllocation, purpose: e.target.value})}
                      className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={newAllocation.amount || ''}
                      onChange={(e) => setNewAllocation({...newAllocation, amount: parseFloat(e.target.value) || 0})}
                      className="w-32 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                    <button
                      onClick={addSavingsAllocation}
                      className="px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowSavingsModal(false);
                      setNewAllocation({ purpose: '', amount: 0 });
                    }}
                    className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Batch Edit Modal */}
        {showBatchEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold dark:text-white">Batch Edit Transactions</h2>
                  <button
                    onClick={cancelBatchEdit}
                    className="text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Editing {selectedTransactions.length} transaction(s)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Leave fields empty to keep existing values
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="New description for all selected"
                      value={batchEditForm.description}
                      onChange={(e) => setBatchEditForm({...batchEditForm, description: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category (optional)
                    </label>
                    <select
                      value={batchEditForm.category}
                      onChange={(e) => setBatchEditForm({...batchEditForm, category: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">-- Keep existing categories --</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__new__">+ Create New Category</option>
                    </select>
                    {batchEditForm.category === '__new__' && (
                      <input
                        type="text"
                        placeholder="Enter new category name"
                        value={newBatchCategoryName}
                        onChange={(e) => setNewBatchCategoryName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 mt-2"
                        autoFocus
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={cancelBatchEdit}
                    className="px-6 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyBatchEdit}
                    disabled={!batchEditForm.description && (batchEditForm.category === '__new__' ? !newBatchCategoryName : !batchEditForm.category)}
                    className="px-6 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    Apply Changes
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