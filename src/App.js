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
    category: 'all', 
    dateFilterType: 'all', // 'all', 'year', 'month', 'dateRange'
    year: '',
    month: '',
    startDate: '',
    endDate: ''
  });
  const [showRules, setShowRules] = useState(false);
  const [newRule, setNewRule] = useState({ pattern: '', category: '' });

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

  // Auto-save data when transactions, rules, or accounts change
  useEffect(() => {
    if (user && (transactions.length > 0 || accounts.length > 1)) {
      saveUserData();
    }
  }, [transactions, categoryRules, accounts]);

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
          const activeData = data.accountsData[data.activeAccountId || 'default'] || { transactions: [], categoryRules: {} };
          setTransactions(activeData.transactions || []);
          setCategoryRules(activeData.categoryRules || {});
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
          categoryRules
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
        categoryRules
      }
    };
    setAccountsData(updatedAccountsData);

    // Load new account data
    const newAccountData = updatedAccountsData[accountId] || { transactions: [], categoryRules: {} };
    setTransactions(newAccountData.transactions);
    setCategoryRules(newAccountData.categoryRules);
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
      // Category filter
      if (filter.category !== 'all' && t.category !== filter.category) return false;
      
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
    transactions.forEach(t => {
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
  }, [transactions]);

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
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition"
            >
              <Plus size={20} />
              Add Transaction
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
                  <select
                    value={filter.category}
                    onChange={(e) => setFilter({...filter, category: e.target.value})}
                    className="px-4 py-2 border rounded-lg"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>

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
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Spending by Category</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Top Spending Categories</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Monthly Overview</h2>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="spending" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Transactions ({filteredTransactions.length})</h2>
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
      </div>
    </div>
  );
}