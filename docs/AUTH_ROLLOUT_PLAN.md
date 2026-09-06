# Auth Rollout Plan — public access for the 3 PWAs

**Status:** planned, not started · **Written:** 2026-09-06 · **Owner:** ben

Plan to give `CaTetonne`, `budget-tracker`, and `score-counter` real login-based
access over the public internet (dropping Tailscale as the access control),
with per-user data isolation and shared workspaces. The work is done **once in
this template** and rolled out to all three apps, which are structurally
identical descendants of it.

---

## 1. Goal & locked decisions

Reach the three apps from anywhere **without Tailscale**, gated by real
accounts, hardened for public exposure.

| Decision | Choice | Consequence |
|---|---|---|
| Client form factor | **Stay PWA** (no APK/store) | Login is a *server* concern; an APK/TWA is just the same PWA in a shell and saves zero auth work. Store distribution can be added later without changing the server. |
| Who can register | **Invite-only** (no public sign-up) | No email/SMTP server needed, no captcha/GDPR-signup burden. Accounts are minted by CLI (first admin) or invite link. |
| Identity scope | **Separate auth per app** | Each app keeps its own SQLite DB, container, and user table. No shared SSO. |
| Data model | **Per-workspace isolation + shared workspaces** | Data is isolated *between* workspaces and shared *within* one. Invite links bind a new user to a workspace. |
| Reuse | **Port `Project_Planner` Lot 2 auth** | Argon2id, server-side opaque sessions, CSRF, brute-force lockout, constant-time login all already built — but for Postgres; this is a SQLite port. |

**Why PWA over APK (recap):** the Play Store does not manage login for you.
Accounts, passwords, sessions, and data all live on your server either way. A
store "APK" for a web app is a TWA — literally this PWA in a Chrome shell, same
code, same server, zero auth savings. Google sign-in / passkeys / biometrics are
available to the PWA on the web too. Only wrap the winner in a TWA if you later
want Play Store presence; the plan below is unchanged.

---

## 2. Current state (facts as of 2026-09-06)

- **All three apps descend from this template** and share its shape: Express
  server serving `/api/sync` + `/health` and the built PWA (`client/dist`),
  **SQLite** storage, one DB file per app.
- **There is no login today — Tailscale *is* the auth.** `middleware/auth.js`
  admits any request from the tailnet IP range and `GET /api/sync` returns the
  *entire* database. Removing Tailscale removes 100% of current access control.
- **The sync layer is single-tenant.** Every synced table is global; there is no
  owner column and no per-user scoping. This is the biggest change (Phase 2).
- **Deployment uses the Tailscale *sidecar* pattern** (not the template's simpler
  loopback model): each app container runs `network_mode: service:ts-<app>`,
  sharing a Tailscale sidecar's network namespace; the sidecar does
  `tailscale serve` (userspace) and proxies to `127.0.0.1:3000`. **The app
  process therefore sits *on the tailnet* — see the threat model.**
- **Secrets hygiene is good:** `.env` is gitignored in every repo; no committed
  secrets found.
- **No open-registration / setup endpoint exists** in any app (verified). The one
  `/bootstrap` route in `budget-tracker` returns *data*, not accounts.
- **Divergences to watch during the port:**
  - `budget-tracker` uses **better-sqlite3** (`db.prepare(...).all()`, sync);
    the template and the others use async **sqlite3** (`dbAll`/`dbGet`/`dbRun`).
    The auth queries must be written in each app's DB idiom.
  - Container runs **as root** in `CaTetonne`, `score-counter`, and this template
    (no `USER` line). Only `budget-tracker` sets `USER node`.

---

## 3. Target data model (workspaces)

A workspace is a **key, not a table**: one shared dataset ("one DB") that one or
more users share. Three pieces:

- **`workspaces`** — one row per workspace (the shared dataset).
- **`workspace_id` column stamped on every data row** — a workspace is "all the
  domain rows sharing the same `workspace_id`".
- **`workspace_members(workspace_id, user_id, role)`** — links one or several
  users to a workspace. Roles: `owner` (can invite / manage members) and
  `member`.

Illustration (budget-tracker):

```
workspaces:        W1  ("Household")
workspace_members: (W1, ben,   owner)
                   (W1, alice, member)     ← 2 users, one shared dataset
accounts:          (id=a1, workspace_id=W1, …) ┐ everything tagged W1
transactions:      (id=t9, workspace_id=W1, …) ┘ is shared by ben + alice
```

Isolation is **between** `workspace_id` values; sharing is **within** one. This
is `Project_Planner`'s Slice-3 model with `workspace` in place of `project`.

**Invite link** = a one-time, expiring, workspace-scoped token. Redeeming it
**creates the account** (user sets username + password) **and** inserts the
`workspace_members` row. It is `Project_Planner`'s activation code extended with
a `workspace_id` binding, reusing its `tokens.js` (`sha256` + `safeEqualHex`).

---

## 4. Threat model

### 4.1 The critical fact: public apps sit on the tailnet

Because each app container **shares the Tailscale sidecar's network namespace**,
the app process has the sidecar's `tailscale0` interface in its own namespace —
it is a tailnet node. So **a compromised public app is already inside your
Tailscale network.** "Keep Tailscale for everything else" does *not* wall the
rest off from a breached public app, because that app lives on the same tailnet.

### 4.2 What an attacker can reach, by stage

| Stage | Precondition | Reach |
|---|---|---|
| 0 | Unauthenticated, no breach | Only the 3 apps' HTTP surface (static PWA, `/health`, `/api/*`, login + invite-redeem). SSH, Postgres, host, other containers, other tailnet services stay invisible from the internet. Can brute-force login (mitigated) / probe for bugs / DoS. |
| 1 | Holds a valid account (leaked invite, cred theft) | `/api/sync` scoped to *their* workspace → own data only. Cross-workspace access requires an **authorization/IDOR bug** → scoping must be airtight. |
| 2 | **App RCE** (dep CVE / logic flaw → code exec in container) | The app's whole SQLite DB (all its workspaces) **and** — because it shares a tailnet node's namespace — the tailnet, gated only by tailnet ACLs (allow-all by default). On CaTetonne/score-counter the process is **root in-container**, widening escape. **App-layer auth does nothing here — isolation is the backstop.** |
| 3 | Container escape → host root | Everything on the host + full tailnet. Already clean on the two classic enablers (no `--privileged`, no `docker.sock` mount); root-in-container + no cap-drop keeps this wider than needed. |

**Headline:** direct internet reach is genuinely just the 3 apps — but a single
app RCE turns "3 exposed apps" into "a doorway to the whole tailnet" unless the
namespace coupling is broken or the tailnet is ACL-restricted.

### 4.3 CLI account-creation threat

The `create-user` CLI has **no network surface** — it is a local shell command
writing the local SQLite file. It cannot be used to create an account remotely;
an attacker must *already* have host/DB access, at which point account creation
is moot (they can read the DB directly). So CLI abuse is strictly a
**post-compromise** concern. Defenses = host hardening (§5) + the CLI's own
design: `Project_Planner`'s CLI **never takes a password** (it prints a one-time
activation code; the person sets their own password), so no password leaks into
shell history or `ps`. Carry that design over verbatim. The *remote*
account-creation surface is the **invite link**, not the CLI.

---

## 5. The plan (do once in the template, then roll out)

### Phase 0 — Public ingress & isolation

- **Pick an ingress** (open decision, §7): **Cloudflare Tunnel** (no inbound
  port, WAF/rate-limiting/bot-filtering, origin-IP hiding) *or* Caddy (auto
  Let's Encrypt). Cloudflare Tunnel is the stronger posture for public exposure.
  Tailscale Funnel works too but adds little filtering.
- **Break the namespace coupling for public apps (the key control).** Do not let
  an internet-facing app share a tailnet node's namespace. Put the public apps
  behind the chosen ingress on an **isolated Docker network with no `tailscale0`
  interface**; keep a Tailscale sidecar (if any) for private/admin access only.
  Then an app breach has no tailnet to ride.
- **If a sidecar stays (Funnel), treat those nodes as an untrusted DMZ:** tag
  them (`tag:public-dmz`) and write **default-deny tailnet ACLs** so they can
  reach nothing else. Tailscale is allow-all by default — verify and restrict.
- **Lock CORS** from `origin:'*'` to same-origin (the client is served by the
  same Express process). `origin:'*'` + `credentials:true` is rejected by
  browsers for cookie auth anyway.
- **Harden containers:** add `USER node` to `score-counter`, `CaTetonne`, and
  this template (budget-tracker already has it); `cap_drop: [ALL]`,
  `security_opt: ["no-new-privileges:true"]`, `read_only: true` (+ tmpfs for
  writable dirs). Pin base images; keep `npm audit` clean.
- **Harden the host / management plane:** SSH key-only (no passwords), root login
  disabled, `fail2ban`; firewall allows only the ingress from the world, SSH only
  from your IP / VPN / a Tailscale kept for *admin*. Patch the box.
- **Ideal:** run the 3 public apps on a **separate VM/host** from sensitive
  tailnet-only services, so even host compromise can't reach them.
- **Secrets/files:** prod session pepper + `.env` + `.db` at `600`, owned by the
  app user, kept off the image and out of git (already gitignored).

### Phase 1 — Auth core → SQLite

- **Copy** from `Project_Planner/server/src/auth/`: `password.js` (Argon2id,
  DB-agnostic, copies as-is), `tokens.js`, `cookies.js`, `session.js`,
  `users.js`; plus `routes/auth.js` and `middleware/auth.js` (`requireSession`).
- **Port the DB layer:** replace Postgres `all/one/query` with each app's SQLite
  idiom (`dbAll/dbGet/dbRun` for template/CaTetonne/score-counter;
  `db.prepare(...)` for budget-tracker). Rewrite migration `003_auth.sql` as a
  SQLite `users` + `sessions` schema.
- **Replace** the tailnet IP check in `middleware/auth.js` with `requireSession`
  — the swap the plan always anticipated ("retrofit by replacing
  `middleware/auth.js`").
- **Cookie auth, not Bearer:** the client is same-origin → httpOnly + Secure +
  SameSite cookies with CSRF double-submit (Planner already implements it). No
  token in JS — safer than the desktop app's `localStorage` Bearer path.
- **Invites/bootstrap:** port `create-user` CLI to SQLite as the first-admin
  bootstrap (one-time activation code, never a password argument).
- **Client:** add a login view to the PWA (Planner's `renderer/auth.js` is the
  reference) and gate the app behind it.

### Phase 2 — Workspaces, memberships & invite links

- **Schema:** `workspaces`, `workspace_members(workspace_id, user_id, role)`, and
  **`workspace_id` on every synced table from day one** (adding it later means a
  backfill migration on live data).
- **Sync scoping:** scope every `/api/sync` read and write to the caller's
  workspace membership. Ensure the existing `budget-tracker` `/bootstrap` route
  lands behind `requireSession` + workspace scoping.
- **Invite links:** `POST` to mint a one-time, expiring, **hashed-at-rest**
  invite token bound to `workspace_id` + role; a redeem endpoint that creates the
  account and inserts the membership. Owner can revoke an unused link.
  - **Security rules:** single-use · short expiry (24–72h) · high-entropy ·
    hashed at rest · revocable · **consumed by POST from a landing page, never
    GET** (a raw GET token leaks via history + `Referer`) · rate-limited.
  - **Never add** an open "if zero users, allow signup" / setup endpoint.
- **Backfill:** assign existing rows to your bootstrap workspace.

### Phase 3 — Roll out to all three

- Apply the template diff to `CaTetonne`, `budget-tracker`, `score-counter`. They
  differ only in domain schema, never in the auth seam. Each keeps its own
  users/workspaces/data and its own container/volume/sidecar (already separate —
  keep it that way so one popped app ≠ the others' data).
- Per app: bootstrap your admin + workspace via CLI, verify login and invite
  redemption end-to-end **locally**, then switch ingress from tailnet to public
  and remove/repurpose the Tailscale sidecar per Phase 0.

---

## 6. Security checklist (public exposure)

TLS + HSTS · httpOnly/Secure/SameSite cookies · CSRF double-submit · Argon2id ·
server-side session expiry + rotation + revocation · brute-force lockout ·
constant-time login (no username enumeration) · strict security headers · edge
rate-limiting · parameterized SQL only (already true) · sync payload validation ·
**non-root container** · cap-drop + no-new-privileges + read-only FS · **no
tailnet interface on public app containers** (or default-deny DMZ ACLs) ·
off-box backups · pinned base images + `npm audit` clean · SSH key-only + private
management plane.

Everything except TLS/proxy/rate-limit/isolation already exists in
`Project_Planner`'s auth — the port carries it over.

---

## 7. Open decisions to make before building

1. **Ingress:** Cloudflare Tunnel vs Caddy vs Tailscale Funnel (recommend
   Cloudflare Tunnel for filtering + no open port).
2. **Same host or separate VM** for the 3 public apps (recommend separate VM if
   feasible).
3. **Keep a Tailscale sidecar for admin** on the public apps, or remove it
   entirely and admin via the private host only.

---

## 8. Effort estimate

- Phase 0: ~½ day (plus VM provisioning if separating hosts).
- Phase 1: ~1–2 sessions (mostly mechanical Postgres→SQLite port).
- Phase 2: ~1–2 sessions (workspace scoping + invite flow is the real work).
- Phase 3: ~½ day per app (mechanical), plus per-app verification.

Order to ship: Phase 0 + 1 first (public URL + login, Tailscale off), then Phase
2 (isolation + invites), then Phase 3 rollout. Bake `workspace_id` into the
schema from the start even if the invite UI comes last.

---

## 9. Key file references

- Current tailnet auth to replace: `pwa-sync-template/server/src/middleware/auth.js`
- Auth to port from: `Project_Planner/server/src/auth/*`,
  `Project_Planner/server/src/routes/auth.js`,
  `Project_Planner/server/scripts/create-user.js`,
  `Project_Planner/server/db/migrations/003_auth.sql`
- Client auth reference: `Project_Planner/renderer/auth.js`,
  `Project_Planner/renderer/sync.js`
- Sync route to make multi-tenant: `pwa-sync-template/server/src/routes/sync.js`
  (and each app's equivalent; `budget-tracker/server/src/routes/api.js`)
- Deployment to isolate: each app's `docker-compose.yml` (Tailscale sidecar) and
  `Dockerfile` (add `USER node`).
