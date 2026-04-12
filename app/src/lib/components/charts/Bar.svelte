<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	let {
		fill = 'var(--chart-1)',
		gap = 2
	}: {
		fill?: string;
		gap?: number;
	} = $props();

	const { data, xGet, yGet, height, xScale } = getContext<{
		data: Readable<any[]>;
		xGet: Readable<(d: any) => number>;
		yGet: Readable<(d: any) => number>;
		height: Readable<number>;
		xScale: Readable<any>;
	}>('LayerCake');

	const barWidth = $derived.by(() => {
		const scale = $xScale;
		if (typeof scale.bandwidth === 'function') return Math.max(0, scale.bandwidth() - gap);
		const pts = $data;
		if (pts.length < 2) return 10;
		const spacing = Math.abs($xGet(pts[1]) - $xGet(pts[0]));
		return Math.max(1, spacing - gap);
	});

	const bars = $derived(
		$data
			.filter((d: any) => d.y != null)
			.map((d: any) => ({
				x: $xGet(d) - barWidth / 2,
				y: $yGet(d),
				width: barWidth,
				height: $height - $yGet(d)
			}))
	);
</script>

{#each bars as bar}
	<rect
		x={bar.x}
		y={bar.y}
		width={bar.width}
		height={bar.height}
		{fill}
		rx="2"
	/>
{/each}
