async function request(method, path, body, type = 'application/json') {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = type;
    opts.body = type === 'application/json' ? JSON.stringify(body) : body;
  }
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    let message = `${res.status}`;
    try { message = (await res.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  bootstrap: () => request('GET', '/bootstrap'),
  accountData: (id) => request('GET', `/accounts/${id}/data`),
  createAccount: (name) => request('POST', '/accounts', { name }),
  patchAccountSettings: (id, patch) => request('PATCH', `/accounts/${id}/settings`, patch),
  deleteAccount: (id) => request('DELETE', `/accounts/${id}`),

  createTransaction: (accountId, tx) => request('POST', `/accounts/${accountId}/transactions`, tx),
  patchTransaction: (id, patch) => request('PATCH', `/transactions/${id}`, patch),
  deleteTransaction: (id) => request('DELETE', `/transactions/${id}`),
  batchEdit: (ids, set) => request('POST', '/transactions/batch', { ids, set }),
  batchDelete: (ids) => request('POST', '/transactions/batch-delete', { ids }),

  importCsv: (accountId, text) => request('POST', `/accounts/${accountId}/import`, text, 'text/csv'),
  autocategorize: (accountId) => request('POST', `/accounts/${accountId}/autocategorize`),

  addRule: (pattern, category) => request('POST', '/rules', { pattern, category }),
  batchRules: (patterns, category) => request('POST', '/rules/batch', { patterns, category }),
  deleteRules: (patterns) => request('POST', '/rules/delete', { patterns }),

  addCategory: (accountId, name) => request('POST', `/accounts/${accountId}/categories`, { name }),
  renameCategory: (accountId, from, to) => request('POST', `/accounts/${accountId}/categories/rename`, { from, to }),
  deleteCategory: (accountId, category, replacement) =>
    request('POST', `/accounts/${accountId}/categories/delete`, { category, replacement }),

  createSavings: (accountId, name, balance) => request('POST', `/accounts/${accountId}/savings`, { name, balance }),
  patchSavings: (id, patch) => request('PATCH', `/savings/${id}`, patch),
  deleteSavings: (id) => request('DELETE', `/savings/${id}`),
  savingsTransaction: (id, type, amount) => request('POST', `/savings/${id}/transactions`, { type, amount }),
  createSavingsRecurring: (id, amount, day) => request('POST', `/savings/${id}/recurring`, { amount, day }),
  deleteSavingsRecurring: (rid) => request('DELETE', `/savings/recurring/${rid}`),
};
