import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { buttonClasses, formClasses } from '../utils/tailwindClasses';

export function LoginScreen({
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  authError,
  loading,
  handleAuth,
  darkMode,
  setDarkMode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-md relative">
        {/* Dark Mode Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          title="Toggle dark mode"
        >
          {darkMode ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-600" />}
        </button>
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Budget Tracker</h1>
          <p className="text-gray-600 dark:text-gray-300">Sign in to access your budget</p>
        </div>
        
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              authMode === 'login' 
                ? 'bg-blue-500 dark:bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 rounded-lg font-semibold transition ${
              authMode === 'signup' 
                ? 'bg-blue-500 dark:bg-blue-600 text-white' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={formClasses.inputLg}
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={formClasses.inputLg}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          {authError && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
              {authError}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className={`${buttonClasses.primaryLg} w-full font-semibold disabled:bg-gray-400 dark:disabled:bg-gray-600`}
          >
            {loading ? 'Processing...' : authMode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
