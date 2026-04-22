<script lang="ts">
	import type { PulseResponse } from '$lib/api';
	import { US_TILE_GRID } from '$lib/us-tile-grid';

	interface HoverInfo {
		code: string;
		x: number;
		y: number;
		value: number | null;
	}

	interface Props {
		data: PulseResponse;
		hover: HoverInfo | null;
		onHoverChange: (h: HoverInfo | null) => void;
		onSelect: (seriesId: string) => void;
		formatValue: (v: number | null, unit?: string) => string;
	}

	const { data, hover, onHoverChange, onSelect, formatValue }: Props = $props();

	const SIZE = 52;
	const GAP = 4;
	const COLS = US_TILE_GRID[0].length;
	const ROWS = US_TILE_GRID.length;
	const W = COLS * (SIZE + GAP);
	const H = ROWS * (SIZE + GAP);

	function tileColor(t: number, higherIsBetter: boolean): string {
		if (!isFinite(t)) return 'var(--bg-soft)';
		const intensity = Math.max(0.05, Math.min(1, t));
		const hue = higherIsBetter ? 250 : 25;
		return `oklch(${(96 - intensity * 52).toFixed(0)}% ${(0.02 + intensity * 0.16).toFixed(3)} ${hue})`;
	}

	const range = $derived(data.max - data.min || 1);
</script>

<svg viewBox="0 0 {W} {H + 40}" width="100%" style:display="block">
	{#each US_TILE_GRID as row, rIdx}
		{#each row as code, cIdx}
			{#if code && data.data[code]}
				{@const d = data.data[code]}
				{@const v = d.value}
				{@const t = v != null ? (v - data.min) / range : -1}
				{@const bg = v != null ? tileColor(t, data.higherIsBetter) : 'var(--bg-soft)'}
				{@const hovered = hover?.code === code}
				{@const isStrong = v != null && t > 0.55}
				{@const ink = isStrong ? 'white' : 'var(--ink-1)'}
				<g
					transform="translate({cIdx * (SIZE + GAP)}, {rIdx * (SIZE + GAP)})"
					role="button"
					tabindex="0"
					style="cursor: {d.seriesId ? 'pointer' : 'default'}"
					onmouseenter={() => onHoverChange({ code, x: cIdx * (SIZE + GAP), y: rIdx * (SIZE + GAP), value: v })}
					onmouseleave={() => onHoverChange(null)}
					onclick={() => d.seriesId && onSelect(d.seriesId)}
					onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && d.seriesId) onSelect(d.seriesId); }}
				>
					<rect
						width={SIZE}
						height={SIZE}
						fill={bg}
						stroke={hovered ? 'var(--ink-0)' : 'var(--border-faint)'}
						stroke-width={hovered ? 1.5 : 1}
						rx="2"
					/>
					<text
						x={SIZE / 2}
						y={SIZE / 2 + 4}
						text-anchor="middle"
						font-size="10"
						font-family="var(--font-mono)"
						fill={ink}
						style="pointer-events: none; font-weight: 500;"
					>{code}</text>
				</g>
			{/if}
		{/each}
	{/each}
</svg>

{#if hover}
	<div
		class="absolute px-3 py-2 rounded-[5px] text-[12px] z-10 pointer-events-none"
		style:background="var(--bg)"
		style:border="1px solid var(--border)"
		style:box-shadow="0 4px 12px rgba(0,0,0,0.06)"
		style:left="{28 + Math.min(hover.x + SIZE + 12, 600)}px"
		style:top="{24 + 40 + hover.y}px"
	>
		<div class="font-mono text-[11px] mb-[2px]" style:color="var(--ink-3)">{hover.code}</div>
		<div class="font-mono text-[15px] font-medium tabular-nums" style:color="var(--ink-0)">{formatValue(hover.value, data.unit)}</div>
		<div class="text-[10px] mt-[2px]" style:color="var(--ink-3)">{data.label}</div>
	</div>
{/if}
