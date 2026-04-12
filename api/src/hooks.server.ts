import type { Handle } from '@sveltejs/kit';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const API_KEY = process.env.API_KEY || '';

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin') ?? '';
	const path = event.url.pathname;

	// CORS preflight
	if (event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: corsHeaders(origin) });
	}

	// API key auth for /api/* routes (skip health check at root)
	if (path.startsWith('/api/') && API_KEY) {
		const provided = event.request.headers.get('x-api-key');
		if (provided !== API_KEY) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
			});
		}
	}

	const response = await resolve(event);

	for (const [key, value] of Object.entries(corsHeaders(origin))) {
		response.headers.set(key, value);
	}

	return response;
};

function corsHeaders(origin: string): Record<string, string> {
	const allowed =
		ALLOWED_ORIGINS.length === 0 ||
		ALLOWED_ORIGINS.includes('*') ||
		ALLOWED_ORIGINS.some((o) => origin.startsWith(o));

	return {
		'Access-Control-Allow-Origin': allowed ? origin || '*' : '',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
		'Access-Control-Max-Age': '86400'
	};
}
