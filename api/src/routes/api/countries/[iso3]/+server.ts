import { json, error } from '@sveltejs/kit';
import { query } from '$lib/db';
import { getCountriesCached } from '../+server';
import type { RequestHandler } from './$types';

// ISO3 -> ISO2 for the World Bank population series (POPTOT{ISO2}A647NWDB)
const ISO3_TO_ISO2: Record<string, string> = {
	AFG: 'AF', ALB: 'AL', DZA: 'DZ', ASM: 'AS', AND: 'AD', AGO: 'AO', ATG: 'AG',
	ARG: 'AR', ARM: 'AM', ABW: 'AW', AUS: 'AU', AUT: 'AT', AZE: 'AZ', BHS: 'BS',
	BHR: 'BH', BGD: 'BD', BRB: 'BB', BLR: 'BY', BEL: 'BE', BLZ: 'BZ', BEN: 'BJ',
	BMU: 'BM', BTN: 'BT', BOL: 'BO', BIH: 'BA', BWA: 'BW', BRA: 'BR', BRN: 'BN',
	BGR: 'BG', BFA: 'BF', BDI: 'BI', CPV: 'CV', KHM: 'KH', CMR: 'CM', CAN: 'CA',
	CYM: 'KY', CAF: 'CF', TCD: 'TD', CHL: 'CL', CHN: 'CN', COL: 'CO', COM: 'KM',
	COG: 'CG', COD: 'CD', CRI: 'CR', CIV: 'CI', HRV: 'HR', CUB: 'CU', CUW: 'CW',
	CYP: 'CY', CZE: 'CZ', DNK: 'DK', DJI: 'DJ', DMA: 'DM', DOM: 'DO', ECU: 'EC',
	EGY: 'EG', SLV: 'SV', GNQ: 'GQ', ERI: 'ER', EST: 'EE', SWZ: 'SZ', ETH: 'ET',
	FJI: 'FJ', FIN: 'FI', FRA: 'FR', PYF: 'PF', GAB: 'GA', GMB: 'GM', GEO: 'GE',
	DEU: 'DE', GHA: 'GH', GRC: 'GR', GRL: 'GL', GRD: 'GD', GUM: 'GU', GTM: 'GT',
	GIN: 'GN', GNB: 'GW', GUY: 'GY', HTI: 'HT', HND: 'HN', HKG: 'HK', HUN: 'HU',
	ISL: 'IS', IND: 'IN', IDN: 'ID', IRN: 'IR', IRQ: 'IQ', IRL: 'IE', IMN: 'IM',
	ISR: 'IL', ITA: 'IT', JAM: 'JM', JPN: 'JP', JOR: 'JO', KAZ: 'KZ', KEN: 'KE',
	KIR: 'KI', PRK: 'KP', KOR: 'KR', XKX: 'XK', KWT: 'KW', KGZ: 'KG', LAO: 'LA',
	LVA: 'LV', LBN: 'LB', LSO: 'LS', LBR: 'LR', LBY: 'LY', LIE: 'LI', LTU: 'LT',
	LUX: 'LU', MAC: 'MO', MDG: 'MG', MWI: 'MW', MYS: 'MY', MDV: 'MV', MLI: 'ML',
	MLT: 'MT', MHL: 'MH', MRT: 'MR', MUS: 'MU', MEX: 'MX', FSM: 'FM', MDA: 'MD',
	MCO: 'MC', MNG: 'MN', MNE: 'ME', MAR: 'MA', MOZ: 'MZ', MMR: 'MM', NAM: 'NA',
	NRU: 'NR', NPL: 'NP', NLD: 'NL', NCL: 'NC', NZL: 'NZ', NIC: 'NI', NER: 'NE',
	NGA: 'NG', MKD: 'MK', MNP: 'MP', NOR: 'NO', OMN: 'OM', PAK: 'PK', PLW: 'PW',
	PSE: 'PS', PAN: 'PA', PNG: 'PG', PRY: 'PY', PER: 'PE', PHL: 'PH', POL: 'PL',
	PRT: 'PT', PRI: 'PR', QAT: 'QA', ROU: 'RO', RUS: 'RU', RWA: 'RW', WSM: 'WS',
	SMR: 'SM', STP: 'ST', SAU: 'SA', SEN: 'SN', SRB: 'RS', SYC: 'SC', SLE: 'SL',
	SGP: 'SG', SXM: 'SX', SVK: 'SK', SVN: 'SI', SLB: 'SB', SOM: 'SO', ZAF: 'ZA',
	SSD: 'SS', ESP: 'ES', LKA: 'LK', SDN: 'SD', SUR: 'SR', SWE: 'SE', CHE: 'CH',
	SYR: 'SY', TWN: 'TW', TJK: 'TJ', TZA: 'TZ', THA: 'TH', TLS: 'TL', TGO: 'TG',
	TON: 'TO', TTO: 'TT', TUN: 'TN', TUR: 'TR', TKM: 'TM', UGA: 'UG', UKR: 'UA',
	ARE: 'AE', GBR: 'GB', USA: 'US', URY: 'UY', UZB: 'UZ', VUT: 'VU', VEN: 'VE',
	VNM: 'VN', VGB: 'VG', VIR: 'VI', YEM: 'YE', ZMB: 'ZM', ZWE: 'ZW'
};

interface HeadlineRow {
	series_id: string;
	date: string;
	value: number | null;
}

interface SeriesRow {
	id: string;
	title: string;
	frequency_short: string;
	units_short: string;
	popularity: number;
	observation_count: number;
	observation_start: string;
	observation_end: string;
}

type HeadlineKey = 'gdp_per_capita' | 'population' | 'inflation' | 'life_expectancy';

export const GET: RequestHandler = async ({ params, url }) => {
	const iso3 = params.iso3.toUpperCase();
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '30'), 200);

	const countries = await getCountriesCached();
	const country = countries.find((c) => c.iso3 === iso3);
	if (!country) throw error(404, `Unknown country iso3: ${iso3}`);

	const series = await query<SeriesRow>(
		`SELECT id, title, frequency_short, units_short, popularity, observation_count,
		        CAST(observation_start AS VARCHAR) AS observation_start,
		        CAST(observation_end AS VARCHAR) AS observation_end
		 FROM series
		 WHERE list_contains(category_ids, ?::INTEGER)
		 ORDER BY popularity DESC NULLS LAST
		 LIMIT ?`,
		country.categoryId,
		limit
	);

	// Build headline IDs
	const iso2 = ISO3_TO_ISO2[iso3];
	const headlineIds: Record<HeadlineKey, string> = {
		gdp_per_capita: `NYGDPPCAPKD${iso3}`,
		population: iso2 ? `POPTOT${iso2}A647NWDB` : '',
		inflation: `FPCPITOTLZG${iso3}`,
		life_expectancy: `SPDYNLE00IN${iso3}`
	};

	const idsToFetch = Object.values(headlineIds).filter((id): id is string => id.length > 0);
	let latestMap = new Map<string, { value: number | null; date: string }>();
	if (idsToFetch.length > 0) {
		const placeholders = idsToFetch.map(() => '?').join(',');
		const rows = await query<HeadlineRow>(
			`WITH latest AS (
			   SELECT series_id, MAX(date) AS d
			   FROM observations
			   WHERE series_id IN (${placeholders})
			   GROUP BY series_id
			 )
			 SELECT o.series_id, CAST(o.date AS VARCHAR) AS date, o.value
			 FROM observations o
			 JOIN latest l ON o.series_id = l.series_id AND o.date = l.d`,
			...idsToFetch
		);
		latestMap = new Map(rows.map((r) => [r.series_id, { value: r.value, date: r.date }]));
	}

	function pick(sid: string): { value: number | null; seriesId: string; date: string | null } | null {
		if (!sid) return null;
		const row = latestMap.get(sid);
		if (!row) return null;
		return { value: row.value, seriesId: sid, date: row.date };
	}

	const headline = {
		gdp_per_capita: pick(headlineIds.gdp_per_capita),
		population: pick(headlineIds.population),
		inflation: pick(headlineIds.inflation),
		life_expectancy: pick(headlineIds.life_expectancy)
	};

	return json({
		iso3: country.iso3,
		name: country.name,
		categoryId: country.categoryId,
		seriesCount: country.seriesCount,
		series,
		headline
	});
};
