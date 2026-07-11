# Budget Tracker — Maintainer Guide

## Stack

- **Frontend**: React 19 (Create React App / `react-scripts`) + Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore) — no custom server
- **Database**: Firestore (per-user documents, see Firestore structure below)
- **Key libraries**: `recharts` (charts), `lucide-react` (icons)

## Repository layout

```
budget-tracker/
├── public/
├── src/
│   ├── components/
│   │   ├── AppShellHeader.jsx
│   │   ├── CategoryManagerPanel.jsx
│   │   ├── CategoryRulesPanel.jsx
│   │   ├── DashboardCharts.jsx
│   │   ├── JointSplitSection.jsx
│   │   ├── LoginScreen.jsx
│   │   ├── SavingsSection.jsx
│   │   └── TransactionTable.jsx
│   ├── hooks/
│   │   └── useAppState.js   — reducer-backed app state + ACTIONS
│   ├── utils/
│   │   ├── categories.js    — categorization + rule learning
│   │   ├── dates.js         — date formatting/filtering
│   │   ├── i18n.js          — EN/FR strings
│   │   ├── savings.js       — savings formatting helpers
│   │   └── tailwindClasses.js — shared Tailwind class constants
│   └── App.js               — orchestration, derived data, Firebase sync
├── firebase.json            — Firebase Hosting config
├── .firebaserc              — Firebase project alias (`boo2-budget`)
├── .env.example              — Firebase config template
└── docs/
    ├── WORKFLOW.md     — how we work together
    ├── MAINTAINER.md   — this file (architecture + gotchas)
    ├── BACKLOG.md      — pending items
    ├── FEEDBACK.md     — items pending user test/confirmation
    ├── DONE.md         — completed archive
    └── Bugs.md         — confirmed bugs
```

## Branch strategy

| Branch | Purpose |
| --- | --- |
| `master` | Stable, smoke-tested releases |
| `feature/*` | Feature branches — merge to `master` after smoke test |

All work happens on feature branches. Merge to `master` only after the smoke test below.

## Dev setup

```bash
# Prerequisites (one-time)
# - Node.js + npm
# - A Firebase project with Email/Password Auth and Firestore enabled

# Install dependencies
npm install

# Configure Firebase
cp .env.example .env
# fill in REACT_APP_FIREBASE_* values from the Firebase console

# Run in development mode
npm start

# Build for production
npm run build
```

## Architecture

### State model

App state is reducer-backed via `src/hooks/useAppState.js` (`ACTIONS` constants + a single reducer). `App.js` owns orchestration: resolving Firebase auth, loading Firestore data on sign-in, deriving memoized values (filtered transactions, categories, chart data, stats), and composing the tab UI. Small UI-only values (e.g. transient modal open state) can stay in local `useState` instead of the shared reducer.

### Key modules / files

- `src/App.js` — app orchestration, derived/memoized data, Firebase sync, tab composition.
- `src/hooks/useAppState.js` — reducer-backed application state and action types.
- `src/utils/categories.js` — rule-based categorization and rule learning from existing categorized transactions.
- `src/utils/dates.js` — date formatting and filtering helpers.
- `src/utils/savings.js` — savings formatting helpers.
- `src/utils/i18n.js` — English/French UI strings.
- `src/utils/tailwindClasses.js` — shared Tailwind class constants for repeated UI patterns.
- `src/components/*.jsx` — extracted, focused UI sections (login, header, transactions table, category panels, dashboard charts, joint split, savings).

### Firestore structure

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
    categoryRules      — shared across all accounts for the user
    activeAccountId
    lastUpdated
```

See `README.md` for full data shapes (Transaction, Category Rules, Savings Accounts, Savings Transaction History) and data-flow details (CSV import, filtering, auto-save).

## Known gotchas

<!-- Add dated entries here as non-obvious bugs, constraints, or workarounds are discovered. -->

## Building for distribution

```bash
npm run build
```

Output:

- Static production bundle in `build/`, deployed via Firebase Hosting (`firebase deploy`, project alias `boo2-budget` in `.firebaserc`). `firebase.json` rewrites all routes to `/index.html` (SPA routing).

## Smoke test checklist

1. Sign in with email/password; confirm the session persists across a reload.
2. Add a manual transaction on an account; confirm it saves and appears in the transaction table.
3. Import a CSV; confirm rows parse, dedupe against existing transactions, and auto-categorize via rules.
4. Create/rename/delete a category rule; confirm it applies to matching transactions.
5. Check dashboard charts (spending by category, monthly overview) update correctly when filters change.
6. Add a savings account, record a deposit and a withdrawal; confirm balance and chart update.
7. Toggle dark mode and the EN/FR language switch; confirm both persist across reload.
8. Run `npm run build` and confirm it completes without errors.
