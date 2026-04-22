import { fetchObservations } from '$lib/api';

// NBER-based US recession indicator. USREC is monthly: 1 = recession month, 0 = expansion.
// Source: https://fred.stlouisfed.org/series/USREC
const SERIES_ID = 'USREC';

let cache: Promise<Array<[Date, Date]>> | null = null;

export function getRecessionPeriods(): Promise<Array<[Date, Date]>> {
	if (cache) return cache;
	cache = fetchObservations([SERIES_ID]).then((obsMap) => {
		const obs = obsMap[SERIES_ID];
		if (!obs) return [];
		return toRanges(obs.dates, obs.values);
	});
	return cache;
}

function toRanges(dates: string[], values: (number | null)[]): Array<[Date, Date]> {
	const ranges: Array<[Date, Date]> = [];
	let start: Date | null = null;
	let lastRecessionDate: Date | null = null;

	for (let i = 0; i < dates.length; i++) {
		const v = values[i];
		if (v === 1) {
			const d = new Date(dates[i] + 'T00:00:00');
			if (!start) start = d;
			lastRecessionDate = d;
		} else if (v === 0 || v == null) {
			if (start && lastRecessionDate) {
				// Extend the end date by ~1 month so the band covers the full recession month
				const end = new Date(lastRecessionDate);
				end.setMonth(end.getMonth() + 1);
				ranges.push([start, end]);
				start = null;
				lastRecessionDate = null;
			}
		}
	}
	if (start && lastRecessionDate) {
		const end = new Date(lastRecessionDate);
		end.setMonth(end.getMonth() + 1);
		ranges.push([start, end]);
	}
	return ranges;
}
