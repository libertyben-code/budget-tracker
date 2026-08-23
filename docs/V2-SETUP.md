# Budget Tracker v2 — Setup & Operations

v2 is a self-hosted rewrite: vanilla HTML/CSS/JS frontend + Node/Express + SQLite, installed on Android as a PWA over Tailscale HTTPS. No login — Tailscale is the security perimeter.

## Run locally (development, Windows or Linux)

```bash
cd server && npm install && cd ..
node server/src/index.js
# open http://localhost:3000
```

The SQLite database is created automatically at `data/budget.db` (a fresh one seeds the `default` account).

## Deploy on the Linux server (Portainer)

The app runs as a **Portainer stack deployed from this git repository** — Portainer clones the repo onto the server and builds the Dockerfile itself. There is no registry and no CI: a deploy is Portainer pulling the latest `master` and rebuilding.

Prerequisites: Docker + Portainer, Tailscale connected.

### The data folder lives on the host, not in Docker

`docker-compose.yml` bind-mounts whatever `DATA_DIR` points at, and deliberately has **no default**:

```yaml
- ${DATA_DIR:?set DATA_DIR to the absolute host path of the data folder}:/data
```

`DATA_DIR` must be an **absolute** host path, set as a stack environment variable; the deploy fails with `required variable DATA_DIR is missing a value` if you forget it. That strictness is the point. A relative path (`./data`) in a Portainer git stack resolves against Portainer's *own* volume (`/data/compose/<stack-id>` inside the Portainer container), so the stack comes up healthy on a brand-new empty database while the real one sits untouched — which reads as total data loss rather than as a config error. A deploy that refuses to start is the better way to get this wrong.

The rest of this document uses two shell variables in place of your own paths:

```bash
export CLONE=~/server/budget-tracker      # your clone of this repo on the server
export DATA_DIR="$CLONE/data"             # the folder holding budget.db
sudo chown -R 1000:1000 "$DATA_DIR"       # container runs as non-root uid 1000
```

### One-time cutover from the old direct-Docker setup

Stop the old stack **first**. Two containers bound to the same SQLite file (and the same host port) is a corruption risk, not just a port clash:

```bash
cd "$CLONE"
docker compose down
```

The git clone itself can stay — the data folder inside it is still what the Portainer stack mounts.

### Create the stack

Portainer → **Stacks** → **Add stack** → **Repository**:

| Field | Value |
|---|---|
| Repository URL | `https://github.com/libertyben-code/budget-tracker` |
| Reference | `refs/heads/master` |
| Compose path | `docker-compose.yml` |
| Authentication | only if the repo is private — GitHub username + a personal access token with `repo` scope |
| Environment variables | **`DATA_DIR`** — required, no default. The absolute host path of your data folder (the `$DATA_DIR` above)<br>**`TS_AUTHKEY`** — required on the first deploy. A reusable auth key from the Tailscale admin console |

Enable **GitOps updates** if you want Portainer to poll `master` and redeploy on its own, or leave it off and use the **Pull and redeploy** button. Then **Deploy the stack** — the first deploy builds the image, so it takes a minute or two.

Check it came up:

```bash
docker ps --filter name=budget-tracker
docker exec budget-tracker node -e "fetch('http://localhost:3000/api/health').then(r=>r.text()).then(console.log)"
```

There is no host port to curl — see below.

### Ingress: the Tailscale sidecar

The stack runs a `tailscale/tailscale` container beside the app. It joins the tailnet as its **own machine** named `budget`, so the app answers on `https://budget.<tailnet>.ts.net` instead of sharing the host's name on a spare port.

The app container has no network of its own: `network_mode: service:ts-budget` makes it share the sidecar's namespace, so both see the same `localhost`. `tailscale/serve-config.json` proxies `:443` to `http://127.0.0.1:3000`, which is the app. **Nothing is bound on the host** — the old `127.0.0.1:3001` publish is gone, and the tailnet is now the only route in.

Why a hostname each rather than a port each: Android matches an installed PWA on hostname and **ignores the port**, so two apps behind one tailnet name can never both be installed. The manifest `id` field does not help — app identity is `(origin, id)`, and different ports are already different origins.

First deploy, in the Tailscale admin console:

1. **Generate a reusable auth key** (Settings → Keys). Not ephemeral — an ephemeral node disappears when the container stops. Set it as the stack's `TS_AUTHKEY`.
2. After the sidecar starts, find the new `budget` machine and **disable key expiry** on it, or it drops off the tailnet in ~6 months. (Tagging the key with an ACL tag via `TS_EXTRA_ARGS=--advertise-tags=tag:container` does this permanently instead, if you have tags set up.)
3. Confirm the name: `tailscale status` from any device now lists `budget` as a separate machine.

The auth key is only consumed on first start; the node identity then lives in the `ts-budget-state` volume. Keep that volume and later redeploys need no key.

Once the new hostname answers, retire the old host-level mapping — but check what else the machine serves first, because `reset` clears **every** mapping on it, not just this app's:

```bash
tailscale serve status       # what else is mapped on this machine?
sudo tailscale serve --https=443 off
```

## Install on Android (both phones)

1. Open `https://budget.<tailnet>.ts.net` in Chrome (with Tailscale active on the phone)
2. Menu ⋮ → **Add to Home screen** → Install
3. The app opens standalone, full-screen, with its own icon

## Updates

Push to `master`, then in Portainer open the stack and hit **Pull and redeploy** (or let GitOps polling do it). Portainer re-clones the repo and rebuilds the image; the data folder is untouched by a redeploy.

Phones pick up the new version the next time the app is opened (network-first service worker). When releasing, bump the `CACHE` version constant in `client/sw.js` (`bt-static-v1` → `v2`, …).

Redeploying does **not** back the database up — that used to be the first line of `update.sh`, and the Portainer button has no equivalent. Backups are now a separate, scheduled job (below).

## Backups

Your entire financial history is one file: `budget.db`. `backup.sh` snapshots it. Portainer's clone of the repo is private to Portainer, so the copy of the script you schedule is the one in your own clone — keep it current with `git pull`:

```bash
sudo apt install sqlite3        # one-time; the script needs the CLI
cd "$CLONE" && git pull
./backup.sh
```

It writes a timestamped copy to `../backups/` (i.e. alongside the data folder, not inside it, so backups are never mounted into the container) and keeps the newest 14. Unlike the compose file, the script needs no configuration: `DATA_DIR` defaults to the `data/` folder beside the script itself, which is where your clone already keeps it. Export `DATA_DIR` / `BACKUP_DIR` to override.

Run it nightly, since nothing else will:

```cron
30 3 * * * /absolute/path/to/budget-tracker/backup.sh
```

Each snapshot is a **single self-contained file**: the script switches it out of WAL mode after taking it, so reading one to check its contents never leaves `-wal`/`-shm` files beside it, and a snapshot is always safe to copy on its own. Pruning removes a snapshot's sidecars along with it.

**Why it uses `sqlite3 .backup` and not `cp`:** the database runs in WAL mode, so recent writes live in `budget.db-wal` and not in `budget.db`. Copying `budget.db` on its own yields a stale database — on an un-checkpointed DB it can have no tables at all. `.backup` performs a consistent online snapshot and is safe while the container is running.

To restore, stop the stack in Portainer, then:

```bash
cd "$DATA_DIR"
cp budget.db budget.db.broken
rm -f budget.db-wal budget.db-shm       # stale WAL against a restored DB is not valid
cp ../backups/budget-YYYYMMDD-HHMMSS.db budget.db
sudo chown 1000:1000 budget.db
```

and start the stack again. For off-box safety, sync `../backups/` to a NAS or rclone target.

## Architecture notes

- `client/` — static frontend, native ES modules, no build step. Views in `client/js/views/`, one module per screen; state in `client/js/store.js`; all server calls in `client/js/api.js`.
- `shared/` — pure ESM modules (categorization engine, date + CSV helpers) imported by both Node and the browser.
- `server/` — Express 5 + better-sqlite3. All routes in `server/src/routes/api.js`; schema in `server/src/schema.sql`.
- Dates are stored ISO (`YYYY-MM-DD`) in the DB and API, displayed as `dd/mm/yy`. Amounts: negative = spending, positive = income. Category rules are global; everything else is per budget account.
- Recurring savings deposits: rules live in `savings_recurring` (amount + day 1–28). Due deposits are applied lazily on `GET /accounts/:id/data` with multi-month catch-up; history ids are deterministic (`rec_<ruleId>_<date>`) so an occurrence can never apply twice.
- CSV import (parse → skip REVERTED/PENDING → dedup → categorize) runs server-side in `importTransactions()` — a future bank-sync connector (e.g. Enable Banking) can feed the same function.

## Security model

No application-layer auth by design — **Tailscale is the perimeter**, so keep it that way:

- The app container publishes **no host port at all** — it sits on the Tailscale sidecar's network namespace, so the tailnet is the only route in. **Never `tailscale funnel`** it, and never give the `budget` service a `ports:` block back (e.g. `3001:3000`) — either one would expose all your financial data with no login.
- Hardening already in the code: strict CSP + `X-Frame-Options`/`nosniff`/`Referrer-Policy` headers; CSV export neutralizes spreadsheet formula injection; the import endpoint only accepts `text/csv` (blocks cross-site form POSTs); the container runs as non-root uid 1000.
- Offline caveat: the service worker keeps an unencrypted snapshot of your data on each phone for offline reads — rely on device lock.

## Adding a login later (if ever needed)

One Express middleware in front of `/api/*` checking a session cookie + a `POST /api/login` route, and a 401 handler in `client/js/api.js`. No data model changes needed.
