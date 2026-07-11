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
