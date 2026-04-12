import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q');
	if (!q || q.length < 2) return json({ series: [], count: 0 });

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
	const pattern = `%${q}%`;

	const rows = await query(
		`SELECT id, title, frequency_short, units_short, popularity, observation_count,
		        CAST(observation_start AS VARCHAR) AS observation_start,
		        CAST(observation_end AS VARCHAR) AS observation_end
		 FROM series
		 WHERE title ILIKE ? OR id ILIKE ? OR notes ILIKE ?
		 ORDER BY popularity DESC
		 LIMIT ?`,
		pattern,
		pattern,
		pattern,
		limit
	);

	return json({ series: rows, count: rows.length, query: q });
};
