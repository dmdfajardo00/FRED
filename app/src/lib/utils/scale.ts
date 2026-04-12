/**
 * Linear scale — maps a domain [min, max] to a range [0, size].
 */
export function linearScale(
	value: number,
	domainMin: number,
	domainMax: number,
	rangeSize: number
): number {
	if (domainMax === domainMin) return rangeSize / 2;
	return ((value - domainMin) / (domainMax - domainMin)) * rangeSize;
}

/**
 * Compute domain min/max with optional padding.
 */
export function computeDomain(
	values: (number | null)[],
	padding = 0.05
): [number, number] {
	const defined = values.filter((v): v is number => v !== null);
	if (defined.length === 0) return [0, 1];
	const min = Math.min(...defined);
	const max = Math.max(...defined);
	const span = max - min || 1;
	return [min - span * padding, max + span * padding];
}

/**
 * Generate N evenly spaced tick values across [min, max].
 */
export function generateTicks(min: number, max: number, count = 5): number[] {
	const step = (max - min) / (count - 1);
	return Array.from({ length: count }, (_, i) => min + i * step);
}
