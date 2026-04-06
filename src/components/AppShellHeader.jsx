import React from 'react';
import { Download, Edit2, LogOut, Moon, Plus, Save, Settings, Sun, Upload, X } from 'lucide-react';
import { buttonClasses, cardClasses, formClasses, textClasses } from '../utils/tailwindClasses';

export function AppShellHeader({
  accounts,
  accountsData,
  activeAccountId,
  activeMainTab,
  categories,
  categoryRules,
  darkMode,
  deleteAccount,
  exportCSV,
  handleFileUpload,
  handleLogout,
  importErrors,
  isAddingAccount,
  newAccountName,
  setActiveMainTab,
  setDarkMode,
  setLanguage,
  setImportErrors,
  setIsAddingAccount,
  setNewAccountName,
  setShowCategoryManager,
  setShowRules,
  setShowSettingsMenu,
  settingsMenuRef,
  showCategoryManager,
  showRules,
  showSettingsMenu,
  switchAccount,
  transactions,
  userEmail,
  addAccount,
  language,
  t
}) {
  const navButtonClasses = (isActive) => `px-4 py-2 rounded-lg font-medium transition whitespace-nowrap text-sm sm:text-base ${
    isActive
      ? 'bg-blue-500 dark:bg-blue-600 text-white'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
  }`;

  const accountTabClasses = (isActive) => `px-4 py-2 rounded-t-lg font-medium transition whitespace-nowrap ${
    isActive
      ? 'bg-blue-500 dark:bg-blue-600 text-white'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
  }`;

  return (
    <div className={cardClasses.default}>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-800 dark:text-white">{t('login.title')}</h1>
          <p className={`text-sm mt-1 truncate max-w-[200px] sm:max-w-none ${textClasses.muted}`}>{t('header.loggedInAs', { email: userEmail })}</p>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="flex items-center gap-2 px-2 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            title={t('login.toggleDarkMode')}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            <span className="hidden sm:inline">{darkMode ? t('header.light') : t('header.dark')}</span>
          </button>
          <div ref={settingsMenuRef} className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="flex items-center gap-2 px-2 sm:px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              title={t('header.openSettings')}
            >
              <Settings size={20} />
              <span className="hidden sm:inline">{t('header.settings')}</span>
            </button>

            {showSettingsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 overflow-hidden">
                <div className="p-2 space-y-1">
                  <label className="flex items-center gap-3 w-full px-3 py-2 rounded-lg cursor-pointer text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                    <Upload size={18} />
                    <span>{t('header.importCsv')}</span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        handleFileUpload(e);
                        setShowSettingsMenu(false);
                      }}
                      className="hidden"
                    />
                  </label>

                  <button
                    onClick={() => {
                      exportCSV();
                      setShowSettingsMenu(false);
                    }}
                    disabled={transactions.length === 0}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={18} />
                    <span>{t('header.exportCsv')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowRules(!showRules);
                      setShowSettingsMenu(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <Settings size={18} />
                    <span>{t('header.categoryRules', { count: Object.keys(categoryRules).length })}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowCategoryManager(!showCategoryManager);
                      setShowSettingsMenu(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <Edit2 size={18} />
                    <span>{t('header.manageCategories', { count: categories.length })}</span>
                  </button>

                  <button
                    onClick={() => {
                      setLanguage(language === 'en' ? 'fr' : 'en');
                      setShowSettingsMenu(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  >
                    <Settings size={18} />
                    <span>{t('common.language')}: {language === 'en' ? t('common.english') : t('common.french')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={handleLogout} className={`flex items-center gap-2 ${buttonClasses.danger}`}>
            <LogOut size={20} />
            <span className="hidden sm:inline">{t('header.logout')}</span>
          </button>
        </div>
      </div>

      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-3">
          {accounts.map((account) => (
            <React.Fragment key={account.id}>
              <div className="group relative">
                <button
                  onClick={() => {
                    switchAccount(account.id);
                    if (activeMainTab === 'savings') {
                      setActiveMainTab('dashboard');
                    }
                  }}
                  className={accountTabClasses(activeAccountId === account.id && activeMainTab !== 'savings')}
                >
                  {account.name}
                  {accountsData[account.id] && (
                    <span className="ml-2 text-xs opacity-75">
                      ({accountsData[account.id].transactions?.length || 0})
                    </span>
                  )}
                </button>
                {account.id !== 'default' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAccount(account.id);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 dark:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                    title={t('header.deleteAccountTitle')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {account.id === 'default' && (
                <button onClick={() => setActiveMainTab('savings')} className={navButtonClasses(activeMainTab === 'savings')}>
                  {t('header.savings')}
                </button>
              )}
            </React.Fragment>
          ))}

          {!isAddingAccount ? (
            <button
              onClick={() => setIsAddingAccount(true)}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-t-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition flex items-center gap-1 shrink-0"
            >
              <Plus size={16} />
              {t('header.newAccount')}
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addAccount()}
                placeholder={t('header.accountName')}
                className={`${formClasses.input} ${textClasses.placeholder} w-40 sm:w-56`}
                autoFocus
              />
              <button onClick={addAccount} className="p-2 bg-green-500 dark:bg-green-600 text-white rounded hover:bg-green-600 dark:hover:bg-green-700 shrink-0">
                <Save size={16} />
              </button>
              <button
                onClick={() => {
                  setIsAddingAccount(false);
                  setNewAccountName('');
                }}
                className="p-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded hover:bg-gray-400 dark:hover:bg-gray-500 shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {activeMainTab !== 'savings' && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button onClick={() => setActiveMainTab('dashboard')} className={navButtonClasses(activeMainTab === 'dashboard')}>{t('header.dashboard')}</button>
          <button onClick={() => setActiveMainTab('graphs')} className={navButtonClasses(activeMainTab === 'graphs')}>{t('header.transactions')}</button>
          <button onClick={() => setActiveMainTab('joint')} className={navButtonClasses(activeMainTab === 'joint')}>{t('header.jointSplit')}</button>
        </div>
      )}

      {importErrors && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                {t('header.importWarning', { count: importErrors.count, suffix: importErrors.count > 1 ? 's' : '' })}
              </h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                {t('header.importWarningDesc')}
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-mono">
                {t('header.lines', { lines: importErrors.lines.slice(0, 20).join(', ') })}
                {importErrors.lines.length > 20 && t('header.andMore', { count: importErrors.lines.length - 20 })}
              </p>
            </div>
            <button
              onClick={() => setImportErrors(null)}
              className="text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-800 p-1 rounded"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}