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
