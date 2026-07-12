import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApiRouter } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'budget.db');

const db = openDb(DB_PATH);
const app = express();

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self'; manifest-src 'self'; " +
      "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '5mb' }));
app.use('/api', createApiRouter(db));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use(express.static(path.join(ROOT, 'client')));
app.get('*name', (req, res) => {
  res.sendFile(path.join(ROOT, 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`budget-tracker listening on http://localhost:${PORT} (db: ${DB_PATH})`);
});
