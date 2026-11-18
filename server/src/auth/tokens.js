import crypto from 'node:crypto';

// A session token and an activation code are the same shape of secret: a random
// value the client holds and the server stores only as a hash. 256 bits from the
// CSPRNG, base64url so it survives a cookie and a URL unescaped.
export function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

// Activation codes are typed or pasted by a human, so make them shorter and
// unambiguous — no letters that read as digits. Still 20 chars of a 32-symbol
// alphabet ≈ 100 bits, far past guessable for a value that also expires and is
// one-time.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function activationCode() {
  const bytes = crypto.randomBytes(20);
  let out = '';
  for (let i = 0; i < 20; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Compare two hex digests without leaking, through timing, how many leading
// characters matched. Length-guarded so timingSafeEqual never throws on a
// mismatched buffer size.
export function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}
