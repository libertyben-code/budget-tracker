import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiRouter } from './routes/api.js';
import { createBankRouter } from './routes/bank.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

// Builds the Express app without listening, so tests can mount it on an ephemeral port
// with a temp database and a mock bank provider.
export function createApp(db, { bank }) {
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
  app.use('/api/bank', createBankRouter(db, bank));
  app.use('/api', createApiRouter(db));
  // Anything under /api the router did not claim is a 404, not the SPA shell:
  // the catch-all below would answer it with index.html and a 200, which the
  // client then fails to parse as JSON with an error that names nothing.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.use('/shared', express.static(path.join(ROOT, 'shared')));
  app.use(express.static(path.join(ROOT, 'client')));
  app.get('*name', (req, res) => {
    res.sendFile(path.join(ROOT, 'client', 'index.html'));
  });

  // Express's default handler prints a stack trace as HTML outside production.
  // The message stays in the log: SQLite's constraint text names tables and
  // columns, and the body limits' own errors carry a status worth keeping.
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({ error: 'Internal server error' });
  });

  return app;
}
