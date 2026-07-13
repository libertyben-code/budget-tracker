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

## Bug fixes

- [x] Adding a transaction then pressing Cancel no longer leaves an empty transaction — ＋ now opens a draft that only saves to the server on Save — OK
