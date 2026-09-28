# Auth Rollout Plan — public access for the 3 PWAs

**Status:** decided, not started · **Written:** 2026-09-06 · **Revised:** 2026-09-28 (review
session, decisions below) · **Owner:** ben

Plan to give `CaTetonne`, `budget-tracker` and `score-counter` real login-based access over the
public internet, **Tailscale removed**, with per-user data isolation and owner-paired sharing —
and, separately, to put all three on the Play Store as **server-less** apps. The same text lives
in all three repos; edit it in one and copy it to the others.

---

## 1. Decisions (2026-09-28)

| Decision | Choice | Consequence |
|---|---|---|
| Access for friends | **Public HTTPS + login**, Tailscale gone | Every request is authenticated by a server-side session; the tailnet IP check is deleted, not kept as a second wall. |
| Who can register | **Owner creates every account** (CLI, later an admin page) | No public sign-up, no invite links, no e-mail. The account is born pending with a one-time activation code; the person sets their own password. |
| Identity scope | **One login per app**, no SSO | Each app keeps its own SQLite, its own `users`/`sessions`, its own container. |
| Data model | **One workspace per account; the owner can pair a couple** | Data is isolated *between* workspaces and shared *within* one. The only sharing is an admin action: add user B to A's workspace. |
| Auth source | **Port `Project_Planner` auth** (`server/src/auth/*`, `routes/auth.js`, `middleware/auth.js`, `scripts/create-user.js`) | Argon2id with scrypt fallback, opaque sessions stored as SHA-256, cookie + CSRF double-submit, brute-force lockout, constant-time login. Postgres → SQLite is a mechanical rewrite. |
| Friends on Android | **TWA** (Trusted Web Activity, Bubblewrap) on the public URL — optional, the PWA install already works | Same origin as the site: cookies, service worker and IndexedDB unchanged, no CORS. |
| Store apps | **Capacitor APK/AAB, local-only, no server** — score-counter and budget-tracker free, CaTetonne free + one-time paid unlock (`CaTetonne/docs/ROADMAP.md` Phase B) | The existing `VITE_APP_MODE=store` build for the two Vite apps. **budget-tracker has no local data layer** (client talks to the API for everything) — its store version needs an in-browser database first, and goes last. |
| Ingress | **Cloudflare Tunnel** recommended (open decision §7) | No inbound port on the home router, TLS and edge rate-limiting for free, home IP hidden. One subdomain per app, which is also what Android's install-by-host needs. |
| Perimeter | **Cloudflare Access in front of all three hostnames** (decided 2026-09-28) | A one-time e-mail code (or Google login) at the edge, allow-list of the friends' addresses, before the app's own login page is reachable. Bots and scanners never reach the server; an unknown Express/Node bug has nobody to exploit it. Free up to 50 users. The app keeps its own login for identity and workspaces. |

Store and friends builds are **two different Android apps per product** (different application
ids, different signing). Never upload the friends/TWA build to the public listing.

---

## 2. Current state (2026-09-28)

- Tailscale *is* the auth: `middleware/auth.js` admits any request carrying a tailnet address in
  `X-Forwarded-For`; `GET /api/sync` returns the whole database. Sync tables have no owner column.
- Deployment: each app container shares a Tailscale sidecar's network namespace
  (`network_mode: service:ts-*`), `tailscale serve` proxies to `127.0.0.1:3000`.
- Review findings that gate public exposure are filed in each repo's `docs/BUGS.md` (budget:
  `docs/Bugs.md`). The two that block a second user: **the server merge is last-push-wins**
  (writers never compare `edited_at`) and **sync validators bound nothing**.
- Harmonised on 2026-09-28 (branch `feature/public-prep-harmonize`, awaiting test): CaTetonne lost
  its wildcard CORS and gained the security headers and the modal title/double-tap fixes
  score-counter already had; score-counter binds `HOST` and pins the Tailscale image; the error
  handler, health and sync 500s no longer return SQLite's message; budget-tracker answers unknown
  `/api/*` with a JSON 404 and has a JSON error handler.
- `pwa-sync-template` is **not a git repository**. Do the engine work in `score-counter` (2 lines
  of drift from the template) and copy back; do not start there.
- DB idioms differ: async `dbRun/dbGet/dbAll` (sqlite3) in the two Vite apps, synchronous
  `db.prepare(...)` (better-sqlite3) in budget-tracker. budget-tracker also has **no migration
  runner** — `schema.sql` is `CREATE TABLE IF NOT EXISTS` and `meta.schema_version` is never read.
- Containers run as root in score-counter and CaTetonne (no `USER`); budget-tracker runs as `node`.

---

## 3. Target model

**Server-side tenancy, client unaware.** A browser origin holds one logged-in user at a time, so
the client schema does not change:

- `users`, `sessions` as in Planner's `003_auth.sql`, rewritten for SQLite (text timestamps,
  integer booleans, `?` placeholders). Roles: `admin` (the owner) and `user`.
- `workspaces(id, name, created_at)` and `workspace_members(workspace_id, user_id, role)`. An
  account gets its own workspace at creation; pairing = a second membership row, admin-only.
- **`workspace_id` on every synced table**, stamped by the server from the session on every write
  (a client-supplied value is ignored), filtered on every read. The upsert must also refuse to
  overwrite a row that belongs to another workspace: `ON CONFLICT(id) DO UPDATE … WHERE
  workspace_id = excluded.workspace_id AND <incoming stamp is newer>` — the same rewrite that fixes
  last-push-wins, so **the two land together, with tests**.
- Existing rows are backfilled to the owner's workspace in the same migration.
- budget-tracker: `workspace_id` on `accounts` and `category_rules` (`UNIQUE(workspace_id,
  pattern)`); children reach it through `account_id` / `savings_account_id`; `requireAccount` checks
  membership, and the child-id routes join through the account. The hard-coded `'default'` account
  becomes "create on first login". Ids move from `Date.now()` to `crypto.randomUUID()`.

**Session presentation.** Cookie (`<app>_session`, httpOnly, Secure, SameSite=Lax) + CSRF cookie
echoed in `X-CSRF-Token` on unsafe methods — Planner's `requireSession` verbatim. Its Bearer path
stays in the middleware (free) but no client uses it. Sessions: idle 14 d, absolute 90 d (Planner's
30 d idle suits an internal tool; these are phones that get lost), and Settings offers "log out
everywhere" (`destroyUserSessions`).

**Client.** A login page rendered by the client (never a server redirect: the service worker
serves cached `index.html` for every navigation), gating the app before `startSync()`; every auth
endpoint under `/api/auth/*` (the worker never caches `/api`). Sync fetches add the CSRF header;
a 401 raises `auth-required` instead of backing off. **Logout and a login as a different user wipe
IndexedDB and the watermark** (`resetAllData`) — the device may be shared. budget-tracker also
clears its Cache Storage entries.

**Account lifecycle.** `npm run create-user -- <username> "<Display>" [--pair-with <username>]`
prints a one-time activation code; the person activates in the login page (username + code + new
password). `--reissue` is the password reset. Later: an admin page in Settings for the same three
actions (create, reissue, pair), server-enforced `requireAdmin`.

---

## 4. Threat model (unchanged in substance)

Stage 0 — unauthenticated: only the login and activation routes and the static PWA are reachable;
mitigations are lockout (persisted), edge rate-limiting, small body limit on `/api/auth`,
constant-time login. Stage 1 — a valid account: sees exactly its workspace; cross-workspace access
needs an authorisation bug, so scoping is tested. Stage 2 — app RCE: the app's whole SQLite. **With
Tailscale removed the public apps are no longer on the tailnet**, which was the 2026-09-06 plan's
worst case; keep them on an isolated Docker network with nothing else on it. Stage 3 — container
escape: `USER node`, `cap_drop: [ALL]`, `no-new-privileges`, no docker socket.

Behind Cloudflare the app must `app.set('trust proxy', 1)` and read the client IP from
`CF-Connecting-IP` for lockout and rate-limit keys; otherwise every visitor is the tunnel.

**Access moves Stage 0 off the server.** With Access in front, an unauthenticated stranger reaches
Cloudflare's login page and nothing else; the app's `/api/auth/*` routes only ever see people on the
allow-list. Two consequences the code must honour: the tunnel is the only path in, so the app must
**verify the `Cf-Access-Jwt-Assertion` header** on every request (Cloudflare's public keys, the
application's AUD tag) and refuse without it — otherwise a leaked tunnel token or a misconfigured
route bypasses the perimeter; and when the Access cookie expires the edge answers an API call with a
**302 to its login page instead of JSON**, which the client must treat as "log in again", not as a
sync error. Access is a perimeter, not identity: the workspace is still decided by the app's session.

---

## 5. Phases and sessions

One feature per session (see CLAUDE.md). The order is the dependency order.

**S1 — done 2026-09-28.** Review, harmonisation, this plan.

**S2, S3 — sync writer rewrite** (score-counter, then CaTetonne; copy to the template). Upsert on
every table with a newer-stamp guard and a `workspace_id` equality guard, server tests for both;
CaTetonne decides the measurements `UNIQUE(baby_id,type,date)` rule. Validators gain length and
timestamp-format checks. Ship server before clients.

**S4 — auth core, score-counter.** Port `auth/{password,tokens,cookies,session,users}.js`,
`routes/auth.js`, `middleware/auth.js` (replacing the tailnet check), `scripts/create-user.js`;
tables via `ADDED_TABLES`; `argon2` dependency (the Dockerfile's deps stage already has the
compiler); JSON limit scoped (`/api/sync` 10 MB, `/api/auth` 16 KB); `trust proxy`; login page,
CSRF header, 401 handling, logout wipe, i18n. Test locally with `COOKIE_SECURE` off. Includes the
`Cf-Access-Jwt-Assertion` check as middleware (skipped when `CF_ACCESS_AUD` is unset, i.e. locally)
and the client's handling of a 302/opaque redirect on `/api` as auth-required.

**S5 — workspaces, score-counter.** `workspaces`, `workspace_members`, `workspace_id` columns +
backfill, pull/push scoping, `--pair-with`, scoping tests.

**S6, S7 — CaTetonne**: S4 + S5 applied (remove the dead `routes/babies.js` and `routes/data.js`).

**S8, S9 — budget-tracker**: the same in better-sqlite3 idiom, plus a versioned migration runner
(`meta.schema_version` is read at last), per-workspace default account, UUID ids, `requireAccount`
membership check, child routes joined through the account.

**S10 — Phase 0 infra.** Per repo: `docker-compose.yml` replaces the Tailscale sidecar with a
`cloudflared` sidecar (`TUNNEL_TOKEN` as a stack variable, no `ports:`, isolated network);
Dockerfile `USER node` with `--chown` on `/app/db` (**one-time `chown -R 1000:1000` on the existing
volume** in the runbook); `cap_drop`, `no-new-privileges`, read-only filesystem, memory and pids
limits, pinned images. Runbook in each SETUP doc: domain on Cloudflare, one tunnel with three
hostnames, **one Access application per hostname** (policy: allow-list of e-mail addresses, one-time
PIN, session 30 days, `CF_ACCESS_AUD` and team domain into the stack variables), WAF rate-limit rule
on `/api/auth/*`, cutover per app (backup off-box first), phones reinstall the PWA from the new host.
Tailscale leaves the three app stacks only — SSH and Portainer stay tailnet-only and never on the
public path.

**S11 — TWA ×3.** `client/public/.well-known/assetlinks.json` (budget: `client/.well-known/`) —
**bypass Access for `/.well-known/*`** on each hostname, Google's checker fetches it anonymously;
Bubblewrap project per app, upload key, Play internal-testing track with friends as testers (or
sideload).

**S12+ — store apps.** score-counter: Capacitor wrap of the `store` build. CaTetonne: ROADMAP Phase
A/B (Capacitor, scheduled local notifications, Play Billing one-time unlock, Data safety, privacy
policy). budget-tracker: **first** an in-browser data layer (the API's logic moves client-side over
IndexedDB, the template's shape), then the wrap — several sessions, last in line.

---

## 6. Security checklist (public exposure)

Cloudflare Access allow-list in front, JWT verified by the app · TLS + HSTS at the edge ·
httpOnly/Secure/SameSite cookies · CSRF double-submit · Argon2id ·
server-side session expiry + revocation · persisted lockout · constant-time login · strict headers
(done) · generic error bodies (done) · edge rate-limiting · scoped body limits · bounded validators
· parameterised SQL (true) · workspace guard in every writer · `trust proxy` · non-root container ·
cap-drop + no-new-privileges + read-only FS + resource limits · isolated network, **no tailnet
interface** · off-box backups, restore tested · pinned images + Dependabot on the three repos ·
idle session 14 d for public use, "log out everywhere" in Settings · logout wipes local data ·
management plane (SSH, Portainer) tailnet-only.

---

## 7. Open decisions

1. **Ingress:** Cloudflare Tunnel (recommended: no open port, free TLS and rate-limiting, hides the
   home IP; needs a domain on Cloudflare DNS) vs Caddy + router port-forward + a dynamic-DNS name.
   Access (decided) needs the Cloudflare side, so the choice is effectively made unless Access is
   dropped. Trade-off accepted: TLS terminates at Cloudflare's edge, which sees the traffic in clear.
2. **Host:** same box as today or a separate VM for the three public apps (recommended if easy).
3. **Application ids** for six Android apps (store + TWA per product); permanent once on Play.
4. **budget-tracker store version:** build the local data layer, or ship budget as friends-only
   for now.

---

## 8. Key file references

- Tailnet auth to delete: `server/src/middleware/auth.js` in each Vite app; budget-tracker has none.
- Auth to port: `Project_Planner/server/src/auth/*`, `routes/auth.js`, `routes/admin.js`
  (`requireAdmin`), `middleware/auth.js`, `scripts/create-user.js`, `db/migrations/003_auth.sql`.
- Client reference: `Project_Planner/renderer/auth.js` (bearer variant — ours is cookie),
  `renderer/home.html` login modal markup.
- Sync route to rewrite: `server/src/routes/sync.js` (both Vite apps);
  `budget-tracker/server/src/routes/api.js`.
- Migrations: `ADDED_TABLES` / `ADDED_COLUMNS` in `server/src/db.js`; budget-tracker
  `server/src/db.js` + `schema.sql` (runner to write).
- Build modes: `client/vite.config.js` (`VITE_APP_MODE`, `VITE_TARGET`, `storeBuildGuard`).
