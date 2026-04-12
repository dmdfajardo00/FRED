import { json } from '@sveltejs/kit';
import { getDb } from '$lib/db';

export async function GET() {
	try {
		await getDb();
		return json({ status: 'ok', service: 'fred-api', version: '0.0.1' });
	} catch (e) {
		return json({ status: 'error', message: String(e) }, { status: 500 });
	}
}
