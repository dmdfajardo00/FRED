/**
 * Format a numeric value with smart abbreviation (K, M, B, T).
 */
export function formatNumber(value: number | null, units?: string): string {
	if (value === null || value === undefined) return 'N/A';

	const abs = Math.abs(value);
	const sign = value < 0 ? '-' : '';

	let formatted: string;
	if (abs >= 1_000_000_000_000) {
		formatted = `${sign}${(abs / 1_000_000_000_000).toFixed(2)}T`;
	} else if (abs >= 1_000_000_000) {
		formatted = `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
	} else if (abs >= 1_000_000) {
		formatted = `${sign}${(abs / 1_000_000).toFixed(2)}M`;
	} else if (abs >= 1_000) {
		formatted = `${sign}${(abs / 1_000).toFixed(1)}K`;
	} else {
		formatted = `${sign}${abs.toFixed(2)}`;
	}

	return units ? `${formatted} ${units}` : formatted;
}

/**
 * Format a date string for display.
 */
export function formatDate(dateStr: string, frequency?: string): string {
	const date = new Date(dateStr + 'T00:00:00');
	const year = date.getFullYear();
	const month = date.toLocaleString('en-US', { month: 'short' });

	if (frequency === 'Annual' || frequency === 'A') {
		return `${year}`;
	}
	if (frequency === 'Quarterly' || frequency === 'Q') {
		const q = Math.floor(date.getMonth() / 3) + 1;
		return `Q${q} ${year}`;
	}
	return `${month} ${year}`;
}

/**
 * Format a percentage change with sign.
 */
export function formatChange(value: number): string {
	const sign = value >= 0 ? '+' : '';
	return `${sign}${value.toFixed(2)}%`;
}

/**
 * Editorial-style value formatting — matches Meridian prototype.
 */
export function formatValue(v: number): string {
	if (Math.abs(v) >= 1e12) return (v / 1e12).toFixed(2) + 'T';
	if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B';
	if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
	if (Math.abs(v) >= 1e3) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
	if (Math.abs(v) < 10) return v.toFixed(2);
	return v.toFixed(1);
}

export function formatFrequency(code: string): string {
	switch ((code || '').toUpperCase()) {
		case 'D': return 'Daily';
		case 'W': return 'Weekly';
		case 'M': return 'Monthly';
		case 'BW': return 'Bi-weekly';
		case 'Q': return 'Quarterly';
		case 'SA': return 'Semi-Annual';
		case 'A': return 'Annual';
		case '5Y': return '5-Yearly';
		case '10Y': return '10-Yearly';
		default: return code || '—';
	}
}

export function formatLongDate(d: string | Date): string {
	const date = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00' : d) : d;
	return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
