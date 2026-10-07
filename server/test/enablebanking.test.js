import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildJwt, loadConfig, EnableBankingClient, ApiError } from '../src/enablebanking.js';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });

test('buildJwt produces an RS256 token with the documented header and claims', () => {
  const now = 1_700_000_000;
  const jwt = buildJwt({ appId: 'app-123', privateKey: pem }, now);
  const [h, p, s] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { typ: 'JWT', alg: 'RS256', kid: 'app-123' });
  assert.deepEqual(JSON.parse(Buffer.from(p, 'base64url')), {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + 3600,
  });
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url')));
});

test('loadConfig accepts a base64 key, a literal-\\n key, a key file, and reports unconfigured', () => {
  const b64 = loadConfig({ EB_APP_ID: 'x', EB_PRIVATE_KEY: Buffer.from(pem).toString('base64') });
  assert.equal(b64.privateKey, pem);
  assert.ok(b64.configured);
  assert.equal(b64.apiBase, 'https://api.enablebanking.com');

  const literal = loadConfig({ EB_APP_ID: 'x', EB_PRIVATE_KEY: pem.replace(/\n/g, '\\n'), EB_API_BASE: 'http://mock/' });
  assert.equal(literal.privateKey.trim(), pem.trim());
  assert.equal(literal.apiBase, 'http://mock');

  assert.equal(loadConfig({}).configured, false);
  assert.equal(loadConfig({ EB_APP_ID: 'x' }).configured, false);
});

test('client: bearer + PSU headers, continuation paging, retry without a rejected partial PSU set, typed errors', async () => {
  const calls = [];
  let transactionCalls = 0;
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    const u = new URL(url);
    if (u.pathname === '/accounts/u1/transactions') {
      transactionCalls++;
      if (transactionCalls === 1) {
        return new Response(JSON.stringify({ code: 'PSU_HEADER_NOT_PROVIDED', message: 'partial' }), { status: 400 });
      }
      const page = u.searchParams.get('continuation_key');
      return Response.json(page
        ? { transactions: [{ transaction_id: 'b' }] }
        : { transactions: [{ transaction_id: 'a' }], continuation_key: 'k2' });
    }
    return new Response(JSON.stringify({ message: 'nope' }), { status: 404 });
  };
  const client = new EnableBankingClient({ appId: 'app', privateKey: pem, apiBase: 'https://mock.test' }, { fetchImpl });
  const txs = await client.fetchTransactions('u1', {
    dateFrom: '2026-01-01', dateTo: '2026-02-01', psu: { ip: '1.2.3.4', userAgent: 'UA' },
  });
  assert.deepEqual(txs.map(t => t.transaction_id), ['a', 'b']);
  assert.match(calls[0].init.headers.Authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  assert.equal(calls[0].init.headers['Psu-Ip-Address'], '1.2.3.4');
  assert.equal(calls[0].init.headers['Psu-User-Agent'], 'UA');
  assert.equal(calls[1].init.headers['Psu-Ip-Address'], undefined, 'retry drops the PSU headers');
  assert.ok(calls[0].url.includes('date_from=2026-01-01') && calls[0].url.includes('date_to=2026-02-01'));
  assert.ok(calls[2].url.includes('continuation_key=k2'));

  await assert.rejects(client.getApplication(), (err) => err instanceof ApiError && err.status === 404 && err.message === 'nope');
});
