import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../utils/savings';

export function SavingsSection({
  addSavingsAccount,
  addSavingsTransaction,
  cancelEditSavingsAccount,
  colors,
  deleteSavingsAccount,
  editingSavingsForm,
  editingSavingsId,
  isMobileChart,
  newSavingsAccount,
  newSavingsTransaction,
  saveSavingsAccount,
  savingsAccounts,
  savingsAccountsChartData,
  savingsAccountsTotal,
  savingsTransactionHistory,
  setEditingSavingsForm,
  setNewSavingsAccount,
  setNewSavingsTransaction,
  startEditSavingsAccount,
  t
}) {
  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white">{t('savings.overview')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {t('savings.subtitle')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('savings.totalSaved')}</div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
              €{formatCurrency(savingsAccountsTotal)}
            </div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('savings.savingsAccounts')}</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{savingsAccounts.length}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('savings.savingsAccountName')}</label>
              <input
                type="text"
                value={newSavingsAccount.name}
                onChange={(e) => setNewSavingsAccount({ ...newSavingsAccount, name: e.target.value })}
                placeholder={t('savings.savingsAccountName')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('savings.initialBalance')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newSavingsAccount.balance}
                onChange={(e) => setNewSavingsAccount({ ...newSavingsAccount, balance: e.target.value })}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={addSavingsAccount}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition h-10 whitespace-nowrap"
          >
            {t('savings.addAccount')}
          </button>
        </div>
      </div>

      {savingsAccounts.length > 0 ? (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{t('savings.splitByAccount')}</h3>
            <ResponsiveContainer width="100%" height={isMobileChart ? 320 : 360}>
              <PieChart>
                <Pie
                  data={savingsAccountsChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={!isMobileChart}
                  label={isMobileChart ? false : ({ name }) => name}
                  outerRadius={isMobileChart ? 90 : 120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {savingsAccountsChartData.map((entry, index) => (
                    <Cell key={`savings-account-cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, item) => {
                    const percent = item && typeof item.percent === 'number' ? item.percent * 100 : 0;
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
            <h3 className="text-xl font-bold mb-4 dark:text-white">{t('savings.addWithdraw')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_120px_auto] gap-3 items-end mb-6">
              <select
                value={newSavingsTransaction.selectedAccountId}
                onChange={(e) => setNewSavingsTransaction({ ...newSavingsTransaction, selectedAccountId: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t('savings.selectAccount')}</option>
                {savingsAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <select
                value={newSavingsTransaction.type}
                onChange={(e) => setNewSavingsTransaction({ ...newSavingsTransaction, type: e.target.value })}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="deposit">{t('savings.deposit')}</option>
                <option value="withdrawal">{t('savings.withdraw')}</option>
              </select>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newSavingsTransaction.amount}
                onChange={(e) => setNewSavingsTransaction({ ...newSavingsTransaction, amount: e.target.value })}
                placeholder={t('common.amount')}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={addSavingsTransaction}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
              >
                {t('savings.apply')}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
            <h3 className="text-xl font-bold mb-4 dark:text-white">{t('savings.accountsTitle')}</h3>
            <div className="space-y-3">
              {savingsAccounts.map((account) => (
                <div key={account.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
                  {editingSavingsId === account.id ? (
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-3 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('savings.name')}</label>
                        <input
                          type="text"
                          value={editingSavingsForm.name}
                          onChange={(e) => setEditingSavingsForm({ ...editingSavingsForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('savings.balance')}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={editingSavingsForm.balance}
                          onChange={(e) => setEditingSavingsForm({ ...editingSavingsForm, balance: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveSavingsAccount}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 whitespace-nowrap"
                        >
                          {t('common.save')}
                        </button>
                        <button
                          onClick={cancelEditSavingsAccount}
                          className="px-3 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 whitespace-nowrap"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{account.name}</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-white">€{formatCurrency(account.balance)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {savingsAccountsTotal > 0
                            ? t('savings.percentOfTotal', { percent: ((account.balance / savingsAccountsTotal) * 100).toFixed(1) })
                            : t('savings.percentOfTotal', { percent: '0.0' })}
                        </div>
                        {savingsTransactionHistory[account.id]?.length > 0 && (
                          <details className="mt-3 text-sm">
                            <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline">{t('savings.transactionHistory', { count: savingsTransactionHistory[account.id].length })}</summary>
                            <div className="mt-2 space-y-1 pl-4 border-l border-gray-300 dark:border-gray-600">
                              {[...savingsTransactionHistory[account.id]].reverse().map((tx) => (
                                <div key={tx.id} className="flex justify-between text-xs">
                                  <span className="text-gray-600 dark:text-gray-400">{tx.date}</span>
                                  <span className={tx.type === 'deposit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                                    {tx.type === 'deposit' ? '+' : '-'}€{formatCurrency(tx.amount)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditSavingsAccount(account)}
                          className="px-3 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 whitespace-nowrap"
                        >
                          {t('common.edit')}
                        </button>
                        <button
                          onClick={() => deleteSavingsAccount(account.id)}
                          className="px-3 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 whitespace-nowrap"
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}