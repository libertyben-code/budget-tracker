# Budget Tracker — Bugs

Confirmed bugs to fix in priority before new features.

Format: `- [ ] description` pending, `- [x] description — OK` once fixed.

---

## Transactions

- [ ] `PATCH`/`DELETE /transactions/:txId` and the batch routes take ids with no account scope. Harmless with one user; blocking for the auth rollout.

## Categorization

## Dashboard

## Savings

## Joint Split

## Auth / UI

- [ ] `client/js/app.js` turns every boot failure into "offline" and `api.js` throws without a status: a future 401 is indistinguishable from a down server (auth rollout).
- [ ] `client/sw.js` keeps `/api/bootstrap` and `/api/accounts/:id/data` in Cache Storage; on a shared device that outlives a logout — clear on logout (auth rollout).
