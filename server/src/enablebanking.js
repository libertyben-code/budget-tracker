// Enable Banking (enablebanking.com) client: RS256 JWT auth plus the few account-information
// endpoints the sync needs. No dependencies — Node's crypto signs the JWT, global fetch does
// the HTTP. The provider is kept behind this one module so a replacement (another
// aggregator, or a CSV fallback) only has to satisfy the same handful of methods.
import crypto from 'node:crypto';
import fs from 'node:fs';

export const DEFAULT_API_BASE = 'https://api.enablebanking.com';
const TOKEN_TTL = 3600; // seconds; the API rejects anything over 24h
const TOKEN_REFRESH_MARGIN = 300;

export function loadConfig(env = process.env) {
  const appId = (env.EB_APP_ID || '').trim();
  let privateKey = '';
  if (env.EB_PRIVATE_KEY_FILE) privateKey = fs.readFileSync(env.EB_PRIVATE_KEY_FILE, 'utf8');
  else if (env.EB_PRIVATE_KEY) privateKey = decodePem(env.EB_PRIVATE_KEY);
  return {
    appId,
    privateKey,
    redirectUrl: (env.EB_REDIRECT_URL || '').trim(),
    apiBase: (env.EB_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, ''),
    configured: Boolean(appId && privateKey),
  };
}

// Accepts the PEM verbatim (real newlines or the literal two characters "\n") or base64 of
// the whole file. A stack variable is a single line, so base64 is the form that survives
// Portainer without mangling.
function decodePem(value) {
  const v = String(value).trim();
  if (v.includes('-----BEGIN')) return v.replace(/\\n/g, '\n');
  return Buffer.from(v, 'base64').toString('utf8');
}

const b64url = (s) => Buffer.from(s).toString('base64url');

export function buildJwt({ appId, privateKey }, now = Math.floor(Date.now() / 1000), ttl = TOKEN_TTL) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }));
  const payload = b64url(JSON.stringify({
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: now,
    exp: now + ttl,
  }));
  const input = `${header}.${payload}`;
  // crypto.sign with an RSA key and sha256 is PKCS#1 v1.5, i.e. RS256
  const signature = crypto.sign('sha256', Buffer.from(input), privateKey).toString('base64url');
  return `${input}.${signature}`;
}

export class ApiError extends Error {
  constructor(message, { status, code, body } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export class EnableBankingClient {
  constructor(config, { fetchImpl = globalThis.fetch } = {}) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.token = null;
    this.tokenExp = 0;
  }

  bearer() {
    const now = Math.floor(Date.now() / 1000);
    if (!this.token || this.tokenExp - now < TOKEN_REFRESH_MARGIN) {
      this.token = buildJwt(this.config, now);
      this.tokenExp = now + TOKEN_TTL;
    }
    return this.token;
  }

  // psu = { ip, userAgent } marks the call as made while the end user is present, which
  // lifts the banks' four-unattended-fetches-a-day cap. Both headers or neither: the API
  // rejects a partial set, and on that rejection the safe retry is with none.
  async request(method, path, { query, body, psu } = {}) {
    const url = new URL(this.config.apiBase + path);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    }
    const headers = { Authorization: `Bearer ${this.bearer()}`, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (psu?.ip && psu?.userAgent) {
      headers['Psu-Ip-Address'] = psu.ip;
      headers['Psu-User-Agent'] = psu.userAgent;
    }
    const res = await this.fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
    if (!res.ok) {
      const code = typeof data?.code === 'string' ? data.code : (typeof data?.error === 'string' ? data.error : '');
      if (psu && code === 'PSU_HEADER_NOT_PROVIDED') return this.request(method, path, { query, body });
      const message = data?.message || data?.detail || `Enable Banking responded ${res.status}`;
      throw new ApiError(message, { status: res.status, code, body: data });
    }
    return data;
  }

  getApplication() { return this.request('GET', '/application'); }
  listAspsps(country) { return this.request('GET', '/aspsps', { query: { country, service: 'AIS' } }); }
  startAuth(payload) { return this.request('POST', '/auth', { body: payload }); }
  createSession(code) { return this.request('POST', '/sessions', { body: { code } }); }
  getSession(id) { return this.request('GET', `/sessions/${encodeURIComponent(id)}`); }
  deleteSession(id, psu) { return this.request('DELETE', `/sessions/${encodeURIComponent(id)}`, { psu }); }

  async fetchTransactions(uid, { dateFrom, dateTo, psu, maxPages = 100 } = {}) {
    const all = [];
    let continuationKey;
    for (let page = 0; page < maxPages; page++) {
      const data = await this.request('GET', `/accounts/${encodeURIComponent(uid)}/transactions`, {
        query: { date_from: dateFrom, date_to: dateTo, continuation_key: continuationKey },
        psu,
      });
      all.push(...(data?.transactions || []));
      continuationKey = data?.continuation_key;
      if (!continuationKey) break;
    }
    return all;
  }
}
