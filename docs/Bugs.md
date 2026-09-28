# Budget Tracker — Bugs

Confirmed bugs to fix in priority before new features.

Format: `- [ ] description` pending, `- [x] description — OK` once fixed.

---

## Transactions

- [ ] `shared/csv.js` cannot round-trip: import splits on bare commas while export quotes fields with commas and prefixes `'` to a leading `-`. `"Shop, Ltd",-5.5` comes back as amount 0, type `'-5.5`. The app cannot re-import its own export (found in review, 2026-09-28).
- [ ] `date` is not validated on `POST /accounts/:id/transactions` (`routes/api.js`): `{"date":{}}` stores `[object Object]` and the year/month filters in `derive.js` swallow it silently.
- [ ] `PATCH`/`DELETE /transactions/:txId` and the batch routes take ids with no account scope. Harmless with one user; blocking for the auth rollout.

## Categorization

- [ ] Category rename/delete rewrite or delete `category_rules` for every account (`routes/api.js`): rules are global while categories are per account.
- [ ] A one-character rule pattern matches every description (`shared/categorize.js`).

## Dashboard

## Savings

- [ ] Amount/balance guards use `Number.isNaN`, not `Number.isFinite` (`routes/api.js`, four sites): `"1e400"` stores Infinity, serialises as `null`, and the total and history are broken from then on.
- [ ] Ids are `Date.now()`; `savings_history.id` is a global primary key, so two deposits in the same millisecond collide and answer 500. Two users make this likely — switch to `crypto.randomUUID()`.

## Joint Split

## Auth / UI

- [ ] Express 5 leaves `req.body` undefined when no parser matches, so `POST /accounts` without a JSON content type throws (now a JSON 500, was an HTML stack trace).
- [ ] `client/js/app.js` turns every boot failure into "offline" and `api.js` throws without a status: a future 401 is indistinguishable from a down server (auth rollout).
- [ ] `client/sw.js` keeps `/api/bootstrap` and `/api/accounts/:id/data` in Cache Storage; on a shared device that outlives a logout — clear on logout (auth rollout).
- [ ] `npm audit`: one moderate (`qs`, transitive via express) — `npm audit fix`.
