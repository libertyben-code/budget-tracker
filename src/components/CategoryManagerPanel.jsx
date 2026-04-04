import React from 'react';
import { Edit2, Trash2, X } from 'lucide-react';
import { badgeClasses, buttonClasses, formClasses } from '../utils/tailwindClasses';

export function CategoryManagerPanel({
  cancelDeleteCategory,
  categories,
  confirmDeleteCategory,
  deletingCategory,
  editingCategory,
  handleDeleteCategory,
  handleRenameCategory,
  isCreatingNewCategory,
  newCategoryName,
  replacementCategory,
  setEditingCategory,
  setIsCreatingNewCategory,
  setNewCategoryName,
  setReplacementCategory,
  setShowCategoryManager,
  transactions,
}) {
  return (
    <>
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold dark:text-white">Category Manager</h3>
          <button
            onClick={() => setShowCategoryManager(false)}
            className="text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Rename categories to update all transactions using that category.
        </p>

        <div className="md:hidden space-y-2 max-h-80 overflow-y-auto">
          {categories.map(category => {
            const count = transactions.filter(t => t.category === category).length;
            return (
              <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {editingCategory === category ? (
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameCategory(category, newCategoryName);
                          }
                        }}
                        onBlur={() => handleRenameCategory(category, newCategoryName)}
                        className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoFocus
                      />
                    ) : (
                      <span className={`inline-block break-words max-w-full ${badgeClasses.default}`}>
                        {category}
                      </span>
                    )}
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                      {count} transaction{count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setNewCategoryName(category);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 p-1 rounded"
                      title="Rename category"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(category)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded"
                      title="Delete category"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hidden md:block max-h-60 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
              <tr>
                <th className="text-left p-2 dark:text-white">Category Name</th>
                <th className="text-center p-2 dark:text-white">Count</th>
                <th className="text-center p-2 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => {
                const count = transactions.filter(t => t.category === category).length;
                return (
                  <tr key={category} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-2">
                      {editingCategory === category ? (
                        <input
                          type="text"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleRenameCategory(category, newCategoryName);
                            }
                          }}
                          onBlur={() => handleRenameCategory(category, newCategoryName)}
                          className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <span className={badgeClasses.default}>
                          {category}
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center text-gray-600 dark:text-gray-400">{count}</td>
                    <td className="p-2 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setNewCategoryName(category);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 p-1 rounded"
                          title="Rename category"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category)}
                          className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 p-1 rounded"
                          title="Delete category"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {deletingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 dark:text-white">
              Delete Category: {deletingCategory}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              There are {transactions.filter(t => t.category === deletingCategory).length} transaction(s) with this category.
            </p>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              What would you like to do with these transactions?
            </p>

            <div className="mb-4">
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!isCreatingNewCategory}
                  onChange={() => {
                    setIsCreatingNewCategory(false);
                    setReplacementCategory('Uncategorized');
                  }}
                  className="cursor-pointer"
                />
                <span className="text-gray-700 dark:text-gray-300">Set to Uncategorized</span>
              </label>

              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="radio"
                  checked={isCreatingNewCategory}
                  onChange={() => {
                    setIsCreatingNewCategory(true);
                    setReplacementCategory('');
                  }}
                  className="cursor-pointer"
                />
                <span className="text-gray-700 dark:text-gray-300">Enter a new category</span>
              </label>

              {isCreatingNewCategory && (
                <div className="ml-6 mt-2">
                  <input
                    type="text"
                    value={replacementCategory}
                    onChange={(e) => setReplacementCategory(e.target.value)}
                    placeholder="New category name"
                    className={formClasses.input}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={cancelDeleteCategory}
                className={buttonClasses.secondary}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteCategory}
                disabled={isCreatingNewCategory && !replacementCategory.trim()}
                className={`${buttonClasses.danger} disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
