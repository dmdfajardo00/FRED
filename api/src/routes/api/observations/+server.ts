import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const idsParam = url.searchParams.get('ids');
	if (!idsParam) return json({ error: 'ids parameter required' }, { status: 400 });

	const ids = idsParam.split(',').slice(0, 50);
	const start = url.searchParams.get('start') || '1900-01-01';
	const end = url.searchParams.get('end') || '2099-12-31';

	const placeholders = ids.map(() => '?').join(',');
	const rows = await query<{ series_id: string; date: string; value: number | null }>(
		`SELECT series_id, CAST(date AS VARCHAR) AS date, value
		 FROM observations
		 WHERE series_id IN (${placeholders})
		   AND date >= CAST(? AS DATE)
		   AND date <= CAST(? AS DATE)
		 ORDER BY series_id, date`,
		...ids,
		start,
		end
	);

	const series: Record<string, { dates: string[]; values: (number | null)[] }> = {};
	for (const row of rows) {
		if (!series[row.series_id]) series[row.series_id] = { dates: [], values: [] };
		series[row.series_id].dates.push(row.date);
		series[row.series_id].values.push(row.value);
	}

	return json({ series, count: rows.length });
};
