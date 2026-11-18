import { randomToken, sha256 } from './tokens.js';

// Two horizons, both enforced server-side so a stolen cookie cannot outlive
// either. Absolute: a session is dead this long after creation no matter what.
// Idle: dead this long after its last use. The idle window slides on lookup; the
// absolute one never moves. These are phones that get lost, hence 14 days idle.
export const ABSOLUTE_MS = 90 * 24 * 60 * 60 * 1000;
export const IDLE_MS = 14 * 24 * 60 * 60 * 1000;

// Every request looks the session up. Sliding last_seen each time would be a
// write per request for nothing: against a 14-day window, a slide that lands up
// to five minutes late changes no outcome.
const SLIDE_MS = 5 * 60 * 1000;

// Returns the RAW token — the only time it exists outside the client's cookie.
// The row holds sha256(token), so a database dump yields nothing that logs in.
export function createSession(db, userId, { userAgent, ip } = {}) {
  const token = randomToken();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + ABSOLUTE_MS).toISOString();
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, created_at, last_seen, expires_at, user_agent, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sha256(token), userId, now, now, expires, userAgent || null, ip || null);
  return { token, expires };
}

// The user behind a token, or null. One query joins the session to its user and
// household, so a disabled account (active = 0) or a changed membership counts on
// the very next request — the reason sessions live server-side.
export function lookupSession(db, token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT s.token_hash, s.last_seen, s.expires_at,
           u.id, u.username, u.display_name, u.role, u.active, m.workspace_id
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN workspace_members m ON m.user_id = u.id
     WHERE s.token_hash = ?
  `).get(sha256(token));
  if (!row) return null;

  const now = Date.now();
  const lastSeen = new Date(row.last_seen).getTime();
  if (!row.active || now > lastSeen + IDLE_MS || now > new Date(row.expires_at).getTime()) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash);
    return null;
  }

  if (now - lastSeen > SLIDE_MS) {
    db.prepare('UPDATE sessions SET last_seen = ? WHERE token_hash = ?').run(new Date(now).toISOString(), row.token_hash);
  }
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    workspaceId: row.workspace_id,
  };
}

export function destroySession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

// "Log out everywhere" in Settings, and what to swing when disabling an account.
export function destroyUserSessions(db, userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// A session nobody presents again is never looked up, so never deleted by the
// check above. Once per boot is enough to stop the table growing forever.
export function pruneSessions(db) {
  const now = Date.now();
  return db.prepare('DELETE FROM sessions WHERE expires_at < ? OR last_seen < ?')
    .run(new Date(now).toISOString(), new Date(now - IDLE_MS).toISOString()).changes;
}
