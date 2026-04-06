import React from 'react';
import { Edit2, Trash2, X } from 'lucide-react';
import { badgeClasses, buttonClasses, cardClasses, formClasses } from '../utils/tailwindClasses';

export function CategoryRulesPanel({
  applyBatchRuleEdit,
  batchRuleCategory,
  categories,
  categoryRules,
  handleAddRule,
  handleBatchRuleDelete,
  handleBatchRuleEdit,
  handleDeleteRule,
  newRule,
  ruleFilter,
  selectedRules,
  setBatchRuleCategory,
  setNewRule,
  setRuleFilter,
  setShowBatchRuleEdit,
  setShowRules,
  showBatchRuleEdit,
  toggleSelectAllRules,
  toggleSelectRule,
  t,
}) {
  return (
    <>
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold dark:text-white">{t('categoryRules.title')}</h3>
          <button
            onClick={() => setShowRules(false)}
            className="text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
            title={t('common.close')}
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('categoryRules.subtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            placeholder={t('categoryRules.patternPlaceholder')}
            value={newRule.pattern}
            onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <input
            type="text"
            placeholder={t('categoryRules.categoryPlaceholder')}
            value={newRule.category}
            onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={handleAddRule}
            className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 w-full sm:w-auto"
          >
            {t('categoryRules.addRule')}
          </button>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            {t('categoryRules.filterByCategory')}
          </label>
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">{t('categoryRules.allCategories')}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {(() => {
          const filteredRules = ruleFilter
            ? Object.fromEntries(Object.entries(categoryRules).filter(([_, cat]) => cat === ruleFilter))
            : categoryRules;

          return (
            <>
              {selectedRules.length > 0 && (
                <div className={`${cardClasses.info} mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2`}>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {t('categoryRules.selectedRules', { count: selectedRules.length, suffix: selectedRules.length > 1 ? 's' : '' })}
                  </span>
                  <div className="flex gap-2 flex-wrap w-full sm:w-auto">
                    <button
                      onClick={handleBatchRuleEdit}
                      className="flex items-center justify-center gap-1 px-3 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 text-sm w-full sm:w-auto"
                    >
                      <Edit2 size={14} />
                      {t('categoryRules.changeCategory')}
                    </button>
                    <button
                      onClick={handleBatchRuleDelete}
                      className="flex items-center justify-center gap-1 px-3 py-1 bg-red-500 dark:bg-red-600 text-white rounded hover:bg-red-600 dark:hover:bg-red-700 text-sm w-full sm:w-auto"
                    >
                      <Trash2 size={14} />
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )}

              <div className="md:hidden space-y-2 max-h-80 overflow-y-auto">
                {Object.entries(filteredRules).map(([pattern, category]) => (
                  <div key={pattern} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRules.includes(pattern)}
                          onChange={() => toggleSelectRule(pattern)}
                          className="cursor-pointer mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="font-mono text-xs break-all dark:text-gray-300">{pattern}</div>
                          <span className={`inline-block mt-2 ${badgeClasses.default}`}>
                            {category}
                          </span>
                        </div>
                      </label>
                      <button
                        onClick={() => handleDeleteRule(pattern)}
                        className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded flex-shrink-0"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block max-h-60 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="text-center py-2 px-2 dark:text-white w-10">
                        <input
                          type="checkbox"
                          checked={selectedRules.length === Object.keys(filteredRules).length && Object.keys(filteredRules).length > 0}
                          onChange={() => toggleSelectAllRules(filteredRules)}
                          className="cursor-pointer"
                        />
                      </th>
                      <th className="text-left p-2 dark:text-white">{t('categoryRules.pattern')}</th>
                      <th className="text-left p-2 dark:text-white">{t('common.category')}</th>
                      <th className="text-center p-2 dark:text-white">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(filteredRules).map(([pattern, category]) => (
                      <tr key={pattern} className="border-t border-gray-200 dark:border-gray-700">
                        <td className="text-center py-2 px-2">
                          <input
                            type="checkbox"
                            checked={selectedRules.includes(pattern)}
                            onChange={() => toggleSelectRule(pattern)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="p-2 font-mono text-xs dark:text-gray-300">{pattern}</td>
                        <td className="p-2">
                          <span className={badgeClasses.default}>
                            {category}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => handleDeleteRule(pattern)}
                            className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          );
        })()}
      </div>

      {showBatchRuleEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 dark:text-white">
              {t('categoryRules.batchTitle', { count: selectedRules.length })}
            </h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('categoryRules.newCategory')}
              </label>
              <input
                type="text"
                value={batchRuleCategory}
                onChange={(e) => setBatchRuleCategory(e.target.value)}
                placeholder={t('categoryRules.enterCategoryName')}
                className={formClasses.input}
                list="batch-rule-categories-list"
              />
              <datalist id="batch-rule-categories-list">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowBatchRuleEdit(false);
                  setBatchRuleCategory('');
                }}
                className={buttonClasses.secondary}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={applyBatchRuleEdit}
                disabled={!batchRuleCategory.trim()}
                className={`${buttonClasses.primary} disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {t('categoryRules.applyToRules', { count: selectedRules.length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
