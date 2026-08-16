# Budget Tracker — Done

Archive of completed feedback items. Do not edit during sessions — items are moved here from `docs/BACKLOG.md` when completed.

---

## Refactors

- [x] Extract CategoryRulesPanel, CategoryManagerPanel, DashboardCharts into components — OK

## Security

- [x] Security hardening before self-host deploy: CSP + security headers, CSV export formula-injection guard + RFC-4180 quoting, API input coercion, `text/csv`-only import (closes cross-site bypass), non-root container + `.dockerignore` — OK

## Categorization

- [x] Add new categories from Manage Categories (settings menu) — persisted via `custom_categories`, selectable everywhere before any transaction uses them; empty categories delete directly — OK
- [x] "Do one, then apply the rest": single category change stays one-only, settings "Apply Rules to All" re-applies rules across every transaction (overwriting matches) — OK

## Dashboard

- [x] Remove the category filter dropdown from the Spending by Category card — OK

## UI / UX

- [x] Replace all native `window.confirm` popups with a theme-styled in-app confirm dialog (EN/FR) — OK
- [x] Move the tab navigation to a fixed bottom bar, icon over label, active tab in the accent colour — OK
- [x] Use the wallet mark as the PWA/Android icon and the browser-tab favicon, replacing the € glyph — OK
- [x] Replace the desktop-style category and select-all checkboxes with app-like drawn ticks on tappable rows — OK
- [x] Centre the salary fields and their figures in Joint Split — OK
- [x] Move the light/dark toggle into the Settings menu — OK
- [x] Colour themes: six accents with dark-mode steps, picked from Settings and persisted — OK
- [x] Centre the account switcher between the app name and the settings icon — OK
- [x] Restore the wallet mark beside the app name, enlarge the app name, and make the account switcher a prominent accent pill — all on one header row — OK

## Deployment

- [x] Deploy via Portainer instead of docker compose on the server directly, keeping the database in a host folder — Portainer git stack building the Dockerfile, absolute bind mount driven by `DATA_DIR` — OK

## Bug fixes

- [x] Adding a transaction then pressing Cancel no longer leaves an empty transaction — ＋ now opens a draft that only saves to the server on Save — OK
- [x] `update.sh` backups were silently worthless — a `cp` of a WAL-mode `budget.db` captures a stale (possibly table-less) database; `backup.sh` now uses `sqlite3 .backup` — OK
