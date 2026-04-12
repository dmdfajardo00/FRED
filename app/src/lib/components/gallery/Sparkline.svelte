<script lang="ts">
	let {
		values = [] as (number | null)[],
		color = 'var(--chart-1)',
		width = 200,
		height = 60
	}: {
		values?: (number | null)[];
		color?: string;
		width?: number;
		height?: number;
	} = $props();

	const path = $derived.by(() => {
		const valid = values.filter((v): v is number => v != null);
		if (valid.length < 2) return '';

		const min = Math.min(...valid);
		const max = Math.max(...valid);
		const range = max - min || 1;
		const pad = range * 0.05;

		let idx = 0;
		const segments: string[] = [];
		for (let i = 0; i < values.length; i++) {
			const v = values[i];
			if (v == null) continue;
			const x = (i / (values.length - 1)) * width;
			const y = height - ((v - (min - pad)) / (range + pad * 2)) * height;
			segments.push(`${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
			idx++;
		}
		return segments.join(' ');
	});

	const areaPath = $derived.by(() => {
		if (!path) return '';
		const valid = values.filter((v): v is number => v != null);
		if (valid.length < 2) return '';

		const lastX = (values.length - 1 - [...values].reverse().findIndex((v) => v != null)) / (values.length - 1) * width;
		const firstX = values.findIndex((v) => v != null) / (values.length - 1) * width;
		return `${path} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z`;
	});

	const gradId = $derived(`spark-${Math.random().toString(36).slice(2, 6)}`);
</script>

{#if path}
	<svg viewBox="0 0 {width} {height}" preserveAspectRatio="none" class="w-full h-full">
		<defs>
			<linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
				<stop offset="0%" stop-color={color} stop-opacity="0.15" />
				<stop offset="100%" stop-color={color} stop-opacity="0" />
			</linearGradient>
		</defs>
		<path d={areaPath} fill="url(#{gradId})" />
		<path d={path} fill="none" stroke={color} stroke-width="1.5" vector-effect="non-scaling-stroke" />
	</svg>
{:else}
	<div class="w-full h-full rounded bg-muted/30 animate-pulse"></div>
{/if}
