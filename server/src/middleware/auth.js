// Sessions are the access control (docs/AUTH_ROLLOUT_PLAN.md): being on the tailnet no longer
// lets anyone in, and the workspace a session names is the whole of data scoping.
//
// A request may present its session two ways, and which one it used decides
// whether CSRF applies:
//   • Cookie (budget_session) — what the same-origin PWA sends automatically. A
//     browser also sends it on a forged cross-site request, so cookie auth on a
//     state-changing method must pass the double-submit CSRF check.
//   • Authorization: Bearer <token> — kept for a native wrapper that would be a
//     different origin. A browser never attaches it on its own, so there is no
//     CSRF surface on this path and the check is skipped. No client uses it yet.
import { lookupSession } from '../auth/session.js';
import { parseCookies, clearAuthCookies, SESSION_COOKIE, CSRF_COOKIE } from '../auth/cookies.js';
import { safeEqualHex } from '../auth/tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function bearerToken(req) {
  return req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7).trim() : null;
}

export function requireSession(db) {
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    const bearer = bearerToken(req);
    const viaCookie = !bearer && !!cookies[SESSION_COOKIE];

    const user = lookupSession(db, bearer || cookies[SESSION_COOKIE]);
    if (!user) {
      // A cookie that no longer names a session is dead weight the browser would keep sending.
      if (viaCookie) clearAuthCookies(res);
      return res.status(401).json({ error: 'unauthenticated' });
    }
    if (!user.workspaceId) return res.status(403).json({ error: 'no_workspace' });

    // Double-submit: the CSRF cookie is readable by our own client, which echoes
    // it in this header; a cross-site attacker can neither read the cookie nor
    // set the header. Compared length-safe. Only the cookie path, only unsafe methods.
    if (viaCookie && !SAFE_METHODS.has(req.method)) {
      const sent = String(req.headers['x-csrf-token'] || '');
      const expected = cookies[CSRF_COOKIE] || '';
      if (!expected || !sent || !safeEqualHex(Buffer.from(sent).toString('hex'), Buffer.from(expected).toString('hex'))) {
        return res.status(403).json({ error: 'csrf' });
      }
    }

    req.user = user;
    next();
  };
}
