<script lang="ts">
	import { getContext } from 'svelte';
	import type { Readable } from 'svelte/store';

	type DataPoint = { x: Date; y: number };
	type Dataset = { points: DataPoint[]; label: string; color: string; units: string };
	type HoverInfo = {
		index: number;
		cursorX: number;
		cursorY: number;
		date: Date;
		items: Array<{ label: string; value: number | null; color: string; units: string }>;
	};

	let {
		datasets = [] as Dataset[],
		onhover = (_info: HoverInfo) => {},
		onleave = () => {},
		onzoom = (_domain: [Date, Date]) => {}
	}: {
		datasets?: Dataset[];
		onhover?: (info: HoverInfo) => void;
		onleave?: () => void;
		onzoom?: (domain: [Date, Date]) => void;
	} = $props();

	const { xScale, yScale, width, height } = getContext<{
		xScale: Readable<any>;
		yScale: Readable<any>;
		width: Readable<number>;
		height: Readable<number>;
	}>('LayerCake');

	const DRAG_THRESHOLD = 5;

	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragCurrentX = $state(0);

	function findNearest(mouseX: number): { index: number; date: Date } | null {
		const primary = datasets[0];
		if (!primary || primary.points.length === 0) return null;
		const pts = primary.points;
		const dateAtMouse = $xScale.invert(mouseX) as Date;
		let lo = 0;
		let hi = pts.length - 1;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (pts[mid].x < dateAtMouse) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) {
			const dPrev = Math.abs(dateAtMouse.getTime() - pts[lo - 1].x.getTime());
			const dCurr = Math.abs(dateAtMouse.getTime() - pts[lo].x.getTime());
			if (dPrev < dCurr) lo--;
		}
		return { index: lo, date: pts[lo].x };
	}

	function getItemsAtDate(date: Date): Array<{ label: string; value: number | null; color: string; units: string }> {
		return datasets.map((ds) => {
			const target = date.getTime();
			let closest = ds.points[0];
			let minDist = Infinity;
			for (const p of ds.points) {
				const d = Math.abs(p.x.getTime() - target);
				if (d < minDist) { minDist = d; closest = p; }
				if (d > minDist) break;
			}
			return {
				label: ds.label,
				value: closest && minDist < 86400000 * 45 ? closest.y : null,
				color: ds.color,
				units: ds.units
			};
		});
	}

	function handleMove(e: MouseEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		if (isDragging) {
			dragCurrentX = Math.max(0, Math.min(mouseX, $width));
			return;
		}

		const nearest = findNearest(mouseX);
		if (!nearest) return;

		const snappedX = $xScale(nearest.date);
		const primaryY = datasets[0]?.points[nearest.index]?.y;
		const cursorY = primaryY != null ? $yScale(primaryY) : mouseY;

		onhover({
			index: nearest.index,
			cursorX: snappedX,
			cursorY,
			date: nearest.date,
			items: getItemsAtDate(nearest.date)
		});
	}

	function handleDown(e: MouseEvent) {
		const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		isDragging = true;
		dragStartX = mouseX;
		dragCurrentX = mouseX;
	}

	function handleUp() {
		if (isDragging) {
			const dist = Math.abs(dragCurrentX - dragStartX);
			if (dist > DRAG_THRESHOLD) {
				const x0 = Math.min(dragStartX, dragCurrentX);
				const x1 = Math.max(dragStartX, dragCurrentX);
				const d0 = $xScale.invert(x0) as Date;
				const d1 = $xScale.invert(x1) as Date;
				onzoom([d0, d1]);
			}
			isDragging = false;
			onleave();
		}
	}

	function handleLeave() {
		if (!isDragging) onleave();
	}

	function handleDblClick() {
		onzoom([new Date(0), new Date(9999, 0)]);
	}

	const selX = $derived(Math.min(dragStartX, dragCurrentX));
	const selW = $derived(Math.abs(dragCurrentX - dragStartX));
</script>

<!-- Selection rectangle during drag -->
{#if isDragging && selW > DRAG_THRESHOLD}
	<rect
		x={selX} y={0}
		width={selW} height={$height}
		fill="var(--primary)"
		opacity="0.1"
		pointer-events="none"
	/>
	<line x1={selX} y1={0} x2={selX} y2={$height} stroke="var(--primary)" stroke-width="1" opacity="0.5" pointer-events="none" />
	<line x1={selX + selW} y1={0} x2={selX + selW} y2={$height} stroke="var(--primary)" stroke-width="1" opacity="0.5" pointer-events="none" />
{/if}

<!-- Invisible interaction rect -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<rect
	x={0} y={0}
	width={$width} height={$height}
	fill="transparent"
	style="cursor: {isDragging ? 'ew-resize' : 'crosshair'}"
	onmousemove={handleMove}
	onmousedown={handleDown}
	onmouseup={handleUp}
	onmouseleave={handleLeave}
	ondblclick={handleDblClick}
/>
