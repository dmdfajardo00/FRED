<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	let { periods = [] as Array<[Date, Date]> }: { periods?: Array<[Date, Date]> } = $props();

	const { xScale, height, width } = getContext<{
		xScale: Readable<(d: Date) => number>;
		height: Readable<number>;
		width: Readable<number>;
	}>('LayerCake');

	function band(start: Date, end: Date) {
		const x1 = Math.max(0, Math.min($xScale(start), $width));
		const x2 = Math.max(0, Math.min($xScale(end), $width));
		const left = Math.min(x1, x2);
		const w = Math.abs(x2 - x1);
		return { x: left, width: w };
	}
</script>

{#each periods as [start, end], i (i)}
	{@const b = band(start, end)}
	{#if b.width > 0}
		<rect
			x={b.x}
			y={0}
			width={b.width}
			height={$height}
			fill="var(--ink-3)"
			opacity="0.10"
			pointer-events="none"
		/>
	{/if}
{/each}
