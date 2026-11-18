import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from './password.js';
import { activationCode, sha256, safeEqualHex } from './tokens.js';
import { createWorkspace, joinWorkspace, workspaceOfUsername } from './workspaces.js';

export const ROLES = ['admin', 'user'];
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,31}$/i;
export const MIN_PASSWORD = 10;

const ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_FAILS = 5;
export const LOCK_MS = 15 * 60 * 1000;

const iso = () => new Date().toISOString();

// A hash of a value that is never a real password, verified against on the
// no-such-user path so that "unknown username" and "wrong password" take the same
// time. Without it, a fast 401 is a username oracle.
let dummyHash = null;
async function dummy() {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

// Create a PENDING account: no password, a one-time activation code returned in
// plaintext exactly once (only its hash is stored). The admin hands the code to
// the person. This is the only place an account is born; there is no sign-up.
//
// It is born with a workspace: its own, or with `pairWith` the one that account
// is in — which is the whole of sharing. The partner is looked up before
// anything is written, so a mistyped name does not leave half an account.
export function createUser(db, { username, displayName, role = 'user', pairWith }) {
  if (!ROLES.includes(role)) throw new Error(`unknown role: ${role}`);
  const name = String(username || '').trim();
  if (!USERNAME_RE.test(name)) throw new Error('username: 2–32 letters, digits, dots, dashes or underscores');
  const display = String(displayName || '').trim();
  if (!display) throw new Error('display name required');
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(name)) throw new Error(`username already taken: ${name}`);
  const shared = pairWith ? workspaceOfUsername(db, pairWith) : null;
  if (pairWith && !shared) throw new Error(`no such user to pair with: ${pairWith}`);

  const id = crypto.randomUUID();
  const code = activationCode();
  const now = iso();
  let workspaceId = shared;
  db.transaction(() => {
    db.prepare(`
      INSERT INTO users (id, username, display_name, role, activation_hash, activation_expires, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, display, role, sha256(code), new Date(Date.now() + ACTIVATION_TTL_MS).toISOString(), now, now);
    if (shared) joinWorkspace(db, id, shared);
    else workspaceId = createWorkspace(db, { userId: id, displayName: display, role });
  })();
  return { id, username: name, code, workspaceId, paired: Boolean(shared) };
}

// A new code for an existing account — the admin's answer to "forgot password"
// or a lapsed activation. It does not clear the current password; the account
// keeps working until someone completes activation with the new code.
export function reissueActivation(db, username) {
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(String(username || '').trim());
  if (!user) throw new Error(`no such user: ${username}`);
  const code = activationCode();
  db.prepare('UPDATE users SET activation_hash = ?, activation_expires = ?, updated_at = ? WHERE id = ?')
    .run(sha256(code), new Date(Date.now() + ACTIVATION_TTL_MS).toISOString(), iso(), user.id);
  return { id: user.id, username: user.username, code };
}

// Consume a code to set a password. Same path serves first activation and a reset.
// Reasons are returned as codes, not thrown — the route maps them all to one
// generic answer so activation cannot be used to probe which usernames exist.
export async function activateUser(db, { username, code, newPassword }) {
  if (!newPassword || newPassword.length < MIN_PASSWORD) return { ok: false, reason: 'weak_password' };
  const user = db.prepare('SELECT id, activation_hash, activation_expires FROM users WHERE username = ? AND active = 1')
    .get(String(username || '').trim());
  if (!user || !user.activation_hash) return { ok: false, reason: 'no_activation' };
  if (Date.now() > new Date(user.activation_expires).getTime()) return { ok: false, reason: 'expired' };
  // The code is printed in capitals; a phone that lower-cases it is not wrong.
  if (!safeEqualHex(sha256(String(code).trim().toUpperCase()), user.activation_hash)) return { ok: false, reason: 'bad_code' };

  const passwordHash = await hashPassword(newPassword);
  db.prepare(`
    UPDATE users
       SET password_hash = ?, activation_hash = NULL, activation_expires = NULL,
           failed_logins = 0, locked_until = NULL, updated_at = ?
     WHERE id = ?
  `).run(passwordHash, iso(), user.id);
  return { ok: true };
}

// Verify a login. Every failure returns { ok: false } with a coarse reason the
// route flattens to one answer. Lockout is persisted on the row so it holds
// across a restart; a clean login clears it.
export async function verifyLogin(db, { username, password }) {
  const user = db.prepare(`
    SELECT id, username, display_name, role, password_hash, active, failed_logins, locked_until
      FROM users WHERE username = ?
  `).get(String(username || '').trim());

  if (!user) { await verifyPassword(await dummy(), password); return { ok: false, reason: 'bad_credentials' }; }
  if (!user.active) { await verifyPassword(await dummy(), password); return { ok: false, reason: 'inactive' }; }
  if (user.locked_until && Date.now() < new Date(user.locked_until).getTime()) {
    await verifyPassword(await dummy(), password);
    return { ok: false, reason: 'locked' };
  }
  if (!user.password_hash) { await verifyPassword(await dummy(), password); return { ok: false, reason: 'needs_activation' }; }

  if (await verifyPassword(user.password_hash, password)) {
    if (user.failed_logins) db.prepare('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?').run(user.id);
    return { ok: true, user: { id: user.id, username: user.username, displayName: user.display_name, role: user.role } };
  }

  const fails = user.failed_logins + 1;
  const lockUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS).toISOString() : null;
  db.prepare('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?').run(fails, lockUntil, user.id);
  return { ok: false, reason: 'bad_credentials' };
}
