import test from 'node:test';
import assert from 'node:assert/strict';
import { parseImportCsv, toExportCsv } from '../../shared/csv.js';
import { isoToDisplay } from '../../shared/dates.js';

test('an export imports back unchanged', () => {
  const transactions = [
    { date: '2026-09-28', description: 'Shop, Ltd', category: 'Food, drink', amount: -5.5, type: 'CARD_PAYMENT', state: 'COMPLETED' },
    { date: '2026-09-27', description: 'He said "hi"', category: '', amount: 12, type: 'TRANSFER', state: 'COMPLETED' },
    { date: '2026-09-26', description: '=HYPERLINK("http://x")', category: '', amount: -0.01, type: '-odd', state: 'COMPLETED' },
    { date: '2026-09-25', description: 'Line one\nline two', category: '@home', amount: -100, type: '+TOPUP', state: '' },
  ];
  const { rows, failedLines } = parseImportCsv(toExportCsv(transactions, isoToDisplay));
  assert.deepEqual(failedLines, []);
  assert.deepEqual(rows, transactions.map(({ category, ...t }) => t));
});

test('failed lines are numbered by where the record starts in the file', () => {
  const csv = [
    'Date,Description,Amount,State',
    '01/09/26,"two',
    'lines",-1,COMPLETED',
    '',
    '02/09/26,Pending thing,-2,PENDING',
  ].join('\r\n');
  const { rows, failedLines } = parseImportCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, 'two\r\nlines');
  assert.deepEqual(failedLines, [5]);
});
