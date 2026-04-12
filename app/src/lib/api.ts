const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_URL) {
	console.warn('[api] VITE_API_URL not set — API calls will fail');
}

export interface SeriesSummary {
	id: string;
	title: string;
	frequency_short: string;
	units_short: string;
	popularity: number;
	observation_count: number;
	observation_start: string;
	observation_end: string;
}

export interface ObservationData {
	dates: string[];
	values: (number | null)[];
}

async function get<T>(path: string): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (API_KEY) headers['X-API-Key'] = API_KEY;

	const res = await fetch(`${API_URL}${path}`, { headers });
	if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
	return res.json();
}

export async function searchSeries(q: string, limit = 20): Promise<SeriesSummary[]> {
	if (q.length < 2) return [];
	const data = await get<{ series: SeriesSummary[] }>(`/api/series/search?q=${encodeURIComponent(q)}&limit=${limit}`);
	return data.series;
}

export async function listSeries(offset = 0, limit = 24, sort = 'popularity'): Promise<SeriesSummary[]> {
	const data = await get<{ series: SeriesSummary[] }>(`/api/series?limit=${limit}&offset=${offset}&sort=${sort}`);
	return data.series;
}

export async function fetchObservations(ids: string[], start?: string, end?: string): Promise<Record<string, ObservationData>> {
	const params = new URLSearchParams({ ids: ids.join(',') });
	if (start) params.set('start', start);
	if (end) params.set('end', end);
	const data = await get<{ series: Record<string, ObservationData> }>(`/api/observations?${params}`);
	return data.series;
}

export async function fetchStats(): Promise<Record<string, number>> {
	return get('/api/stats');
}

export async function getSeriesMetadata(ids: string[]) {
	const data = await get<{ series: any[] }>(`/api/series?ids=${ids.join(',')}`);
	return data.series;
}
