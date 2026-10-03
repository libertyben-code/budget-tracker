# Budget Tracker

Budget Tracker is a self-hosted personal finance app: a plain HTML/CSS/JS frontend and a Node/Express + SQLite backend, installed as a PWA on your phone over Tailscale. No login, no cloud dependency — your data stays on your own server.

## Features

### Transactions

- **Bank sync** — link Revolut, Crédit Agricole or any bank Enable Banking covers from Settings ▸ *Bank sync*; the first sync runs the moment the bank approves, and *Sync now* (or *Sync all accounts* in the Settings menu) pulls new transactions through the same dedupe and category rules as a CSV import. Each linked bank account maps to a budget account of your choice, or to a savings account whose balance and history then come from the bank; re-mapping carries what was already imported along. Consents expire after 90–180 days and are renewed from the same panel. Needs two server variables — see [docs/V2-SETUP.md](docs/V2-SETUP.md#bank-sync-enable-banking).
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

- Savings tracking with deposit/withdrawal history, shared by every budget account: the Savings tab is the same whichever account is active.
- Recurring monthly deposits, applied automatically with catch-up.
- Split-by-account chart.
- A savings account can be fed by a category: tag the transfers (by rule or by hand), in any budget account, and its balance and history follow — the way to track a Revolut Pocket, which open banking does not expose.

### Navigation & appearance

- **Bottom tab bar** — Dashboard, Transactions, Joint Split and Savings sit in a fixed bar at the bottom of the screen, each an icon over its label, the current one in the accent colour. It clears the phone's home indicator and stays put while the page scrolls.
- **Header** — one row: the wallet mark and the app name on the left, the account switcher centred between them and the settings icon on the right. The switcher is a rounded pill in the accent colour, large enough to read and to tap, and it carries an `ACCOUNT` label on wider screens. When the row runs short the account name shortens and the app name does not — the app name is fixed, and the account's full name is in the dropdown.
- **Colour theme** — six accents (indigo, violet, blue, green, amber, coral) picked from a swatch row in Settings, each with its own dark-mode step. Charts keep their own fixed palette: a series colour is data, so it does not follow a per-device preference. The Android status bar follows the chosen accent.
- **Light / dark** — an *Appearance* item in the Settings menu, alongside the colour swatches and the language switch. Both persist across reloads.
- **Selection ticks** — categories, "All" and the rule list use a drawn tick on a full-width tappable row rather than a desktop checkbox.

### Multi-account, EN/FR, offline-read PWA

## Setup

See **[docs/V2-SETUP.md](docs/V2-SETUP.md)** for full deployment instructions (a Portainer stack deployed from this repo, Tailscale, backups, phone install).

Quick local dev run:

```bash
cd server && npm install && cd ..
node server/src/index.js
# open http://localhost:3000
```

A fresh SQLite database is created automatically at `data/budget.db`, seeded with a `default` account.

## Architecture

See **[docs/MAINTAINER.md](docs/MAINTAINER.md)** for stack details, repository layout, and the smoke test checklist.
