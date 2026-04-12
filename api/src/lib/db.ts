import { Database } from 'duckdb-async';

const DB_PATH = process.env.DUCKDB_PATH || '../data/fred/fred.duckdb';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
	if (!db) {
		db = await Database.create(DB_PATH, { access_mode: 'READ_ONLY' });
		console.log(`[db] Connected to DuckDB at ${DB_PATH}`);
	}
	return db;
}

function convertBigInts(obj: Record<string, unknown>): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		result[k] = typeof v === 'bigint' ? Number(v) : v;
	}
	return result;
}

export async function query<T = Record<string, unknown>>(
	sql: string,
	...params: unknown[]
): Promise<T[]> {
	const database = await getDb();
	const rows = await database.all(sql, ...params);
	return rows.map((row) => convertBigInts(row as Record<string, unknown>) as T);
}
