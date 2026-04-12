import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const idsParam = url.searchParams.get('ids');

	if (idsParam) {
		const ids = idsParam.split(',').slice(0, 100);
		const placeholders = ids.map(() => '?').join(',');
		const rows = await query(
			`SELECT id, title, frequency, frequency_short, units, units_short,
			        seasonal_adjustment, seasonal_adjustment_short,
			        CAST(observation_start AS VARCHAR) AS observation_start,
			        CAST(observation_end AS VARCHAR) AS observation_end,
			        last_updated, popularity, group_popularity, notes,
			        release_ids, category_ids, tags,
			        observation_count, observations_source
			 FROM series WHERE id IN (${placeholders})`,
			...ids
		);
		return json({ series: rows, count: rows.length });
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const sort = url.searchParams.get('sort') === 'popularity' ? 'popularity DESC' : 'id';

	const rows = await query(
		`SELECT id, title, frequency_short, units_short, popularity, observation_count,
		        CAST(observation_start AS VARCHAR) AS observation_start,
		        CAST(observation_end AS VARCHAR) AS observation_end
		 FROM series ORDER BY ${sort} LIMIT ? OFFSET ?`,
		limit,
		offset
	);

	return json({ series: rows, count: rows.length });
};
