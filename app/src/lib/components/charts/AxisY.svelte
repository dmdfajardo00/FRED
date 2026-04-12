<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	let {
		formatTick = defaultFormat
	}: {
		formatTick?: (d: number) => string;
	} = $props();

	function defaultFormat(d: number): string {
		const abs = Math.abs(d);
		if (abs >= 1_000_000) return (d / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
		if (abs >= 1_000) return (d / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
		return d.toFixed(abs < 10 ? 1 : 0);
	}

	const { yScale, width } = getContext<{
		yScale: Readable<any>;
		width: Readable<number>;
	}>('LayerCake');

	const ticks = $derived(
		typeof $yScale.ticks === 'function' ? ($yScale.ticks(5) as number[]) : []
	);
</script>

{#each ticks as tick}
	{@const y = $yScale(tick)}
	<line
		x1="0"
		x2={$width}
		y1={y}
		y2={y}
		stroke="var(--border)"
		opacity="0.3"
		stroke-dasharray="3,3"
	/>
	<text
		x="-8"
		{y}
		dy="3"
		text-anchor="end"
		font-size="10"
		fill="var(--muted-foreground)"
		opacity="0.7"
	>
		{formatTick(tick)}
	</text>
{/each}
