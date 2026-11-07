// What the app knows about reaching the server. While `paused`, writes fail at once instead of
// being sent. `onDown` runs before a network failure is thrown, so the app can pause first.
export const net = {
  message: 'Network error',
  paused: false,
  failedWrites: 0,
  cachedAt: null,
  heardAt: null,
  onDown: () => {},
  onCached: () => {},
};

async function request(method, path, body, type = 'application/json') {
  const write = method !== 'GET';
  if (write && net.paused) {
    net.failedWrites++;
    throw Object.assign(new Error(net.message), { network: true });
  }
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = type;
    opts.body = type === 'application/json' ? JSON.stringify(body) : body;
  }
  let res;
  try {
    res = await fetch('/api' + path, opts);
  } catch {
    if (write) net.failedWrites++;
    net.onDown(net.heardAt);
    throw Object.assign(new Error(net.message), { network: true });
  }
  const stamp = res.headers.get('X-BT-Cached-At');
  if (!write) net.cachedAt = stamp ? Date.parse(stamp) : null;
  if (stamp) net.onCached(net.cachedAt);
  else net.heardAt = Date.now();
  if (!res.ok) {
    let message = `${res.status}`;
    try { message = (await res.json()).error || message; } catch {}
    throw Object.assign(new Error(message), { status: res.status });
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  bootstrap: () => request('GET', '/bootstrap'),
  accountData: (id) => request('GET', `/accounts/${id}/data`),
  createAccount: (name, currency) => request('POST', '/accounts', { name, currency }),
  patchJointSettings: (patch) => request('PATCH', '/settings/joint', patch),
  deleteAccount: (id) => request('DELETE', `/accounts/${id}`),
  patchAccountSettings: (id, patch) => request('PATCH', `/accounts/${id}/settings`, patch),

  createTransaction: (accountId, tx) => request('POST', `/accounts/${accountId}/transactions`, tx),
  patchTransaction: (accountId, id, patch) => request('PATCH', `/accounts/${accountId}/transactions/${id}`, patch),
  deleteTransaction: (accountId, id) => request('DELETE', `/accounts/${accountId}/transactions/${id}`),
  batchEdit: (accountId, ids, set) => request('POST', `/accounts/${accountId}/transactions/batch`, { ids, set }),
  batchDelete: (accountId, ids) => request('POST', `/accounts/${accountId}/transactions/batch-delete`, { ids }),
  uncategorize: (ids, category) => request('POST', '/transactions/uncategorize', { ids, category }),

  importCsv: (accountId, text) => request('POST', `/accounts/${accountId}/import`, text, 'text/csv'),
  autocategorize: (accountId) => request('POST', `/accounts/${accountId}/autocategorize`),

  addRule: (pattern, category) => request('POST', '/rules', { pattern, category }),
  batchRules: (patterns, category) => request('POST', '/rules/batch', { patterns, category }),
  deleteRules: (patterns) => request('POST', '/rules/delete', { patterns }),

  categories: () => request('GET', '/categories'),
  addCategory: (name) => request('POST', '/categories', { name }),
  renameCategory: (from, to) => request('POST', '/categories/rename', { from, to }),
  deleteCategory: (category, replacement) => request('POST', '/categories/delete', { category, replacement }),

  savings: () => request('GET', '/savings'),
  createSavings: (name, balance, category) => request('POST', '/savings', { name, balance, category }),
  patchSavings: (id, patch) => request('PATCH', `/savings/${id}`, patch),
  deleteSavings: (id) => request('DELETE', `/savings/${id}`),
  savingsTransaction: (id, type, amount) => request('POST', `/savings/${id}/transactions`, { type, amount }),
  deleteSavingsEntry: (id, entryId) => request('DELETE', `/savings/${id}/history/${entryId}`),
  createSavingsRecurring: (id, amount, day) => request('POST', `/savings/${id}/recurring`, { amount, day }),
  deleteSavingsRecurring: (rid) => request('DELETE', `/savings/recurring/${rid}`),

  bankStatus: () => request('GET', '/bank/status'),
  bankAspsps: (country) => request('GET', `/bank/aspsps?country=${encodeURIComponent(country)}`),
  bankLink: (payload) => request('POST', '/bank/link', payload),
  bankSync: (connectionId) => request('POST', '/bank/sync', connectionId ? { connectionId } : {}),
  bankSyncAccount: (bankAccountId) => request('POST', '/bank/sync', { bankAccountId }),
  bankPatchAccount: (id, patch) => request('PATCH', `/bank/accounts/${encodeURIComponent(id)}`, patch),
  bankUnlink: (id) => request('DELETE', `/bank/connections/${encodeURIComponent(id)}`),
};
