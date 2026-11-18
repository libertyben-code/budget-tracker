import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createUser } from '../src/auth/users.js';
import { createSession } from '../src/auth/session.js';
import { SESSION_COOKIE, CSRF_COOKIE } from '../src/auth/cookies.js';

const NO_BANK = { config: { configured: false }, client: null };

// An account with a live session, and the headers its browser would send: both cookies and
// the CSRF echo.
export function signIn(db, username, { role = 'user', pairWith } = {}) {
  const user = createUser(db, { username, displayName: username, role, pairWith });
  const { token } = createSession(db, user.id);
  const csrf = `csrf-${username}`;
  return { ...user, headers: { Cookie: `${SESSION_COOKIE}=${token}; ${CSRF_COOKIE}=${csrf}`, 'X-CSRF-Token': csrf } };
}

// The app on an ephemeral port over a temp database, with `owner` signed in as the admin who
// took the 'home' household and its 'default' account. `app.fetch` sends owner's session;
// `app.as(user)` makes the same for another account.
export function startApp(bank = NO_BANK) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-test-'));
  const db = openDb(path.join(dir, 'test.db'));
  const owner = signIn(db, 'owner', { role: 'admin' });
  const server = createApp(db, { bank });
  return new Promise((resolve) => {
    const listener = server.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${listener.address().port}`;
      const as = (who) => (url, init = {}) => fetch(base + url, { ...init, headers: { ...who.headers, ...init.headers } });
      resolve({
        db,
        base,
        owner,
        as,
        fetch: as(owner),
        close: () => { listener.close(); db.close(); fs.rmSync(dir, { recursive: true, force: true }); },
      });
    });
  });
}
