import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

const STATES = [
	'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
	'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
	'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

// Suffix -> { seriesId builder, label, unit, higherIsBetter }
const METRICS: Record<string, { suffix: string; label: string; unit: string; higherIsBetter: boolean }> = {
	unemployment: { suffix: 'UR', label: 'Unemployment Rate', unit: '%', higherIsBetter: false },
	employment:   { suffix: 'NA', label: 'Total Nonfarm Employment', unit: 'k', higherIsBetter: true },
	income:       { suffix: 'PCPI', label: 'Per Capita Personal Income', unit: '$', higherIsBetter: true }
};

export const GET: RequestHandler = async ({ url }) => {
	const metricKey = url.searchParams.get('metric') || 'unemployment';
	const m = METRICS[metricKey] || METRICS.unemployment;

	const ids = STATES.map((st) => `${st}${m.suffix}`);
	const placeholders = ids.map(() => '?').join(',');

	const rows = await query<{ series_id: string; value: number | null; date: string }>(
		`WITH latest AS (
		   SELECT series_id, MAX(date) AS d
		   FROM observations
		   WHERE series_id IN (${placeholders})
		   GROUP BY series_id
		 )
		 SELECT o.series_id, CAST(o.date AS VARCHAR) AS date, o.value
		 FROM observations o
		 JOIN latest l ON o.series_id = l.series_id AND o.date = l.d`,
		...ids
	);

	const byId = Object.fromEntries(rows.map((r) => [r.series_id, r]));
	const data: Record<string, { value: number | null; date: string | null; seriesId: string }> = {};
	for (let i = 0; i < STATES.length; i++) {
		const st = STATES[i];
		const sid = ids[i];
		const row = byId[sid];
		data[st] = {
			value: row?.value ?? null,
			date: row?.date ?? null,
			seriesId: sid
		};
	}

	const vals = rows.map((r) => r.value).filter((v): v is number => typeof v === 'number');
	const min = vals.length ? Math.min(...vals) : 0;
	const max = vals.length ? Math.max(...vals) : 0;

	return json({
		metric: metricKey,
		label: m.label,
		unit: m.unit,
		higherIsBetter: m.higherIsBetter,
		min,
		max,
		data
	});
};
