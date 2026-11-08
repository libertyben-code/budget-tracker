# Changelog

Release notes for Budget Tracker. Versions before 2.0.1 were released without a changelog; their history is in the dated development log in `docs/WORKFLOW.md`.

---

## 2.3.0 — 2026-11-08

### What's new

- **Syncs when you open the app.** Linked banks update on their own when you open or return to the app, at most once an hour per account. If a sync fails, the Balance card says so and it tries again six hours later.
- **A nicer account picker.** Each account shows an icon and its balance, with a checkmark on the active one. Delete is now a single item for the active account, so switch to an account to delete it.
- **A slimmer Dashboard.** The Balance card takes about half the height, and the balance and net figures are centered.

### Fixes & improvements

- A manual sync that finds nothing new now still updates the balance.

---

## 2.2.1 — 2026-11-08

### Fixes & improvements

- **More reliable deploys.** The server image can now still build when the prebuilt database module can't be downloaded from GitHub, by compiling it instead.

---

## 2.2.0 — 2026-11-08

### What's new

- **Your real balance.** The Dashboard and Transactions show what is actually in the account: the bank's own figure for a linked account, and a balance you set with *Set balance…* for a manual one.
- **The month at a glance.** The Dashboard opens on the balance, a month stepper and the month's net, money in and money out. The Dashboard and Transactions now keep separate filters.
- **To categorise.** A new screen lists every uncategorised transaction, by merchant or by date, so one choice settles a whole group. Open it from the Dashboard card or the line on Transactions.
- **Category picker.** A searchable sheet where you can also create a category. Choosing one updates the matching uncategorised transactions in every account and saves a rule for future imports; Undo takes both back, and the transaction you edited keeps its new category.
- **Compact transactions.** Rows are grouped by day. Tap one to see and edit its details, use *Select* for batch edits, and undo a delete from the message that follows.
- **Adding a transaction.** A new sheet with Expense or Income, labelled fields and Undo.
- **Filters.** A compact bar with a Filters sheet, and search now matches amounts too.
- **Accounts in another currency.** When you link a bank, choose whether to import accounts in another currency. Each one gets its own budget account and shows its own currency.
- **One joint split.** It is worked out from the two salaries and the amount wanted in the shared account, and is the same on every account. It starts from the account where you had filled in salaries.
- **A better first run.** A new install opens on a welcome card (link a bank, import a CSV, add a transaction) and offers starter categories in your language.
- **Settings and appearance.** The settings menu is grouped, and Appearance can follow the phone with *Match phone*.
- **Desktop.** A navigation rail on the side from 900px wide.

### Fixes & improvements

- **A server that is down now says so.** A "Can't reach your server" banner shows how old the data is and pauses edits, and Retry clears it once the server is back.
- **Messages match what happened.** Confirmations and errors look different, savings actions report their result and can be undone, and a new or edited transaction with a zero amount or an empty description is refused.
- **Easier to read and to use.** Text contrast is raised across the themes, and dialogs work properly with a keyboard and a screen reader.
- **Typing is no longer lost.** Values you have typed and the focus survive when the screen updates.
- **Amounts follow your language and currency**, such as €2,310.45 or 2 310,45 €, and "Uncategorized" is translated.
- **Smaller fixes.** Batch edit keeps the typed description when you create a category, the choices for deleting a category appear on its row, and charts stay steady when the screen updates.

The database upgrades itself on first start. It only adds columns and a settings table, and removes nothing.

---

## 2.1.4 — 2026-11-07

### Fixes & improvements

- **Edits and deletes stay within their own budget account.** Changing, deleting or batch-editing a transaction now goes through the account it belongs to, and the server refuses to touch another account's transactions. Nothing changes in use; it prepares for adding logins.

---

## 2.1.3 — 2026-11-04

### Fixes & improvements

- **An exported CSV can be imported again.** A description containing a comma (such as "Shop, Ltd") shifted the columns on import, so the amount came back as €0; quotes, line breaks and descriptions starting with `=`, `+`, `-` or `@` now come back exactly as exported.

---

## 2.1.2 — 2026-11-04

### Fixes & improvements

- **Savings deposits made at the same moment are all recorded.** Two deposits arriving together could fail with an error; each now gets its own history entry.
- **Out-of-range savings amounts are refused.** A balance or deposit too large to be a real number (such as `1e400`) used to be saved and broke the savings total and history from then on.
- **Transaction dates are checked.** A transaction sent with a malformed date is refused instead of being saved and then silently hidden by the month filters.
- **One-letter category rules are refused.** A single-character rule matched almost every transaction; rules now need at least two characters, and any one-letter rule already saved is ignored.
- **Server dependencies updated** to their latest patched versions.

---

## 2.1.1 — 2026-10-08

### Fixes & improvements

- **Saving a transaction on a wide screen keeps what you typed.** On a computer or tablet (640px and wider), adding or editing a transaction saved it as €0 with no description, today's date and Uncategorized, whatever you had entered. Phones were not affected.

---

## 2.1.0 — 2026-10-07

### What's new

- **Action required before your next redeploy: back up the database.** Run `./backup.sh` first. This release reshapes two tables so savings and custom categories no longer belong to one budget account, and earlier versions cannot start on the upgraded file — going back to 2.0.5 means restoring that backup. The upgrade itself keeps everything: savings history, recurring deposits and bank links survive, and custom categories several accounts had merge into one.
- **Bank sync.** Link Revolut, Crédit Agricole or any bank Enable Banking covers from Settings ▸ *Bank sync*, and new transactions arrive through the same dedupe and category rules as a CSV import. The first sync runs the moment the bank approves, which is when banks hand over the full history; *Sync now* and *Sync all accounts* pull what is new. Each bank account maps to a budget account — or to a savings account whose balance comes from the bank — and re-mapping moves what was already imported. It is free for personal use and hidden until you set three stack variables; see `docs/V2-SETUP.md`. CSV import stays as the fallback.
- **Savings fed from transactions.** A savings account can follow a category: tag the transfers to it, by rule or by hand, and its balance and history fill themselves. This is how to track a Revolut Pocket, which open banking does not expose.
- **Savings are shared by every account.** The Savings tab is the same whichever budget account is active, a category-fed account adds up that category across all of them, and deleting a budget account no longer deletes its savings.
- **Categories are shared by every account.** One list in every picker, filter and rule, whichever account is active. Renaming or deleting a category updates its transactions in all accounts, the category manager counts across all of them, and a category you created survives deleting the account you made it in.

### Fixes & improvements

- **Unknown API addresses answer with a clear error.** A request to an address the server does not know now gets a JSON 404 instead of the app's page, and a server error no longer sends back a stack trace.

---

## 2.0.5 — 2026-09-06

### Fixes & improvements

- **2.0.4's status-bar changes didn't work — this reverts them and corrects the notes.** The diagnosis was wrong: current Chrome for Android does not let an installed app colour its status bar at runtime. The bar takes the fixed `theme_color` from the app manifest (indigo here) and ignores the accent — it is not edge-to-edge, so the page never draws behind the status bar, the gradient painted nothing, and there was no "header hiding under the status bar" to fix. Following the accent live is no longer possible for an installed PWA on Android; it still works in a plain browser tab. No visible change from 2.0.4, and the Tailscale-sidecar deployment that also shipped in 2.0.4 is unaffected.

---

## 2.0.4 — 2026-09-06

### Fixes & improvements

- **The app now has its own address.** It runs behind a Tailscale sidecar and answers on its own tailnet hostname (`https://budget.<tailnet>.ts.net`) instead of sharing the server's name on a spare port — which is what lets it install as its own PWA, since Android matches an installed app on hostname and ignores the port. Your data lives on the server and is untouched, but the address has changed: **remove the old app and re-add it from the new URL.** Deploy steps (delete the stale `budget` tailnet machine, retire the old `:8443` serve mapping) are in `docs/V2-SETUP.md`. The old loopback publish is gone, so the tailnet is now the only route in.
- **The status-bar colour is back on Android, and the header no longer hides under it.** A recent Chrome update started drawing installed apps edge-to-edge — the page now paints behind the phone's status bar. That stopped the accent colour reaching the strip around the camera, and because the header did not reserve room for that strip, its content (the app name, account pill and gear) slid up underneath it. The header now leaves room for the status bar and paints that strip in your accent colour, so it follows your accent and dark mode. If it still looks off after updating, remove and re-add the app to the home screen.

---

## 2.0.3 — 2026-08-16

### Fixes & improvements

- **Every backup is now a single file**: `sqlite3 .backup` produced a snapshot that inherited WAL mode from the live database, so simply opening a backup to check its contents created `-wal`/`-shm` files beside it — and the cleanup only ever deleted `budget-*.db`, so those leftovers outlived the backup they belonged to. A backup carrying a stale `-wal` is the same trap that made the old `cp`-based backups worthless, just moved onto the backups themselves. Snapshots are now switched out of WAL mode as they are taken, so reading one changes nothing, and pruning removes a snapshot's leftovers along with it.
No application, schema or security-model changes.

---

## 2.0.2 — 2026-08-16

### Fixes & improvements

- **Action required before your next redeploy**: `DATA_DIR` must now be set as an environment variable on the Portainer stack, pointing at the absolute host path of your data folder. It no longer has a default, so a deploy without it stops with `required variable DATA_DIR is missing a value` rather than starting. That is deliberate: any default is a path that might not be yours, and mounting the wrong folder brings the stack up healthy on an empty database — which looks like losing everything. Refusing to deploy is the safe way to get this wrong.
- **Backups need no configuration**: `backup.sh` defaults to the `data/` folder beside itself, which is where your clone already keeps it.
- **Housekeeping**: removed dead Firebase entries left in `.dockerignore` by the v2 cutover, and deleted the merged feature branches from the repository.

No application, schema or security-model changes — the container still publishes on `127.0.0.1:3001` and Tailscale is untouched.

---

## 2.0.1 — 2026-08-16

### Fixes & improvements

- **Deployment via Portainer**: the app now runs as a Portainer stack deployed straight from this repository — Portainer clones it onto the server and builds the image itself. Updates are the *Pull and redeploy* button instead of an SSH session. See `docs/V2-SETUP.md`.
- **The database stays in a folder you own**: the container's data volume is an absolute host path (`DATA_DIR`, defaulting to the existing folder), so the database is never stored inside Portainer's internals and survives deleting or recreating the stack.
- **Working backups**: `update.sh` is replaced by `backup.sh`. The old script copied `budget.db` with `cp`, which does not work on a WAL-mode database — those backups captured a stale, sometimes completely empty database. Backups now use `sqlite3 .backup` for a consistent snapshot that is safe to take while the app is running, are written outside the container's volume, and are pruned to the newest 14. Schedule it with cron; a redeploy no longer takes one for you.

---
