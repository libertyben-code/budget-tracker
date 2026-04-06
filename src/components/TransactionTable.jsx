import React from 'react';
import { Edit2, Plus, Save, Trash2, X } from 'lucide-react';

export function TransactionTable({
  categories,
  editForm,
  editingId,
  filter,
  filteredTransactions,
  formatDateToDDMMYY,
  handleAdd,
  handleBatchDelete,
  handleBatchEdit,
  handleDelete,
  handleEdit,
  handleSave,
  handleSort,
  selectedTransactions,
  setEditForm,
  setEditingId,
  setFilter,
  setSelectedTransactions,
  setShowCategoryDropdown,
  showCategoryDropdown,
  sortConfig,
  toggleSelectAll,
  toggleSelectTransaction,
  t
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold dark:text-white">{t('transactionTable.title', { count: filteredTransactions.length })}</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 transition"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">{t('transactionTable.addTransaction')}</span>
        </button>
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative w-full">
          <button
            onClick={() => setShowCategoryDropdown((prev) => !prev)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition flex items-center justify-between"
          >
            <span>{filter.categories.length === 0 ? t('transactionTable.allCategories') : t('transactionTable.selectedCount', { count: filter.categories.length })}</span>
            <span>▼</span>
          </button>
          <div className={`${showCategoryDropdown ? 'block' : 'hidden'} absolute top-full mt-1 left-0 right-0 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto`}>
            <div className="p-2">
              <label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={filter.categories.length === 0}
                  onChange={() => setFilter({ ...filter, categories: [] })}
                  className="cursor-pointer"
                />
                <span className="text-sm dark:text-white">{t('transactionTable.allCategories')}</span>
              </label>
              {categories.map((cat) => (
                <label key={cat} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.categories.includes(cat)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilter({ ...filter, categories: [...filter.categories, cat] });
                      } else {
                        setFilter({ ...filter, categories: filter.categories.filter((current) => current !== cat) });
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
            placeholder={t('transactionTable.searchDescription')}
            value={filter.description}
            onChange={(e) => setFilter({ ...filter, description: e.target.value })}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {selectedTransactions.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex flex-wrap gap-2 items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('transactionTable.selectedTransactions', { count: selectedTransactions.length })}
          </span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleBatchEdit}
              className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition text-sm"
            >
              {t('transactionTable.batchEdit')}
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition text-sm"
            >
              {t('common.delete')}
            </button>
            <button
              onClick={() => setSelectedTransactions([])}
              className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition text-sm"
            >
              {t('transactionTable.clear')}
            </button>
          </div>
        </div>
      )}

      <div className="md:hidden space-y-2">
        {filteredTransactions.map((transaction) => (
          <div key={transaction.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            {editingId === transaction.id ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedTransactions.includes(transaction.id)}
                    onChange={() => toggleSelectTransaction(transaction.id)}
                    className="cursor-pointer"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t('transactionTable.editingTransaction')}</span>
                </div>

                <input
                  type="text"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  list="categories-list-mobile"
                />
                <datalist id="categories-list-mobile">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />

                <div className="flex justify-end gap-2">
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
              </div>
            ) : (
              <>
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
                  <span className={`text-sm font-semibold whitespace-nowrap ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    €{transaction.amount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="min-w-0">
                    <div className="text-sm dark:text-gray-300 truncate">{transaction.description}</div>
                    <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${transaction.category === 'Uncategorized' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'}`}>
                      {transaction.category}
                    </span>
                  </div>
                  <div className="flex justify-center gap-2 flex-shrink-0">
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
              </>
            )}
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
                  {t('common.date')}
                  {sortConfig.key === 'date' && <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="text-left py-2 px-2 dark:text-gray-300">{t('common.description')}</th>
              <th
                className="text-left py-2 px-2 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                onClick={() => handleSort('category')}
              >
                <div className="flex items-center gap-1">
                  {t('common.category')}
                  {sortConfig.key === 'category' && <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th
                className="text-right py-2 px-2 dark:text-gray-300 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  {t('common.amount')}
                  {sortConfig.key === 'amount' && <span>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>}
                </div>
              </th>
              <th className="text-center py-2 px-2 dark:text-gray-300">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((transaction) => (
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
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        list="categories-list"
                      />
                      <datalist id="categories-list">
                        {categories.map((cat) => (
                          <option key={cat} value={cat} />
                        ))}
                      </datalist>
                    </td>
                    <td className="py-2 px-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) })}
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
                      <span className={`px-2 py-1 rounded-full text-xs ${transaction.category === 'Uncategorized' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'}`}>
                        {transaction.category}
                      </span>
                    </td>
                    <td className={`py-2 px-2 text-sm text-right font-semibold ${transaction.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      €{transaction.amount.toFixed(2)}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex justify-center gap-2">
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
  );
}