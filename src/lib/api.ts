const API_URL = import.meta.env.VITE_API_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || '';

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

export interface SeriesMeta extends SeriesSummary {
	frequency: string;
	units: string;
	seasonal_adjustment: string;
	seasonal_adjustment_short: string;
	last_updated: string;
	group_popularity: number;
	notes: string | null;
	release_ids: number[];
	category_ids: number[];
	tags: string[];
	observations_source: string;
}

export interface ObservationData {
	dates: string[];
	values: (number | null)[];
}

export interface ReleaseSummary {
	id: number;
	name: string;
	press_release: boolean;
	link: string | null;
	notes: string | null;
}

export interface CategorySummary {
	id: number;
	name: string;
	parent_id: number;
	notes?: string | null;
}

async function get<T>(path: string): Promise<T> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (API_KEY) headers['X-API-Key'] = API_KEY;

	const res = await fetch(`${API_URL}${path}`, { headers });
	if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
	return res.json();
}

export interface ListSeriesParams {
	limit?: number;
	offset?: number;
	sort?: 'popularity' | 'alpha' | 'obs' | 'recent';
	category?: string;
	tag?: string;
	frequency?: string;
	popMin?: number;
	release?: string | number;
}

export interface SearchFilters extends ListSeriesParams {
	q: string;
}

export async function searchSeries(filters: SearchFilters): Promise<SeriesSummary[]> {
	const { q, limit = 24, offset = 0, category, tag, frequency } = filters;
	if (q.length < 1) return [];
	const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) });
	if (category) params.set('category', category);
	if (tag) params.set('tag', tag);
	if (frequency) params.set('frequency', frequency);
	const data = await get<{ series: SeriesSummary[] }>(`/api/series/search?${params}`);
	return data.series;
}

export async function listSeries(p: ListSeriesParams = {}): Promise<SeriesSummary[]> {
	const params = new URLSearchParams();
	params.set('limit', String(p.limit ?? 24));
	params.set('offset', String(p.offset ?? 0));
	params.set('sort', p.sort ?? 'popularity');
	if (p.category) params.set('category', p.category);
	if (p.tag) params.set('tag', p.tag);
	if (p.frequency) params.set('frequency', p.frequency);
	if (p.popMin) params.set('popMin', String(p.popMin));
	if (p.release) params.set('release', String(p.release));
	const data = await get<{ series: SeriesSummary[] }>(`/api/series?${params}`);
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

export async function getSeriesMetadata(ids: string[]): Promise<SeriesMeta[]> {
	const data = await get<{ series: SeriesMeta[] }>(`/api/series?ids=${ids.join(',')}`);
	return data.series;
}

export async function listReleases(): Promise<ReleaseSummary[]> {
	const data = await get<{ releases: ReleaseSummary[] }>(`/api/releases`);
	return data.releases;
}

export async function getRelease(id: number | string, limit = 30): Promise<{ release: ReleaseSummary; series: SeriesSummary[] }> {
	return get(`/api/releases/${id}?limit=${limit}`);
}

export async function listCategories(parent?: number | string): Promise<CategorySummary[]> {
	const q = parent != null ? `?parent=${parent}` : '';
	const data = await get<{ categories: CategorySummary[] }>(`/api/categories${q}`);
	return data.categories;
}

export interface PulseState {
	value: number | null;
	date: string | null;
	seriesId: string;
}

export interface PulseResponse {
	metric: string;
	label: string;
	unit: string;
	higherIsBetter: boolean;
	min: number;
	max: number;
	data: Record<string, PulseState>;
}

export async function fetchPulseStates(metric = 'unemployment'): Promise<PulseResponse> {
	return get(`/api/pulse/states?metric=${metric}`);
}

export interface CountryPulseDatum {
	value: number | null;
	seriesId: string;
	date: string | null;
}

export interface CountryPulseResponse {
	metric: string;
	label: string;
	unit: '$' | '%' | 'people';
	coverage: 'global' | 'oecd';
	year: number;
	min: number;
	max: number;
	median: number;
	countries_with_data: number;
	total_countries: number;
	data: Record<string, CountryPulseDatum>;
}

export async function fetchPulseCountries(metric: string, year?: number): Promise<CountryPulseResponse> {
	const params = new URLSearchParams({ metric });
	if (year != null) params.set('year', String(year));
	return get(`/api/pulse/countries?${params}`);
}
