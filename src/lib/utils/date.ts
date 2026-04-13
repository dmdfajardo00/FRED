/**
 * Parse a FRED date string (YYYY-MM-DD) to a timestamp for scale calculations.
 */
export function parseDate(dateStr: string): number {
	return new Date(dateStr + 'T00:00:00').getTime();
}

/**
 * Format a timestamp back to a short label for axis display.
 */
export function formatAxisDate(timestamp: number, spanMs: number): string {
	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = date.toLocaleString('en-US', { month: 'short' });

	// Show year only for spans > 5 years
	if (spanMs > 5 * 365.25 * 24 * 3600 * 1000) {
		return `${year}`;
	}
	return `${month} '${String(year).slice(2)}`;
}

/**
 * Clamp a date range to valid FRED observation boundaries.
 */
export function clampDateRange(
	start: number,
	end: number,
	obsStart: string,
	obsEnd: string
): [number, number] {
	const minTs = parseDate(obsStart);
	const maxTs = parseDate(obsEnd);
	return [Math.max(start, minTs), Math.min(end, maxTs)];
}
