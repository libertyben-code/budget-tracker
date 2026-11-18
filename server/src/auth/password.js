import crypto from 'node:crypto';
import { promisify } from 'node:util';

// Argon2id is the first choice — memory-hard, the current best defence against a
// stolen-hash offline attack on a GPU. But it is a native addon, and if it will
// not build on a given machine (Windows without build tools, an odd Node ABI) we
// fall back to scrypt, which is built into Node, needs no compiler, and is itself
// memory-hard and perfectly strong. The stored hash names its own scheme, so the
// two can coexist in one table and a machine can verify a hash the other wrote.
const scrypt = promisify(crypto.scrypt);

// scrypt cost. N=2^15 with r=8,p=1 is ~32 MB and a few ms — the OWASP-recommended
// floor, comfortable for a login that happens a handful of times a day.
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 32 };

let argon2 = null;
try {
  argon2 = (await import('argon2')).default;
} catch {
  argon2 = null;
  console.warn('[auth] argon2 unavailable — using built-in scrypt for password hashing');
}

async function scryptHash(password) {
  const salt = crypto.randomBytes(16);
  const dk = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

async function scryptVerify(stored, password) {
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const dk = await scrypt(password, salt, expected.length, { N: +N, r: +r, p: +p });
  // Both buffers are our own fixed length, so timingSafeEqual is safe to call.
  return crypto.timingSafeEqual(dk, expected);
}

export async function hashPassword(password) {
  if (argon2) return argon2.hash(password, { type: argon2.argon2id });
  return scryptHash(password);
}

// Dispatch on the stored hash, not on which library is loaded now: a hash written
// as argon2 must still verify even if this process fell back to scrypt, and vice
// versa. argon2's own verify is constant-time; scryptVerify uses timingSafeEqual.
export async function verifyPassword(stored, password) {
  if (!stored) return false;
  if (stored.startsWith('$argon2')) {
    if (!argon2) throw new Error('hash is argon2 but argon2 is unavailable in this process');
    return argon2.verify(stored, password);
  }
  if (stored.startsWith('scrypt$')) return scryptVerify(stored, password);
  return false;
}

export const usingArgon2 = () => !!argon2;
