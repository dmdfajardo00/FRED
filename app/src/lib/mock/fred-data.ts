import type { Series, ChartConfig } from '$lib/types/fred';

function generateTimeSeries(
	startYear: number,
	endYear: number,
	frequency: 'Monthly' | 'Quarterly' | 'Daily',
	generator: (i: number, total: number) => number
): { date: string; value: number }[] {
	const points: { date: string; value: number }[] = [];
	let total = 0;

	if (frequency === 'Monthly') {
		total = (endYear - startYear) * 12;
		for (let i = 0; i < total; i++) {
			const year = startYear + Math.floor(i / 12);
			const month = (i % 12) + 1;
			points.push({
				date: `${year}-${String(month).padStart(2, '0')}-01`,
				value: Math.round(generator(i, total) * 100) / 100
			});
		}
	} else if (frequency === 'Quarterly') {
		total = (endYear - startYear) * 4;
		for (let i = 0; i < total; i++) {
			const year = startYear + Math.floor(i / 4);
			const month = (i % 4) * 3 + 1;
			points.push({
				date: `${year}-${String(month).padStart(2, '0')}-01`,
				value: Math.round(generator(i, total) * 100) / 100
			});
		}
	} else {
		total = (endYear - startYear) * 252;
		for (let i = 0; i < total; i++) {
			const dayOffset = Math.floor(i * (365 / 252));
			const d = new Date(startYear, 0, 1);
			d.setDate(d.getDate() + dayOffset);
			if (d.getFullYear() > endYear) break;
			points.push({
				date: d.toISOString().slice(0, 10),
				value: Math.round(generator(i, total) * 100) / 100
			});
		}
	}

	return points;
}

const UNRATE: Series = {
	id: 'UNRATE',
	title: 'Unemployment Rate',
	frequency: 'Monthly',
	frequency_short: 'M',
	units: 'Percent',
	units_short: '%',
	seasonal_adjustment: 'Seasonally Adjusted',
	seasonal_adjustment_short: 'SA',
	observation_start: '1948-01-01',
	observation_end: '2026-03-01',
	last_updated: '2026-04-04 07:46:02-05',
	popularity: 94,
	notes: 'The unemployment rate represents the number of unemployed as a percentage of the labor force.',
	release_ids: [50],
	category_ids: [12, 32447],
	tags: ['bls', 'monthly', 'nation', 'sa', 'unemployment', 'usa'],
	observation_count: 939,
	observations: generateTimeSeries(2000, 2026, 'Monthly', (i, total) => {
		const base = 5.0;
		const recession2008 = i > 96 && i < 144 ? Math.sin((i - 96) / 15) * 5 : 0;
		const covid = i > 240 && i < 260 ? Math.exp(-((i - 244) ** 2) / 20) * 10 : 0;
		const trend = -0.005 * i + 0.01 * Math.sin(i / 24);
		return Math.max(3.2, base + recession2008 + covid + trend + Math.random() * 0.3);
	})
};

const CPIAUCSL: Series = {
	id: 'CPIAUCSL',
	title: 'Consumer Price Index for All Urban Consumers',
	frequency: 'Monthly',
	frequency_short: 'M',
	units: 'Index 1982-1984=100',
	units_short: 'Index',
	seasonal_adjustment: 'Seasonally Adjusted',
	seasonal_adjustment_short: 'SA',
	observation_start: '1947-01-01',
	observation_end: '2026-03-01',
	last_updated: '2026-04-10 08:30:00-05',
	popularity: 100,
	notes: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average.',
	release_ids: [10],
	category_ids: [9],
	tags: ['bls', 'cpi', 'inflation', 'monthly', 'nation', 'sa', 'usa'],
	observation_count: 949,
	observations: generateTimeSeries(2000, 2026, 'Monthly', (i) => {
		return 170 + i * 0.55 + Math.sin(i / 6) * 2 + Math.random() * 1.5;
	})
};

const DGS10: Series = {
	id: 'DGS10',
	title: '10-Year Treasury Constant Maturity Rate',
	frequency: 'Daily',
	frequency_short: 'D',
	units: 'Percent',
	units_short: '%',
	seasonal_adjustment: 'Not Seasonally Adjusted',
	seasonal_adjustment_short: 'NSA',
	observation_start: '1962-01-02',
	observation_end: '2026-04-11',
	last_updated: '2026-04-11 15:18:01-05',
	popularity: 99,
	notes: 'Market yield on U.S. Treasury securities at 10-year constant maturity.',
	release_ids: [18],
	category_ids: [115],
	tags: ['10-year', 'daily', 'h15', 'interest rate', 'nation', 'nsa', 'treasury', 'usa'],
	observation_count: 16000,
	observations: generateTimeSeries(2015, 2026, 'Daily', (i, total) => {
		const base = 2.5;
		const trend = Math.sin(i / 500) * 1.5;
		const covidDip = i > 1200 && i < 1400 ? -1.5 * Math.exp(-((i - 1300) ** 2) / 5000) : 0;
		const hike = i > 1700 ? 1.5 * (1 - Math.exp(-(i - 1700) / 300)) : 0;
		return Math.max(0.5, base + trend + covidDip + hike + (Math.random() - 0.5) * 0.15);
	})
};

const GDPC1: Series = {
	id: 'GDPC1',
	title: 'Real Gross Domestic Product',
	frequency: 'Quarterly',
	frequency_short: 'Q',
	units: 'Billions of Chained 2017 Dollars',
	units_short: 'Bil. Ch. 2017$',
	seasonal_adjustment: 'Seasonally Adjusted Annual Rate',
	seasonal_adjustment_short: 'SAAR',
	observation_start: '1947-01-01',
	observation_end: '2025-10-01',
	last_updated: '2026-03-27 08:30:00-05',
	popularity: 97,
	notes: 'Real gross domestic product is the inflation adjusted value of goods and services produced.',
	release_ids: [53],
	category_ids: [106],
	tags: ['gdp', 'nation', 'quarterly', 'saar', 'usa'],
	observation_count: 315,
	observations: generateTimeSeries(2000, 2026, 'Quarterly', (i) => {
		const base = 13000;
		const growth = i * 120;
		const recession = i > 28 && i < 36 ? -1200 * Math.sin((i - 28) / 3) : 0;
		const covid = i > 80 && i < 84 ? -3000 * Math.exp(-((i - 81) ** 2) / 1) : 0;
		return base + growth + recession + covid + Math.random() * 100;
	})
};

const FEDFUNDS: Series = {
	id: 'FEDFUNDS',
	title: 'Federal Funds Effective Rate',
	frequency: 'Monthly',
	frequency_short: 'M',
	units: 'Percent',
	units_short: '%',
	seasonal_adjustment: 'Not Seasonally Adjusted',
	seasonal_adjustment_short: 'NSA',
	observation_start: '1954-07-01',
	observation_end: '2026-03-01',
	last_updated: '2026-04-01 16:16:00-05',
	popularity: 96,
	notes: 'The federal funds rate is the interest rate at which depository institutions lend balances to each other overnight.',
	release_ids: [18],
	category_ids: [120],
	tags: ['federal funds', 'fed', 'interest rate', 'monthly', 'nation', 'nsa', 'usa'],
	observation_count: 860,
	observations: generateTimeSeries(2000, 2026, 'Monthly', (i) => {
		if (i < 12) return 6.5 - i * 0.35;
		if (i < 48) return 1.0 + (i - 12) * 0.12;
		if (i < 60) return 5.25;
		if (i < 72) return 5.25 - (i - 60) * 0.35;
		if (i < 120) return Math.max(0.05, 0.25 - (i - 72) * 0.005);
		if (i < 168) return 0.08;
		if (i < 204) return 0.08 + (i - 168) * 0.07;
		if (i < 240) return 2.4 - (i - 204) * 0.06;
		if (i < 264) return Math.max(0.05, 0.1);
		if (i < 288) return 0.1 + (i - 264) * 0.22;
		return Math.max(4.5, 5.33 - (i - 288) * 0.08);
	})
};

const SP500: Series = {
	id: 'SP500',
	title: 'S&P 500',
	frequency: 'Daily',
	frequency_short: 'D',
	units: 'Index',
	units_short: 'Index',
	seasonal_adjustment: 'Not Seasonally Adjusted',
	seasonal_adjustment_short: 'NSA',
	observation_start: '2015-01-02',
	observation_end: '2026-04-11',
	last_updated: '2026-04-11 18:01:00-05',
	popularity: 98,
	notes: 'The S&P 500 is regarded as the best single gauge of large-cap U.S. equities.',
	release_ids: [0],
	category_ids: [32255],
	tags: ['daily', 'equities', 'nation', 'nsa', 'sp500', 'usa'],
	observation_count: 2800,
	observations: generateTimeSeries(2015, 2026, 'Daily', (i) => {
		const base = 2000;
		const growth = i * 1.5;
		const covidCrash = i > 1200 && i < 1350 ? -800 * Math.exp(-((i - 1270) ** 2) / 800) : 0;
		const volatility = Math.sin(i / 50) * 100 + Math.sin(i / 200) * 200;
		return Math.max(1800, base + growth + covidCrash + volatility + (Math.random() - 0.5) * 30);
	})
};

const M2SL: Series = {
	id: 'M2SL',
	title: 'M2 Money Supply',
	frequency: 'Monthly',
	frequency_short: 'M',
	units: 'Billions of Dollars',
	units_short: 'Bil. $',
	seasonal_adjustment: 'Seasonally Adjusted',
	seasonal_adjustment_short: 'SA',
	observation_start: '1959-01-01',
	observation_end: '2026-02-01',
	last_updated: '2026-03-25 16:00:00-05',
	popularity: 91,
	notes: 'M2 includes M1 plus savings deposits, small-denomination time deposits, and retail money market fund shares.',
	release_ids: [21],
	category_ids: [29],
	tags: ['m2', 'monetary aggregates', 'money supply', 'monthly', 'nation', 'sa', 'usa'],
	observation_count: 805,
	observations: generateTimeSeries(2000, 2026, 'Monthly', (i) => {
		const base = 4800;
		const growth = i * 30 + i ** 1.3 * 2;
		const covidSpike = i > 240 ? 3500 * (1 - Math.exp(-(i - 240) / 20)) : 0;
		const taper = i > 270 ? -(i - 270) * 15 : 0;
		return base + growth + covidSpike + taper + Math.random() * 50;
	})
};

const MORTGAGE30US: Series = {
	id: 'MORTGAGE30US',
	title: '30-Year Fixed Rate Mortgage Average',
	frequency: 'Monthly',
	frequency_short: 'M',
	units: 'Percent',
	units_short: '%',
	seasonal_adjustment: 'Not Seasonally Adjusted',
	seasonal_adjustment_short: 'NSA',
	observation_start: '1971-04-01',
	observation_end: '2026-04-10',
	last_updated: '2026-04-10 10:00:00-05',
	popularity: 99,
	notes: '30-year fixed-rate mortgage average in the United States.',
	release_ids: [207],
	category_ids: [114],
	tags: ['30-year', 'freddie mac', 'mortgage', 'nation', 'nsa', 'usa', 'weekly'],
	observation_count: 660,
	observations: generateTimeSeries(2000, 2026, 'Monthly', (i) => {
		const base = 7.5;
		const downtrend = -i * 0.015;
		const bounce = i > 240 ? (i - 240) * 0.02 : 0;
		const hike = i > 270 ? 2.5 * (1 - Math.exp(-(i - 270) / 15)) : 0;
		return Math.max(2.6, base + downtrend + bounce + hike + (Math.random() - 0.5) * 0.2);
	})
};

const T10Y2Y: Series = {
	id: 'T10Y2Y',
	title: '10-Year Treasury Minus 2-Year Treasury Spread',
	frequency: 'Daily',
	frequency_short: 'D',
	units: 'Percent',
	units_short: '%',
	seasonal_adjustment: 'Not Seasonally Adjusted',
	seasonal_adjustment_short: 'NSA',
	observation_start: '1976-06-01',
	observation_end: '2026-04-11',
	last_updated: '2026-04-11 15:18:01-05',
	popularity: 99,
	notes: 'Series is calculated as the spread between 10-Year Treasury Constant Maturity and 2-Year Treasury Constant Maturity.',
	release_ids: [18],
	category_ids: [115],
	tags: ['10-year', '2-year', 'daily', 'interest rate', 'nation', 'nsa', 'spread', 'treasury', 'usa'],
	observation_count: 12500,
	observations: generateTimeSeries(2015, 2026, 'Daily', (i, total) => {
		const base = 1.0;
		const cycle = Math.sin(i / 400) * 1.5;
		const inversion = i > 1800 && i < 2400 ? -1.5 * Math.exp(-((i - 2100) ** 2) / 40000) : 0;
		return base + cycle + inversion + (Math.random() - 0.5) * 0.1;
	})
};

export const MOCK_SERIES: Record<string, Series> = {
	UNRATE,
	CPIAUCSL,
	DGS10,
	GDPC1,
	FEDFUNDS,
	SP500,
	M2SL,
	MORTGAGE30US,
	T10Y2Y
};

export const CHART_CONFIGS: ChartConfig[] = [
	{
		id: 'UNRATE',
		title: 'Unemployment Rate',
		subtitle: 'U.S. Bureau of Labor Statistics',
		units: '%',
		chartType: 'line',
		color: 'var(--chart-1)',
		series: UNRATE
	},
	{
		id: 'CPIAUCSL',
		title: 'Consumer Price Index',
		subtitle: 'CPI for All Urban Consumers',
		units: 'Index',
		chartType: 'area',
		color: 'var(--chart-2)',
		series: CPIAUCSL
	},
	{
		id: 'DGS10',
		title: '10-Year Treasury Yield',
		subtitle: 'Constant Maturity Rate',
		units: '%',
		chartType: 'line',
		color: 'var(--chart-3)',
		series: DGS10
	},
	{
		id: 'GDPC1',
		title: 'Real GDP',
		subtitle: 'Billions of Chained 2017 Dollars',
		units: 'Bil.$',
		chartType: 'bar',
		color: 'var(--chart-4)',
		series: GDPC1
	},
	{
		id: 'FEDFUNDS',
		title: 'Federal Funds Rate',
		subtitle: 'Effective Rate',
		units: '%',
		chartType: 'step',
		color: 'var(--chart-5)',
		series: FEDFUNDS
	},
	{
		id: 'SP500',
		title: 'S&P 500',
		subtitle: 'Large-Cap U.S. Equities Index',
		units: 'Index',
		chartType: 'area',
		color: 'var(--chart-1)',
		series: SP500
	},
	{
		id: 'M2SL',
		title: 'M2 Money Supply',
		subtitle: 'Monetary Aggregate',
		units: 'Bil.$',
		chartType: 'area',
		color: 'var(--chart-2)',
		series: M2SL
	},
	{
		id: 'MORTGAGE30US',
		title: '30-Year Mortgage Rate',
		subtitle: 'Freddie Mac',
		units: '%',
		chartType: 'line',
		color: 'var(--chart-3)',
		series: MORTGAGE30US
	},
	{
		id: 'T10Y2Y',
		title: 'Treasury Spread (10Y-2Y)',
		subtitle: 'Yield Curve Inversion Indicator',
		units: '%',
		chartType: 'area',
		color: 'var(--chart-4)',
		series: T10Y2Y
	}
];

export function getChartConfig(id: string): ChartConfig | undefined {
	return CHART_CONFIGS.find((c) => c.id === id);
}
