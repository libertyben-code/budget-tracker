# Budget Tracker App

## Overview

Budget Tracker is a React application for managing personal finances with Firebase-backed authentication and persistence. It supports multiple accounts, automatic transaction categorization, savings tracking, a joint split planner, responsive charts, batch transaction operations, and dark mode.

The codebase has been refactored so that:

- `App.js` acts as the orchestration layer.
- Reducer-backed state lives in `src/hooks/useAppState.js`.
- Major UI sections are split into focused components.

## Features

### Authentication

- Firebase email/password authentication.
- Persistent login sessions.
- User-specific saved data.

### Multi-Account Support

- Multiple budget accounts per user.
- Independent transactions and savings data per account.
- Shared category rules across all user accounts.

### Transaction Management

- CSV import from bank statements.
- CSV export from the settings menu.
- Manual add, edit, and delete flows.
- Sortable transaction views.
- Batch edit and batch delete support.

### Categorization

- Rule-based automatic categorization.
- Rule learning from existing categorized transactions.
- Manual rule creation and deletion.
- Category rename and delete workflows.

### Dashboard and Analysis

- Balance and spending summaries.
- Spending by category chart.
- Spending by category per month chart.
- Monthly overview chart.
- Combined text, category, and date filtering.

### Joint Split

- Salary-based contribution planning for two people.
- Uses current-month transactions where the category contains `bill`.
- Shows the bill total used as the planning reference.

### Savings

- Separate savings account management.
- Deposit and withdrawal history per savings account.
- Savings distribution chart.
- Edit and delete flows for savings accounts.

### UI

- Dark mode with persisted preference.
- Responsive layouts across tabs.
- Shared Tailwind class constants for repeated UI patterns.

## Setup

### Environment Variables

Create a `.env` file with your Firebase configuration:

```env
REACT_APP_FIREBASE_API_KEY=your_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

Do not commit `.env`.

### Install and Run

```bash
npm install
npm start
```

### Production Build

```bash
npm run build
```

## Current Architecture

### Main Files

- `src/App.js`: app orchestration, derived data, Firebase sync, and tab composition.
- `src/hooks/useAppState.js`: reducer-backed application state and action types.
- `src/utils/tailwindClasses.js`: shared Tailwind class constants.
- `src/utils/dates.js`: date formatting and filtering helpers.
- `src/utils/categories.js`: categorization helpers and rule learning.
- `src/utils/savings.js`: savings formatting helpers.

### Extracted UI Components

- `src/components/LoginScreen.jsx`
- `src/components/AppShellHeader.jsx`
- `src/components/JointSplitSection.jsx`
- `src/components/SavingsSection.jsx`
- `src/components/TransactionTable.jsx`

### State Management

The app uses a reducer-backed state model via `useAppState` for the core domains:

- Authentication.
- Accounts.
- Transactions.
- Filters and sorting.
- Category rules and category management.
- Savings data.
- UI preferences such as dark mode.

Example usage:

```javascript
const [appState, dispatch] = useAppState();

dispatch({ type: ACTIONS.SET_TRANSACTIONS, payload: parsedTransactions });
dispatch({ type: ACTIONS.SET_DARK_MODE, payload: true });
dispatch({ type: ACTIONS.SET_ACTIVE_ACCOUNT_ID, payload: 'default' });
```

Small UI-only values can still remain in local `useState` when they are not part of the shared app domain.

## Data Flow

### App Initialization

1. Firebase authentication state is resolved.
2. If a user is signed in, user data is loaded from Firestore.
3. Account data, transactions, savings data, and rules are populated.

### CSV Import

1. The CSV file is read line by line.
2. Valid rows are mapped into transaction objects.
3. Pending or reverted rows are skipped.
4. Categorization rules are applied.
5. Learned category patterns are updated from imported rows.

### Transaction Changes

1. The reducer-backed state is updated.
2. Related category rules can be updated.
3. Firebase auto-save persists the account state.

### Filtering

1. Filter state changes.
2. `useMemo` recalculates filtered datasets.
3. Stats, charts, and table output update automatically.

## Core Data Shapes

### Transaction

```javascript
{
  id: 1699123456789,
  date: '31/10/24',
  description: 'Amazon Purchase',
  category: 'Shopping',
  amount: -45.99,
  type: 'Card Payment',
  state: 'COMPLETED'
}
```

### Category Rules

```javascript
{
  amazon: 'Shopping',
  starbucks: 'Food & Drink',
  salary: 'Income'
}
```

Category rules are global at the user level and shared across accounts.

### Savings Accounts

```javascript
[
  {
    id: 'savings_1712250000000',
    name: 'Emergency Fund',
    balance: 1500.0
  },
  {
    id: 'savings_1712250003456',
    name: 'Vacation Fund',
    balance: 750.5
  }
]
```

### Savings Transaction History

```javascript
{
  savings_1712250000000: [
    {
      id: 'tx_1712250001000',
      date: '04/04/26',
      type: 'deposit',
      amount: 500.0,
      timestamp: 1712250001000
    }
  ]
}
```

## Firestore Structure

```text
users/
  {userId}/
    accounts
    accountsData
      {accountId}
        transactions
        savingsAccounts
        savingsTransactionHistory
        salaryInputs
        jointTargetAmount
    categoryRules
    activeAccountId
    lastUpdated
```

## Performance Notes

Derived values are memoized where they are expensive or reused:

- Filtered transactions.
- Categories.
- Months and years.
- Savings totals and chart data.
- Category chart data.
- Monthly overview data.
- Summary stats.
- Joint split derived totals.

This keeps filtering and chart rendering responsive as the dataset grows.

## Development Notes

- Build verification command: `npm run build`.
- Firebase uses the modular v9 SDK.
- Shared styling constants live in `src/utils/tailwindClasses.js`.
- `App.js` is intentionally moving toward orchestration-only responsibilities.

## Next Refactor Candidates

- Batch edit modal.
