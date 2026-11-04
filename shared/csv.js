import { displayToIso } from './dates.js';

function parseRecords(text) {
  const records = [];
  let values = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else { if (c === '\n') line++; field += c; }
    } else if (c === '"' && !field.trim()) {
      quoted = true;
    } else if (c === ',') {
      values.push(field);
      field = '';
    } else if (c === '\n') {
      values.push(field);
      records.push({ line: recordLine, values });
      values = [];
      field = '';
      recordLine = ++line;
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (values.length || field) {
    values.push(field);
    records.push({ line: recordLine, values });
  }
  return records;
}

// Undoes csvText's formula guard, so the app's own export imports back unchanged.
function stripFormulaGuard(s) {
  return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s;
}

export function parseImportCsv(text) {
  const [header, ...records] = parseRecords(text);
  const headers = (header?.values || []).map(h => h.trim());
  const rows = [];
  const failedLines = [];

  records.forEach(({ line: lineNumber, values }) => {
    if (values.every(v => !v.trim())) return;

    const row = {};
    headers.forEach((h, i) => {
      row[h] = stripFormulaGuard(values[i]?.trim() || '');
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
