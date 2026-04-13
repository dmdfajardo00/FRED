<script lang="ts">
	import { getContext } from 'svelte';
	import { timeFormat } from 'd3-time-format';
	import type { Readable } from 'svelte/store';

	const { xScale, height, width } = getContext<{
		xScale: Readable<any>;
		height: Readable<number>;
		width: Readable<number>;
	}>('LayerCake');

	const fmt = timeFormat("%b '%y");

	const ticks = $derived.by(() => {
		const scale = $xScale;
		if (typeof scale.ticks === 'function') return scale.ticks(6) as Date[];
		const domain = scale.domain() as Date[];
		return [domain[0], domain[domain.length - 1]];
	});
</script>

<g transform="translate(0, {$height})">
	{#each ticks as tick}
		{@const x = $xScale(tick)}
		<line x1={x} x2={x} y1="0" y2="5" stroke="var(--border)" />
		<text
			{x}
			y="18"
			text-anchor="middle"
			font-size="10"
			fill="var(--muted-foreground)"
			opacity="0.7"
		>
			{fmt(tick)}
		</text>
	{/each}
</g>
