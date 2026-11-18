import crypto from 'node:crypto';

// A workspace is a household: every budget account, savings account, rule, category, joint
// setting and bank connection belongs to exactly one, and everyone in it sees all of it.

export function workspaceOfUsername(db, username) {
  return db.prepare(`
    SELECT m.workspace_id AS id FROM users u JOIN workspace_members m ON m.user_id = u.id
     WHERE u.username = ?
  `).get(String(username || '').trim())?.id;
}

// The workspace that holds everything written before there were logins (db.js seeds it as
// 'home') has no members until the first admin account takes it.
function unclaimedWorkspace(db) {
  return db.prepare(`
    SELECT id FROM workspaces WHERE id NOT IN (SELECT workspace_id FROM workspace_members)
    ORDER BY created_at LIMIT 1
  `).get()?.id;
}

// An account's own workspace, made with the account. A new one starts with a budget account,
// because the client always has one selected.
export function createWorkspace(db, { userId, displayName, role }) {
  const claimed = role === 'admin' ? unclaimedWorkspace(db) : null;
  const workspaceId = claimed || crypto.randomUUID();
  db.transaction(() => {
    if (!claimed) {
      db.prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)')
        .run(workspaceId, displayName, new Date().toISOString());
      db.prepare("INSERT INTO accounts (id, name, workspace_id) VALUES (?, 'Main Account', ?)")
        .run(`account_${crypto.randomUUID()}`, workspaceId);
    }
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')").run(workspaceId, userId);
  })();
  return workspaceId;
}

export function joinWorkspace(db, userId, workspaceId) {
  db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')").run(workspaceId, userId);
}
