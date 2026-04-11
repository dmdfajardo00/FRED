// scripts/lib/fred-client.js
// Shared FRED API client — uses node:https directly with `agent: false` to
// force a fresh HTTP/1.1 TCP connection per request. This bypasses undici's
// HTTP/2 connection pool entirely, which we previously saw get stuck on stale
// connections when FRED returned 5xx errors under load.
//
// FRED's documented limit is 120 req/min per key. We stay well under at ~109/min.

import https from 'node:https';

const BASE_HOST = 'api.stlouisfed.org';
const MIN_INTERVAL_MS = 550; // ~109 req/min
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 30000;

let lastRequestTime = 0;

function assertKey() {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error('FRED_API_KEY not set. Run with --env-file=.env');
  return key;
}

async function throttle() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Make a one-shot HTTP/1.1 GET request via node:https.
 * `agent: false` forces a fresh TCP connection each time — no pool, no reuse.
 */
function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'GET',
        headers,
        agent: false, // KEY: disables connection pooling, one TCP per request
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          resolve({ statusCode: res.statusCode, body });
        });
        res.on('error', reject);
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`request timeout after ${REQUEST_TIMEOUT_MS}ms`));
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch a FRED API endpoint. Always returns parsed JSON.
 * @param {string} endpoint - e.g. '/fred/category/children'
 * @param {object} params   - query params (api_key and file_type are set automatically for v1)
 */
export async function fetchFred(endpoint, params = {}) {
  const key = assertKey();
  const url = new URL('https://' + BASE_HOST + endpoint);
  // v2 endpoints use HTTP Bearer auth (Authorization header).
  // v1 endpoints use the api_key query parameter.
  const isV2 = endpoint.startsWith('/fred/v2/');
  if (!isV2) {
    url.searchParams.set('api_key', key);
    url.searchParams.set('file_type', 'json');
  }
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const headers = {
    'User-Agent': 'curl/8.4.0',
    'Accept': 'application/json',
    'Host': BASE_HOST,
  };
  if (isV2) headers.Authorization = `Bearer ${key}`;

  let attempt = 0;
  while (true) {
    await throttle();
    try {
      const { statusCode, body } = await httpGet(url.toString(), headers);

      if (statusCode === 429) {
        const wait = 5000 * (attempt + 1);
        console.warn(`[rate-limit] 429 on ${endpoint}, sleeping ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        attempt++;
        if (attempt > MAX_RETRIES) throw new Error(`429 exhausted retries`);
        continue;
      }

      if (statusCode < 200 || statusCode >= 300) {
        if (statusCode === 400) {
          const err = new Error(`FRED 400: ${body}`);
          err.status = 400;
          throw err;
        }
        throw new Error(`FRED ${statusCode}: ${body.slice(0, 200)}`);
      }

      return JSON.parse(body);
    } catch (err) {
      if (err.status === 400) throw err;
      attempt++;
      if (attempt > MAX_RETRIES) throw err;
      const wait = 1000 * 2 ** attempt;
      console.warn(`[retry ${attempt}] ${endpoint}: ${err.message}. Sleeping ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

/**
 * Paginate a FRED endpoint that supports limit/offset and returns a keyed array.
 */
export async function paginateFred(endpoint, params, arrayKey, pageSize = 1000) {
  const out = [];
  let offset = 0;
  while (true) {
    const res = await fetchFred(endpoint, { ...params, limit: pageSize, offset });
    const page = res[arrayKey] || [];
    out.push(...page);
    const total = res.count ?? out.length;
    console.log(`  [${endpoint}] offset=${offset} got=${page.length} total_so_far=${out.length}/${total}`);
    if (page.length === 0) break;
    if (out.length >= total) break;
    offset += pageSize;
  }
  return out;
}
