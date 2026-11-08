# Budget Tracker

Budget Tracker is a self-hosted personal finance app: a plain HTML/CSS/JS frontend and a Node/Express + SQLite backend, installed as a PWA on your phone over Tailscale. No login, no cloud dependency — your data stays on your own server.

## Features

### Transactions

- **Bank sync** — link Revolut, Crédit Agricole or any bank Enable Banking covers from Settings ▸ *Bank sync*; the first sync runs the moment the bank approves, and *Sync now* (or *Sync all accounts* in the Settings menu) pulls new transactions through the same dedupe and category rules as a CSV import. Opening the app syncs on its own too, at most once an hour per account, and six hours after a failure. Each linked bank account maps to a budget account of your choice, or to a savings account whose balance and history then come from the bank; re-mapping carries what was already imported along. Accounts in another currency are offered their own budget account (or left out) at link time, so pounds never land in a euro account, and a summary after linking shows where each account went. Consents expire after 90–180 days and are renewed from the same panel. Needs two server variables — see [docs/V2-SETUP.md](docs/V2-SETUP.md#bank-sync-enable-banking).
- CSV import from bank statements (skip pending/reverted, dedupe, auto-categorize), and CSV export.
- Compact list grouped by day; tap a transaction to open its details, edit it or delete it (with Undo). A **Select** button enters batch mode for batch edit and batch delete.
- **Add sheet** — Expense / Income, amount, description, category chips and date chips; the button stays disabled until the entry is valid.
- One-line search (descriptions and amounts) and a **Filters** sheet whose summary always shows the active period.

### Categorization

- Rule-based automatic categorization, learned from your own categorization history.
- **Apply to similar** — setting a category saves a rule and applies it straight away to the matching uncategorised transactions in every account, with Undo.
- **To categorise** inbox — uncategorised transactions grouped by merchant, one choice per group.
- Category picker with search, recent picks and "New category"; a starter set of categories is offered on a fresh install (EN or FR).
- One category list shared by every budget account; create, rename and delete propagate across every account.
- Manual rule creation and deletion; **Apply Rules to All** in the Settings menu.

### Dashboard

- **Balance** — the real account balance: from the bank for synced accounts, or an opening balance plus transactions for manual ones (set it from the account menu).
- Month stepper with the month's net, money in and money out, and a "transactions need a category" card.
- Spending by category, monthly overview (income vs. spending) and per-category-by-month trend with a 6M/12M/All range.
- A welcome card on an empty account: link a bank, import a CSV or add a transaction.

### Joint Split

- One setting for every account: the amount wanted in the shared account each month and the two salaries; each person pays in proportion to their salary. The two people can be named.

### Savings

- Savings tracking with deposit/withdrawal history (each with Undo, and removable entries), shared by every budget account.
- Recurring monthly deposits, applied automatically with catch-up.
- Split-by-account chart.
- A savings account can be fed by a category: tag the transfers (by rule or by hand), in any budget account, and its balance and history follow — the way to track a Revolut Pocket, which open banking does not expose.

### Navigation & appearance

- **Bottom tab bar** on phones (Dashboard, Transactions, Joint Split, Savings); a left navigation rail from 900px wide.
- **Header** — one row: the wallet mark and the app name, the account switcher pill in the middle, which lists each account with its balance, the settings icon on the right.
- **Settings menu** grouped into Data, Organise and Preferences.
- **Appearance** — Match phone (default), Light or Dark; six accent colours, readable in both themes. Charts keep their own fixed palette.
- Money is formatted for the language and the account's currency (`€2,310.45` / `2 310,45 €`, `£` on a GBP account).
- Clear feedback: neutral confirmations, red only for errors, Undo where an action can be reversed; a banner when the server can't be reached, with edits paused until it is back.
- Dialogs work with the keyboard and screen readers (focus moves in and back, Escape closes).

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
