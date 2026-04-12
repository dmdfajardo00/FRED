import type { Handle } from '@sveltejs/kit';

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim());

export const handle: Handle = async ({ event, resolve }) => {
	const origin = event.request.headers.get('origin') ?? '';

	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: corsHeaders(origin)
		});
	}

	const response = await resolve(event);

	for (const [key, value] of Object.entries(corsHeaders(origin))) {
		response.headers.set(key, value);
	}

	return response;
};

function corsHeaders(origin: string): Record<string, string> {
	const allowed =
		ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.some((o) => origin.startsWith(o));

	return {
		'Access-Control-Allow-Origin': allowed ? origin || '*' : '',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400'
	};
}
