# CLAUDE.md — Budget Tracker

Routing index. **Read this, then open only the one doc/file the task needs.** `docs/` is ~88 KB and
`WORKFLOW.md` alone is 39 KB — opening it as a warm-up costs more than most tasks then use. Detail
lives in the docs below; this file is the map plus the rules that apply to every task.

## What this is

Self-hosted personal finance app: **plain HTML/CSS/JS frontend** (no build step, no framework) +
Node/Express + SQLite backend, installed as a PWA on the phone over **Tailscale**. No login, no
cloud dependency — the data stays on your own server.

Unlike the sibling PWAs (`score-counter`, `CaTetonne`, `pwa-sync-template`), this one is **not**
built from the Vite template and has no outbox/watermark sync engine: the client talks to the API
directly. Don't reach for those repos' patterns here.

**Default branch is `master`**, not `main`.

## Where to read (docs/) — open the ONE that matters

| Need | File |
|------|------|
| How we work: session start/end, branches, commits, versioning, **and the constraints below** | `docs/WORKFLOW.md` |
| Architecture: schema, derivation, service worker | `docs/MAINTAINER.md` |
| Deploying (Docker, Portainer git stack, volumes, backups) | `docs/V2-SETUP.md` |
| Adding accounts/auth | `docs/AUTH_ROLLOUT_PLAN.md` |
| Pending work / known bugs / shipped / requests | `docs/BACKLOG.md`, `docs/Bugs.md`, `docs/DONE.md`, `docs/FEEDBACK.md` |

Note the casing: `Bugs.md` here, not `BUGS.md`.

## Landmarks

- `client/js/` — `app.js` (shell/router), `api.js` (server calls), `store.js` (client state),
  `derive.js` (computed figures), `dom.js`, `i18n.js`, and `views/` (`dashboard`, `transactions`,
  `savings`, `filters`, `header`, `joint-split`, `category-manager`, `rules-panel`,
  `batch-edit-modal`).
- `client/` also holds `sw.js` and `manifest.webmanifest` directly — no bundler, so **what ships is
  what is on disk**.
- `shared/` — `categorize.js`, `csv.js`, `dates.js`: used by both sides. A change here lands on the
  client and the server at once.
- `server/src/` — `index.js` (entry), `db.js`, `routes/api.js`, `schema.sql`. `npm start` in
  `server/`.
- `backup.sh`, `Dockerfile`, `docker-compose.yml` at the root; the SQLite file lives in `data/`.

## Constraints index — a bug already paid for each of these

**Do not read all of WORKFLOW.md to find these.** Recognise the situation here, then open that one
dated section.

- **A network-first service worker masks a down server** — the app looks fine while nothing works.
- **`cp budget.db` is not a backup: the DB is in WAL mode.** Use `backup.sh` / `VACUUM INTO`.
- **A relative bind mount in a Portainer git stack is not on the host** — it resolves inside the
  stack's own checkout, so data written there is not where you think it is.
- **The container runs as non-root uid 1000** — anything it must write has to be owned accordingly.
- **Equal specificity makes token order decide the accent** — theme selectors are resolved by source
  order, not by intent.
- **An installed Android PWA caches its launcher icon**, and **cannot colour its own status bar**
  (two attempts, the second superseded — read both before trying a third).

## Rules that apply to every task (inline so they're always loaded)

**Rule #1 — branch first.** `git checkout -b feature/short-description` is the very first action of
every session, **before any file edit**. Never commit to `master` directly.

**Approval flow.** Claude implements and states what changed and why → user tests → only then
commit. Doc-only and typo fixes may be committed directly after stating intent.

**Commits.** One per logical change (not per file, not per session). `<type>: <description>` —
`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`. Imperative mood, first line under 50 characters.

**Coding style:**
- No comments unless the WHY is non-obvious (bug workaround, hidden constraint, surprise).
- No docstrings — well-named identifiers are self-documenting.
- No backwards-compat shims — change the code directly, or flag the break in docs.
- No defensive error handling for impossible/internal cases — only at boundaries (user input, APIs).
- Prefer editing existing files over creating new ones.
- No premature abstractions — three similar lines beat a helper used twice.

**Item tracking.** Pending `[ ]` items live in `docs/BACKLOG.md` / `docs/Bugs.md`; move an item to
`docs/DONE.md` with `— OK` on the commit that closes it, not before.

**Session start.** Just say what you want to work on — this file loads automatically. Bugs take
priority over new features, so check `docs/Bugs.md` when choosing work. One feature or one bug per
session: every request re-sends the whole conversation, so carrying finished work forward pays for
it again on every later request.

**Keep this file a map — don't let it grow.**
