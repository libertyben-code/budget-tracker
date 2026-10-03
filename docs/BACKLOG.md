# Budget Tracker — Backlog

Active pending items only. Completed items are moved to `docs/DONE.md`.

Format: `- [ ] description` for pending. When done: delete from here, append to `docs/DONE.md` with `— OK`.

---

## Transactions

## Categorization

## Dashboard

## Savings

- [ ] Make savings global instead of per budget account: one Savings tab whatever account is active, a category-fed account summing that category across every budget account (requested 2026-10-03, builds on `feature/bank-sync`). Points to settle: `savings_accounts.account_id` is `NOT NULL … ON DELETE CASCADE`, so deleting a budget account deletes its savings — needs a table rebuild in `db.js`, not just a column; the fed balance/history is derived client-side from the active account's transactions only, so it moves server-side (`GET /accounts/:id/data` or a `/savings` route); `applyDueRecurring` runs per account; category rename/delete are per account but would re-point a global link — decide whether a rename in one account follows or leaves the link.

## Joint Split

## Auth / UI

## Evolutions
