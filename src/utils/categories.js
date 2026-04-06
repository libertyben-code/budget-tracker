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
 * AI-style fallback categorization for unknown merchants.
 * Uses merchant keyword intent + fuzzy match against existing user categories.
 * @param {string} description - Transaction description
 * @param {array} availableCategories - Existing categories in the account
 * @returns {string} Best category guess or 'Uncategorized'
 */
export const guessCategoryWithAI = (description, availableCategories = []) => {
  const desc = (description || '').toLowerCase();
  if (!desc) return 'Uncategorized';

  const categories = availableCategories.filter(c => c && c !== 'Uncategorized');
  if (categories.length === 0) return 'Uncategorized';

  const intents = [
    { tags: ['grocery', 'supermarket', 'aldi', 'lidl', 'tesco', 'carrefour', 'auchan', 'food'], aliases: ['grocer', 'grocery', 'supermarket', 'food'] },
    { tags: ['restaurant', 'cafe', 'coffee', 'uber eats', 'deliveroo', 'just eat', 'takeaway'], aliases: ['restaurant', 'dining', 'food', 'eating out'] },
    { tags: ['fuel', 'petrol', 'gas station', 'shell', 'bp', 'esso', 'total'], aliases: ['fuel', 'gas', 'transport', 'car'] },
    { tags: ['rent', 'landlord', 'mortgage'], aliases: ['rent', 'housing', 'home'] },
    { tags: ['electric', 'water', 'internet', 'mobile', 'phone', 'utility', 'bill'], aliases: ['utilities', 'bills', 'internet', 'phone'] },
    { tags: ['netflix', 'spotify', 'disney', 'prime video', 'subscription'], aliases: ['subscription', 'entertainment', 'streaming'] },
    { tags: ['pharmacy', 'doctor', 'medical', 'hospital', 'dentist'], aliases: ['health', 'medical', 'pharmacy'] },
    { tags: ['amazon', 'shop', 'store', 'ikea', 'zara', 'h&m'], aliases: ['shopping', 'retail'] },
    { tags: ['salary', 'payroll', 'income', 'refund'], aliases: ['income', 'salary'] },
    { tags: ['transfer', 'bank transfer'], aliases: ['transfer', 'bank'] },
  ];

  const scoreCategory = (categoryName, intentAliases) => {
    const normalized = categoryName.toLowerCase();
    let score = 0;

    intentAliases.forEach((alias) => {
      if (normalized.includes(alias)) score += 2;
    });

    return score;
  };

  let bestCategory = 'Uncategorized';
  let bestScore = 0;

  intents.forEach((intent) => {
    const matched = intent.tags.some((tag) => desc.includes(tag));
    if (!matched) return;

    categories.forEach((category) => {
      const score = scoreCategory(category, intent.aliases);
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    });
  });

  return bestScore > 0 ? bestCategory : 'Uncategorized';
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
