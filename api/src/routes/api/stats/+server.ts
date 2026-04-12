import { json } from '@sveltejs/kit';
import { query } from '$lib/db';

export async function GET() {
	const [stats] = await query(`
		SELECT
			(SELECT COUNT(*) FROM series) AS series,
			(SELECT COUNT(*) FROM observations) AS observations,
			(SELECT COUNT(*) FROM categories) AS categories,
			(SELECT COUNT(*) FROM releases) AS releases,
			(SELECT COUNT(*) FROM sources) AS sources,
			(SELECT COUNT(*) FROM tags) AS tags
	`);

	return json(stats);
}
