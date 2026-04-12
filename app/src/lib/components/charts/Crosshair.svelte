<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	let {
		x = null as number | null,
		y = null as number | null,
		isDragging = false
	}: {
		x?: number | null;
		y?: number | null;
		isDragging?: boolean;
	} = $props();

	const { width, height } = getContext<{
		width: Readable<number>;
		height: Readable<number>;
	}>('LayerCake');
</script>

{#if !isDragging && x != null && y != null}
	<!-- Vertical line -->
	<line
		x1={x} y1={0} x2={x} y2={$height}
		stroke="var(--muted-foreground)"
		stroke-width="1"
		stroke-dasharray="3,3"
		opacity="0.5"
		pointer-events="none"
	/>
	<!-- Horizontal line -->
	<line
		x1={0} y1={y} x2={$width} y2={y}
		stroke="var(--muted-foreground)"
		stroke-width="1"
		stroke-dasharray="3,3"
		opacity="0.5"
		pointer-events="none"
	/>
	<!-- Dot at intersection -->
	<circle
		cx={x} cy={y} r="3"
		fill="var(--primary)"
		stroke="var(--background)"
		stroke-width="1.5"
		pointer-events="none"
	/>
{/if}
