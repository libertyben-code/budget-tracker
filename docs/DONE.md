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
- [x] Categories global instead of per budget account — one list in every picker whichever account is active, rename/delete reach every account's transactions, custom categories outlive a deleted account, counts in the manager span all accounts — OK

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
- [x] Saving a new or edited transaction at ≥ 640px stored blank values (amount 0, empty description) — the edit form is rendered in both the hidden cards and the visible table under the same ids, so `getElementById` read the hidden copy; Save now reads the form it sits in, and the ids are gone — OK
- [x] Transaction dates are validated — `POST`/`PATCH` refuse anything but `YYYY-MM-DD` instead of storing `[object Object]` that the month filters then hid — OK
- [x] Savings amounts and balances must be finite — `"1e400"` stored Infinity, which serialised as `null` and broke the total and history — OK
- [x] A request without a JSON body answers 400 instead of throwing — Express 5 leaves `req.body` undefined when no parser matches; it now defaults to `{}` — OK
- [x] Generated ids use `crypto.randomUUID()` instead of `Date.now()` — two savings deposits in the same millisecond collided on `savings_history.id` and answered 500 — OK
- [x] A one-character rule pattern no longer matches every description — rules need at least 2 characters, and shorter ones already stored are skipped — OK
- [x] Server dependencies upgraded with `npm audit fix` (`qs`, `body-parser`, `proxy-addr`, `content-type`) — audit clean — OK
- [x] Category rename/delete reaching `category_rules` for every account — intended since global categories (2026-10-06): categories and rules are both global — OK
- [x] The app re-imports its own CSV export — import split on bare commas, so a quoted `"Shop, Ltd"` shifted every later column; it now reads quoted fields (commas, `""`, line breaks) and strips the export's `'` formula guard — OK
- [x] Transaction edit/delete routes are scoped to an account — `PATCH`/`DELETE` and the batch routes moved under `/accounts/:id/transactions/…` and only touch that account's rows, so another account's id answers 404 or changes nothing (auth rollout prep) — OK

## Bank sync

- [x] Connect Revolut and Crédit Agricole through a free third-party API — Enable Banking restricted production, Settings ▸ Bank sync, first sync in the callback, per-account mapping and cutover — OK
- [x] Keep the personal and joint bank accounts as separate budget accounts — re-mapping moves the imported rows, inline account creation from the panel — OK
- [x] Savings accounts fed from the bank — balance from the balances endpoint, movements as history, savings-type accounts unmapped by default — OK
- [x] Savings fed from transactions — a savings account linked to a category derives its balance and history from the tagged transfers, for pockets the bank does not expose — OK
- [x] Sync all accounts from the Settings menu — one entry, shown once a bank is linked, syncs every connection — OK

## Savings

- [x] Savings global instead of per budget account — one Savings tab whatever account is active, savings outlive a deleted budget account, a category-fed account sums the category across every budget account; a rename carries the link, a delete drops it only once no account has the category — OK

## UX overhaul — branch `feature/ux-plan` (2026-11-08, awaiting the phone test before merge)

From the 2026-11-07 UX audit; one session per item. Flip these to `— OK` once tested on the phone.

- [x] Toasts match the outcome: neutral confirmations, red errors, live region, Undo actions (Q1)
- [x] Batch edit keeps the typed description when choosing "Create new category" (Q2)
- [x] Category delete choices appear in place of the row, not below the list (Q3)
- [x] New/edited transactions refuse a zero amount or empty description, client and server (Q4)
- [x] Text on accent and status colours reaches 4.5:1 in all 12 theme × accent pairs (Q6)
- [x] Copy fixes: page language follows the app, real plurals, neutral boot text, "Main Account" fits the pill (Q8)
- [x] Apply a new category to similar uncategorised rows in every account, with Undo (M1)
- [x] Category picker sheet with search, recent picks and "New category" (M2)
- [x] First-run welcome card and starter categories in EN/FR (M3)
- [x] "Can't reach your server" banner; writes paused; 401/403 told apart from unreachable (M4)
- [x] Other-currency bank accounts get their own budget account (or are left out) at link time; link summary; bank panel copy (M5)
- [x] Settings menu grouped (Data / Organise / Preferences); Import reachable by keyboard; appearance follows the phone (M6)
- [x] Dialog and form accessibility: roles, labels, Escape, focus trap and return, inert background, reduced motion (M7)
- [x] Charts rebuilt only when their data changes; no animation under reduced motion (M8)
- [x] Joint split from the two salaries and the wanted amount, one setting for every account (M9)
- [x] Savings: inline errors, receipts with Undo, removable history entries (M10)
- [x] Real account balance: bank balance for synced accounts, opening balance for manual ones (M11)
- [x] Dashboard month stepper; Dashboard and Transactions filters independent (L1a)
- [x] Dashboard month at a glance: balance, net/in/out, "need a category" card; honest Transactions tiles (L1b)
- [x] Compact day-grouped transaction rows, Select mode, empty states (L2a)
- [x] Transaction detail sheet; delete and batch delete with Undo (L2b)
- [x] Compact filter bar with a Filters sheet; search matches amounts (L2c)
- [x] Add-transaction sheet with Expense/Income, labelled fields and Undo (L3)
- [x] "To categorise" inbox grouped by merchant (L4)
- [x] Typed form values and focus survive re-renders (L5)
- [x] Desktop navigation rail from 900px (L6)
- [x] One money formatter per language and account currency; "Uncategorized" translated (Q5)
- [x] Boot failures no longer all read as "offline": `api.js` errors carry their status (from docs/Bugs.md, closed by M4)
