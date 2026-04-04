// Reusable Tailwind CSS class constants to reduce repetition and improve maintainability

export const formClasses = {
  // Standard input field styling
  input: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
  
  // Larger input fields (login forms, modals)
  inputLg: 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  
  // Select/dropdown fields
  select: 'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
  
  // Small select fields (compact layout)
  selectSm: 'flex-1 sm:flex-none px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm',
};

export const buttonClasses = {
  // Primary button (blue)
  primary: 'px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition',
  
  // Primary large button
  primaryLg: 'px-6 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition',
  
  // Secondary button (gray)
  secondary: 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition',
  
  // Danger button (red)
  danger: 'px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg hover:bg-red-600 dark:hover:bg-red-700 transition',
  
  // Success button (green)
  success: 'px-4 py-2 bg-green-500 dark:bg-green-600 text-white rounded-lg hover:bg-green-600 dark:hover:bg-green-700 transition',
  
  // Disabled state
  disabled: 'px-4 py-2 bg-gray-400 dark:bg-gray-600 text-gray-200 dark:text-gray-400 rounded-lg cursor-not-allowed opacity-50',
  
  // Icon button (compact)
  icon: 'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition',
  
  // Small button (compact)
  small: 'px-3 py-1 text-sm rounded-lg transition',
  
  // Button with whitespace-nowrap (for menu buttons)
  compact: 'px-3 py-2 rounded-lg whitespace-nowrap transition',
};

export const badgeClasses = {
  // Default badge (blue)
  default: 'px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-xs',
  
  // Uncategorized badge (gray)
  uncategorized: 'px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-xs',
  
  // Success badge (green)
  success: 'px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs',
  
  // Warning badge (yellow)
  warning: 'px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs',
  
  // Danger badge (red)
  danger: 'px-2 py-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs',
};

export const cardClasses = {
  // Standard card with padding
  default: 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6',
  
  // Compact card
  compact: 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-4',
  
  // Info card (blue background)
  info: 'bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800',
  
  // Success card (green background)
  success: 'bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-lg border border-emerald-100 dark:border-emerald-800',
  
  // Warning card (amber background)
  warning: 'bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3',
  
  // Danger card (red background)
  danger: 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3',
};

export const textClasses = {
  // Placeholder text
  placeholder: 'placeholder-gray-400 dark:placeholder-gray-500',
  
  // Muted/secondary text
  muted: 'text-gray-500 dark:text-gray-400',
  
  // Small text
  small: 'text-xs dark:text-gray-400',
};

export const layoutClasses = {
  // Container
  container: 'max-w-7xl mx-auto',
  
  // Responsive grid
  gridCols2: 'grid grid-cols-1 sm:grid-cols-2 gap-4',
  gridCols3: 'grid grid-cols-1 md:grid-cols-3 gap-4',
  gridColsAuto: 'grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-end',
  
  // Flexbox utilities
  flexBetween: 'flex items-center justify-between',
  flexCenter: 'flex items-center justify-center',
  flexStart: 'flex items-center',
};
