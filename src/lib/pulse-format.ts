export function formatPulseValue(v: number | null, unit = ''): string {
	if (v == null) return '—';
	if (unit === '$') return '$' + Math.round(v).toLocaleString();
	if (unit === 'k') return (v / 1000).toFixed(1) + 'k';
	if (unit === 'people') {
		if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
		if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
		if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
		return Math.round(v).toLocaleString();
	}
	if (unit === '%') return v.toFixed(2) + '%';
	if (unit === 'years') return v.toFixed(1) + ' yr';
	return v.toFixed(2) + unit;
}
