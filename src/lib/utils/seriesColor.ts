const PALETTE = [
	'var(--c-cobalt)',
	'var(--c-maroon)',
	'var(--c-ochre)',
	'var(--c-moss)',
	'var(--c-plum)'
];

export function colorForSeries(id: string): string {
	if (!id) return PALETTE[0];
	let h = 0;
	for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
	return PALETTE[h % PALETTE.length];
}

export const CHART_PALETTE = PALETTE;
