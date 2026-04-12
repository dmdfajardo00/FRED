import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const parentId = url.searchParams.get('parent');

	if (parentId != null) {
		const rows = await query(
			`SELECT id, name, parent_id, notes
			 FROM categories WHERE parent_id = ? ORDER BY name`,
			parseInt(parentId)
		);
		return json({ categories: rows, count: rows.length });
	}

	const rows = await query(
		`SELECT id, name, parent_id FROM categories ORDER BY id`
	);
	return json({ categories: rows, count: rows.length });
};
