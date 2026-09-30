import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { loadConfig, EnableBankingClient } from './enablebanking.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = process.env.PORT || 3000;
// Defaults to every interface, which is what a normally-networked container needs for a
// published port to work. Under the Tailscale sidecar the app shares the sidecar's network
// namespace — where 0.0.0.0 includes the node's tailnet IP — so docker-compose.yml pins this
// to loopback, leaving `tailscale serve` on :443 as the only way in.
const HOST = process.env.HOST || '0.0.0.0';
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data', 'budget.db');

const db = openDb(DB_PATH);
const bankConfig = loadConfig();
const app = createApp(db, {
  bank: { config: bankConfig, client: bankConfig.configured ? new EnableBankingClient(bankConfig) : null },
});

app.listen(PORT, HOST, () => {
  console.log(`budget-tracker listening on http://localhost:${PORT} (db: ${DB_PATH})`);
  console.log(bankConfig.configured
    ? `bank sync: Enable Banking app ${bankConfig.appId} via ${bankConfig.apiBase}`
    : 'bank sync: not configured (set EB_APP_ID and EB_PRIVATE_KEY to enable)');
});
