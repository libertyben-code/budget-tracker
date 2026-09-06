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
- Always end with `Co-Authored-By: Claude <model> <noreply@anthropic.com>`, naming the model **actually used for that session** — e.g. `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Sessions run on different models, so this is written fresh each time rather than copied from a fixed string

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

### 2026-08-15 — Equal specificity makes token order decide the accent

`:root[data-theme="dark"]` and `:root[data-accent="green"]` have **identical** specificity (0,2,0), so neither wins on weight — the one written later in `tokens.css` does. An accent block placed above the dark block silently loses in light mode, which reads as "the green theme does nothing" rather than as a CSS ordering problem.

**Rule:** in `tokens.css`, accent blocks go *after* the dark block, and the combined `[data-theme="dark"][data-accent]` pairs (0,3,0) go after those. Adding an accent means adding it in both places or it will look right in one theme only.

### 2026-08-15 — An installed Android PWA caches its launcher icon

Changing `manifest.webmanifest` or the PNGs it points at does not repaint the icon on a phone that already has the app on its home screen — Android copies the icon at install time. The change is invisible on exactly the devices that matter, while looking correct in the browser.

**Rule:** an icon change ships with "remove and re-add the PWA" in the release note. Do not debug the manifest against an installed shortcut; check it in a browser tab first, where the favicon updates immediately.

### 2026-08-16 — A relative bind mount in a Portainer git stack is not on the host

Portainer clones a git stack into its **own** volume and runs compose from there, so `./data:/data` resolves to `/data/compose/<stack-id>/data` inside the Portainer container — not to any folder you can find on the server. The stack starts, the app works, and a brand-new empty database quietly appears in Portainer's internals; deleting the stack deletes the data with it.

**Rule:** the data bind mount in `docker-compose.yml` is an absolute path supplied by a **required** variable (`${DATA_DIR:?…}:/data`) — no default, so an unset or forgotten value fails the deploy instead of inventing a folder. Never "tidy" it back to a relative path or give it a default: the failure is silent and looks like data loss, not like a config error.

### 2026-08-16 — `cp budget.db` is not a backup: the DB is in WAL mode

`openDb()` sets `journal_mode = WAL`, so writes land in `budget.db-wal` and only reach `budget.db` at a checkpoint. Copying `budget.db` alone therefore captures a stale database — and on a DB that has never checkpointed, one with **no tables at all** (verified: the dev DB's 4KB `budget.db` alongside a 222KB WAL copied to a file where `select` fails with `no such table`). The old `update.sh` did exactly this before every update, so those backups were worthless.

**Rule:** snapshot with `sqlite3 "$DB" ".backup '$DEST'"` (what `backup.sh` does) — consistent, WAL-aware, safe while the container runs. If you ever restore by hand, delete the stale `-wal`/`-shm` next to the restored file.

### 2026-09-06 — An installed Android PWA cannot colour its own status bar

`applyTheme` writes the resolved `--accent` into `<meta name="theme-color">`, and that used to colour the strip behind the phone's status bar and follow the accent. A Chrome for Android update around 2026-09 ended that: an installed (standalone) PWA now takes its status-bar colour from the **manifest `theme_color` alone**, a single literal snapshotted at install, and ignores every runtime change to the meta tag. The meta still drives the address bar in a browser *tab* — which is why it reads as the colour breaking only once installed, and why all three of Ben's PWAs lost it on the same day with nothing committed. A platform change presents as a regression with an empty `git log`.

Two wrong fixes were ruled out on a device (verified on CaTetonne, then applied here), each having first shipped in 2.0.4:

- **It is not edge-to-edge.** The page does not draw behind the bar, so `env(safe-area-inset-top)` is 0; a gradient painted into that band shows nothing, and there was no "header sliding under the status bar" to fix either — that premise was wrong.
- **Dropping `theme_color` does not fall back to the meta.** With no manifest colour the bar goes system **black**, not the accent.

**Rule:** there is no runtime control of an installed PWA's status bar. Choose a fixed `theme_color` in the manifest (`#4f6df5` indigo here, the default accent) and accept that it only changes on reinstall — the "static at install" limitation the launcher icon already has. Keep the meta write for browser-tab mode, where it still follows the accent. Do **not** reintroduce a safe-area gradient or a top-inset "fix"; both are recorded here because they looked right and were not. (The genuine `env(safe-area-inset-bottom)` handling on the tab bar and `main` is unrelated and stays.)

---

## Dated development log

<!-- Add an entry at the end of every session. -->
<!-- Format: ### YYYY-MM-DD — Short description (branch name if applicable) -->
<!-- Body: bullet points of what was done. -->

### 2026-09-06 — The status bar cannot follow the accent on an installed PWA (branch: feature/status-bar-fixed-colour)

- The 2.0.4 status-bar changes were wrong and are reverted here. Verified on CaTetonne (which shares this code): an installed Android PWA takes its status bar from the static manifest `theme_color` and ignores the live meta. It is not edge-to-edge — the page never draws behind the bar, so `env(safe-area-inset-top)` is 0, the gradient painted nothing, and the "header sliding under the status bar" that 2.0.4 also claimed to fix was never happening.
- Dropping `theme_color` from the manifest (tested on CaTetonne) made the bar go system black, not the accent — confirming there is no runtime lever. So `.app-header` is back to a plain `var(--surface)` background and `var(--space-3) var(--space-4)` padding, and the manifest keeps its indigo `theme_color`. The genuine bottom-inset handling on the tab bar and `main` is untouched.
- The accent-following status bar is gone on Android; recorded as a constraint above so it is not "fixed" a third time. No visible change from 2.0.4.

### 2026-09-06 — Status-bar strip follows the accent; header stops sliding under it (branch: feature/edge-to-edge-status-bar) — SUPERSEDED

- Shipped in 2.0.4 and wrong; kept only so the mistake is legible. It claimed Chrome had gone edge-to-edge, that the header needed a top inset, and that painting the safe-area band would make the strip follow the accent. None held on a device — see the entry above.

### 2026-08-16 — Backup snapshots are single self-contained files (branch: feature/backup-sidecar-prune)

- **The prune gap, and why it mattered.** `sqlite3 .backup` produces a snapshot that *inherits WAL mode from the source*, so merely opening a backup to check it had data spawned `-wal`/`-shm` sidecars beside it — and the prune glob `budget-*.db` never matched those, so they outlived the snapshot they belonged to. The real danger was not the clutter: a backup carrying an uncheckpointed `-wal` is the same trap as the one that made the old `cp`-based backups worthless, moved from the live database onto the backups themselves.
- Fixed at the root rather than by sweeping: `backup.sh` now switches each snapshot to `journal_mode=DELETE` right after taking it, so every backup is one self-contained file and reading one creates nothing. The prune additionally removes `$old-wal`/`$old-shm` with their parent, covering anything already lying around. **Testing caught what reading the code would not**: the mode switch *itself* leaves an `-shm` behind, so the obvious version of this fix looks right and isn't — hence the `rm -f` immediately after the pragma.
- Verified: 500 rows including uncheckpointed WAL writes preserved, snapshot reports `delete`, inspecting it leaves the folder byte-identical, and 21 snapshots pruned to 14 with each removed snapshot's sidecars going too. Not handled, deliberately: sidecars whose parent was already deleted by the old script. None can be created from now on, so permanent code for a one-time leftover isn't worth it, and an `-shm` with no parent is inert.
- **Commit trailers now name the model actually used** (this file previously hardcoded one). Sessions run on different models; the trailer is written fresh each time.

### 2026-08-16 — Public-repo exposure audit; host path behind a required variable (branch: feature/remove-host-paths)

- Audit prompted by the Portainer move making the repo the deployment source. **The deployment change itself exposes nothing**: the database has never been committed (checked every path that has ever existed in history, plus the largest blobs — no `.db`, no CSV, no keys), the binding is still `127.0.0.1:3001:3000`, `.dockerignore` keeps `data`/`.git` out of the build context, and the docs use `<host>.<tailnet>.ts.net` placeholders rather than the real tailnet.
- **The one real finding predated Portainer**: the v1 Firebase config (project `boo2-budget`, web API key, sender id) is permanently in public history — hardcoded in `src/App.js` from `74c8bbb` "initial commit", and again in a committed `.env` at `e049bb0`. Commits `8863bd3` ("Move Firebase config to environment variables") and `9369ec3` ("Stop tracking .env") only stopped tracking them going forward; both blobs stay fetchable, and the v2 cutover that deleted `src/` didn't touch them either. A Firebase *web* API key is not a credential — it ships in the client bundle by design — so the exposure only bites through project config: whether sign-up was still enabled and what the Firestore rules said. Ben had already closed the Firebase account, which takes the project, its data and its rules with it and leaves the key pointing at nothing. Repo-side residue removed: the dead `.firebase`/`.firebaserc`/`firebase.json` entries in `.dockerignore`. The two Firestore mentions left in this log are historical record.
- **Deployment paths became configuration rather than constants.** The two files got *different* treatments, because they fail differently: `docker-compose.yml` now takes `DATA_DIR` as a **required** variable with no default (`${DATA_DIR:?…}`), while `backup.sh` defaults to the `data/` folder beside the script. Substituting a neutral default like `/srv/budget-tracker/data` in the compose file would have re-created the exact trap from the entry above — a present-but-wrong path mounts an empty folder and the stack comes up healthy on a blank database. A deploy that refuses to start is the safe way to be wrong; a script that only ever runs from your own clone can just look next to itself.
- **Deploy consequence**: the stack needs a `DATA_DIR` environment variable set in Portainer from now on, or *Pull and redeploy* fails at config parse with `required variable DATA_DIR is missing a value` (safe failure — the container is not recreated).
- Verified without Docker on the dev Mac: compose YAML parses with the interpolation intact as one scalar and the loopback port unchanged; `backup.sh` passes `sh -n` and, run from `/` as cron does, found its data folder, captured all 500 rows including uncheckpointed WAL writes, honoured a `DATA_DIR` override, and pruned 24 snapshots to exactly 14.
- Housekeeping: the three merged feature branches (`app-like-ui`, `header-two-row`, `portainer-deploy`) deleted locally and on GitHub after confirming the stack's Reference points at `refs/heads/master`; the remote is now `master` alone.
- Known, not fixed: the prune glob `budget-*.db` ignores the `-wal`/`-shm` sidecars that appear if a snapshot is ever opened in place, so they can outlive their parent — the same stale-WAL hazard the restore procedure warns about.

### 2026-08-16 — Deployment moved to a Portainer git stack (branch: feature/portainer-deploy)

- Deployment went from `docker compose up` run by hand in the server clone to a **Portainer stack deployed from this repository** — Portainer clones `master` onto the server and builds the Dockerfile itself. No registry and no CI, so a deploy is the *Pull and redeploy* button (or GitOps polling). Ben's requirement was that the database stay in a folder he owns on the server, which is what decided the shape of the change.
- The load-bearing edit is one line: `./data:/data` → an absolute host path in `${DATA_DIR}`. Portainer runs a git stack's compose from **its own** volume, so a relative mount resolves to `/data/compose/<stack-id>` inside the Portainer container — the stack would have come up healthy on a brand-new empty database while the real one sat unused, reading as total data loss. The absolute default is the folder that was already there, so nothing had to be migrated. Also added `container_name: budget-tracker` so `docker ps`/`docker logs` don't depend on the stack's name.
- **Found a real bug while rewriting `update.sh`**: its first line was `cp data/budget.db backup-….db`, and the DB runs in WAL mode. Verified against the dev DB — a 4KB `budget.db` beside a 222KB `-wal`, copied alone, produced a file where `select` fails with `no such table`. Every backup that script ever took was stale or empty. `update.sh` became `backup.sh` (git-pull-and-rebuild is Portainer's job now): `sqlite3 .backup` for a consistent online snapshot, written to a sibling `backups/` folder rather than inside the mounted volume, newest 14 kept. Tested locally — full row count in the snapshot, 21 files pruned to 14.
- Cutover gotchas that cost a round trip each and are now in `V2-SETUP.md`: a Portainer stack's source (web editor vs. repository) is fixed at creation, so this needed a *new* stack rather than an edit; the old stack has to be stopped first or port 3001 collides; and the branch must be **pushed** before Portainer can clone it — pointing at a ref that only exists locally gives `reference not found`, which reads like a permissions problem on a public repo. Deploying from `master` before the merge was the dangerous workaround here, since master still had the relative mount.
- Docs: `V2-SETUP.md` deploy/update/backup sections rewritten (stack fields, cutover order, cron line, restore procedure); `MAINTAINER.md` stack + layout; `README.md` setup pointer; two new *Known technical constraints* entries. No application, schema or security-model changes — the container still publishes on `127.0.0.1:3001` and Tailscale is untouched.
- Verified by Ben on the server: stack deployed from the feature branch, existing data intact, app running on his phone.

### 2026-08-15 — Header rework: wallet restored, bigger name, prominent account pill (branch: feature/header-two-row)

- Follow-up to the UI pass below, which had hidden the wallet mark at ≤480px to buy width for a viewport-centred account pill. Ben wanted the mark back, a bigger app name **and** a more visible account switcher — which do not fit a single row alongside a viewport-centred pill: with the wallet and a legible name taking their width, `1fr auto 1fr` leaves the pill about 46px at 390px.
- Tried two rows first (title + gear above, switcher centred below); Ben rejected it, so the final layout is one flex row with the pill centred **between** the name and the gear via `margin: 0 auto` — which is what the original request said. Wallet 18→24px, app name 0.85→1.05rem, pill 125×32 → 142×40 with an accent tint, rounded shape and an `ACCOUNT` label above 700px. Header is 65px, against 57px before and 117px for the rejected two-row version.
- `.app-title` is `flex: 0 0 auto` so the **account name** truncates rather than the app name. Result: the full app name renders at every width from 320px up, where before it ellipsised at ≤430px.
- Two defects found by measuring rather than by eye, both fixed: the `max-width` sat on `.account-btn` instead of the shrinking flex item, so the pill overlapped the gear below 390px; and the account menu hung from `left: 0` of a now-centred button and ran off the right edge, so `.account-switcher .dropdown` became `position: static` and the menu now resolves against the sticky `.app-header` and drops centred under it. `.app-header` z-index 30 → 40 so its dropdowns clear the tab bar's 35.
- Verified over CDP at 320/360/390/430/768/1100: left and right gaps around the pill equal at every width, no overlap, no clipping, no horizontal scroll, menus inside the viewport, all four tabs at a 65px header, zero console errors. Known cosmetic: on a wide desktop the pill sits right of true centre, since the title is wider than the gear.

### 2026-08-15 — App-like UI pass: bottom nav, wallet icon, drawn ticks, accent themes (branch: feature/app-like-ui)

- **Bottom tab bar**: the four tabs left the header for a fixed `.tab-bar`, icon over label, active tab in the accent. `renderNav()` in `views/header.js` is appended after `<main>` by `app.js` — a sibling of the header, since only render order decides which fixed element owns the bottom of the screen. New `--tabbar-h` token drives `main`'s padding, the selection bar and the toast together; the old `.tabs`/`.tab` rules were deleted rather than left behind. New 22px `navIcons` export, separate from the 18px `icons` set.
- **Wallet icon everywhere**: new `client/icons/icon.svg` (the `icons.wallet` path, white on the indigo tile) is now the tab favicon and the source of regenerated `icon-192/512.png`, replacing the € glyph. No rasteriser in the toolchain — headless Chrome generated them, and the command is recorded in `MAINTAINER.md` so the next change to the mark is reproducible. `sw.js` cache `bt-static-v3` → `v4`.
- **Ticks are no longer checkboxes**: `checkRow()`/`checkPill()` in `dom.js` replaced all four native `input[type=checkbox]` (category filter, Transactions "All", rules "All" and per-rule). They are `role="checkbox"` buttons on 44px targets, so the handlers moved from `data-action-change` + `el.checked` to `data-action` + deriving the current state.
- **Accent themes**: six accents as `:root[data-accent]` blocks in `tokens.css`, indigo unchanged as the default and deliberately blockless. `applyTheme()` is the single writer of `data-theme` + `data-accent` and pushes the resolved `--accent` into the `theme-color` meta, which Android needs literal. The chart palette stays independent — a series colour is data, not a preference.
- **Header**: light/dark moved into the Settings menu as *Appearance*, next to the new swatch row; `.header-top` became a `1fr auto 1fr` grid so the account pill is genuinely centred (measured exact at 320–1100px) rather than centred between whatever the neighbours happen to measure.
- **Joint Split**: salary fields centred as a pair, labels and figures centred, inputs capped at 200px.
- Verified over CDP in headless Chrome at 390×844 and 1100×800: zero console errors or exceptions, no horizontal scroll at any width, tab bar flush to the viewport bottom, and the contribution maths unchanged (3200/2400 against 2100 → €1200.00 / €900.00). No server, schema or security-model changes.

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
