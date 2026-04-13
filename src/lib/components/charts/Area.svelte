<script lang="ts">
	import { getContext } from 'svelte';
	import { area, line, curveMonotoneX } from 'd3-shape';
	import type { Readable } from 'svelte/store';

	let {
		fill = 'var(--chart-1)',
		opacity = 0.15,
		data: customData = undefined as any[] | undefined
	}: {
		fill?: string;
		opacity?: number;
		data?: any[];
	} = $props();

	const { data: ctxData, xGet, yGet, height } = getContext<{
		data: Readable<any[]>;
		xGet: Readable<(d: any) => number>;
		yGet: Readable<(d: any) => number>;
		height: Readable<number>;
	}>('LayerCake');

	const renderData = $derived(customData ?? $ctxData);
	const gradientId = $derived(`area-grad-${Math.random().toString(36).slice(2, 8)}`);

	const areaPath = $derived(
		area<any>()
			.defined((d) => d.y != null)
			.x((d) => $xGet(d))
			.y0($height)
			.y1((d) => $yGet(d))
			.curve(curveMonotoneX)(renderData) ?? ''
	);

	const linePath = $derived(
		line<any>()
			.defined((d) => d.y != null)
			.x((d) => $xGet(d))
			.y((d) => $yGet(d))
			.curve(curveMonotoneX)(renderData) ?? ''
	);
</script>

<defs>
	<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
		<stop offset="0%" stop-color={fill} stop-opacity={opacity} />
		<stop offset="100%" stop-color={fill} stop-opacity="0" />
	</linearGradient>
</defs>

<path d={areaPath} fill="url(#{gradientId})" stroke="none" />
<path
	d={linePath}
	fill="none"
	stroke={fill}
	stroke-width="1.5"
	vector-effect="non-scaling-stroke"
/>
