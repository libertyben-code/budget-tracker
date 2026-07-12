# Budget Tracker

Budget Tracker is a self-hosted personal finance app: a plain HTML/CSS/JS frontend and a Node/Express + SQLite backend, installed as a PWA on your phone over Tailscale. No login, no cloud dependency — your data stays on your own server.

## Features

### Transactions

- CSV import from bank statements (skip pending/reverted, dedupe, auto-categorize).
- CSV export.
- Manual add, edit, and delete.
- Inline category editing, sortable/paginated views, multi-select batch edit and delete.

### Categorization

- Rule-based automatic categorization, learned from your own categorization history.
- Manual rule creation and deletion.
- Category rename and delete, propagated across transactions.

### Dashboard

- Balance and spending summary tiles.
- Spending by category (horizontal bars, € + %).
- Monthly overview (income vs. spending) and per-category-by-month trend, with a shared 6M/12M/All range picker.

### Joint Split

- Salary-based contribution planning for two people.
- Uses current-month transactions where the category contains `bill`.

### Savings

- Per-account savings tracking with deposit/withdrawal history.
- Recurring monthly deposits, applied automatically with catch-up.
- Split-by-account chart.

### Multi-account, dark mode, EN/FR, offline-read PWA

## Setup

See **[docs/V2-SETUP.md](docs/V2-SETUP.md)** for full deployment instructions (Docker + Tailscale on a self-hosted server, phone install).

Quick local dev run:

```bash
cd server && npm install && cd ..
node server/src/index.js
# open http://localhost:3000
```

A fresh SQLite database is created automatically at `data/budget.db`, seeded with a `default` account.

## Architecture

See **[docs/MAINTAINER.md](docs/MAINTAINER.md)** for stack details, repository layout, and the smoke test checklist.
