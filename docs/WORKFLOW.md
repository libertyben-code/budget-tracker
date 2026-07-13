# Budget Tracker — How We Work Together

This file lives at `docs/WORKFLOW.md`. To start a Claude session: **"read docs/WORKFLOW.md and start a session"**.

---

## Starting a session

1. Mention this file and the current branch/feature you want to work on
2. Reference `docs/Bugs.md` — bugs to fix take priority over new features
3. Reference `docs/BACKLOG.md` for the pending `[ ]` items backlog
4. State what you want to accomplish — Claude will ask clarifying questions if needed before starting
5. **Claude creates a feature branch before touching any code** — no exceptions (see Branch strategy below)

---

## Ending a session

Claude follows this checklist at the end of every working session, in order:

1. **Ask the user to test** — "Can you test the build?"
2. **Wait for approval** — do not proceed until the user confirms ("ok", "good", etc.) or requests fixes
3. **Update all docs** once approved:
   - `docs/BACKLOG.md` — delete completed items (move to `docs/DONE.md` with `— OK`)
   - `README.md` — any user-visible change
   - `docs/MAINTAINER.md` — any architecture / gotcha change
   - `docs/WORKFLOW.md` — add dated dev log entry for the session
4. **Commit everything** on the feature branch (code + docs in one commit, or docs as a follow-up commit)
5. **Ask the user to merge** — "Ready to merge `feature/xxx` → `main`?"
6. **After merge confirmed**: bump version, commit the bump, `git push`
7. **Write release notes** — add entry to `CHANGELOG.md` for the new version (see [Changelog format](#changelog-format--release-notes) below), commit + push
8. **Push the release tag** — `git tag vX.Y.Z && git push origin vX.Y.Z`

---

## Branch strategy

> **Rule #1 — enforced at session start**: Claude runs `git checkout -b feature/xxx` as the very first action of every session, before any file edit. If this step is skipped, no code changes are made until it is done.

| Rule | Detail |
|---|---|
| **Never commit to `main` directly** | Always branch first — no exceptions |
| Branch naming | `feature/short-description` (e.g. `feature/dashboard-filters`) |
| One branch per feature set | Group related changes; don't mix unrelated features |
| Merge only when complete | Feature done + docs updated + user smoke test passed |

```bash
# Start of session — always first
git checkout -b feature/my-feature

# End of session — after user approval
git checkout main
git merge feature/my-feature --no-ff
git push
```

---

## Version management

> **Paused as of 2026-07-11**: version bumping is on hold for now — do not bump `package.json` or tag releases on merge until this note is removed. Rules below still describe the intended process for when bumping resumes.

### Rules

| Rule | Detail |
|---|---|
| **Never bump per branch** | Branches are dev-in-progress; version reflects what is released |
| **Bump at merge to `main`** | One bump per merge, committed right after the merge commit |
| Commit message | `chore: bump version to X.Y.Z` |

### Increment guide

| Change type | Bump | Example |
|---|---|---|
| Bug fix, UI tweak, wording | `PATCH` | 1.0.0 → 1.0.1 |
| New feature | `MINOR` | 1.0.x → 1.1.0 |
| Major architectural change | `MAJOR` | 1.x → 2.0.0 |

---

## Changelog format & release notes

Every release entry in `CHANGELOG.md` must follow this format:

```markdown
## X.Y.Z — YYYY-MM-DD

### What's new / Fixes & improvements

- **Feature name**: description.

---
```

**Rules:**

- The heading `## X.Y.Z — YYYY-MM-DD` must match the released version exactly
- The closing `---` marks the end of the section
- Add the entry **before** pushing the tag

---

## Commit discipline

- **One commit per logical change** — not one per file, not one per session
- Format: `type(scope): description` (conventional commits)
  - `feat(ui): add dark mode toggle`
  - `fix(auth): correct token expiry handling`
  - `docs: update README for new export feature`
  - `chore: bump version to 1.1.0`
- Always `git push` immediately after each commit — no local-only commits
- Always add `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` at the end

---

## Before committing — approval flow

**The mandatory flow for any code change:**

1. Claude implements the change and states which files changed and why
2. **User tests the build** and approves or requests changes
3. Claude commits only after explicit user approval ("ok", "good", "commit it", etc.)

**Exceptions (Claude may commit directly after stating intent, no build test needed):**

- Typo / formatting fixes in docs
- Doc-only commits (README, MAINTAINER, WORKFLOW)

**If a tool call is rejected:**
- Do NOT retry the exact same call
- Read the rejection reason — it usually contains the fix
- Adjust approach and confirm before retrying

---

## Documentation — end of session AND before merging

| File | When to update |
|---|---|
| `README.md` | Any user-visible change |
| `docs/MAINTAINER.md` | Any architecture / gotcha change |
| `docs/BACKLOG.md` / `docs/DONE.md` | Move completed items from BACKLOG → DONE immediately |
| `docs/WORKFLOW.md` | When the collaboration process itself changes |

---

## BACKLOG.md is the living backlog

`BACKLOG.md` contains only pending `[ ]` items. `DONE.md` is the archive.

```
# In BACKLOG.md:
- [ ] pending item

# When done — remove from BACKLOG.md, append to DONE.md:
- [x] done item — OK
```

New items are added by the user after testing. Move to `DONE.md` on the commit that closes the item, not before.

---

## Coding style

- **No comments** unless the WHY is non-obvious (a bug workaround, a hidden constraint, a surprise behavior)
- **No docstrings** — well-named identifiers are self-documenting
- **No backwards-compat shims** — change the code directly
- **No defensive error handling** for impossible/internal cases — only at system boundaries (user input, external APIs)
- **Prefer editing existing files** over creating new ones
- **No premature abstractions** — three similar lines is better than a helper for two uses

---

## Known technical constraints

<!-- Add dated entries as you discover surprises, bugs with non-obvious fixes, or hidden constraints. -->
<!-- Format: ### YYYY-MM-DD — Short title -->
<!-- Body: describe the constraint, the rule it implies, and a code example if useful. -->

### 2026-07-12 — Network-first service worker masks a down server

`client/sw.js` is network-first: reads (`GET /`, shell, `/api/bootstrap`, `/api/accounts/:id/data`) fall back to the cache when the server doesn't answer, but writes (PATCH/POST/DELETE) are never cached. So when the dev server is **not running**, the symptoms are: the app still "loads" but slowly (each read waits for the network before the cache falls back), and any write — e.g. changing a transaction category — fails with `NetworkError when attempting to fetch resource`. **Rule:** when a write throws `NetworkError` or loads feel slow, check the server is actually up (`curl http://localhost:3000/api/health`) *before* suspecting app code. A stale registered SW can keep serving cached reads long after the server stopped; DevTools → Application → Service Workers → Unregister + hard reload clears it.

### 2026-07-12 — Container runs as non-root uid 1000

The Docker image drops root (`USER node`, uid 1000). The bind-mounted `./data` volume must be writable by that uid or better-sqlite3 fails to open/create `budget.db`. **Rule:** on the server, `sudo chown -R 1000:1000 data` before `docker compose up` (documented in `docs/V2-SETUP.md`).

---

## Dated development log

<!-- Add an entry at the end of every session. -->
<!-- Format: ### YYYY-MM-DD — Short description (branch name if applicable) -->
<!-- Body: bullet points of what was done. -->

### 2026-07-13 — Category management, apply-rules, styled confirms, add-tx cancel fix (branch: feature/manage-categories)

- **Add categories**: new per-account `custom_categories` table so a category with zero transactions persists and appears in every picker. `client/js/derive.js` `categories()` now returns transaction-derived ∪ custom names. Manage Categories (settings menu) gained an "Add" input; deleting a category with no transactions removes it directly (no reassign step); rename/delete keep `custom_categories` in sync. New endpoint `POST /accounts/:id/categories`; account-data payload carries `customCategories`.
- **"Do one, then apply the rest"**: changing a single transaction's category still affects only that row (and quietly learns a rule). The settings item formerly "Auto-Categorize" is now **Apply Rules to All** — `POST /accounts/:id/autocategorize` was changed from Uncategorized-only to re-applying every rule across all transactions, overwriting where a rule matches; behind a styled confirm with an "N updated" toast. Rule patterns match as case-insensitive substrings, so a short pattern (e.g. `tesco`) generalizes across merchant variants.
- **Styled confirmations**: added `confirmDialog()` to `client/js/dom.js` (promise-based, theme-styled modal, EN/FR) and replaced all 7 `window.confirm` calls (delete tx / batch delete / delete rules / delete savings / delete recurring / delete account / apply rules). The delete-account confirm moved from a hardcoded English string to i18n (`header.confirmDeleteAccount`).
- **Bug fix (add-tx cancel)**: ＋ used to create the transaction on the server immediately, so Cancel left an empty row. Now ＋ sets `creatingTx` and renders a draft row; the server row is created only on Save (`save-new-tx`). Editing an existing transaction (`editingId`) is unchanged.
- **Dashboard**: removed the category-filter dropdown from the Spending by Category card (title + chart only); dropped the now-dead `pieCategories` state and `pie-cat*` actions. The shared top-of-page category filter is untouched.
- Bumped service-worker cache `bt-static-v2` → `v3`. Verified end-to-end via headless-Chrome (phone viewport): all flows pass with zero console errors. No security-model changes.

### 2026-07-12 — Header layout + dashboard chart merge (branch: feature/header-layout)

- Header: account switcher moved out of its own row into the top row, between the app title and the dark-mode/settings buttons, freeing a full row of vertical space for `main`. App name shrunk (1.1rem → 0.95rem) with a new small version line (`v2.0.0`, bump the `VERSION` constant in `client/js/views/header.js` at release) stacked underneath. Account pill resized down to `.btn.small` scale (32px/0.85rem) with a tighter `max-width` so it no longer crowds the app name on narrow widths.
- Dashboard: merged the "Monthly Overview" chart and the category-by-month chart into a single wide card with a two-pane `.chart-split` layout (side-by-side ≥900px, stacked on mobile, divider between panes) — they already shared the same date-range picker, so this was a natural pairing. The category-by-month title dropped its "per Month" suffix (`dashboard.spendingByCategoryMonth`, both EN/FR) since it's now redundant. The standalone "Spending by Category" (horizontal-bar) card above is unchanged.
- No server/data changes; verified by checking the live dev server serves the updated `header.js`/`dashboard.js`/`views.css`/`i18n.js`.

### 2026-07-12 — Security hardening pass before self-host deploy (branch: feature/security-hardening)

- Full read-through security audit of the v2 stack. Clean on the classic axes: SQL fully parameterized (no injection), client rendering uniformly `esc()`-escaped (no XSS), no committed secrets, `npm audit` = 0 vulns, container already bound to `127.0.0.1`. Verdict: the security model rests entirely on Tailscale as the network perimeter — accepted (Tailscale is the user's sole LAN access), so the no-auth design stays.
- Hardening applied and verified end-to-end against a throwaway DB:
  - **Security headers** (`server/src/index.js`): strict CSP (`script-src 'self'`, `style-src 'self' 'unsafe-inline'` for the inline `style=` attributes; covers css/manifest/img/connect/worker), plus `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `x-powered-by` disabled.
  - **CSV export formula-injection guard** (`shared/csv.js`): free-text cells starting `= + - @ \t \r` are `'`-prefixed and all text fields RFC-4180-quoted; the numeric `amount` is left raw so negatives aren't corrupted.
  - **API input coercion** (`server/src/routes/api.js`): transaction create/patch coerce `amount` to a finite number and text fields to strings (a non-string body no longer 500s in better-sqlite3).
  - **Cross-site import bypass closed**: import parser restricted from `*/*` to `text/csv` (no longer a CORS "simple" request, so cross-site POSTs hit a failing preflight).
  - **Container drops root** (`USER node`) + new `.dockerignore` (stops shipping the real DB/`.git`/v1 files into the build context); `docs/V2-SETUP.md` gained the `chown 1000:1000 data` step.
- Not changed: application-layer auth (#1, by design), the offline SW cache snapshot (awareness only), and the naive CSV *import* splitter (correctness, not security — left to avoid perturbing the tested import pipeline).

### 2026-07-12 — v2 UI polish: savings cards, dashboard/joint tweaks, inline category, modern selects, account switcher (branch: feature/v2-ui-polish)

- Savings: each account renders as its own card (was one wrapping card); Total Saved centered hero, subtitle removed; split-by-account chart moved above the account list; add-account behind a ＋ toggle beside the title.
- Joint Split: contribution cards always visible (show €0.00 + hint when no salary) and centered with a clear gap above the salary inputs; the "includes… bill" explanation moved to sit under the Included Transactions header (bills total shown top-right there); removed the "N others not included" line.
- Dashboard: balance/spending tiles centered and unified to one medium size shared with the Transactions tab (`renderTiles` no longer branches on a `hero` flag; `.tile.total-tile` + `.value.big`); trend-range picker (6M/12M/All) moved out of the top row into the Monthly Overview card header since it only scopes the two time-series charts; Spending-by-Category bars now show `€ · %`.
- Transactions: unwrapped the list — the header (title/select-all/＋) sits on the page and each transaction is its own card (desktop table still one card); **inline category editing** — the category is a tappable `<select>` on cards and table rows (`set-category` action patches + learns a rule; a `noop` action stops the tap from also selecting the row).
- Selects modernised app-wide: native `<select>` chrome replaced with `appearance:none` + a shared theme-aware `--chevron` token (tokens.css); category chips are pill-shaped; the category-filter and dashboard category buttons use a `.select-btn` style (dropped the `▾` glyph).
- Account overflow fix: replaced the horizontally-overflowing account tab strip with an **account-switcher dropdown** (`accountMenuOpen` state) — current account button opens a scrollable menu of all accounts (delete + count badge each) with the New-Account form inside; scales to any count, never overflows.
- No new i18n gaps; no server changes. sw.js cache stays `bt-static-v2` (v2 still unreleased).

### 2026-07-11 — v2 UI revamp: responsive layout, charts, filters, savings recurring (branch: feature/v2-ui-revamp)

- Responsive pass — no horizontal page scroll at phone widths (grid/flex `min-width: 0` fixes, `overflow-x: clip`, charts fit the viewport instead of scrolling). Phone-friendly inputs: 16px font (no iOS focus zoom), `inputmode="decimal"` on amounts, 44px touch targets on coarse pointers.
- Filters: single chip row (This Month · Last Month · 3M · 6M · Month… · Year… · Range… · All) replaces the date-type segmented control + separate Current Month toggle + preset buttons.
- Dashboard charts rebuilt (dataviz-validated): Spending by Category → horizontal bars with € labels; Monthly Overview → income vs spending bars; per-month stacked/grouped chart fits the screen with a shared 6M/12M/All trend-range picker (trend charts ignore the time filter to avoid the single-point trap). New CVD-safe chart palette with dedicated dark-mode steps; stable per-category colors with top-7 + "Other" folding.
- Transactions: tap-to-select cards/table rows (per-row checkboxes removed), floating bottom selection bar (no layout shift), inline category edit is a dropdown of existing categories only, add button reduced to ＋.
- Joint Split: duplicate "Total to put" tile removed; coherent field layout.
- Savings: hero centered Total Saved (subtitle removed), split-by-account chart as horizontal bars placed above the accounts list, per-account deposit/withdraw + history, add-account behind a ＋ toggle next to the title. **New feature: recurring monthly deposits** — `savings_recurring` table, rules applied lazily with catch-up on account data load, idempotent via deterministic history ids; UI to add/list/delete rules per savings account.
- All emoji icons replaced with inline SVG icons (`client/js/dom.js` `icons`): edit/trash (accent/danger), header wallet/moon/sun/gear, settings menu, offline banner, recurring.
- `sw.js` CACHE bumped to `bt-static-v2`. README/MAINTAINER still describe v1 — rewrite deferred to cutover (tracked in BACKLOG).

### 2026-07-11 — v2 self-hosted rewrite baseline (branch: feature/v2-rewrite)

- Built the full v2 stack alongside the old CRA app (old `src/` untouched, kept as reference until parity cutover):
  - `server/` — Express 5 + better-sqlite3, ~25 REST endpoints (transactions, batch ops, CSV import/export, rules, category rename/delete propagation, savings, multi-account). CSV import pipeline (skip REVERTED/PENDING → dedup → rules-then-keyword categorization) is server-side and reusable for a future bank connector.
  - `client/` — full plain HTML/CSS/JS rewrite, native ES modules, no build step; Chart.js v4 vendored. All v1 features rebuilt: transactions (inline edit/sort/pagination/multi-select/batch edit), filters, dashboard (3 charts + tiles), joint split, savings, multi-account, dark mode, EN/FR.
  - `shared/` — categorization engine, date + CSV helpers used by both Node and browser. Dates now stored ISO in DB/API, displayed dd/mm/yy.
  - PWA: manifest, network-first service worker with offline read-only fallback, generated icons.
  - Deployment: Dockerfile, docker-compose.yml, update.sh (backup → pull → rebuild); `tailscale serve` provides HTTPS. See `docs/V2-SETUP.md`.
  - `server/scripts/migrate-from-firestore.mjs` — one-time Firestore → SQLite migration (not yet run against real data).
- Verified: 30-check API test suite passes (incl. double-import → 0 duplicates); headless-Chrome drive of all flows at phone + desktop sizes with zero JS errors.
- Committed as a working baseline before a planned revamp session; not merged, no version bump (bumping paused).

### 2026-07-11 — Adopt WORKFLOW docs (branch: feature/adopt-workflow-docs)

- Copied the `docs/` template into the repo and filled in project-specific content:
  - `MAINTAINER.md` — stack, repo layout, dev setup, architecture, Firestore structure, and a smoke test checklist, sourced from `README.md` and the existing codebase.
  - `Bugs.md`, `BACKLOG.md`, `FEEDBACK.md` — reset to empty, project-specific section headers (Transactions, Categorization, Dashboard, Savings, Joint Split, Auth/UI), ready for real items.
  - `DONE.md` — seeded with the CategoryRulesPanel/CategoryManagerPanel/DashboardCharts component extraction (already completed per git history).
  - `WORKFLOW.md` — project title, corrected co-author model string.
- Fixed `README.md`'s "Next Refactor Candidates" list, which was stale: 3 of 4 listed items were already extracted into components; only the batch edit modal extraction remains (moved to `BACKLOG.md` under Evolutions).
