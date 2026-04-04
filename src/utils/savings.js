// Savings utilities for account and transaction management

/**
 * Format currency amount with space separators (e.g., 1234.56 -> "1 234.56")
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '0.00';
  const fixed = parseFloat(amount).toFixed(2);
  return fixed.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

/**
 * Calculate total from savings accounts
 * @param {array} savingsAccounts - Array of savings account objects
 * @returns {number} Total balance across all accounts
 */
export const calculateTotalSavings = (savingsAccounts) => {
  return savingsAccounts.reduce((sum, account) => sum + (account.balance || 0), 0);
};

/**
 * Format savings accounts for pie chart visualization
 * @param {array} savingsAccounts - Array of savings account objects
 * @returns {array} Formatted data for Recharts PieChart
 */
export const formatSavingsChartData = (savingsAccounts) => {
  return savingsAccounts.map(account => ({
    name: account.name,
    value: parseFloat(account.balance)
  }));
};

/**
 * Validate savings transaction input
 * @param {string} accountId - Selected account ID
 * @param {string} type - Transaction type (deposit/withdrawal)
 * @param {string|number} amount - Transaction amount
 * @param {number} accountBalance - Current account balance
 * @returns {object} Validation result with isValid and message
 */
export const validateSavingsTransaction = (accountId, type, amount, accountBalance) => {
  if (!accountId) {
    return { isValid: false, message: 'Please select an account' };
  }
  
  const numAmount = parseFloat(amount);
  if (Number.isNaN(numAmount) || numAmount <= 0) {
    return { isValid: false, message: 'Please enter a valid amount' };
  }
  
  if (type === 'withdrawal' && numAmount > accountBalance) {
    return { isValid: false, message: 'Insufficient funds' };
  }
  
  return { isValid: true, message: '' };
};

/**
 * Build updated savings accounts with new transaction
 * @param {array} savingsAccounts - Current savings accounts
 * @param {string} accountId - Account to update
 * @param {string} type - Transaction type (deposit/withdrawal)
 * @param {number} amount - Transaction amount
 * @param {object} currentHistory - Current transaction history
 * @returns {object} Updated accounts and history
 */
export const addSavingsTransaction = (savingsAccounts, accountId, type, amount, currentHistory) => {
  const numAmount = parseFloat(amount);
  
  const updatedAccounts = savingsAccounts.map(account => {
    if (account.id === accountId) {
      const newBalance = type === 'deposit' 
        ? account.balance + numAmount 
        : account.balance - numAmount;
      return { ...account, balance: parseFloat(newBalance.toFixed(2)) };
    }
    return account;
  });

  const date = new Date();
  const dateStr = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
  
  const newTransaction = {
    id: `tx_${Date.now()}`,
    date: dateStr,
    type,
    amount: numAmount,
    timestamp: date.getTime()
  };

  const updatedHistory = {
    ...currentHistory,
    [accountId]: [...(currentHistory[accountId] || []), newTransaction]
  };

  return { updatedAccounts, updatedHistory };
};

/**
 * Validate savings account input
 * @param {string} name - Account name
 * @param {string|number} balance - Initial balance
 * @returns {object} Validation result
 */
export const validateSavingsAccount = (name, balance) => {
  if (!name || !name.trim()) {
    return { isValid: false, message: 'Please enter an account name' };
  }
  
  const numBalance = parseFloat(balance);
  if (Number.isNaN(numBalance) || numBalance < 0) {
    return { isValid: false, message: 'Please enter a valid balance' };
  }
  
  return { isValid: true, message: '' };
};
