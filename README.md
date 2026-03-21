# Budget Tracker App - Technical Documentation

## Overview

This Budget Tracker is a React-based web application that helps users manage their personal finances with automatic transaction categorization, advanced data visualization, multi-account support, dark mode, sortable tables, batch operations, and cloud synchronization through Firebase.

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

### 2. **Dark Mode**
- Toggle between light and dark themes
- Persistent preference saved to localStorage
- Full UI adaptation including:
  - All buttons and forms
  - Tables and data displays
  - Charts and visualizations (adjusted grid lines and axis colors)
  - Modals and dropdowns
  - Category badges and status indicators

### 3. **Multi-Account Management**
- Create and manage multiple budget accounts (e.g., Personal, Business, Joint)
- Switch seamlessly between different accounts
- Each account has independent:
  - Transaction history
  - Savings allocations
- Global category rules shared across all user accounts
- Delete accounts (with protection for default account)
- Account-specific data synchronization

### 4. **Transaction Management**
- **CSV Import**: 
  - Upload bank statement CSV files for automatic transaction parsing
  - Auto-format dates to dd/mm/yy format during import
  - Import error tracking with line-by-line reporting
  - Automatic filtering of REVERTED and PENDING transactions
  - Visual warning display for skipped transactions
- **Manual Entry**: Add transactions one at a time via the UI
- **CRUD Operations**: Edit, delete, and view all transactions in a table format
- **Sortable Columns**: Click column headers to sort by Date, Category, or Amount (ascending/descending)
- **Multi-Select**: Select multiple transactions with checkboxes
- **Batch Operations**:
  - Batch edit description and/or category for selected transactions
  - Batch delete multiple transactions at once
  - Category dropdown with "Create New" option in batch edit
- **CSV Export**: Download your transaction data as a CSV file
- **Date Format**: All dates consistently displayed in dd/mm/yy format
- **Real-time Updates**: Changes instantly reflected across all visualizations

### 5. **Intelligent Auto-Categorization**
- Machine learning-inspired pattern matching system
- **Automatic Learning**: When you manually categorize a transaction, the app learns the pattern
- **Rule-Based System**: Maintains a dictionary of description patterns → categories
- **Manual Rules**: Add custom categorization rules through the settings panel
- **Category Filtering**: Filter rules by category to view and manage specific groups
- **Batch Rule Operations**:
  - Select multiple rules with checkboxes
  - Change category for multiple rules at once
  - Batch delete rules by category
  - Filter and batch edit for efficient rule management
- **Bulk Re-categorization**: Apply rules to all uncategorized transactions with one click
- **Global Rules**: Category rules are user-level (shared across all accounts)
- **Rule Synchronization**: Rules automatically update when categories are renamed or deleted

### 6. **Category Management**
- **Rename Categories**: Update category names across all transactions and rules
- **Delete Categories**: Remove categories with options to:
  - Set affected transactions to "Uncategorized"
  - Enter a new replacement category name
- **Automatic Rule Updates**: Category rules update automatically when categories change
- **Category Count**: View transaction count per category
- **Visual Feedback**: Color-coded category badges throughout the interface

### 7. **Savings Management**
- **Savings Allocation**: Break down savings deposits by purpose (e.g., Emergency Fund, Vacation, House)
- **Visual Breakdown**: Dedicated pie chart showing allocation by purpose
- **Per-Transaction Tracking**: Allocate specific amounts from each savings transaction
- **Unallocated Tracking**: Automatically tracks unallocated savings amounts
- Account-specific savings goals and allocations

### 8. **Advanced Data Visualization**
Four interactive charts using Recharts library:
- **Spending by Category (Pie Chart)**: Visual breakdown of spending by category with percentages
- **Spending by Category per Month (Grouped Bar Chart)**: 
  - Shows all categories grouped by month
  - Side-by-side bars for easy comparison
  - Larger bar size (60px) for better visibility
  - Optimized spacing between month groups
  - Replaced old "Top Spending Categories" chart
- **Monthly Overview (Line Chart)**: Monthly spending trends over time (income removed)
- **Savings Breakdown (Pie Chart)**: Visual breakdown of savings allocations by purpose
- **Dark Mode Adaptation**:
  - Lighter axis labels for better visibility in dark mode
  - Darker grid lines to reduce visual clutter
  - Consistent color scheme across themes
- Toggle charts visibility on/off
- Responsive design for all screen sizes

### 9. **Advanced Filtering & Search**
Multiple filter options working in combination:
- **Category Filter**: Multi-select category filtering with checkboxes
  - Linked to transaction filtering
  - Select multiple categories simultaneously
  - Visual checkbox indicators
- **Description Search**: Search transactions by description (case-insensitive)
- **Category Search**: Search by category name
- **Date Filters**:
  - Filter by specific year
  - Filter by specific month
  - Filter by custom date range
  - View all transactions (no date filter)
- Real-time statistics that update based on filtered data
- Clear filters button for quick reset

### 10. **Real-time Statistics**
Dynamic statistics display that updates based on filters:
- **Total Balance**: Income minus spending (color-coded: green for positive, red for negative)
- **Total Spending**: Sum of all expenses
- **Total Income**: Sum of all income
- Statistics reflect currently applied filters

### 11. **Cloud Synchronization**
- All data automatically synced to Firebase Firestore
- Auto-save triggers when transactions, category rules, or accounts change
- Data persists across devices when logged in with the same account
- Automatic data loading on login
- Multi-account data structure with efficient synchronization
- Global category rules shared across all user accounts
- Last updated timestamp tracking

## Technical Architecture

### State Management

The app uses React hooks for state management:

```javascript
// Authentication State
const [user, setUser] = useState(null);
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
  'default': { transactions: [], savingsAllocations: {} }
});

// Transaction State
const [transactions, setTransactions] = useState([]);
const [categoryRules, setCategoryRules] = useState({}); // Global rules
const [editingId, setEditingId] = useState(null);
const [editForm, setEditForm] = useState({});

// Sorting State
const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

// Multi-select State
const [selectedTransactions, setSelectedTransactions] = useState([]);
const [showBatchEdit, setShowBatchEdit] = useState(false);
const [batchEditForm, setBatchEditForm] = useState({ description: '', category: '' });

// Category Management State
const [showCategoryManager, setShowCategoryManager] = useState(false);
const [editingCategory, setEditingCategory] = useState(null);
const [newCategoryName, setNewCategoryName] = useState('');
const [deletingCategory, setDeletingCategory] = useState(null);
const [replacementCategory, setReplacementCategory] = useState('Uncategorized');
const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);

// Category Rules State
const [showRules, setShowRules] = useState(false);
const [newRule, setNewRule] = useState({ pattern: '', category: '' });
const [ruleFilter, setRuleFilter] = useState('');
const [selectedRules, setSelectedRules] = useState([]);
const [showBatchRuleEdit, setShowBatchRuleEdit] = useState(false);
const [batchRuleCategory, setBatchRuleCategory] = useState('');

// Import Error State
const [importErrors, setImportErrors] = useState(null);

// Savings State
const [showSavingsModal, setShowSavingsModal] = useState(false);
const [selectedSavingsTransaction, setSelectedSavingsTransaction] = useState(null);
const [savingsAllocations, setSavingsAllocations] = useState({});
const [newAllocation, setNewAllocation] = useState({ purpose: '', amount: 0 });

// Dark Mode State
const [darkMode, setDarkMode] = useState(() => {
  const saved = localStorage.getItem('darkMode');
  return saved ? JSON.parse(saved) : false;
});

// UI State
const [filter, setFilter] = useState({
  categories: [],
  description: '',
  categorySearch: '',
  dateFilterType: 'all',
  year: '',
  month: '',
  startDate: '',
  endDate: ''
});
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
  date: "31/10/24",               // dd/mm/yy format (auto-formatted)
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

**Note**: Category rules are now global (user-level), shared across all accounts.

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
      │       └─ savingsAllocations: Object
      │   }
      ├─ categoryRules: Object              // Global rules (user-level)
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

- Dark mode toggle button (moon/sun icon)
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

- **Multi-Category Select**: Choose multiple categories with checkboxes
- **Description Search**: Search transactions by description text
- **Category Search**: Search by category name
- **Date Filters**:
  - All dates (no filter)
  - Filter by year
  - Filter by month (formatted as MMM-YYYY)
  - Filter by custom date range (start and end dates)
- Clear filters button

**Charts Section** (toggleable):

- Spending by Category (Pie Chart)
- Spending by Category per Month (Grouped Bar Chart)
  - Side-by-side bars for each category
  - Larger bars (60px) for better visibility
  - Monthly groupings with optimized spacing
- Monthly Overview (Line Chart) - showing spending only
- Savings Breakdown (Pie Chart) - shows allocation by purpose
- All charts update based on filtered data
- Dark mode optimized with adjusted colors

**Transactions Table**:

- Multi-select checkboxes for batch operations
- Sortable columns: Date, Category, Amount (click header to sort)
- Sort indicators (▲▼) showing current sort direction
- Inline editing mode
- Color-coded amounts (green for income, red for expenses)
- Category badges (gray for uncategorized, blue for categorized)
- Savings allocation button for savings transactions
- Batch edit and batch delete controls when transactions selected

**Category Rules Panel** (Collapsible):

- Shows count of active rules (global, not per-account)
- Add new rule form (pattern + category)
- Category filter dropdown to view rules by category
- Multi-select checkboxes for batch rule operations
- Batch operations:
  - Change category for selected rules
  - Delete multiple rules at once
- Table of all/filtered rules with delete option
- Automatic learning explanation text

**Category Manager Panel** (Collapsible):

- List of all categories with transaction counts
- Rename category (updates all transactions and rules)
- Delete category with options:
  - Set affected transactions to "Uncategorized"
  - Enter new replacement category
- Visual feedback with color-coded badges

**Import Error Display**:

- Yellow warning banner when import errors occur
- Shows count of skipped lines
- Lists specific line numbers (up to 20, with overflow count)
- Dismissible with close button
- Explains why lines were skipped (REVERTED, PENDING, invalid data)

**Batch Edit Modal**:

- Edit description and/or category for multiple transactions
- Category dropdown with existing categories
- "Create New" category option
- Apply/Cancel buttons with validation

**Batch Rule Edit Modal**:

- Change category for multiple selected rules
- Category dropdown with autocomplete
- Shows count of affected rules
- Apply/Cancel buttons with validation

**Category Delete Modal**:

- Confirmation dialog when deleting categories
- Options for handling affected transactions
- Radio buttons for Uncategorized or new category
- Input field for custom replacement category
- Transaction count display

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

- ✅ Multi-account support with global category rules
- ✅ Date range filters (year, month, custom range)
- ✅ Advanced filtering (multi-category, description search, category search)
- ✅ Savings allocation and tracking
- ✅ Enhanced data visualization with category-by-month grouped bars
- ✅ Dark mode with full UI adaptation
- ✅ Sortable table columns (Date, Category, Amount)
- ✅ Multi-select transactions with batch edit/delete
- ✅ Category management (rename, delete with replacement options)
- ✅ Batch rule operations with category filtering
- ✅ Import error tracking and reporting
- ✅ Consistent date formatting (dd/mm/yy)
- ✅ Chart optimizations for dark mode
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
