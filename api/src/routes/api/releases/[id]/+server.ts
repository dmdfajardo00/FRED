import { json, error } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id);
	if (Number.isNaN(id)) throw error(400, 'Invalid release id');

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 200);

	const [release] = await query(
		`SELECT id, name, press_release, link, notes FROM releases WHERE id = ?`,
		id
	);
	if (!release) throw error(404, 'Release not found');

	const series = await query(
		`SELECT id, title, frequency_short, units_short, popularity, observation_count,
		        CAST(observation_start AS VARCHAR) AS observation_start,
		        CAST(observation_end AS VARCHAR) AS observation_end
		 FROM series
		 WHERE list_contains(release_ids, ?::INTEGER)
		 ORDER BY popularity DESC NULLS LAST
		 LIMIT ?`,
		id,
		limit
	);

	return json({ release, series, count: series.length });
};
