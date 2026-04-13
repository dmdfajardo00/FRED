<script lang="ts">
	import { getContext } from 'svelte';
	import { line, curveMonotoneX, curveStepAfter } from 'd3-shape';
	import type { Readable } from 'svelte/store';

	let {
		stroke = 'var(--chart-1)',
		strokeWidth = 1.5,
		curve = 'monotone' as 'monotone' | 'step',
		data: customData = undefined as any[] | undefined
	}: {
		stroke?: string;
		strokeWidth?: number;
		curve?: 'monotone' | 'step';
		data?: any[];
	} = $props();

	const { data: ctxData, xGet, yGet } = getContext<{
		data: Readable<any[]>;
		xGet: Readable<(d: any) => number>;
		yGet: Readable<(d: any) => number>;
	}>('LayerCake');

	const renderData = $derived(customData ?? $ctxData);
	const curveFunc = $derived(curve === 'step' ? curveStepAfter : curveMonotoneX);

	const path = $derived(
		line<any>()
			.defined((d) => d.y != null)
			.x((d) => $xGet(d))
			.y((d) => $yGet(d))
			.curve(curveFunc)(renderData) ?? ''
	);
</script>

<path
	d={path}
	fill="none"
	stroke={stroke}
	stroke-width={strokeWidth}
	vector-effect="non-scaling-stroke"
/>
