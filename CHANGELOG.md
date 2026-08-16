# Changelog

Release notes for Budget Tracker. Versions before 2.0.1 were released without a changelog; their history is in the dated development log in `docs/WORKFLOW.md`.

---

## 2.0.3 — 2026-08-16

### Fixes & improvements

- **Every backup is now a single file**: `sqlite3 .backup` produced a snapshot that inherited WAL mode from the live database, so simply opening a backup to check its contents created `-wal`/`-shm` files beside it — and the cleanup only ever deleted `budget-*.db`, so those leftovers outlived the backup they belonged to. A backup carrying a stale `-wal` is the same trap that made the old `cp`-based backups worthless, just moved onto the backups themselves. Snapshots are now switched out of WAL mode as they are taken, so reading one changes nothing, and pruning removes a snapshot's leftovers along with it.
No application, schema or security-model changes.

---

## 2.0.2 — 2026-08-16

### Fixes & improvements

- **Action required before your next redeploy**: `DATA_DIR` must now be set as an environment variable on the Portainer stack, pointing at the absolute host path of your data folder. It no longer has a default, so a deploy without it stops with `required variable DATA_DIR is missing a value` rather than starting. That is deliberate: any default is a path that might not be yours, and mounting the wrong folder brings the stack up healthy on an empty database — which looks like losing everything. Refusing to deploy is the safe way to get this wrong.
- **No host paths in a public repository**: the server username and directory layout that were baked into `docker-compose.yml`, `backup.sh` and the docs are gone. `backup.sh` needs no configuration in exchange — it defaults to the `data/` folder beside itself, which is where your clone already keeps it.
- **Housekeeping**: removed dead Firebase entries left in `.dockerignore` by the v2 cutover, and deleted the merged feature branches from the repository.

No application, schema or security-model changes — the container still publishes on `127.0.0.1:3001` and Tailscale is untouched.

---

## 2.0.1 — 2026-08-16

### Fixes & improvements

- **Deployment via Portainer**: the app now runs as a Portainer stack deployed straight from this repository — Portainer clones it onto the server and builds the image itself. Updates are the *Pull and redeploy* button instead of an SSH session. See `docs/V2-SETUP.md`.
- **The database stays in a folder you own**: the container's data volume is an absolute host path (`DATA_DIR`, defaulting to the existing folder), so the database is never stored inside Portainer's internals and survives deleting or recreating the stack.
- **Working backups**: `update.sh` is replaced by `backup.sh`. The old script copied `budget.db` with `cp`, which does not work on a WAL-mode database — those backups captured a stale, sometimes completely empty database. Backups now use `sqlite3 .backup` for a consistent snapshot that is safe to take while the app is running, are written outside the container's volume, and are pruned to the newest 14. Schedule it with cron; a redeploy no longer takes one for you.

---
