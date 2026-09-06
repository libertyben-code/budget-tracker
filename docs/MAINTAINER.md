# Budget Tracker — Maintainer Guide

## Stack

- **Frontend**: plain HTML/CSS/JS, native ES modules, no build step. Chart.js v4 vendored in `client/vendor/`.
- **Backend**: Express 5 + better-sqlite3. All routes in one file.
- **Database**: SQLite (WAL mode), single file at `data/budget.db`, bind-mounted into the container from the absolute host path in `DATA_DIR` (a required stack variable — the compose file has no default, so a missing value fails the deploy rather than mounting the wrong folder).
- **Deployment**: a Portainer stack deployed from this git repository (Portainer clones the repo on the server and builds the Dockerfile — no registry, no CI), exposed over the tailnet via `tailscale serve` (HTTPS, required for PWA install). No application-layer auth — Tailscale is the security perimeter.

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
├── Dockerfile, docker-compose.yml, backup.sh, .dockerignore
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

### Header layout

One flex row: `.app-title` (wallet + name), `.account-switcher`, then the settings `.dropdown`. Three things about it are load-bearing and none are obvious from reading the rules:

- **`.app-title` is `flex: 0 0 auto` — it never shrinks.** When the row runs out of width the account pill gives way instead. That is a deliberate priority call, not an oversight: the app name is fixed branding, while the account name is user data that is also readable in full in the dropdown. Making the title shrinkable puts an ellipsis in "Budget Tracker" at 360px.
- **The width cap lives on `.account-switcher`, not on `.account-btn`.** Flex shrinking applies to the flex item; with the `max-width` on the button, the button keeps its content width and rides over the settings gear below 390px.
- **The account menu is anchored to the header, not to its own button.** `.account-switcher .dropdown` is `position: static`, so the absolutely positioned menu resolves against `.app-header` (sticky counts as positioned) and drops centred beneath the whole header. A menu hanging from `left: 0` of a centred button runs off the right edge of a phone.

The pill is centred **between the name and the gear** via `margin: 0 auto`, not on the viewport. A `1fr auto 1fr` grid would viewport-centre it, but equal side columns leave roughly 46px for the pill at phone width once a visible wallet and a legible name have taken theirs — the layout was tried that way and reverted. The visible consequence is that on a wide desktop the pill sits right of the true centre, because the title is much wider than the gear.

`.app-header` sits at `z-index: 40`, above the tab bar's 35: the header's dropdowns are its children and inherit its stacking context, so a tall menu would otherwise slide under the bar.

### Navigation

The tab bar is `renderNav()` in `views/header.js`, appended after `<main>` by `app.js` — a sibling of the header rather than part of it, because it is `position: fixed` and only the render order says which one owns the bottom of the screen. `main` carries a `padding-bottom` of `--tabbar-h` plus the safe-area inset; the selection bar and the toast are offset by the same token. **Changing `--tabbar-h` moves all four**, which is the reason the height is a token and not a number in the rule.

Nav glyphs are a separate export (`navIcons`, 22px) from the 18px `icons` set — a tab bar reads by its glyph first. Both draw with `stroke="currentColor"`, so `.tab-btn.active { color: var(--accent) }` is the whole of the active state and it follows a theme change for free.

### Theming

Two attributes on `<html>`: `data-theme` (`light`/`dark`) and `data-accent`. `applyTheme()` in `views/header.js` sets both and is the only writer — called once at boot from `app.js` and again from the two settings actions.

`tokens.css` holds one block per accent, overriding `--accent`, `--accent-strong` and `--accent-soft`. **Order in that file is load-bearing**: `:root[data-theme]` and `:root[data-accent]` have equal specificity, so the accent blocks must come after the dark block to win in light mode; the `[data-theme="dark"][data-accent]` pairs outrank both and can sit anywhere after them. `indigo` is the default and deliberately has no block — it is what `:root` already says, so an unset preference costs nothing.

`applyTheme` also writes the *resolved* `--accent` into the `theme-color` meta. That only reaches the status bar in a browser **tab** (Android cannot resolve a CSS variable, so the computed value has to be pushed back after the attribute changes). Since a Chrome update around 2026-09, an installed (standalone) PWA takes its status bar from the manifest `theme_color` alone (static, snapshotted at install) and ignores runtime meta changes, so the bar cannot follow the accent — it is the fixed manifest indigo. See the WORKFLOW constraints entry, which records the two fixes that looked right and were not.

The chart palette (`--chart-1…8`) is deliberately **not** derived from the accent: a series colour is data, and following a per-device preference would make one chart mean different things on two phones.

### Selection ticks

No native `input[type=checkbox]` anywhere in the app. `checkRow()` and `checkPill()` in `dom.js` render a drawn box with `role="checkbox"` + `aria-checked`, since the semantics are no longer carried by an input. The check glyph is always in the DOM and only changes colour — swapping it in and out would resize the box and shift the label beside it.

Consequence for handlers: these are `data-action` (click), not `data-action-change`, and there is no `el.checked` to read. Each action derives the current state and toggles it — `select-all` recomputes `allVisibleSelected` rather than trusting the DOM. The category dropdown lives inside `[data-keep-open]`, so ticking several categories in a row does not close it; the same is true of the accent swatches.

### Server

`server/src/routes/api.js` holds every REST endpoint: transactions (CRUD, batch ops, CSV import/export), rules, category create/rename/delete propagation, savings (incl. recurring deposits), and multi-account management. `server/src/schema.sql` is the source of truth for the DB schema. Dates are stored ISO (`YYYY-MM-DD`) in the DB and API, displayed `dd/mm/yy` client-side. Amounts: negative = spending, positive = income. Category rules are global; everything else is per budget account.

**Categories** are not a first-class table of record — the list shown in every picker is derived (`client/js/derive.js` `categories()`) as the union of the categories actually used by transactions **plus** any user-defined names in the `custom_categories` table (per account). This lets a brand-new category with zero transactions exist and be selectable. `POST /accounts/:id/categories` adds one; rename/delete keep `custom_categories` in sync alongside the transaction/rule propagation. `POST /accounts/:id/autocategorize` ("Apply Rules to All" in the UI) re-applies every rule across **all** transactions, overwriting where a rule matches the description (rule patterns are matched as case-insensitive substrings — see `shared/categorize.js`).

Recurring savings deposits live in `savings_recurring` (amount + day 1–28); due deposits are applied lazily on `GET /accounts/:id/data` with multi-month catch-up, using deterministic history ids (`rec_<ruleId>_<date>`) so an occurrence can never apply twice.

### Shared

`shared/categorize.js`, `shared/csv.js`, `shared/dates.js` are pure ESM modules imported by both the server (Node) and the client (browser) — one categorization/CSV/date implementation, no drift between import-time and display-time behavior.

### PWA

`client/sw.js` is a network-first service worker: reads fall back to cache when the server is unreachable; writes are never cached. Bump the `CACHE` constant on release. See the "Known technical constraints" section in `docs/WORKFLOW.md` for the failure mode when the server is down.

`client/icons/icon.svg` is the source of the app mark — the same wallet path as `icons.wallet`, white on the indigo tile. `icon-192.png` and `icon-512.png` are rasterised **from it**, so a change to the mark means regenerating both rather than editing them. There is no build step and no SVG rasteriser in the toolchain; headless Chrome is what generated the committed pair:

```sh
# from client/icons, with icon.svg alongside an <img src="icon.svg" width=N height=N> page
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --default-background-color=00000000 --screenshot=icon-192.png --window-size=192,192 file://…/icon-192.html
```

The SVG is also the browser-tab favicon (declared before the PNG, so browsers that support it prefer it). **An installed Android PWA caches its launcher icon at install time**: changing the mark does not reach a phone that already has it on the home screen — that needs a remove and re-add.

## Known gotchas

See the dated entries in `docs/WORKFLOW.md` under "Known technical constraints" (service worker cache masking a down server; container non-root uid and volume permissions; relative bind mounts in a Portainer git stack; WAL mode and `cp`-based backups).

## Smoke test checklist

1. Add a manual transaction on an account; confirm it saves and appears in the transaction list. Press ＋ then Cancel and confirm **no** empty transaction is left behind.
   - Create a category in Manage Categories and confirm it shows in a transaction's category picker; change one transaction's category, then run **Apply Rules to All** and confirm matching transactions follow.
2. Import a CSV; confirm rows parse, dedupe against existing transactions, and auto-categorize via rules.
3. Create/rename/delete a category rule; confirm it applies to matching transactions.
4. Check dashboard charts (spending by category, monthly overview, category-by-month) update correctly when filters/date range change.
5. Add a savings account, record a deposit and a withdrawal; confirm balance and chart update. Add a recurring deposit rule and confirm catch-up applies correctly.
6. Toggle **Appearance** and the EN/FR language switch in the Settings menu; pick an accent from the colour swatches. Confirm all three persist across reload, and that the menu stays open while trying several colours.
7. Switch between accounts via the account switcher; confirm data is isolated per account.
   - At a phone width, confirm the wallet and the full app name are both visible, the switcher sits between them and the gear without touching either, and opening it drops a menu that stays inside the screen. Narrow the window to ~320px: the account name shortens, the app name does not.
8. Tap each of the four tabs in the bottom bar; confirm the active one takes the accent colour and that no card, selection bar or toast is hidden behind the bar at the end of a long list.
9. Tick several categories in the filter dropdown and the **All** pill above the list; confirm the dropdown stays open while ticking, and that untapping returns to the previous state.
10. Install as a PWA on a phone over Tailscale; confirm offline reads still render (writes should fail gracefully when offline). A fresh install shows the wallet icon on the home screen — an existing one keeps the icon it was installed with until it is removed and re-added.
