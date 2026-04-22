import type { Handle } from '@sveltejs/kit';
import { timingSafeEqual } from 'node:crypto';

/**
 * Strict origin allowlist. Browsers from these origins auto-pass the gate;
 * anything else must present a matching X-API-Key or gets 403.
 *
 * Patterns are anchored with ^ and $ to prevent suffix/prefix spoofing
 * (e.g. https://dmdfajardo.pro.attacker.com must NOT match).
 */
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
	// Local dev (any port on localhost / 127.0.0.1, http only)
	/^http:\/\/localhost(:\d+)?$/,
	/^http:\/\/127\.0\.0\.1(:\d+)?$/,
	// Apex domain, exact
	/^https:\/\/dmdfajardo\.pro$/,
	// Any subdomain of dmdfajardo.pro
	/^https:\/\/[a-z0-9-]+\.dmdfajardo\.pro$/,
	// Any vercel.app subdomain (covers preview deploys)
	/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/
];

const API_KEY = process.env.API_KEY || '';

function isAllowedOrigin(origin: string): boolean {
	if (!origin) return false;
	return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

function isValidApiKey(provided: string | null): boolean {
	if (!API_KEY || !provided) return false;
	const a = Buffer.from(API_KEY, 'utf8');
	const b = Buffer.from(provided, 'utf8');
	// timingSafeEqual requires equal lengths; short-circuit otherwise to
	// avoid a length-based leak (constant-length compare is done afterwards).
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

function truncate(s: string, n: number): string {
	return s.length > n ? s.slice(0, n) : s;
}

function buildCorsHeaders(allowedOrigin: string | null): Record<string, string> {
	const headers: Record<string, string> = {
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
		'Access-Control-Max-Age': '86400',
		Vary: 'Origin'
	};
	if (allowedOrigin) {
		headers['Access-Control-Allow-Origin'] = allowedOrigin;
	}
	return headers;
}

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin') ?? '';
	const path = event.url.pathname;
	const method = event.request.method;

	const originOk = isAllowedOrigin(origin);
	const apiKeyOk = isValidApiKey(event.request.headers.get('x-api-key'));

	// Only echo the origin back when the browser origin is in the allowlist.
	// For key-bypass (server-to-server) and no-Origin requests, skip ACAO.
	const echoOrigin = originOk ? origin : null;

	// CORS preflight: never 403 (would break the browser's CORS error UX).
	// Respond 204; if origin isn't allowed, omit ACAO so preflight fails cleanly.
	if (method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: buildCorsHeaders(echoOrigin) });
	}

	// Gate applies only to /api/*. Root health check and everything else stay public.
	if (path.startsWith('/api/')) {
		if (!originOk && !apiKeyOk) {
			console.warn(`[auth] 403 rejected origin="${truncate(origin, 80)}" path="${path}"`);
			return new Response(JSON.stringify({ error: 'Forbidden' }), {
				status: 403,
				headers: { 'Content-Type': 'application/json', ...buildCorsHeaders(echoOrigin) }
			});
		}
	}

	const response = await resolve(event);

	for (const [key, value] of Object.entries(buildCorsHeaders(echoOrigin))) {
		response.headers.set(key, value);
	}

	return response;
};
