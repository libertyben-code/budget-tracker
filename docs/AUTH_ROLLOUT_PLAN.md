# Auth Rollout Plan — public access for the 3 PWAs

**Status:** in progress — S2, S4 (2026-09-28) and S5 (2026-09-29) done in score-counter, S3
(2026-09-28) and S6 (2026-09-29) in CaTetonne · **Written:** 2026-09-06 · **Revised:** 2026-09-28 (review session, decisions below) · **Owner:** ben

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

## 2. Current state (2026-09-29)

- Tailscale *is* the auth in budget-tracker only. **score-counter has sessions since S4 and
  workspaces since S5; CaTetonne has sessions since S6** and no workspaces yet (below). On
  CaTetonne and budget-tracker `GET /api/sync` still returns the whole database — in CaTetonne to
  any account: sync tables have no owner column.
- Deployment: each app container shares a Tailscale sidecar's network namespace
  (`network_mode: service:ts-*`), `tailscale serve` proxies to `127.0.0.1:3000`.
- Review findings that gate public exposure are filed in each repo's `docs/BUGS.md` (budget:
  `docs/Bugs.md`). The two that blocked a second user — **the server merge was
  last-push-wins** (writers never compared `edited_at`) and **sync validators bounded
  nothing** — are fixed in score-counter (S2) and CaTetonne (S3), both 2026-09-28, and still open
  in budget-tracker.
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

**S2 — done 2026-09-28** (score-counter, `feature/sync-writer-lww`). Writers generated from one
column list per table, upsert with a newer-stamp `WHERE`, `stale` counted apart from `failed`;
validators bound lengths, timestamp formats, flags and a far-future merge stamp; nine route tests
over an in-memory SQLite. The `workspace_id` equality guard is one line in the same generated
`WHERE`, added in S5 when the column exists.

**S3 — done 2026-09-28** (CaTetonne, `feature/sync-writer-lww`; engine copied to the template).
The same rewrite, plus the measurements rule: `UNIQUE(baby_id,type,date)` is kept and the day is
merged like the id — the newer stamp takes it, the older rival is deleted (what `REPLACE` did, now
by stamp rather than push order), an older incoming row is stale, and a tombstone claims no day.
No client change; `saveMeasurement`'s fold and `mergePulled`'s rival check are what make the losing
device agree. Ship server before clients.

**S4 — done 2026-09-28** (score-counter, `feature/auth-core`). Ported as planned:
`auth/{password,tokens,cookies,session,users}.js`, `routes/auth.js`, `middleware/auth.js`
(sessions replace the tailnet check), `middleware/cfAccess.js`, `scripts/create-user.js`, tables
via `ADDED_TABLES`, `argon2`, JSON limits scoped (`/api/auth` 16 KB, `/api/sync` 10 MB),
`trust proxy` = 1, login page, CSRF header, 401 handling, logout wipe, EN/FR. Choices to carry
into S6 and S8: no `email`/`external_id` columns (the plan has no e-mail); `username` collates
`NOCASE` (phones capitalise); idle 14 d / absolute 90 d, `last_seen` slid at most every 5 min,
`pruneSessions()` at boot; error bodies are codes (`unauthenticated`, `csrf`, `bad_credentials`,
`bad_code`, `weak_password`) and the client translates them; the session token never appears in a
body; `POST /api/auth/logout-all` backs *Log out everywhere*; a login as a different user wipes
and reloads, a logout wipes regardless. The perimeter: the client fetches `/api` with
`redirect: 'manual'` and treats an `opaqueredirect` as Access having lapsed; since the worker
answers every navigation from cache, the way back is a navigation to `GET /api/auth/return`
(the worker lets `/api` through), which the server bounces to `/`. `cfAccess` exempts `/health`
(Docker's check) and `/.well-known` (S11). Tests: `routes/auth.test.mjs` (the app.js mounting
order, cookies, CSRF, lockout, logout) and `middleware/cfAccess.test.mjs` (a generated key served
as a JWKS). `COOKIE_SECURE=false` is in `.env.example`; production leaves it unset.

**S5 — done 2026-09-29** (score-counter, `feature/workspaces`). `workspaces` and
`workspace_members` through `ADDED_TABLES`, `workspace_id` on the five synced tables through
`ADDED_COLUMNS` (plain `TEXT`, a soft reference, no index). `lookupSession` reads the membership in
the query that reads the user, so `req.user.workspaceId` is what every sync statement is scoped by;
a session without one gets a 403 `no_workspace`. The pull filters on it and selects the writer's
own columns, so `workspace_id` never reaches a client; the writer stamps it from the session, leaves
it out of the `SET`, and adds the equality to the generated `WHERE` — a row held by another
workspace is counted `stale`, not `failed`, so the answer does not say which ids exist elsewhere.
No client change. Choices to carry into S7 and S9: **one workspace per account**, enforced by a
unique index on `workspace_members(user_id)` (the client has nowhere to choose between two, and an
index can be dropped without a rebuild); member roles are `owner` and `member`, read by nothing
yet; **the backfill is adoption** — an admin's new workspace takes every row whose `workspace_id`
is NULL, when the account is created or, for accounts born under S4, at boot (`ensureWorkspaces`,
oldest account first) — and until then an unowned row is reachable by nobody; `synced_at` is not
touched by it. `--pair-with` works **at creation only**. Pairing an account that already exists is
left to the admin page and is more than a membership row: its devices hold a watermark, so the
shared rows have to be offered again (`synced_at` bumped) or they never arrive. Not checked: that
an entry's parent game is in the writer's workspace — a seat written under somebody else's game is
stored in the writer's own workspace and read by nobody else. Tests: `routes/sync.test.mjs`
(scoping at the router), `routes/auth.test.mjs` (login to scoped pull, paired and unpaired),
`auth/workspaces.test.mjs` (adoption, pairing, the boot of a database from S4).

**S6 — done 2026-09-29** (CaTetonne, `feature/auth-core`). S4 ported file for file from
score-counter's commit — not from its head, which carries S5 — with `catetonne_session` and
`catetonne_csrf` as the cookie names; the dead `routes/babies.js` and `routes/data.js` are removed.
What the port added, to carry into S8 and back into score-counter: **a login must draw the page
once.** The login waits for its first sync and then renders; that sync's pull raises `data-pulled`,
whose handler renders too, and a page that fills its container across awaits is then drawn twice,
one copy under the other. It shows only on a login that pulls something — after a logout, never on
a phone that already holds its data — so it passes a first test. CaTetonne skips the pull's render
while the login's sync runs (`entering` in `main.js`); **score-counter has the same two handlers
and is not fixed yet.** Also: whatever the header shows of the data (here the baby picker) and the
FAB are hidden under the login page, and an event that redraws the page on a timer (here the feed
reminder) must not redraw the login page under somebody typing. Deploying it logs every phone out
until its account exists; a first login keeps what the phone holds.

**S7 — CaTetonne**: S5 applied.

**S8, S9 — budget-tracker**: the same in better-sqlite3 idiom, plus a versioned migration runner
(`meta.schema_version` is read at last), per-workspace default account, UUID ids, `requireAccount`
membership check, child routes joined through the account.

**S10 — Phase 0 infra.** Per repo: `docker-compose.yml` gains a `cloudflared` sidecar
(`TUNNEL_TOKEN` as a stack variable, no `ports:`); the Tailscale sidecar is removed only at the
end of the cutover below;
Dockerfile `USER node` with `--chown` on `/app/db` (**one-time `chown -R 1000:1000` on the existing
volume** in the runbook); `cap_drop`, `no-new-privileges`, read-only filesystem, memory and pids
limits, pinned images. Runbook in each SETUP doc: domain on Cloudflare, one tunnel with three
hostnames, **one Access application per hostname** (policy: allow-list of e-mail addresses, one-time
PIN, session 30 days, `CF_ACCESS_AUD` and team domain into the stack variables), WAF rate-limit rule
on `/api/auth/*`, cutover per app (backup off-box first), phones reinstall the PWA from the new host.
Tailscale leaves the three app stacks only — SSH and Portainer stay tailnet-only and never on the
public path.

**Cutover — one server, one database, two doors until the family has moved.** Nothing is cloned,
so nothing diverges. In order:

1. Merge and redeploy the harmonisation branches (done in S1); tailnet behaviour unchanged.
2. **Auth ships first, still private** (S4–S9 on the existing Tailscale stacks). The tailnet check
   becomes sessions, the family logs in once at the tailnet URL over Tailscale, accounts are created
   by CLI and the couple paired. The login gets its real-world test with nobody outside able to
   reach it. Tables arrive through `ADDED_TABLES` at boot; the volume is untouched.
3. **Add the tunnel beside the sidecar.** `cloudflared` joins the sidecar's namespace
   (`network_mode: service:ts-<app>`, as the app does) and proxies to the same `127.0.0.1:3000`;
   Access in front of the public hostname. Both `tailscale serve` and Cloudflare terminate TLS, so
   the `Secure` cookie works on both hosts without a code change — a phone logs in on each host
   separately, which is what is wanted. This is a short window with the app on the tailnet *and* the
   internet; Access makes it acceptable, it must not become the permanent shape.
4. **Friends join** on the public URL. The family stays on the tailnet install as long as needed.
5. **The family switches, one phone at a time:** sync badge ✓ with nothing pending → **backup
   off-box** → install the PWA from the public host → log in → let it pull the full history (a fresh
   origin has no watermark, so it asks for everything) → compare against the old install → uninstall
   the tailnet one. Android keys installs by host, so the two coexist during the check.
6. **Remove the sidecar.** Delete the Tailscale service from the stack; app + `cloudflared` on their
   own network, no tailnet interface — the isolation §4 wants. Tailscale stays on the host for SSH
   and Portainer.

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

- Tailnet auth, deleted in S4 and S6: `server/src/middleware/auth.js` in each Vite app;
  budget-tracker has none.
- Auth to port: `Project_Planner/server/src/auth/*`, `routes/auth.js`, `routes/admin.js`
  (`requireAdmin`), `middleware/auth.js`, `scripts/create-user.js`, `db/migrations/003_auth.sql`.
- Client reference: `Project_Planner/renderer/auth.js` (bearer variant — ours is cookie),
  `renderer/home.html` login modal markup.
- Sync route to rewrite: `server/src/routes/sync.js` (both Vite apps);
  `budget-tracker/server/src/routes/api.js`.
- Migrations: `ADDED_TABLES` / `ADDED_COLUMNS` in `server/src/db.js`; budget-tracker
  `server/src/db.js` + `schema.sql` (runner to write).
- Build modes: `client/vite.config.js` (`VITE_APP_MODE`, `VITE_TARGET`, `storeBuildGuard`).
