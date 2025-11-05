# Budget Tracker App - Technical Documentation

## Overview

This Budget Tracker is a React-based web application that helps users manage their personal finances with automatic transaction categorization, data visualization, and cloud synchronization through Firebase.

## Core Features

### 1. **User Authentication**
- Firebase Authentication integration for secure user management
- Support for both email/password sign-up and login
- Persistent login sessions across browser refreshes
- User-specific data isolation

### 2. **Transaction Management**
- **CSV Import**: Upload bank statement CSV files for automatic transaction parsing
- **Manual Entry**: Add transactions one at a time via the UI
- **CRUD Operations**: Edit, delete, and view all transactions in a table format
- **CSV Export**: Download your transaction data as a CSV file
- **Auto-filtering**: Excludes reverted and pending transactions from imported data

### 3. **Intelligent Auto-Categorization**
- Machine learning-inspired pattern matching system
- **Automatic Learning**: When you manually categorize a transaction, the app learns the pattern
- **Rule-Based System**: Maintains a dictionary of description patterns → categories
- **Manual Rules**: Add custom categorization rules through the settings panel
- **Bulk Re-categorization**: Apply rules to all uncategorized transactions with one click

### 4. **Data Visualization**
Three interactive charts using Recharts library:
- **Pie Chart**: Visual breakdown of spending by category (percentage-based)
- **Bar Chart**: Top 10 spending categories ranked by amount
- **Line Chart**: Monthly spending vs. income trends over time

### 5. **Filtering & Statistics**
- Filter transactions by category
- Filter transactions by month
- Real-time statistics display:
  - Total Balance (income - spending)
  - Total Spending
  - Total Income

### 6. **Cloud Synchronization**
- All data automatically synced to Firebase Firestore
- Auto-save triggers when transactions or category rules change
- Data persists across devices when logged in with the same account
- Automatic data loading on login

## Technical Architecture

### State Management

The app uses React hooks for state management:

```javascript
// Authentication State
const [user, setUser] = useState(null);           // Current logged-in user
const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

// Transaction State
const [transactions, setTransactions] = useState([]); // All transaction records
const [categoryRules, setCategoryRules] = useState({}); // Pattern → Category mapping
const [editingId, setEditingId] = useState(null);     // Currently editing transaction
const [editForm, setEditForm] = useState({});         // Form data for editing

// UI State
const [filter, setFilter] = useState({ category: 'all', month: 'all' });
const [showRules, setShowRules] = useState(false);
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

### Firebase Integration

**Configuration**: Uses Firebase v9+ modular SDK

**Services Used**:
- **Authentication**: Email/password authentication
- **Firestore**: NoSQL database for user data

**Data Structure in Firestore**:
```
users/
  └─ {userId}/
      ├─ transactions: Array
      ├─ categoryRules: Object
      └─ lastUpdated: ISO String
```

### Computed Values (useMemo)

Performance is optimized with memoization:

```javascript
// Only recalculates when transactions or filter changes
const filteredTransactions = useMemo(() => {...}, [transactions, filter]);
const categories = useMemo(() => {...}, [transactions]);
const months = useMemo(() => {...}, [transactions]);
const categoryData = useMemo(() => {...}, [filteredTransactions]);
const monthlyData = useMemo(() => {...}, [transactions]);
const stats = useMemo(() => {...}, [filteredTransactions]);
```

## User Interface

### Login Screen
- Toggle between Login/Sign Up modes
- Email and password fields with validation
- Error message display
- Disabled state during authentication

### Main Dashboard
**Header Section**:
- App title and user email display
- Logout button
- Action buttons: Import, Export, Add Transaction, Category Rules, Auto-Categorize

**Statistics Cards** (3-column grid):
- Total Balance (green if positive, red if negative)
- Total Spending (always red)
- Total Income (always green)

**Filters**:
- Category dropdown (All Categories + all unique categories)
- Month dropdown (All Months + all available months)

**Charts Section** (2-column grid):
- Spending by Category (Pie Chart)
- Top Spending Categories (Bar Chart)
- Monthly Overview (Line Chart) - full width

**Transactions Table**:
- Sortable columns: Date, Description, Category, Amount, Actions
- Inline editing mode
- Color-coded amounts (green for income, red for expenses)
- Category badges (gray for uncategorized, blue for categorized)

### Category Rules Panel (Collapsible)
- Shows count of active rules
- Add new rule form (pattern + category)
- Table of all rules with delete option
- Automatic learning explanation text

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

## Future Enhancement Ideas

Based on the current architecture, potential improvements could include:
- Date range filters
- Budget limits and alerts
- Recurring transaction templates
- Multi-currency support
- Receipt photo uploads
- Shared budgets for families
- Export to PDF reports
- Mobile app version
- Advanced analytics (spending trends, predictions)
