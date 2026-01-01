import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Upload, Download, Edit2, Trash2, Plus, Save, X, Settings, LogOut, Calendar } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBodHwDZ-U8evpumw9vE7-nsfq_auwRZX0",
  authDomain: "boo2-budget.firebaseapp.com",
  projectId: "boo2-budget",
  storageBucket: "boo2-budget.firebasestorage.app",
  messagingSenderId: "504106724059",
  appId: "1:504106724059:web:d632c1732d856bb50ebafe"
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

  // Multi-account state
  const [accounts, setAccounts] = useState([{ id: 'default', name: 'Main Account' }]);
  const [activeAccountId, setActiveAccountId] = useState('default');
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [accountsData, setAccountsData] = useState({
    'default': { transactions: [], categoryRules: {} }
  });

  const [transactions, setTransactions] = useState([]);
  const [categoryRules, setCategoryRules] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filter, setFilter] = useState({ 
    categories: [], // Changed to array for multi-select
    description: '',
    categorySearch: '',
    dateFilterType: 'all', // 'all', 'year', 'month', 'dateRange'
    year: '',
    month: '',
    startDate: '',
    endDate: ''
  });
  const [showRules, setShowRules] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', category: '' });
  const [showGraphs, setShowGraphs] = useState(true);
  
  // Savings allocation state
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [selectedSavingsTransaction, setSelectedSavingsTransaction] = useState(null);
  const [savingsAllocations, setSavingsAllocations] = useState({});
  const [newAllocation, setNewAllocation] = useState({ purpose: '', amount: 0 });

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setInitializing(false);
      if (user) {
        loadUserData(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  // Auto-save data when transactions, rules, accounts, or savings allocations change
  useEffect(() => {
    if (user && (transactions.length > 0 || accounts.length > 1 || Object.keys(savingsAllocations).length > 0)) {
      saveUserData();
    }
  }, [transactions, categoryRules, accounts, savingsAllocations]);

  const loadUserData = async (userId) => {
    try {
      const data = await firebaseHelpers.loadData(userId);
      if (data) {
        // Load accounts structure
        if (data.accounts) {
          setAccounts(data.accounts);
        }
        if (data.accountsData) {
          setAccountsData(data.accountsData);
          // Set active account data
          const activeData = data.accountsData[data.activeAccountId || 'default'] || { transactions: [], categoryRules: {}, savingsAllocations: {} };
          setTransactions(activeData.transactions || []);
          setCategoryRules(activeData.categoryRules || {});
          setSavingsAllocations(activeData.savingsAllocations || {});
          setActiveAccountId(data.activeAccountId || 'default');
        } else {
          // Legacy support: migrate old data to new structure
          setTransactions(data.transactions || []);
          setCategoryRules(data.categoryRules || {});
          setAccountsData({
            'default': {
              transactions: data.transactions || [],
              categoryRules: data.categoryRules || {}
            }
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const saveUserData = async () => {
    if (!user) return;
    try {
      // Update current account data
      const updatedAccountsData = {
        ...accountsData,
        [activeAccountId]: {
          transactions,
          categoryRules,
          savingsAllocations
        }
      };
      
      await firebaseHelpers.saveData(user.uid, {
        accounts,
        accountsData: updatedAccountsData,
        activeAccountId,
        lastUpdated: new Date().toISOString()
      });
      
      setAccountsData(updatedAccountsData);
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

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
    setTransactions([]);
    setCategoryRules({});
    setAccounts([{ id: 'default', name: 'Main Account' }]);
    setActiveAccountId('default');
    setAccountsData({ 'default': { transactions: [], categoryRules: {} } });
    setEmail('');
    setPassword('');
  };

  const switchAccount = (accountId) => {
    // Save current account data before switching
    const updatedAccountsData = {
      ...accountsData,
      [activeAccountId]: {
        transactions,
        categoryRules,
        savingsAllocations
      }
    };
    setAccountsData(updatedAccountsData);

    // Load new account data
    const newAccountData = updatedAccountsData[accountId] || { transactions: [], categoryRules: {}, savingsAllocations: {} };
    setTransactions(newAccountData.transactions);
    setCategoryRules(newAccountData.categoryRules);
    setSavingsAllocations(newAccountData.savingsAllocations || {});
    setActiveAccountId(accountId);
    setEditingId(null);
    setEditForm({});
  };

  const addAccount = () => {
    if (!newAccountName.trim()) return;
    
    const newAccountId = `account_${Date.now()}`;
    const newAccount = { id: newAccountId, name: newAccountName.trim() };
    
    setAccounts([...accounts, newAccount]);
    setAccountsData({
      ...accountsData,
      [newAccountId]: { transactions: [], categoryRules: {} }
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

  const renameAccount = (accountId, newName) => {
    if (!newName.trim()) return;
    
    const updatedAccounts = accounts.map(acc => 
      acc.id === accountId ? { ...acc, name: newName.trim() } : acc
    );
    setAccounts(updatedAccounts);
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
    
    const parsed = lines.slice(1)
      .filter(line => line.trim())
      .map((line, idx) => {
        const values = line.split(',');
        const row = {};
        headers.forEach((header, i) => {
          row[header] = values[i]?.trim() || '';
        });
        
        const description = row['Description'] || '';
        const existingCategory = row['Categories'] || row['Category'] || '';
        const autoCategory = autoCategorizeTrans(description);
        
        return {
          id: Date.now() + idx,
          date: row['Started Date'] || row.Date || '',
          description: description,
          category: existingCategory || autoCategory,
          amount: parseFloat(row.Amount) || 0,
          type: row.Type || '',
          state: row.State || ''
        };
      })
      .filter(t => t.state !== 'REVERTED' && t.state !== 'PENDING');

    learnCategoryFromTransactions(parsed);
    setTransactions(parsed);
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
      date: new Date().toLocaleDateString('en-GB'),
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

  const reapplyRules = () => {
    const updated = transactions.map(t => ({
      ...t,
      category: t.category === 'Uncategorized' ? autoCategorizeTrans(t.description) : t.category
    }));
    setTransactions(updated);
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
    return transactions.filter(t => {
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
      if (!t.date) return true; // Skip filtering if no date
      const [day, month, year] = t.date.split('/');
      
      // Skip if date parts are missing
      if (!year || !month || !day) return true;
      
      if (filter.dateFilterType === 'year' && filter.year) {
        if (year !== filter.year) return false;
      } else if (filter.dateFilterType === 'month' && filter.month) {
        const txMonth = `${year}-${month.padStart(2, '0')}`;
        if (txMonth !== filter.month) return false;
      } else if (filter.dateFilterType === 'dateRange' && filter.startDate && filter.endDate) {
        const txDate = new Date(year, parseInt(month) - 1, parseInt(day));
        const startDate = new Date(filter.startDate);
        const endDate = new Date(filter.endDate);
        if (txDate < startDate || txDate > endDate) return false;
      }
      
      return true;
    });
  }, [transactions, filter]);

  const categories = useMemo(() => 
    [...new Set(transactions.map(t => t.category))].sort()
  , [transactions]);

  const months = useMemo(() => {
    const monthSet = new Set();
    transactions.forEach(t => {
      const [day, month, year] = t.date.split('/');
      if (year && month) monthSet.add(`${year}-${month.padStart(2, '0')}`);
    });
    return [...monthSet].sort().reverse();
  }, [transactions]);

  const years = useMemo(() => {
    const yearSet = new Set();
    transactions.forEach(t => {
      const [day, month, year] = t.date.split('/');
      if (year) yearSet.add(year);
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

  const monthlyData = useMemo(() => {
    const monthly = {};
    filteredTransactions.forEach(t => {
      const [day, month, year] = t.date.split('/');
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
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Budget Tracker</h1>
            <p className="text-gray-600">Sign in to access your budget</p>
          </div>
          
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAuthMode('login')}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                authMode === 'login' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setAuthMode('signup')}
              className={`flex-1 py-2 rounded-lg font-semibold transition ${
                authMode === 'signup' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            
            {authError && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {authError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition disabled:bg-gray-400"
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Budget Tracker</h1>
              <p className="text-sm text-gray-500 mt-1">Logged in as: {user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              <LogOut size={20} />
              Logout
            </button>
          </div>
          
          {/* Account Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {accounts.map(account => (
                <div key={account.id} className="group relative flex items-center">
                  <button
                    onClick={() => switchAccount(account.id)}
                    className={`px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
                      activeAccountId === account.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                      onClick={() => deleteAccount(account.id)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                      title="Delete account"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
              
              {!isAddingAccount ? (
                <button
                  onClick={() => setIsAddingAccount(true)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-t-lg hover:bg-gray-200 transition flex items-center gap-1"
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
                    className="px-3 py-2 border rounded"
                    autoFocus
                  />
                  <button
                    onClick={addAccount}
                    className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    <Save size={16} />
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingAccount(false);
                      setNewAccountName('');
                    }}
                    className="p-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex gap-4 mb-6 flex-wrap">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition">
              <Upload size={20} />
              Import CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            
            <button
              onClick={exportCSV}
              disabled={transactions.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:bg-gray-300"
            >
              <Download size={20} />
              Export CSV
            </button>

            <button
              onClick={() => setShowRules(!showRules)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Settings size={20} />
              Category Rules ({Object.keys(categoryRules).length})
            </button>

            {transactions.length > 0 && (
              <button
                onClick={reapplyRules}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
              >
                Auto-Categorize
              </button>
            )}
          </div>

          {showRules && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-bold mb-4">Category Auto-Assignment Rules</h3>
              <p className="text-sm text-gray-600 mb-4">
                Rules are automatically learned when you set categories.
              </p>
              
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Description pattern"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({...newRule, pattern: e.target.value})}
                  className="flex-1 px-3 py-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newRule.category}
                  onChange={(e) => setNewRule({...newRule, category: e.target.value})}
                  className="flex-1 px-3 py-2 border rounded"
                />
                <button
                  onClick={handleAddRule}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add Rule
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Pattern</th>
                      <th className="text-left p-2">Category</th>
                      <th className="text-center p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(categoryRules).map(([pattern, category]) => (
                      <tr key={pattern} className="border-t">
                        <td className="p-2 font-mono text-xs">{pattern}</td>
                        <td className="p-2">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                            {category}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteRule(pattern)}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Balance</div>
                  <div className={`text-2xl font-bold ${stats.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    €{stats.total.toFixed(2)}
                  </div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Spending</div>
                  <div className="text-2xl font-bold text-red-600">
                    €{stats.spending.toFixed(2)}
                  </div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Income</div>
                  <div className="text-2xl font-bold text-green-600">
                    €{stats.income.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex gap-4 flex-wrap items-center">
                  <div className="flex items-center gap-2">
                    <Calendar size={20} className="text-gray-600" />
                    <select
                      value={filter.dateFilterType}
                      onChange={(e) => setFilter({
                        ...filter, 
                        dateFilterType: e.target.value,
                        year: '',
                        month: '',
                        startDate: '',
                        endDate: ''
                      })}
                      className="px-4 py-2 border rounded-lg font-medium"
                    >
                      <option value="all">All Time</option>
                      <option value="year">By Year</option>
                      <option value="month">By Month</option>
                      <option value="dateRange">Date Range</option>
                    </select>
                  </div>
                  
                  {(filter.categories.length > 0 || filter.description || filter.categorySearch || filter.dateFilterType !== 'all') && (
                    <button
                      onClick={() => setFilter({
                        categories: [],
                        description: '',
                        categorySearch: '',
                        dateFilterType: 'all',
                        year: '',
                        month: '',
                        startDate: '',
                        endDate: ''
                      })}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Date Filter Options */}
                {filter.dateFilterType === 'year' && (
                  <div className="flex gap-2 items-center pl-8">
                    <label className="text-sm font-medium text-gray-700">Year:</label>
                    <select
                      value={filter.year}
                      onChange={(e) => setFilter({...filter, year: e.target.value})}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="">Select Year</option>
                      {years.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filter.dateFilterType === 'month' && (
                  <div className="flex gap-2 items-center pl-8">
                    <label className="text-sm font-medium text-gray-700">Month:</label>
                    <select
                      value={filter.month}
                      onChange={(e) => setFilter({...filter, month: e.target.value})}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="">Select Month</option>
                      {months.map(month => (
                        <option key={month} value={month}>{formatMonthDisplay(month)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {filter.dateFilterType === 'dateRange' && (
                  <div className="flex gap-4 items-center pl-8 flex-wrap">
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-medium text-gray-700">From:</label>
                      <input
                        type="date"
                        value={filter.startDate}
                        onChange={(e) => setFilter({...filter, startDate: e.target.value})}
                        className="px-4 py-2 border rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-sm font-medium text-gray-700">To:</label>
                      <input
                        type="date"
                        value={filter.endDate}
                        onChange={(e) => setFilter({...filter, endDate: e.target.value})}
                        className="px-4 py-2 border rounded-lg"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {transactions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <button
              onClick={() => setShowGraphs(!showGraphs)}
              className="w-full flex items-center justify-center gap-2 px-6 py-2 text-gray-700 hover:bg-gray-50 transition rounded"
            >
              {showGraphs ? (
                <>
                  <span>▲</span>
                  <span className="font-semibold">Reduce Graphs</span>
                </>
              ) : (
                <>
                  <span>▼</span>
                  <span className="font-semibold">Expand Graphs</span>
                </>
              )}
            </button>
          </div>
        )}

        {transactions.length > 0 && showGraphs && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Spending by Category</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({name, percent, value}) => `${name}: €${value.toFixed(0)} (${(percent * 100).toFixed(1)}%)`}
                      outerRadius={100}
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
                      formatter={(value) => `€${value.toFixed(2)}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Top Spending Categories</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={categoryData.slice(0, 10)} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.4}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `€${value}`}
                    />
                    <Tooltip 
                      formatter={(value) => [`€${value.toFixed(2)}`, 'Spending']}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                      cursor={{ fill: 'rgba(136, 132, 216, 0.1)' }}
                    />
                    <Bar 
                      dataKey="value" 
                      fill="url(#colorBar)" 
                      radius={[8, 8, 0, 0]}
                      animationBegin={0}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Monthly Overview</h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const [year, month] = value.split('-');
                      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return `${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`;
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `€${value}`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [`€${value.toFixed(2)}`, name.charAt(0).toUpperCase() + name.slice(1)]}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
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
                  <Line 
                    type="monotone" 
                    dataKey="income" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    dot={{ fill: '#10b981', r: 4 }}
                    activeDot={{ r: 6 }}
                    animationBegin={0}
                    animationDuration={800}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {savingsBreakdownData.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-bold mb-4">Savings Breakdown</h2>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={savingsBreakdownData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({name, percent, value}) => `${name}: €${value.toFixed(0)} (${(percent * 100).toFixed(1)}%)`}
                      outerRadius={100}
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
                      formatter={(value) => `€${value.toFixed(2)}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Transactions ({filteredTransactions.length})</h2>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              <Plus size={20} />
              Add Transaction
            </button>
          </div>
          
          {/* Transaction Search Filters */}
          <div className="mb-4 space-y-3">
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                placeholder="Search Description..."
                value={filter.description}
                onChange={(e) => setFilter({...filter, description: e.target.value})}
                className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
              />
              
              <input
                type="text"
                placeholder="Search Category..."
                value={filter.categorySearch}
                onChange={(e) => setFilter({...filter, categorySearch: e.target.value})}
                className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
              />
            </div>
            
            {/* Multi-Category Selector */}
            {categories.length > 0 && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Filter by Categories {filter.categories.length > 0 && `(${filter.categories.length} selected)`}
                </div>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <label
                      key={cat}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full cursor-pointer transition ${
                        filter.categories.includes(cat)
                          ? 'bg-blue-500 text-white'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
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
                        className="hidden"
                      />
                      <span className="text-sm">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-left py-2 px-2">Description</th>
                  <th className="text-left py-2 px-2">Category</th>
                  <th className="text-right py-2 px-2">Amount</th>
                  <th className="text-center py-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(transaction => (
                  <tr key={transaction.id} className="border-b hover:bg-gray-50">
                    {editingId === transaction.id ? (
                      <>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={editForm.date}
                            onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={editForm.description}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={editForm.category}
                            onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                            className="w-full px-2 py-1 border rounded"
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
                            className="w-full px-2 py-1 border rounded text-right"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={handleSave}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save size={18} />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                            >
                              <X size={18} />
                            </button>
                          </div>
                          </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-2 text-sm">{transaction.date}</td>
                        <td className="py-2 px-2 text-sm">{transaction.description}</td>
                        <td className="py-2 px-2 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            transaction.category === 'Uncategorized' 
                              ? 'bg-gray-100 text-gray-800' 
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {transaction.category}
                          </span>
                        </td>
                        <td className={`py-2 px-2 text-sm text-right font-semibold ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          €{transaction.amount.toFixed(2)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex justify-center gap-2">
                            {transaction.category.toLowerCase().includes('savings') && transaction.amount > 0 && (
                              <button
                                onClick={() => openSavingsModal(transaction)}
                                className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                                title="Allocate savings"
                              >
                                <Settings size={18} />
                              </button>
                            )}
                            <button
                              onClick={() => handleEdit(transaction)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(transaction.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
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

        {/* Savings Allocation Modal */}
        {showSavingsModal && selectedSavingsTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Allocate Savings</h2>
                  <button
                    onClick={() => setShowSavingsModal(false)}
                    className="text-gray-600 hover:bg-gray-100 p-2 rounded"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Transaction</p>
                  <p className="font-semibold">{selectedSavingsTransaction.description}</p>
                  <p className="text-lg font-bold text-green-600">€{selectedSavingsTransaction.amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    Allocated: €{getTotalAllocated(selectedSavingsTransaction.id).toFixed(2)} | 
                    Remaining: €{(selectedSavingsTransaction.amount - getTotalAllocated(selectedSavingsTransaction.id)).toFixed(2)}
                  </p>
                </div>

                {/* Current Allocations */}
                {savingsAllocations[selectedSavingsTransaction.id]?.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold mb-3">Current Allocations</h3>
                    <div className="space-y-2">
                      {savingsAllocations[selectedSavingsTransaction.id].map((alloc, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium">{alloc.purpose}</p>
                            <p className="text-sm text-gray-600">€{alloc.amount.toFixed(2)}</p>
                          </div>
                          <button
                            onClick={() => deleteSavingsAllocation(selectedSavingsTransaction.id, index)}
                            className="text-red-600 hover:bg-red-50 p-2 rounded"
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
                  <h3 className="font-semibold">Add Allocation</h3>
                  <div className="flex gap-3 flex-wrap">
                    <input
                      type="text"
                      placeholder="Purpose (e.g., Traveling, Emergency Fund)"
                      value={newAllocation.purpose}
                      onChange={(e) => setNewAllocation({...newAllocation, purpose: e.target.value})}
                      className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={newAllocation.amount || ''}
                      onChange={(e) => setNewAllocation({...newAllocation, amount: parseFloat(e.target.value) || 0})}
                      className="w-32 px-4 py-2 border rounded-lg"
                    />
                    <button
                      onClick={addSavingsAllocation}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
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
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                  >
                    Done
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