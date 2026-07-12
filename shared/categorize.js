export function autoCategorize(description, rules) {
  const desc = (description || '').toLowerCase();
  for (const rule of rules) {
    if (desc.includes(rule.pattern.toLowerCase())) return rule.category;
  }
  return 'Uncategorized';
}

const INTENTS = [
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

export function guessCategory(description, availableCategories = []) {
  const desc = (description || '').toLowerCase();
  if (!desc) return 'Uncategorized';

  const categories = availableCategories.filter(c => c && c !== 'Uncategorized');
  if (categories.length === 0) return 'Uncategorized';

  let bestCategory = 'Uncategorized';
  let bestScore = 0;

  for (const intent of INTENTS) {
    if (!intent.tags.some(tag => desc.includes(tag))) continue;
    for (const category of categories) {
      const normalized = category.toLowerCase();
      let score = 0;
      for (const alias of intent.aliases) {
        if (normalized.includes(alias)) score += 2;
      }
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }
  }

  return bestScore > 0 ? bestCategory : 'Uncategorized';
}

export function dedupKey(t) {
  const date = (t.date || '').trim();
  const desc = (t.description || '').trim().toLowerCase();
  const amount = Number(t.amount || 0).toFixed(2);
  const type = (t.type || '').trim().toLowerCase();
  return `${date}|${desc}|${amount}|${type}`;
}
