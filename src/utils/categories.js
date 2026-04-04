// Category rules utilities for auto-categorization and learning

/**
 * Auto-categorize a transaction description based on learned rules
 * @param {string} description - Transaction description
 * @param {object} categoryRules - Dictionary of pattern -> category mappings
 * @returns {string} Category name or 'Uncategorized'
 */
export const autoCategorizeTrans = (description, categoryRules) => {
  const desc = description.toLowerCase();
  for (const [pattern, category] of Object.entries(categoryRules)) {
    if (desc.includes(pattern.toLowerCase())) {
      return category;
    }
  }
  return 'Uncategorized';
};

/**
 * Learn new category patterns from a list of transactions
 * @param {array} transactions - List of transactions with categories set
 * @param {object} currentRules - Existing category rules
 * @returns {object} Updated category rules
 */
export const learnCategoryFromTransactions = (transactions, currentRules = {}) => {
  const newRules = { ...currentRules };
  transactions.forEach(t => {
    if (t.description && t.category && t.category !== 'Uncategorized') {
      const desc = t.description.toLowerCase().trim();
      if (!newRules[desc]) {
        newRules[desc] = t.category;
      }
    }
  });
  return newRules;
};

/**
 * Get unique categories from transactions
 * @param {array} transactions - List of transactions
 * @returns {array} Sorted unique category names
 */
export const extractCategories = (transactions) => {
  const cats = new Set(
    transactions
      .map(t => t.category)
      .filter(cat => cat && cat !== 'Uncategorized')
  );
  return ['Uncategorized', ...Array.from(cats).sort()];
};

/**
 * Rename category across all transactions and rules
 * @param {string} oldName - Old category name
 * @param {string} newName - New category name
 * @param {array} transactions - List of transactions
 * @param {object} rules - Category rules
 * @returns {object} Object with updated transactions and rules
 */
export const renameCategory = (oldName, newName, transactions, rules) => {
  const updatedTransactions = transactions.map(t => ({
    ...t,
    category: t.category === oldName ? newName : t.category
  }));

  const updatedRules = {};
  for (const [pattern, category] of Object.entries(rules)) {
    updatedRules[pattern] = category === oldName ? newName : category;
  }

  return { updatedTransactions, updatedRules };
};

/**
 * Delete category from transactions and rules
 * @param {string} categoryToDelete - Category to remove
 * @param {string} replacementCategory - Category to replace with
 * @param {array} transactions - List of transactions
 * @param {object} rules - Category rules
 * @returns {object} Object with updated transactions and rules
 */
export const deleteCategory = (categoryToDelete, replacementCategory, transactions, rules) => {
  const updatedTransactions = transactions.map(t => ({
    ...t,
    category: t.category === categoryToDelete ? replacementCategory : t.category
  }));

  const updatedRules = {};
  for (const [pattern, category] of Object.entries(rules)) {
    if (category !== categoryToDelete) {
      updatedRules[pattern] = category;
    }
  }

  return { updatedTransactions, updatedRules };
};
