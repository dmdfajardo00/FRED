import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
	const group = url.searchParams.get('group');
	const sort = url.searchParams.get('sort') === 'series_count' ? 'series_count DESC' : 'popularity DESC';

	let sql = `SELECT name, group_id, notes, popularity, series_count, created FROM tags`;
	const params: unknown[] = [];

	if (group) {
		sql += ` WHERE group_id = ?`;
		params.push(group);
	}

	sql += ` ORDER BY ${sort} LIMIT ?`;
	params.push(limit);

	const rows = await query(sql, ...params);
	return json({ tags: rows, count: rows.length });
};
