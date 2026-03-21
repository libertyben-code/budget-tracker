# Budget Tracker App - Technical Documentation

## Overview

This Budget Tracker is a React-based web application that helps users manage their personal finances with automatic transaction categorization, advanced data visualization, multi-account support, and cloud synchronization through Firebase.

## Setup Instructions

### Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase configuration values in `.env`:
   ```
   REACT_APP_FIREBASE_API_KEY=your_api_key_here
   REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your_project_id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   REACT_APP_FIREBASE_APP_ID=your_app_id
   ```

3. **Never commit `.env` to Git** - it's already in `.gitignore`

### Installation

```bash
npm install
npm start
```

## Core Features

### 1. **User Authentication**
- Firebase Authentication integration for secure user management
- Email/password login (administrator-managed accounts)
- Persistent login sessions across browser refreshes
- User-specific data isolation
- Automatic save before logout

### 2. **Multi-Account Management**
- Create and manage multiple budget accounts (e.g., Personal, Business, Joint)
- Switch seamlessly between different accounts
- Each account has independent:
  - Transaction history
  - Category rules
  - Savings allocations
- Delete accounts (with protection for default account)
- Account-specific data synchronization

### 3. **Transaction Management**
- **CSV Import**: Upload bank statement CSV files for automatic transaction parsing
- **Manual Entry**: Add transactions one at a time via the UI
- **CRUD Operations**: Edit, delete, and view all transactions in a table format
- **CSV Export**: Download your transaction data as a CSV file
- **Auto-filtering**: Excludes reverted and pending transactions from imported data
- **Real-time Updates**: Changes instantly reflected across all visualizations

### 4. **Intelligent Auto-Categorization**
- Machine learning-inspired pattern matching system
- **Automatic Learning**: When you manually categorize a transaction, the app learns the pattern
- **Rule-Based System**: Maintains a dictionary of description patterns → categories
- **Manual Rules**: Add custom categorization rules through the settings panel
- **Bulk Re-categorization**: Apply rules to all uncategorized transactions with one click
- Category rules are account-specific

### 5. **Savings Management**
- **Savings Allocation**: Break down savings deposits by purpose (e.g., Emergency Fund, Vacation, House)
- **Visual Breakdown**: Dedicated pie chart showing allocation by purpose
- **Per-Transaction Tracking**: Allocate specific amounts from each savings transaction
- **Unallocated Tracking**: Automatically tracks unallocated savings amounts
- Account-specific savings goals and allocations

### 6. **Advanced Data Visualization**
Four interactive charts using Recharts library:
- **Spending by Category (Pie Chart)**: Visual breakdown of spending by category with percentages
- **Top Spending Categories (Bar Chart)**: Top spending categories ranked by amount
- **Monthly Overview (Line Chart)**: Monthly spending vs. income trends over time
- **Savings Breakdown (Pie Chart)**: Visual breakdown of savings allocations by purpose
- Toggle charts visibility on/off
- Responsive design for all screen sizes

### 7. **Advanced Filtering & Search**
Multiple filter options working in combination:
- **Category Filter**: Multi-select category filtering
- **Description Search**: Search transactions by description (case-insensitive)
- **Category Search**: Search by category name
- **Date Filters**:
  - Filter by specific year
  - Filter by specific month
  - Filter by custom date range
  - View all transactions (no date filter)
- Real-time statistics that update based on filtered data

### 8. **Real-time Statistics**
Dynamic statistics display that updates based on filters:
- **Total Balance**: Income minus spending (color-coded: green for positive, red for negative)
- **Total Spending**: Sum of all expenses
- **Total Income**: Sum of all income
- Statistics reflect currently applied filters

### 9. **Cloud Synchronization**
- All data automatically synced to Firebase Firestore
- Auto-save triggers when transactions, category rules, or accounts change
- Data persists across devices when logged in with the same account
- Automatic data loading on login
- Multi-account data structure with efficient synchronization
- Last updated timestamp tracking

## Technical Architecture

### State Management

The app uses React hooks for state management:

```javascript
// Authentication State
const [user, setUser] = useState(null);           // Current logged-in user
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [authError, setAuthError] = useState('');
const [loading, setLoading] = useState(false);
const [initializing, setInitializing] = useState(true);

// Multi-Account State
const [accounts, setAccounts] = useState([{ id: 'default', name: 'Main Account' }]);
const [activeAccountId, setActiveAccountId] = useState('default');
const [isAddingAccount, setIsAddingAccount] = useState(false);
const [newAccountName, setNewAccountName] = useState('');
const [accountsData, setAccountsData] = useState({
  'default': { transactions: [], categoryRules: {}, savingsAllocations: {} }
});

// Transaction State
const [transactions, setTransactions] = useState([]); // Current account transactions
const [categoryRules, setCategoryRules] = useState({}); // Current account rules
const [editingId, setEditingId] = useState(null);     // Currently editing transaction
const [editForm, setEditForm] = useState({});         // Form data for editing

// Savings State
const [showSavingsModal, setShowSavingsModal] = useState(false);
const [selectedSavingsTransaction, setSelectedSavingsTransaction] = useState(null);
const [savingsAllocations, setSavingsAllocations] = useState({});
const [newAllocation, setNewAllocation] = useState({ purpose: '', amount: 0 });

// UI State
const [filter, setFilter] = useState({ 
  categories: [],          // Multi-select categories
  description: '',         // Search by description
  categorySearch: '',      // Search by category name
  dateFilterType: 'all',   // 'all', 'year', 'month', 'dateRange'
  year: '',
  month: '',
  startDate: '',
  endDate: ''
});
const [showRules, setShowRules] = useState(false);
const [newRule, setNewRule] = useState({ pattern: '', category: '' });
const [showGraphs, setShowGraphs] = useState(true);
```

### Data Flow

1. **On App Load**:
   - Firebase checks authentication state
   - If authenticated, loads user data from Firestore
   - Populates transactions and category rules

2. **On CSV Import**:
   - File is read and parsed line by line
   - Each row is mapped to transaction object
   - Auto-categorization runs on each transaction
   - Learns new patterns from imported categories
   - Updates state with new transactions

3. **On Manual Edit/Add**:
   - Transaction updated in local state
   - If category is set, creates/updates a rule
   - Auto-save triggered to Firebase

4. **On Filter Change**:
   - `useMemo` recalculates filtered transactions
   - Charts and stats automatically update

### Key Algorithms

#### Auto-Categorization Algorithm
```javascript
const autoCategorizeTrans = (description) => {
  const desc = description.toLowerCase();
  for (const [pattern, category] of Object.entries(categoryRules)) {
    if (desc.includes(pattern.toLowerCase())) {
      return category;
    }
  }
  return 'Uncategorized';
};
```
- Simple pattern matching
- Case-insensitive substring search
- First match wins
- Falls back to "Uncategorized"

#### Learning Algorithm
```javascript
const learnCategoryFromTransactions = (transactions) => {
  const newRules = { ...categoryRules };
  transactions.forEach(t => {
    if (t.description && t.category && t.category !== 'Uncategorized') {
      const desc = t.description.toLowerCase().trim();
      if (!newRules[desc]) {
        newRules[desc] = t.category;
      }
    }
  });
  setCategoryRules(newRules);
};
```
- Extracts patterns from categorized transactions
- Only learns from non-empty, categorized entries
- Doesn't override existing rules

### Data Structures

#### Transaction Object
```javascript
{
  id: 1699123456789,              // Timestamp-based unique ID
  date: "31/10/2024",             // DD/MM/YYYY format
  description: "Amazon Purchase",  // Transaction description
  category: "Shopping",            // User-assigned or auto-categorized
  amount: -45.99,                 // Negative = expense, Positive = income
  type: "Card Payment",            // Transaction type
  state: "COMPLETED"              // Transaction state
}
```

#### Category Rules Object
```javascript
{
  "amazon": "Shopping",
  "starbucks": "Food & Drink",
  "salary": "Income"
}
```

#### Savings Allocations Object
```javascript
{
  "transaction_id_123": [
    { purpose: "Emergency Fund", amount: 500 },
    { purpose: "Vacation", amount: 300 }
  ],
  "transaction_id_456": [
    { purpose: "House Down Payment", amount: 1000 }
  ]
}
```
- Maps transaction IDs to arrays of allocations
- Each allocation has a purpose and amount
- Unallocated amounts are automatically calculated and tracked

### Firebase Integration

**Configuration**: Uses Firebase v9+ modular SDK

**Services Used**:
- **Authentication**: Email/password authentication
- **Firestore**: NoSQL database for user data

**Data Structure in Firestore**:
```javascript
users/
  └─ {userId}/
      ├─ accounts: Array                    // List of user's accounts
      │   └─ [{ id: 'default', name: 'Main Account' }, ...]
      ├─ accountsData: Object               // Data for each account
      │   └─ {accountId}: {
      │       ├─ transactions: Array
      │       ├─ categoryRules: Object
      │       └─ savingsAllocations: Object
      │   }
      ├─ activeAccountId: String            // Currently active account
      └─ lastUpdated: ISO String
```

### Computed Values (useMemo)

Performance is optimized with memoization:

```javascript
// Only recalculates when dependencies change
const filteredTransactions = useMemo(() => {...}, [transactions, filter]);
const categories = useMemo(() => {...}, [transactions]);
const months = useMemo(() => {...}, [transactions]);
const years = useMemo(() => {...}, [transactions]);
const savingsBreakdownData = useMemo(() => {...}, [filteredTransactions, savingsAllocations]);
const categoryData = useMemo(() => {...}, [filteredTransactions]);
const monthlyData = useMemo(() => {...}, [filteredTransactions]);
const stats = useMemo(() => {...}, [filteredTransactions]);
```

**Filtering Logic**:
- Supports multiple simultaneous filters (categories, description, category search, dates)
- Date filters work with three modes: year-only, month-specific, or custom date range
- All statistics and charts automatically update based on filtered data
- Multi-category selection uses array inclusion checking

## User Interface

### Login Screen
- Email/password login only (administrator-managed accounts)
- Email and password fields with validation
- Error message display
- Disabled state during authentication
- Note indicating that new accounts must be created by administrator

### Main Dashboard

**Account Tabs**:
- Tab interface for switching between accounts
- Visual indicator for active account
- Add new account button with inline form
- Delete account button (hover to reveal)
- Default account cannot be deleted

**Header Section**:
- App title and user email display
- Logout button (with auto-save before logout)
- Action buttons: Import, Export, Add Transaction, Auto-Categorize
- Toggle graphs visibility

**Statistics Cards** (3-column grid):
- Total Balance (green if positive, red if negative)
- Total Spending (always red)
- Total Income (always green)
- Updates dynamically based on active filters

**Filters**:
- **Multi-Category Select**: Choose multiple categories to filter
- **Description Search**: Search transactions by description text
- **Category Search**: Search by category name
- **Date Filters**:
  - All dates (no filter)
  - Filter by year
  - Filter by month (formatted as MMM-YYYY)
  - Filter by custom date range (start and end dates)
- Clear filters button

**Charts Section** (2-column grid, toggleable):
- Spending by Category (Pie Chart)
- Top Spending Categories (Bar Chart)
- Savings Breakdown (Pie Chart) - shows allocation by purpose
- Monthly Overview (Line Chart) - full width
- All charts update based on filtered data

**Transactions Table**:
- Sortable columns: Date, Description, Category, Amount, Actions
- Inline editing mode
- Color-coded amounts (green for income, red for expenses)
- Category badges (gray for uncategorized, blue for categorized)
- Savings allocation button for savings transactions
- Allocate savings by purpose with visual indicators

**Category Rules Panel** (Collapsible):
- Shows count of active rules for current account
- Add new rule form (pattern + category)
- Table of all rules with delete option
- Automatic learning explanation text
- Rules are account-specific

**Savings Allocation Modal**:
- Triggered from savings transactions
- Add multiple allocations per transaction
- Shows total allocated vs. available amount
- Purpose and amount fields
- Visual validation to prevent over-allocation

## CSV Import Format

The app expects CSV files with these headers (flexible):
- `Started Date` or `Date` → date field
- `Description` → description field
- `Categories` or `Category` → category field (optional)
- `Amount` → amount field
- `Type` → transaction type
- `State` → transaction state

**Example**:
```csv
Started Date,Description,Categories,Amount,Type,State
31/10/2024,Amazon Purchase,Shopping,-45.99,Card Payment,COMPLETED
30/10/2024,Salary,Income,2500.00,Bank Transfer,COMPLETED
```

## Color Scheme

**Charts**: 8 predefined colors rotate through categories
```javascript
['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c']
```

**UI Colors**:
- Primary: Blue (#3B82F6)
- Success: Green (#10B981)
- Danger: Red (#EF4444)
- Warning: Orange (#F97316)
- Info: Purple (#A855F7)

## Dependencies

- **React**: UI framework
- **recharts**: Data visualization library
- **lucide-react**: Icon library
- **firebase**: Backend services (Auth + Firestore)
- **tailwindcss**: Utility-first CSS framework

## Security Notes

⚠️ **Important**: The Firebase configuration is hardcoded in the source. In production, these should be environment variables.

- User data is isolated by `userId`
- Authentication required for all data access
- No data sharing between users
- Auto-save ensures data isn't lost

## Performance Optimizations

1. **Memoization**: Heavy calculations cached with `useMemo`
2. **Filtered rendering**: Only filtered transactions shown in table
3. **Lazy chart rendering**: Charts only render when data exists
4. **Debounced saves**: Firebase saves triggered by state changes, not keystrokes

## Implemented Features

The following features have been successfully implemented:
- ✅ Multi-account support
- ✅ Date range filters (year, month, custom range)
- ✅ Advanced filtering (multi-category, description search, category search)
- ✅ Savings allocation and tracking
- ✅ Enhanced data visualization with savings breakdown
- ✅ Account-specific category rules and data
- ✅ Administrator-managed user accounts

## Future Enhancement Ideas

Based on the current architecture, potential improvements could include:
- Budget limits and alerts per category or account
- Recurring transaction templates
- Multi-currency support
- Receipt photo uploads with cloud storage
- Export to PDF reports with charts
- Mobile app version (React Native)
- Advanced analytics (spending trends, predictions, forecasting)
- Bulk transaction editing
- Transaction tags and labels
- Data import from multiple bank formats
- Automated bank account integration
- Split transactions across categories
- Bill reminders and due date tracking
- Income vs. expense goals
- Account merging and migration tools
