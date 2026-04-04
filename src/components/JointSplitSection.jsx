import React from 'react';

export function JointSplitSection({
  currentMonthBillTransactions,
  currentMonthBillsTotal,
  currentMonthNonBillCount,
  formatDateToDDMMYY,
  jointTargetAmount,
  person1Contribution,
  person2Contribution,
  salaryInputs,
  setJointTargetAmount,
  setSalaryInputs,
  totalSalaries,
  totalToSplit
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Joint Account Split</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Automatically includes current-month transactions where category contains "bill".
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600 dark:text-gray-400">Target Joint Deposit</div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">EUR {totalToSplit.toFixed(2)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Bills reference: EUR {currentMonthBillsTotal.toFixed(2)}</div>
        </div>
      </div>

      <div className="mb-4 max-w-sm">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total to Put in Joint Account</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={jointTargetAmount}
          onChange={(e) => setJointTargetAmount(e.target.value)}
          placeholder="2100"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary Person 1</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={salaryInputs.person1}
            onChange={(e) => setSalaryInputs({ ...salaryInputs, person1: e.target.value })}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary Person 2</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={salaryInputs.person2}
            onChange={(e) => setSalaryInputs({ ...salaryInputs, person2: e.target.value })}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {totalSalaries > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-gray-600 dark:text-gray-300">Person 1 Contribution</div>
            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">EUR {person1Contribution.toFixed(2)}</div>
          </div>
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800">
            <div className="text-sm text-gray-600 dark:text-gray-300">Person 2 Contribution</div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">EUR {person2Contribution.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
          Enter both salaries (or at least one) to calculate each person&apos;s pro-rate contribution.
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
          Included Transactions ({currentMonthBillTransactions.length})
        </h3>
        {currentMonthBillTransactions.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            No transactions found for this month with a category containing "bill".
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-2">
              {currentMonthBillTransactions.map((transaction) => (
                <div key={transaction.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateToDDMMYY(transaction.date)}</span>
                    <span className="font-semibold text-sm text-red-600 dark:text-red-400">
                      EUR {Math.abs(transaction.amount || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm dark:text-gray-300 truncate">{transaction.description}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs flex-shrink-0 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {transaction.category}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-2 dark:text-gray-300">Date</th>
                    <th className="text-left py-2 px-2 dark:text-gray-300">Description</th>
                    <th className="text-left py-2 px-2 dark:text-gray-300">Category</th>
                    <th className="text-right py-2 px-2 dark:text-gray-300">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthBillTransactions.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="py-2 px-2 dark:text-gray-300">{formatDateToDDMMYY(transaction.date)}</td>
                      <td className="py-2 px-2 dark:text-gray-300">{transaction.description}</td>
                      <td className="py-2 px-2 dark:text-gray-300">{transaction.category}</td>
                      <td className="py-2 px-2 text-right font-semibold text-red-600 dark:text-red-400">
                        EUR {Math.abs(transaction.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {currentMonthNonBillCount > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          {currentMonthNonBillCount} other current-month transaction(s) are not included because their category does not contain "bill".
        </p>
      )}
    </div>
  );
}