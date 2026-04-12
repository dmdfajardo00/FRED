import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET() {
	const rows = await query(
		`SELECT id, name, press_release, link, notes FROM releases ORDER BY id`
	);
	return json({ releases: rows, count: rows.length });
}
