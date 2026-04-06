import React from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

function formatMonth(value, monthNames) {
  const [year, month] = value.split('-');
  return `${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`;
}

export function DashboardCharts({
  categories,
  categoryByMonthData,
  categoryChartMode,
  categoryData,
  colors,
  darkMode,
  filter,
  isMobileChart,
  monthlyData,
  setCategoryChartMode,
  setFilter,
  setShowCategoryDropdown,
  showCategoryDropdown,
  t,
  language,
}) {
  const monthNames = language === 'fr'
    ? ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
    : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <>
      {/* Spending by Category (Pie) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <div className="relative w-full mb-4">
          <button
            onClick={() => setShowCategoryDropdown(prev => !prev)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-600 transition flex items-center justify-between"
          >
            <span>{filter.categories.length === 0 ? t('dashboard.allCategories') : t('dashboard.selectedCount', { count: filter.categories.length })}</span>
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
                <span className="text-sm dark:text-white">{t('dashboard.allCategories')}</span>
              </label>
              {categories.map(cat => (
                <label key={cat} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.categories.includes(cat)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilter({ ...filter, categories: [...filter.categories, cat] });
                      } else {
                        setFilter({ ...filter, categories: filter.categories.filter(c => c !== cat) });
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

        <h2 className="text-xl font-bold mb-4 dark:text-white">{t('dashboard.spendingByCategory')}</h2>
        <ResponsiveContainer width="100%" height={isMobileChart ? 320 : 380}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={!isMobileChart}
              label={isMobileChart ? false : ({ name }) => name}
              outerRadius={isMobileChart ? 90 : 120}
              fill="#8884d8"
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {categoryData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name, item) => {
                const percent = (item && typeof item.percent === 'number') ? item.percent * 100 : 0;
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

      {/* Spending by Category per Month (Bar) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-xl font-bold dark:text-white">{t('dashboard.spendingByCategoryMonth')}</h2>
          <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden self-start sm:self-auto">
            <button
              onClick={() => setCategoryChartMode('stacked')}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                categoryChartMode === 'stacked'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {t('dashboard.stacked')}
            </button>
            <button
              onClick={() => setCategoryChartMode('grouped')}
              className={`px-3 py-1.5 text-sm font-medium transition border-l border-gray-300 dark:border-gray-600 ${
                categoryChartMode === 'grouped'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {t('dashboard.grouped')}
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('dashboard.trends')}</p>
        <div className="overflow-x-auto">
          <div
            style={{
              minWidth: `${Math.max(640, categoryByMonthData.length * (isMobileChart ? 140 : 120))}px`,
              height: isMobileChart ? 360 : 440,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryByMonthData}
                margin={{ top: 20, right: 20, left: 10, bottom: 65 }}
                barCategoryGap={categoryChartMode === 'stacked' ? '8%' : (categoryByMonthData.length === 1 ? '0%' : '3%')}
                barSize={categoryChartMode === 'stacked' ? undefined : (categoryByMonthData.length === 1 ? (isMobileChart ? 38 : 78) : (isMobileChart ? 26 : 46))}
                barGap={0}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e0e0e0'} />
                <XAxis
                  dataKey="month"
                  angle={-35}
                  textAnchor="end"
                  height={70}
                  tick={{ fontSize: 12, fill: darkMode ? '#e5e7eb' : '#374151' }}
                  tickFormatter={(value) => formatMonth(value, monthNames)}
                />
                <YAxis
                  width={64}
                  tick={{ fontSize: 12, fill: darkMode ? '#e5e7eb' : '#374151' }}
                  tickFormatter={(value) => `€${value}`}
                />
                <Tooltip
                  formatter={(value, name) => [`€${value.toFixed(2)}`, name]}
                  contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {categories.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    fill={colors[index % colors.length]}
                    stackId={categoryChartMode === 'stacked' ? 'total' : undefined}
                    animationBegin={0}
                    animationDuration={800}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Overview (Line) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold dark:text-white">{t('dashboard.monthlyOverview')}</h2>
        </div>
        <ResponsiveContainer width="100%" height={isMobileChart ? 320 : 380}>
          <LineChart data={monthlyData} margin={{ top: 20, right: isMobileChart ? 10 : 30, left: isMobileChart ? 0 : 20, bottom: 20 }}>
            <defs>
              <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e0e0e0'} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: isMobileChart ? 10 : 12, fill: darkMode ? '#e5e7eb' : '#374151' }}
              tickFormatter={(value) => formatMonth(value, monthNames)}
            />
            <YAxis
              width={isMobileChart ? 42 : 60}
              tick={{ fontSize: isMobileChart ? 10 : 12, fill: darkMode ? '#e5e7eb' : '#374151' }}
              tickFormatter={(value) => `€${value}`}
            />
            <Tooltip
              formatter={(value, name) => [`€${value.toFixed(2)}`, name === 'income' ? t('dashboard.income') : t('dashboard.spending')]}
              contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px' }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px', fontSize: isMobileChart ? '11px' : '12px' }}
              iconType="line"
            />
            <Line
              type="monotone"
              dataKey="spending"
              stroke="#ef4444"
              strokeWidth={3}
              dot={{ fill: '#ef4444', r: 4 }}
              activeDot={{ r: 6 }}
              animationBegin={0}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
