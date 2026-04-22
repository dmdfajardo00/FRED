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
	const sortKey = url.searchParams.get('sort') || 'popularity';
	const category = url.searchParams.get('category');
	const tag = url.searchParams.get('tag');
	const frequency = url.searchParams.get('frequency');
	const popMin = url.searchParams.get('popMin');
	const release = url.searchParams.get('release');

	const sortClause =
		sortKey === 'alpha' ? 'title ASC'
		: sortKey === 'obs' ? 'observation_count DESC'
		: sortKey === 'recent' ? 'observation_end DESC'
		: 'popularity DESC';

	const where: string[] = [];
	const params: unknown[] = [];
	if (category) { where.push('list_contains(category_ids, ?::INTEGER)'); params.push(parseInt(category)); }
	if (tag) { where.push('list_contains(tags, ?)'); params.push(tag); }
	if (frequency) { where.push('frequency_short = ?'); params.push(frequency); }
	if (release) { where.push('list_contains(release_ids, ?::INTEGER)'); params.push(parseInt(release)); }
	if (popMin) { where.push('popularity >= ?'); params.push(parseInt(popMin)); }

	const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

	const rows = await query(
		`SELECT id, title, frequency_short, units_short, popularity, observation_count,
		        CAST(observation_start AS VARCHAR) AS observation_start,
		        CAST(observation_end AS VARCHAR) AS observation_end
		 FROM series ${whereSQL}
		 ORDER BY ${sortClause} LIMIT ? OFFSET ?`,
		...params,
		limit,
		offset
	);

	return json({ series: rows, count: rows.length });
};
