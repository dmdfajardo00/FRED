export interface Observation {
	date: string;
	value: number | null;
}

export interface Series {
	id: string;
	title: string;
	frequency: string;
	frequency_short: string;
	units: string;
	units_short: string;
	seasonal_adjustment: string;
	seasonal_adjustment_short: string;
	observation_start: string;
	observation_end: string;
	last_updated: string;
	popularity: number;
	notes: string;
	release_ids: number[];
	category_ids: number[];
	tags: string[];
	observation_count: number;
	observations: Observation[];
}

export interface ChartConfig {
	id: string;
	title: string;
	subtitle: string;
	units: string;
	chartType: 'line' | 'area' | 'bar' | 'step';
	color: string;
	series: Series;
}

export interface NavItem {
	route: string;
	label: string;
	icon: string;
}
