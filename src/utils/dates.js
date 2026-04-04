// Date and time utilities for formatting and calculations

/**
 * Format date to dd/mm/yy format
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string in dd/mm/yy format
 */
export const formatDateToDDMMYY = (date) => {
  if (!date) return '';
  
  // If it's already in dd/mm/yy format (8 chars with slashes at positions 2 and 5)
  if (typeof date === 'string' && date.length === 8 && date[2] === '/' && date[5] === '/') {
    return date;
  }
  
  // If it's in dd/mm/yyyy format
  if (typeof date === 'string' && date.length === 10 && date[2] === '/' && date[5] === '/') {
    const parts = date.split('/');
    return `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}`;
  }
  
  // If it's a Date object or parseable string
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    const day = dateObj.getDate().toString().padStart(2, '0');
    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
    const year = dateObj.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  } catch {
    return date.toString();
  }
};

/**
 * Get relative month bounds (e.g., last 3 months)
 * @param {number} monthCount - Number of months to go back
 * @returns {object} Object with startDate and endDate as Date objects
 */
export const getRelativeMonthBounds = (monthCount) => {
  const endDate = new Date();
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth() - monthCount + 1, 1);
  return { startDate, endDate };
};

/**
 * Format month string for display (e.g., "2024-04" to "Apr-24")
 * @param {string} monthStr - Month string in format YYYY-MM
 * @returns {string} Formatted month display
 */
export const formatMonthDisplay = (monthStr) => {
  if (!monthStr || monthStr.startsWith('__')) return '';
  const [year, month] = monthStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]}-${year.slice(-2)}`;
};

/**
 * Get current month in YYYY-MM format
 * @returns {string} Current month string
 */
export const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Check if a transaction date is in the current month
 * @param {string} dateStr - Transaction date in dd/mm/yy or similar format
 * @returns {boolean} True if date is in current month
 */
export const isCurrentMonth = (dateStr) => {
  try {
    const [day, month, year] = dateStr.split('/');
    const fullYear = 2000 + parseInt(year);
    const txDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
    const now = new Date();
    return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
  } catch {
    return false;
  }
};

/**
 * Parse transaction date and return as Date object
 * @param {string} dateStr - Date string in dd/mm/yy format
 * @returns {Date} Date object
 */
export const parseTransactionDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [day, month, year] = dateStr.split('/');
  const fullYear = 2000 + parseInt(year);
  return new Date(fullYear, parseInt(month) - 1, parseInt(day));
};

/**
 * Get month key for grouping (YYYY-MM format)
 * @param {string} dateStr - Date string in dd/mm/yy format
 * @returns {string} Month key in YYYY-MM format
 */
export const getMonthKey = (dateStr) => {
  const date = parseTransactionDate(dateStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};
