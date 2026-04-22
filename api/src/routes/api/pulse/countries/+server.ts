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

// ISO2 -> ISO3 — comprehensive map used by OECD-keyed and WB-population series.
// WB POPTOT and OECD CPALTT01/LRHUTTTT all key by 2-letter code.
const ISO2_TO_ISO3: Record<string, string> = {
	AF: 'AFG', AL: 'ALB', DZ: 'DZA', AS: 'ASM', AD: 'AND', AO: 'AGO', AG: 'ATG',
	AR: 'ARG', AM: 'ARM', AW: 'ABW', AU: 'AUS', AT: 'AUT', AZ: 'AZE', BS: 'BHS',
	BH: 'BHR', BD: 'BGD', BB: 'BRB', BY: 'BLR', BE: 'BEL', BZ: 'BLZ', BJ: 'BEN',
	BM: 'BMU', BT: 'BTN', BO: 'BOL', BA: 'BIH', BW: 'BWA', BR: 'BRA', BN: 'BRN',
	BG: 'BGR', BF: 'BFA', BI: 'BDI', CV: 'CPV', KH: 'KHM', CM: 'CMR', CA: 'CAN',
	KY: 'CYM', CF: 'CAF', TD: 'TCD', CL: 'CHL', CN: 'CHN', CO: 'COL', KM: 'COM',
	CG: 'COG', CD: 'COD', CR: 'CRI', CI: 'CIV', HR: 'HRV', CU: 'CUB', CW: 'CUW',
	CY: 'CYP', CZ: 'CZE', DK: 'DNK', DJ: 'DJI', DM: 'DMA', DO: 'DOM', EC: 'ECU',
	EG: 'EGY', SV: 'SLV', GQ: 'GNQ', ER: 'ERI', EE: 'EST', SZ: 'SWZ', ET: 'ETH',
	FJ: 'FJI', FI: 'FIN', FR: 'FRA', PF: 'PYF', GA: 'GAB', GM: 'GMB', GE: 'GEO',
	DE: 'DEU', GH: 'GHA', GR: 'GRC', GL: 'GRL', GD: 'GRD', GU: 'GUM', GT: 'GTM',
	GN: 'GIN', GW: 'GNB', GY: 'GUY', HT: 'HTI', HN: 'HND', HK: 'HKG', HU: 'HUN',
	IS: 'ISL', IN: 'IND', ID: 'IDN', IR: 'IRN', IQ: 'IRQ', IE: 'IRL', IM: 'IMN',
	IL: 'ISR', IT: 'ITA', JM: 'JAM', JP: 'JPN', JO: 'JOR', KZ: 'KAZ', KE: 'KEN',
	KI: 'KIR', KP: 'PRK', KR: 'KOR', XK: 'XKX', KW: 'KWT', KG: 'KGZ', LA: 'LAO',
	LV: 'LVA', LB: 'LBN', LS: 'LSO', LR: 'LBR', LY: 'LBY', LI: 'LIE', LT: 'LTU',
	LU: 'LUX', MO: 'MAC', MG: 'MDG', MW: 'MWI', MY: 'MYS', MV: 'MDV', ML: 'MLI',
	MT: 'MLT', MH: 'MHL', MR: 'MRT', MU: 'MUS', MX: 'MEX', FM: 'FSM', MD: 'MDA',
	MC: 'MCO', MN: 'MNG', ME: 'MNE', MA: 'MAR', MZ: 'MOZ', MM: 'MMR', NA: 'NAM',
	NR: 'NRU', NP: 'NPL', NL: 'NLD', NC: 'NCL', NZ: 'NZL', NI: 'NIC', NE: 'NER',
	NG: 'NGA', MK: 'MKD', MP: 'MNP', NO: 'NOR', OM: 'OMN', PK: 'PAK', PW: 'PLW',
	PS: 'PSE', PA: 'PAN', PG: 'PNG', PY: 'PRY', PE: 'PER', PH: 'PHL', PL: 'POL',
	PT: 'PRT', PR: 'PRI', QA: 'QAT', RO: 'ROU', RU: 'RUS', RW: 'RWA', WS: 'WSM',
	SM: 'SMR', ST: 'STP', SA: 'SAU', SN: 'SEN', RS: 'SRB', SC: 'SYC', SL: 'SLE',
	SG: 'SGP', SX: 'SXM', SK: 'SVK', SI: 'SVN', SB: 'SLB', SO: 'SOM', ZA: 'ZAF',
	SS: 'SSD', ES: 'ESP', LK: 'LKA', SD: 'SDN', SR: 'SUR', SE: 'SWE', CH: 'CHE',
	SY: 'SYR', TW: 'TWN', TJ: 'TJK', TZ: 'TZA', TH: 'THA', TL: 'TLS', TG: 'TGO',
	TO: 'TON', TT: 'TTO', TN: 'TUN', TR: 'TUR', TM: 'TKM', UG: 'UGA', UA: 'UKR',
	AE: 'ARE', GB: 'GBR', US: 'USA', UY: 'URY', UZ: 'UZB', VU: 'VUT', VE: 'VEN',
	VN: 'VNM', VG: 'VGB', VI: 'VIR', YE: 'YEM', ZM: 'ZMB', ZW: 'ZWE',
	// Aggregates FRED uses
	EZ: 'EUZ', OECD: 'OECD'
};

const ALL_ISO2 = Object.keys(ISO2_TO_ISO3);
// OECD-only subset for the monthly OECD metrics (CPI y/y, unemployment)
const OECD_ISO2 = [
	'US','GB','JP','DE','FR','IT','CA','AU','KR','MX','ES','NL','BE','CH','SE','AT',
	'DK','FI','NO','IE','PT','GR','PL','CZ','HU','SK','SI','LU','EE','LV','LT','IS',
	'IL','TR','CL','CO','CR','NZ','EZ','OECD'
];

type MetricConfig = {
	label: string;
	unit: '$' | '%' | 'people' | 'years';
	coverage: 'global' | 'oecd';
	frequency: 'annual' | 'monthly';
	buildId: (code: string) => string;
	codes: string[];
	codeType: 'iso2' | 'iso3';
};

const METRICS: Record<string, MetricConfig> = {
	gdp_per_capita: {
		label: 'GDP per Capita (constant 2015 USD)',
		unit: '$',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso3) => `NYGDPPCAPKD${iso3}`,
		codes: ISO3_CODES,
		codeType: 'iso3'
	},
	population: {
		label: 'Population, total',
		unit: 'people',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso2) => `POPTOT${iso2}A647NWDB`,
		codes: ALL_ISO2,
		codeType: 'iso2'
	},
	inflation: {
		label: 'Inflation, consumer prices (% YoY)',
		unit: '%',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso3) => `FPCPITOTLZG${iso3}`,
		codes: ISO3_CODES,
		codeType: 'iso3'
	},
	life_expectancy: {
		label: 'Life Expectancy at Birth (years)',
		unit: 'years',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso3) => `SPDYNLE00IN${iso3}`,
		codes: ISO3_CODES,
		codeType: 'iso3'
	},
	internet_users: {
		label: 'Internet Users (% of population)',
		unit: '%',
		coverage: 'global',
		frequency: 'annual',
		buildId: (iso3) => `ITNETUSERP2${iso3}`,
		codes: ISO3_CODES,
		codeType: 'iso3'
	},
	unemployment: {
		label: 'Harmonised Unemployment Rate',
		unit: '%',
		coverage: 'oecd',
		frequency: 'monthly',
		buildId: (iso2) => `LRHUTTTT${iso2}M156S`,
		codes: OECD_ISO2,
		codeType: 'iso2'
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
		const iso3 = m.codeType === 'iso2' ? ISO2_TO_ISO3[code] : code;
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
