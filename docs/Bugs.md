# Budget Tracker — Bugs

Confirmed bugs to fix in priority before new features.

Format: `- [ ] description` pending, `- [x] description — OK` once fixed.

---

## Transactions

- [ ] `shared/csv.js` cannot round-trip: import splits on bare commas while export quotes fields with commas and prefixes `'` to a leading `-`. `"Shop, Ltd",-5.5` comes back as amount 0, type `'-5.5`. The app cannot re-import its own export (found in review, 2026-09-28).
- [ ] `PATCH`/`DELETE /transactions/:txId` and the batch routes take ids with no account scope. Harmless with one user; blocking for the auth rollout.

## Categorization

- [ ] Category rename/delete rewrite or delete `category_rules` for every account (`routes/api.js`): rules are global while categories are per account.

## Dashboard

## Savings

## Joint Split

## Auth / UI

- [ ] `client/js/app.js` turns every boot failure into "offline" and `api.js` throws without a status: a future 401 is indistinguishable from a down server (auth rollout).
- [ ] `client/sw.js` keeps `/api/bootstrap` and `/api/accounts/:id/data` in Cache Storage; on a shared device that outlives a logout — clear on logout (auth rollout).
