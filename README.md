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
- Create categories (they persist and appear in every picker even before any transaction uses them), rename, and delete — all propagated across transactions.
- Change a single transaction's category without touching others; **Apply Rules to All** (settings menu) then re-applies your rules across every transaction at once.
- Manual rule creation and deletion.

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

### Navigation & appearance

- **Bottom tab bar** — Dashboard, Transactions, Joint Split and Savings sit in a fixed bar at the bottom of the screen, each an icon over its label, the current one in the accent colour. It clears the phone's home indicator and stays put while the page scrolls.
- **Header** — one row: the wallet mark and the app name on the left, the account switcher centred between them and the settings icon on the right. The switcher is a rounded pill in the accent colour, large enough to read and to tap, and it carries an `ACCOUNT` label on wider screens. When the row runs short the account name shortens and the app name does not — the app name is fixed, and the account's full name is in the dropdown.
- **Colour theme** — six accents (indigo, violet, blue, green, amber, coral) picked from a swatch row in Settings, each with its own dark-mode step. Charts keep their own fixed palette: a series colour is data, so it does not follow a per-device preference. The Android status bar follows the chosen accent.
- **Light / dark** — an *Appearance* item in the Settings menu, alongside the colour swatches and the language switch. Both persist across reloads.
- **Selection ticks** — categories, "All" and the rule list use a drawn tick on a full-width tappable row rather than a desktop checkbox.

### Multi-account, EN/FR, offline-read PWA

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
