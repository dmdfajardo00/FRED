import { json } from '@sveltejs/kit';
import { query } from '$lib/db';
import type { RequestHandler } from './$types';

// ISO3 country codes — broad set matching World Bank dataset coverage
// Used for global metrics (NYGDPPCAPKD{ISO3}, POPTOT{ISO3}A647NWDB)
const ISO3_CODES = [
	'ABW','AFG','AGO','ALB','AND','ARE','ARG','ARM','ASM','ATG','AUS','AUT','AZE',
	'BDI','BEL','BEN','BFA','BGD','BGR','BHR','BHS','BIH','BLR','BLZ','BMU','BOL',
	'BRA','BRB','BRN','BTN','BWA','CAF','CAN','CHE','CHI','CHL','CHN','CIV','CMR',
	'COD','COG','COL','COM','CPV','CRI','CUB','CUW','CYM','CYP','CZE','DEU','DJI',
	'DMA','DNK','DOM','DZA','ECU','EGY','ERI','ESP','EST','ETH','FIN','FJI','FRA',
	'FRO','FSM','GAB','GBR','GEO','GHA','GIB','GIN','GMB','GNB','GNQ','GRC','GRD',
	'GRL','GTM','GUM','GUY','HKG','HND','HRV','HTI','HUN','IDN','IMN','IND','IRL',
	'IRN','IRQ','ISL','ISR','ITA','JAM','JOR','JPN','KAZ','KEN','KGZ','KHM','KIR',
	'KNA','KOR','KWT','LAO','LBN','LBR','LBY','LCA','LIE','LKA','LSO','LTU','LUX',
	'LVA','MAC','MAF','MAR','MCO','MDA','MDG','MDV','MEX','MHL','MKD','MLI','MLT',
	'MMR','MNE','MNG','MNP','MOZ','MRT','MUS','MWI','MYS','NAM','NCL','NER','NGA',
	'NIC','NLD','NOR','NPL','NRU','NZL','OMN','PAK','PAN','PER','PHL','PLW','PNG',
	'POL','PRI','PRK','PRT','PRY','PSE','PYF','QAT','ROU','RUS','RWA','SAU','SDN',
	'SEN','SGP','SLB','SLE','SLV','SMR','SOM','SRB','SSD','STP','SUR','SVK','SVN',
	'SWE','SWZ','SXM','SYC','SYR','TCA','TCD','TGO','THA','TJK','TKM','TLS','TON',
	'TTO','TUN','TUR','TUV','TWN','TZA','UGA','UKR','URY','USA','UZB','VCT','VEN',
	'VGB','VIR','VNM','VUT','WSM','XKX','YEM','ZAF','ZMB','ZWE'
];

// ISO2 -> ISO3 for OECD-keyed series (CPALTT01{ISO2}M657N, LRHUTTTT{ISO2}M156S)
// Covers all OECD members + G20 + Euro Area + OECD aggregate
const ISO2_TO_ISO3: Record<string, string> = {
	US: 'USA', GB: 'GBR', JP: 'JPN', DE: 'DEU', FR: 'FRA', IT: 'ITA', CA: 'CAN',
	AU: 'AUS', KR: 'KOR', MX: 'MEX', ES: 'ESP', NL: 'NLD', BE: 'BEL', CH: 'CHE',
	SE: 'SWE', AT: 'AUT', DK: 'DNK', FI: 'FIN', NO: 'NOR', IE: 'IRL', PT: 'PRT',
	GR: 'GRC', PL: 'POL', CZ: 'CZE', HU: 'HUN', SK: 'SVK', SI: 'SVN', LU: 'LUX',
	EE: 'EST', LV: 'LVA', LT: 'LTU', IS: 'ISL', IL: 'ISR', TR: 'TUR', CL: 'CHL',
	CO: 'COL', CR: 'CRI', NZ: 'NZL', CN: 'CHN', IN: 'IND', BR: 'BRA', ZA: 'ZAF',
	RU: 'RUS', ID: 'IDN', SA: 'SAU', EZ: 'EUZ', OECD: 'OECD'
};

const OECD_ISO2 = Object.keys(ISO2_TO_ISO3);

type MetricConfig = {
	label: string;
	unit: '$' | '%' | 'people';
	coverage: 'global' | 'oecd';
	frequency: 'annual' | 'monthly';
	buildId: (code: string) => string;
	codes: string[]; // ISO3 (global) or ISO2 (oecd)
};

const METRICS: Record<string, MetricConfig> = {
	gdp_per_capita: {
		label: 'GDP per Capita (constant 2015 USD)',
		unit: '$',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso3) => `NYGDPPCAPKD${iso3}`,
		codes: ISO3_CODES
	},
	population: {
		label: 'Population, total',
		unit: 'people',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso3) => `POPTOT${iso3}A647NWDB`,
		codes: ISO3_CODES
	},
	cpi_yoy: {
		label: 'CPI (% change from year ago)',
		unit: '%',
		coverage: 'oecd',
		frequency: 'monthly',
		buildId: (iso2) => `CPALTT01${iso2}M657N`,
		codes: OECD_ISO2
	},
	unemployment: {
		label: 'Harmonised Unemployment Rate',
		unit: '%',
		coverage: 'oecd',
		frequency: 'monthly',
		buildId: (iso2) => `LRHUTTTT${iso2}M156S`,
		codes: OECD_ISO2
	}
};

const MAX_PLACEHOLDERS = 300;

function median(sorted: number[]): number {
	if (sorted.length === 0) return 0;
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function fetchLatestBySeries(
	ids: string[],
	yearBound: number | null
): Promise<Map<string, { value: number | null; date: string }>> {
	const result = new Map<string, { value: number | null; date: string }>();
	// Chunk to stay under duckdb-async placeholder limits
	for (let i = 0; i < ids.length; i += MAX_PLACEHOLDERS) {
		const chunk = ids.slice(i, i + MAX_PLACEHOLDERS);
		const placeholders = chunk.map(() => '?').join(',');
		const dateFilter = yearBound !== null ? `AND date <= CAST(? AS DATE)` : '';
		const params: unknown[] = [...chunk];
		if (yearBound !== null) params.push(`${yearBound}-12-31`);

		const rows = await query<{ series_id: string; value: number | null; date: string }>(
			`WITH latest AS (
			   SELECT series_id, MAX(date) AS d
			   FROM observations
			   WHERE series_id IN (${placeholders})
			   ${dateFilter}
			   GROUP BY series_id
			 )
			 SELECT o.series_id, CAST(o.date AS VARCHAR) AS date, o.value
			 FROM observations o
			 JOIN latest l ON o.series_id = l.series_id AND o.date = l.d`,
			...params
		);

		for (const r of rows) {
			result.set(r.series_id, { value: r.value, date: r.date });
		}
	}
	return result;
}

export const GET: RequestHandler = async ({ url }) => {
	const metricKey = url.searchParams.get('metric') || 'gdp_per_capita';
	const m = METRICS[metricKey] || METRICS.gdp_per_capita;

	const yearParam = url.searchParams.get('year');
	const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear();

	// Annual metrics use the year as an upper bound; monthly metrics ignore it.
	const yearBound = m.frequency === 'annual' ? year : null;

	// Build candidate series IDs
	const idToCode = new Map<string, string>(); // seriesId -> ISO3 key
	const ids: string[] = [];
	for (const code of m.codes) {
		const sid = m.buildId(code);
		const iso3 = m.coverage === 'oecd' ? ISO2_TO_ISO3[code] : code;
		if (!iso3) continue;
		ids.push(sid);
		idToCode.set(sid, iso3);
	}

	const latest = await fetchLatestBySeries(ids, yearBound);

	const data: Record<string, { value: number | null; seriesId: string; date: string | null }> = {};
	const values: number[] = [];

	for (const sid of ids) {
		const iso3 = idToCode.get(sid)!;
		const row = latest.get(sid);
		const value = row?.value ?? null;
		data[iso3] = {
			value,
			seriesId: sid,
			date: row?.date ?? null
		};
		if (typeof value === 'number') values.push(value);
	}

	values.sort((a, b) => a - b);
	const min = values.length ? values[0] : 0;
	const max = values.length ? values[values.length - 1] : 0;
	const med = median(values);

	return json({
		metric: metricKey,
		label: m.label,
		unit: m.unit,
		coverage: m.coverage,
		year,
		min,
		max,
		median: med,
		countries_with_data: values.length,
		total_countries: ids.length,
		data
	});
};
