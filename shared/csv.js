import { displayToIso } from './dates.js';

export function parseImportCsv(text) {
  const lines = text.split(/\r?\n/);
  const headers = (lines[0] || '').split(',').map(h => h.trim());
  const rows = [];
  const failedLines = [];

  lines.slice(1).forEach((line, idx) => {
    if (!line.trim()) return;
    const lineNumber = idx + 2;

    const values = line.split(',');
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i]?.trim() || '';
    });

    const description = row['Description'] || '';
    const state = row['State'] || '';
    const amount = parseFloat(row['Amount']) || 0;

    if (state === 'REVERTED' || state === 'PENDING') {
      failedLines.push(lineNumber);
      return;
    }
    if (!description && amount === 0) {
      failedLines.push(lineNumber);
      return;
    }

    rows.push({
      date: displayToIso(row['Started Date'] || row['Date'] || ''),
      description,
      amount,
      type: row['Type'] || '',
      state,
    });
  });

  return { rows, failedLines };
}

function csvQuote(s) {
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

// Free-text cells: neutralize spreadsheet formula injection (a description like
// "=HYPERLINK(...)" from a bank statement would otherwise execute on open), then quote.
function csvText(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return csvQuote(s);
}

export function toExportCsv(transactions, formatDate) {
  const header = 'Date,Description,Category,Amount,Type,State';
  const lines = transactions.map(t =>
    [csvQuote(formatDate(t.date)), csvText(t.description), csvText(t.category), t.amount, csvText(t.type), csvText(t.state)].join(',')
  );
  return [header, ...lines].join('\n');
}
