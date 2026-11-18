// How every account is born: there is no sign-up page. It never sets a password — it creates
// (or refreshes) a PENDING account and prints a one-time activation code; the person picks
// their own password in the app's login page, so the owner never learns it.
//
//   node server/scripts/create-user.js <username> "<Display Name>" [--admin] [--pair-with <username>]
//   node server/scripts/create-user.js <username> --reissue      # new code, keeps the account
//
// The first --admin account takes the household that holds everything from before logins.
// Any other account gets a household of its own; --pair-with puts it in that account's
// household instead, which is the only way two people share anything.
//
// In Docker: docker exec budget-tracker node server/scripts/create-user.js …
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../src/db.js';
import { createUser, reissueActivation } from '../src/auth/users.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const USAGE = [
  'usage: node server/scripts/create-user.js <username> "<Display Name>" [--admin] [--pair-with <username>]',
  '       node server/scripts/create-user.js <username> --reissue',
].join('\n');

const db = openDb(process.env.DB_PATH || path.join(ROOT, 'data', 'budget.db'));
try {
  const args = process.argv.slice(2);
  const username = args[0];
  if (!username) throw new Error(USAGE);

  let result;
  if (args[1] === '--reissue') {
    result = reissueActivation(db, username);
    console.log(`\nRe-issued activation for ${result.username}. Their password works until they use the code.`);
  } else {
    const displayName = args[1];
    if (!displayName || displayName.startsWith('--')) throw new Error(USAGE);
    const role = args.includes('--admin') ? 'admin' : 'user';
    const pair = args.indexOf('--pair-with');
    const pairWith = pair === -1 ? undefined : args[pair + 1];
    if (pair !== -1 && !pairWith) throw new Error(USAGE);
    result = createUser(db, { username, displayName, role, pairWith });
    console.log(`\nCreated pending account ${result.username} (${role}).`);
    if (result.paired) console.log(`Shares a household with ${pairWith}.`);
    else if (result.workspaceId === 'home') console.log('Takes the household that holds the existing data.');
    else console.log('Has a household of its own, with an empty "Main Account".');
  }

  console.log('Activation code (valid 7 days, one-time — give it to the person):\n');
  console.log(`    ${result.code}\n`);
  console.log('They open the app, choose "First time here?", and enter their username, this code and a password.');
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
