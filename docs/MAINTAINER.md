# Budget Tracker — Maintainer Guide

## Stack

- **Frontend**: plain HTML/CSS/JS, native ES modules, no build step. Chart.js v4 vendored in `client/vendor/`.
- **Backend**: Express 5 + better-sqlite3. All routes in one file.
- **Database**: SQLite, single file at `data/budget.db` (bind-mounted into the container).
- **Deployment**: Docker + Docker Compose, exposed over the tailnet via `tailscale serve` (HTTPS, required for PWA install). No application-layer auth — Tailscale is the security perimeter.

## Repository layout

```
budget-tracker/
├── client/
│   ├── index.html
│   ├── manifest.webmanifest, sw.js       — PWA manifest + network-first service worker
│   ├── css/                              — tokens.css, base.css, components.css, views.css
│   ├── icons/
│   ├── vendor/chart.umd.min.js
│   └── js/
│       ├── app.js                        — entry point / tab composition
│       ├── store.js                      — app state
│       ├── api.js                        — all server calls
│       ├── derive.js                     — memoized derived data (filters, chart data, stats)
│       ├── dom.js                        — DOM helpers + inline SVG icon set
│       ├── i18n.js                       — EN/FR strings
│       └── views/                        — one module per screen (dashboard, transactions,
│                                            savings, joint-split, filters, category-manager,
│                                            rules-panel, batch-edit-modal, header)
├── server/
│   ├── src/
│   │   ├── index.js                      — Express app, security headers
│   │   ├── db.js                         — SQLite connection/init
│   │   ├── schema.sql
│   │   └── routes/api.js                 — ~25 REST endpoints
│   └── package.json
├── shared/                               — pure ESM, imported by both Node and the browser
│   ├── categorize.js                     — rule-based categorization engine
│   ├── csv.js                            — CSV import/export helpers
│   └── dates.js
├── Dockerfile, docker-compose.yml, update.sh, .dockerignore
└── docs/
    ├── WORKFLOW.md      — how we work together
    ├── MAINTAINER.md    — this file (architecture + gotchas)
    ├── V2-SETUP.md       — deploy, backups, security model
    ├── BACKLOG.md       — pending items
    ├── FEEDBACK.md      — items pending user test/confirmation
    ├── DONE.md          — completed archive
    └── Bugs.md          — confirmed bugs
```

## Branch strategy

| Branch | Purpose |
| --- | --- |
| `master` | Stable, smoke-tested releases |
| `feature/*` | Feature branches — merge to `master` after smoke test |

All work happens on feature branches. Merge to `master` only after the smoke test below.

## Dev setup

```bash
cd server && npm install && cd ..
node server/src/index.js
# open http://localhost:3000
```

A fresh `data/budget.db` is created automatically and seeded with a `default` account. See `docs/V2-SETUP.md` for the full Docker/Tailscale deploy.

## Architecture

### State model

`client/js/store.js` holds app state; `client/js/app.js` wires up the tabs and re-renders views on state change. Each screen is its own module under `client/js/views/`. All server communication goes through `client/js/api.js`.

- **Confirmations** use `confirmDialog()` in `client/js/dom.js` (a promise-based, theme-styled modal that mirrors `toast()`), never `window.confirm`. It appends to `document.body` so it survives the render loop; callers `await` it and pass already-translated labels (`confirmLabel`/`cancelLabel`, `danger` for destructive actions).
- **Adding a transaction** uses a client-only draft: the ＋ button sets `creatingTx` and renders a blank edit row; the server row is created only on Save (`save-new-tx`), so Cancel creates nothing. Editing an existing transaction is separate (`editingId`) and only patches on Save.

### Server

`server/src/routes/api.js` holds every REST endpoint: transactions (CRUD, batch ops, CSV import/export), rules, category create/rename/delete propagation, savings (incl. recurring deposits), and multi-account management. `server/src/schema.sql` is the source of truth for the DB schema. Dates are stored ISO (`YYYY-MM-DD`) in the DB and API, displayed `dd/mm/yy` client-side. Amounts: negative = spending, positive = income. Category rules are global; everything else is per budget account.

**Categories** are not a first-class table of record — the list shown in every picker is derived (`client/js/derive.js` `categories()`) as the union of the categories actually used by transactions **plus** any user-defined names in the `custom_categories` table (per account). This lets a brand-new category with zero transactions exist and be selectable. `POST /accounts/:id/categories` adds one; rename/delete keep `custom_categories` in sync alongside the transaction/rule propagation. `POST /accounts/:id/autocategorize` ("Apply Rules to All" in the UI) re-applies every rule across **all** transactions, overwriting where a rule matches the description (rule patterns are matched as case-insensitive substrings — see `shared/categorize.js`).

Recurring savings deposits live in `savings_recurring` (amount + day 1–28); due deposits are applied lazily on `GET /accounts/:id/data` with multi-month catch-up, using deterministic history ids (`rec_<ruleId>_<date>`) so an occurrence can never apply twice.

### Shared

`shared/categorize.js`, `shared/csv.js`, `shared/dates.js` are pure ESM modules imported by both the server (Node) and the client (browser) — one categorization/CSV/date implementation, no drift between import-time and display-time behavior.

### PWA

`client/sw.js` is a network-first service worker: reads fall back to cache when the server is unreachable; writes are never cached. Bump the `CACHE` constant on release. See the "Known technical constraints" section in `docs/WORKFLOW.md` for the failure mode when the server is down.

## Known gotchas

See the dated entries in `docs/WORKFLOW.md` under "Known technical constraints" (service worker cache masking a down server; container non-root uid and volume permissions).

## Smoke test checklist

1. Add a manual transaction on an account; confirm it saves and appears in the transaction list. Press ＋ then Cancel and confirm **no** empty transaction is left behind.
   - Create a category in Manage Categories and confirm it shows in a transaction's category picker; change one transaction's category, then run **Apply Rules to All** and confirm matching transactions follow.
2. Import a CSV; confirm rows parse, dedupe against existing transactions, and auto-categorize via rules.
3. Create/rename/delete a category rule; confirm it applies to matching transactions.
4. Check dashboard charts (spending by category, monthly overview, category-by-month) update correctly when filters/date range change.
5. Add a savings account, record a deposit and a withdrawal; confirm balance and chart update. Add a recurring deposit rule and confirm catch-up applies correctly.
6. Toggle dark mode and the EN/FR language switch; confirm both persist across reload.
7. Switch between accounts via the account switcher; confirm data is isolated per account.
8. Install as a PWA on a phone over Tailscale; confirm offline reads still render (writes should fail gracefully when offline).
