// Hand-rolled cookie read/write — the only cookies here are ones we set, with
// values we control (a base64url token, a random CSRF token), so a dependency buys
// nothing. Never widen this to reflect arbitrary cookie values back into headers.

export const SESSION_COOKIE = 'budget_session';
export const CSRF_COOKIE = 'budget_csrf';

// Secure unless switched off by name. `tailscale serve` terminates TLS in front
// of the deployed app, so the default is the deployed shape; only a plain-http
// address other than localhost needs it off, and a deliberately spelled `false`
// is harder to ship by accident than an unset NODE_ENV.
const SECURE = process.env.COOKIE_SECURE !== 'false';

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) {
      try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
    }
  }
  return out;
}

function serialize(name, value, { httpOnly, maxAgeMs } = {}) {
  const bits = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) bits.push('HttpOnly');
  if (SECURE) bits.push('Secure');
  if (maxAgeMs != null) bits.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  return bits.join('; ');
}

// The session cookie is HttpOnly so script cannot read the token. The CSRF cookie
// is deliberately NOT HttpOnly: the client reads it and echoes it in a header, and
// the server checks the two match (double-submit). A cross-site page can neither
// read our cookie nor forge the header, so a forged request fails the check.
export function setAuthCookies(res, { sessionToken, sessionMaxAgeMs, csrfToken }) {
  res.setHeader('Set-Cookie', [
    serialize(SESSION_COOKIE, sessionToken, { httpOnly: true, maxAgeMs: sessionMaxAgeMs }),
    serialize(CSRF_COOKIE, csrfToken, { httpOnly: false, maxAgeMs: sessionMaxAgeMs }),
  ]);
}

export function clearAuthCookies(res) {
  res.setHeader('Set-Cookie', [
    serialize(SESSION_COOKIE, '', { httpOnly: true, maxAgeMs: 0 }),
    serialize(CSRF_COOKIE, '', { httpOnly: false, maxAgeMs: 0 }),
  ]);
}
