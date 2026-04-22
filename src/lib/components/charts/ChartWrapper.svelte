<script lang="ts">
	import { LayerCake, Svg } from 'layercake';
	import { scaleTime, scaleLinear } from 'd3-scale';
	import type { ChartConfig } from '$lib/types/fred';

	import Line from './Line.svelte';
	import Area from './Area.svelte';
	import Bar from './Bar.svelte';
	import AxisX from './AxisX.svelte';
	import AxisY from './AxisY.svelte';
	import Crosshair from './Crosshair.svelte';
	import ChartOverlay from './ChartOverlay.svelte';
	import HoverTooltip from './HoverTooltip.svelte';
	import RecessionBands from './RecessionBands.svelte';

	let {
		config = undefined as ChartConfig | undefined,
		configs = undefined as ChartConfig[] | undefined,
		height = 400,
		mini = false,
		recessionPeriods = [] as Array<[Date, Date]>
	}: {
		config?: ChartConfig;
		configs?: ChartConfig[];
		height?: number;
		mini?: boolean;
		recessionPeriods?: Array<[Date, Date]>;
	} = $props();

	const displayConfigs = $derived(configs ?? (config ? [config] : []));
	const isMultiLine = $derived(displayConfigs.length > 1);
	const h = $derived(mini ? 120 : height);
	const padding = $derived(
		mini
			? { top: 0, right: 0, bottom: 0, left: 0 }
			: { top: 20, right: 15, bottom: 30, left: 55 }
	);

	type Point = { x: Date; y: number };

	const allDatasets = $derived(
		displayConfigs.map((cfg) => ({
			points: cfg.series.observations
				.filter((o) => o.value != null)
				.map((o) => ({ x: new Date(o.date), y: o.value as number })),
			label: cfg.title,
			color: cfg.color,
			units: cfg.units
		}))
	);

	// Merged data for LayerCake domain computation
	const mergedPoints = $derived(allDatasets.flatMap((ds) => ds.points));

	// Zoom state
	let zoomDomain = $state<[Date, Date] | null>(null);
	const isZoomed = $derived(zoomDomain != null);

	const RESET_SENTINEL = new Date(0);

	function handleZoom(domain: [Date, Date]) {
		if (domain[0].getTime() === RESET_SENTINEL.getTime()) {
			zoomDomain = null;
		} else {
			zoomDomain = domain;
		}
	}

	// Compute visible data in zoom range for proper y-domain
	const visiblePoints = $derived.by(() => {
		if (!zoomDomain) return mergedPoints;
		const [start, end] = zoomDomain;
		return mergedPoints.filter((p) => p.x >= start && p.x <= end);
	});

	const xDomain = $derived.by(() => {
		if (zoomDomain) return zoomDomain;
		if (mergedPoints.length === 0) return undefined;
		const dates = mergedPoints.map((p) => p.x);
		return [new Date(Math.min(...dates.map((d) => d.getTime()))), new Date(Math.max(...dates.map((d) => d.getTime())))] as [Date, Date];
	});

	const yDomain = $derived.by(() => {
		if (visiblePoints.length === 0) return undefined;
		const values = visiblePoints.map((p) => p.y);
		const min = Math.min(...values);
		const max = Math.max(...values);
		const margin = (max - min) * 0.05 || 1;
		return [min - margin, max + margin] as [number, number];
	});

	// Hover state
	let hoverX = $state<number | null>(null);
	let hoverY = $state<number | null>(null);
	let hoverDate = $state<Date | null>(null);
	let hoverItems = $state<Array<{ label: string; value: number | null; color: string; units: string }>>([]);
	let hoverVisible = $state(false);
	let isDragging = $state(false);

	function handleHover(info: {
		index: number;
		cursorX: number;
		cursorY: number;
		date: Date;
		items: Array<{ label: string; value: number | null; color: string; units: string }>;
	}) {
		hoverX = info.cursorX;
		hoverY = info.cursorY;
		hoverDate = info.date;
		hoverItems = info.items;
		hoverVisible = true;
	}

	function handleLeave() {
		hoverVisible = false;
		hoverX = null;
		hoverY = null;
	}

	let containerWidth = $state(0);
	let containerHeight = $state(0);

	function renderLayer(cfg: ChartConfig, dataset: { points: Point[] }) {
		return { type: cfg.chartType, points: dataset.points, color: cfg.color };
	}

	const layers = $derived(displayConfigs.map((cfg, i) => renderLayer(cfg, allDatasets[i])));
</script>

<div
	class="relative"
	style="height: {h}px;"
	bind:clientWidth={containerWidth}
	bind:clientHeight={containerHeight}
>
	{#if mergedPoints.length > 0}
		<LayerCake
			data={mergedPoints}
			x="x"
			y="y"
			xScale={scaleTime()}
			yScale={scaleLinear()}
			xDomain={xDomain as unknown as [number, number] | undefined}
			{yDomain}
			{padding}
		>
			<Svg>
				{#if !mini}
					<AxisX />
					<AxisY />
				{/if}

				{#if !mini && recessionPeriods.length > 0}
					<RecessionBands periods={recessionPeriods} />
				{/if}

				{#each layers as layer, i}
					{#if layer.type === 'line'}
						<Line data={layer.points} stroke={layer.color} />
					{:else if layer.type === 'area'}
						<Area data={layer.points} fill={layer.color} />
					{:else if layer.type === 'bar'}
						<Bar fill={layer.color} />
					{:else if layer.type === 'step'}
						<Line data={layer.points} stroke={layer.color} curve="step" />
					{/if}
				{/each}

				{#if !mini}
					<Crosshair x={hoverX} y={hoverY} isDragging={isDragging} />
					<ChartOverlay
						datasets={allDatasets}
						onhover={handleHover}
						onleave={handleLeave}
						onzoom={handleZoom}
					/>
				{/if}
			</Svg>
		</LayerCake>

		<!-- HoverTooltip (HTML overlay, outside SVG) -->
		{#if !mini}
			<HoverTooltip
				visible={hoverVisible}
				x={hoverX ?? 0}
				y={hoverY ?? 0}
				date={hoverDate}
				items={hoverItems}
				{containerWidth}
				{containerHeight}
				{padding}
			/>
		{/if}
	{/if}

	<!-- Zoom reset button -->
	{#if isZoomed && !mini}
		<button
			class="absolute top-2 right-2 z-10 px-2 py-1 text-[11px] font-medium rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
			onclick={() => { zoomDomain = null; }}
		>
			Reset zoom
		</button>
	{/if}
</div>
