import express from 'express';
import { verifyLogin, activateUser, MIN_PASSWORD } from '../auth/users.js';
import { createSession, destroySession, destroyUserSessions, ABSOLUTE_MS } from '../auth/session.js';
import { randomToken } from '../auth/tokens.js';
import { parseCookies, setAuthCookies, clearAuthCookies, SESSION_COOKIE } from '../auth/cookies.js';
import { bearerToken } from '../middleware/auth.js';

// Bounded here, at the boundary, so a hash is never computed over something
// absurd. Every failure is one 400; the field names are not worth telling apart.
const text = (value, max) => (typeof value === 'string' && value.length > 0 && value.length <= max ? value : null);

function issueSession(db, res, user, req) {
  const { token } = createSession(db, user.id, { userAgent: req.headers['user-agent'], ip: req.ip });
  setAuthCookies(res, { sessionToken: token, sessionMaxAgeMs: ABSOLUTE_MS, csrfToken: randomToken() });
}

// Login and activation must be reachable WITHOUT a session, so this router is
// mounted before requireSession. Both, on success, mint a session and set the
// cookies. The session token never appears in a body: the client is same-origin
// and the httpOnly cookie is the only place it lives.
export function createAuthPublicRouter(db) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const username = text(req.body?.username, 64);
    const password = text(req.body?.password, 256);
    if (!username || !password) return res.status(400).json({ error: 'missing_fields' });

    const result = await verifyLogin(db, { username, password });
    // One answer for every failure — bad password, unknown user, locked, not
    // activated — so login reveals nothing about which usernames exist.
    if (!result.ok) return res.status(401).json({ error: 'bad_credentials' });

    issueSession(db, res, result.user, req);
    res.json({ user: result.user });
  });

  router.post('/activate', async (req, res) => {
    const username = text(req.body?.username, 64);
    const code = text(req.body?.code, 64);
    const newPassword = text(req.body?.newPassword, 256);
    if (!username || !code || !newPassword) return res.status(400).json({ error: 'missing_fields' });

    const result = await activateUser(db, { username, code, newPassword });
    if (!result.ok) {
      if (result.reason === 'weak_password') return res.status(400).json({ error: 'weak_password', min: MIN_PASSWORD });
      return res.status(400).json({ error: 'bad_code' });
    }

    // The code just used was proof enough of identity, so a second password prompt would be theatre.
    const full = await verifyLogin(db, { username, password: newPassword });
    issueSession(db, res, full.user, req);
    res.json({ user: full.user });
  });

  return router;
}

// Mounted after requireSession.
export function createAuthRouter(db) {
  const router = express.Router();

  router.get('/me', (req, res) => {
    const { id, username, displayName, role } = req.user;
    res.json({ user: { id, username, displayName, role } });
  });

  router.post('/logout', (req, res) => {
    destroySession(db, bearerToken(req) || parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    clearAuthCookies(res);
    res.status(204).end();
  });

  router.post('/logout-all', (req, res) => {
    destroyUserSessions(db, req.user.id);
    clearAuthCookies(res);
    res.status(204).end();
  });

  return router;
}
