import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 1) return json({ series: [], count: 0 });

	const limit = Math.min(parseInt(url.searchParams.get('limit') || '24'), 100);
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const category = url.searchParams.get('category');
	const tag = url.searchParams.get('tag');
	const frequency = url.searchParams.get('frequency');

	// Exact ID match — short-circuit for direct lookups like "UNRATE"
	if (/^[A-Z0-9_]+$/i.test(q) && q.length <= 30) {
		const exact = await query(
			`SELECT id, title, frequency_short, units_short, popularity, observation_count,
			        CAST(observation_start AS VARCHAR) AS observation_start,
			        CAST(observation_end AS VARCHAR) AS observation_end
			 FROM series WHERE id = ?`,
			q.toUpperCase()
		);
		if (exact.length > 0) {
			// Also get FTS results to append below the exact match
			const ftsRows = await getFtsResults(q, limit - 1, offset, category, tag, frequency);
			const combined = [...exact, ...ftsRows.filter((r: any) => r.id !== q.toUpperCase())];
			return json({ series: combined.slice(0, limit), count: combined.length, query: q });
		}
	}

	const rows = await getFtsResults(q, limit, offset, category, tag, frequency);
	return json({ series: rows, count: rows.length, query: q });
};

async function getFtsResults(
	q: string,
	limit: number,
	offset: number,
	category: string | null,
	tag: string | null,
	frequency: string | null
) {
	// Try FTS first, fall back to ILIKE if index doesn't exist
	try {
		return await ftsQuery(q, limit, offset, category, tag, frequency);
	} catch {
		return await ilikeQuery(q, limit, offset, category, tag, frequency);
	}
}

async function ftsQuery(q: string, limit: number, offset: number, category: string | null, tag: string | null, frequency: string | null) {
	let sql = `
		SELECT s.id, s.title, s.frequency_short, s.units_short, s.popularity, s.observation_count,
		       CAST(s.observation_start AS VARCHAR) AS observation_start,
		       CAST(s.observation_end AS VARCHAR) AS observation_end,
		       fts_main_series.match_bm25(s.id, ?) AS score
		FROM series s
		WHERE score IS NOT NULL
	`;
	const params: unknown[] = [q];
	if (category) { sql += ` AND list_contains(s.category_ids, ?::INTEGER)`; params.push(parseInt(category)); }
	if (tag) { sql += ` AND list_contains(s.tags, ?)`; params.push(tag); }
	if (frequency) { sql += ` AND s.frequency_short = ?`; params.push(frequency); }
	sql += ` ORDER BY score DESC LIMIT ? OFFSET ?`;
	params.push(limit, offset);
	return query(sql, ...params);
}

async function ilikeQuery(q: string, limit: number, offset: number, category: string | null, tag: string | null, frequency: string | null) {
	const pattern = `%${q}%`;
	let sql = `
		SELECT id, title, frequency_short, units_short, popularity, observation_count,
		       CAST(observation_start AS VARCHAR) AS observation_start,
		       CAST(observation_end AS VARCHAR) AS observation_end
		FROM series
		WHERE (title ILIKE ? OR id ILIKE ? OR notes ILIKE ?)
	`;
	const params: unknown[] = [pattern, pattern, pattern];
	if (category) { sql += ` AND list_contains(category_ids, ?::INTEGER)`; params.push(parseInt(category)); }
	if (tag) { sql += ` AND list_contains(tags, ?)`; params.push(tag); }
	if (frequency) { sql += ` AND frequency_short = ?`; params.push(frequency); }
	sql += ` ORDER BY popularity DESC LIMIT ? OFFSET ?`;
	params.push(limit, offset);
	return query(sql, ...params);
}
