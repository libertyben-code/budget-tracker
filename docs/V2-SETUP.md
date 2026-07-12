# Budget Tracker v2 — Setup & Operations

v2 is a self-hosted rewrite: vanilla HTML/CSS/JS frontend + Node/Express + SQLite, installed on Android as a PWA over Tailscale HTTPS. No login — Tailscale is the security perimeter.

## Run locally (development, Windows or Linux)

```bash
cd server && npm install && cd ..
node server/src/index.js
# open http://localhost:3000
```

The SQLite database is created automatically at `data/budget.db` (a fresh one seeds the `default` account).

## Migrate your data from Firestore (one-time, run on the dev PC)

Requires the old `.env` with the `REACT_APP_FIREBASE_*` keys at the repo root.

```bash
# PowerShell
$env:MIGRATE_EMAIL = "you@example.com"
$env:MIGRATE_PASSWORD = "..."
node server/scripts/migrate-from-firestore.mjs
```

The script signs into Firebase, reads your `users/{uid}` document, writes everything into `data/budget.db`, and prints a verification report (per-account transaction counts, rule count, savings totals). It refuses to run if the database already contains transactions. Copy the resulting `data/budget.db` to the server's `data/` folder before first launch.

## Deploy on the Linux server

Prerequisites: Docker + Docker Compose, Tailscale connected.

```bash
git clone <this repo> && cd budget-tracker
mkdir -p data                # put migrated budget.db here if you have one
sudo chown -R 1000:1000 data # container runs as non-root uid 1000; it must own the volume
docker compose up -d --build

# one-time: expose over the tailnet with HTTPS (required for PWA install)
sudo tailscale serve --bg https:443 http://localhost:3000
tailscale serve status       # shows your URL: https://<host>.<tailnet>.ts.net
```

The container listens only on `127.0.0.1:3000`; nothing is reachable outside the tailnet.

## Install on Android (both phones)

1. Open `https://<host>.<tailnet>.ts.net` in Chrome (with Tailscale active on the phone)
2. Menu ⋮ → **Add to Home screen** → Install
3. The app opens standalone, full-screen, with its own icon

## Updates

On the server:

```bash
./update.sh
```

This backs up `data/budget.db` (timestamped copy in `data/`), pulls the latest code, and rebuilds the container. Phones pick up the new version the next time the app is opened (network-first service worker). When releasing, bump the `CACHE` version constant in `client/sw.js` (`bt-static-v1` → `v2`, …).

## Backups

Your entire financial history is one file: `data/budget.db`. `update.sh` snapshots it on every update; for extra safety add a cron copying it elsewhere (e.g. nightly `cp` to a NAS or rclone target).

## Architecture notes

- `client/` — static frontend, native ES modules, no build step. Views in `client/js/views/`, one module per screen; state in `client/js/store.js`; all server calls in `client/js/api.js`.
- `shared/` — pure ESM modules (categorization engine, date + CSV helpers) imported by both Node and the browser.
- `server/` — Express 5 + better-sqlite3. All routes in `server/src/routes/api.js`; schema in `server/src/schema.sql`.
- Dates are stored ISO (`YYYY-MM-DD`) in the DB and API, displayed as `dd/mm/yy`. Amounts: negative = spending, positive = income. Category rules are global; everything else is per budget account.
- Recurring savings deposits: rules live in `savings_recurring` (amount + day 1–28). Due deposits are applied lazily on `GET /accounts/:id/data` with multi-month catch-up; history ids are deterministic (`rec_<ruleId>_<date>`) so an occurrence can never apply twice.
- CSV import (parse → skip REVERTED/PENDING → dedup → categorize) runs server-side in `importTransactions()` — a future bank-sync connector (e.g. Enable Banking) can feed the same function.

## Security model

No application-layer auth by design — **Tailscale is the perimeter**, so keep it that way:

- The container binds `127.0.0.1:3000` only; expose it with `tailscale serve` (tailnet-only). **Never `tailscale funnel`** it and never change the port binding to `0.0.0.0`/`3000:3000` — either would expose all your financial data with no login.
- Hardening already in the code: strict CSP + `X-Frame-Options`/`nosniff`/`Referrer-Policy` headers; CSV export neutralizes spreadsheet formula injection; the import endpoint only accepts `text/csv` (blocks cross-site form POSTs); the container runs as non-root uid 1000.
- Offline caveat: the service worker keeps an unencrypted snapshot of your data on each phone for offline reads — rely on device lock.

## Adding a login later (if ever needed)

One Express middleware in front of `/api/*` checking a session cookie + a `POST /api/login` route, and a 401 handler in `client/js/api.js`. No data model changes needed.
