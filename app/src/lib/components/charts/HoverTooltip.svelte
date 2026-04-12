<script lang="ts">
	import { timeFormat } from 'd3-time-format';

	const fmt = timeFormat('%b %d, %Y');

	let {
		visible = false,
		x = 0,
		y = 0,
		date = null as Date | null,
		items = [] as Array<{ label: string; value: number | null; color: string; units: string }>,
		containerWidth = 0,
		containerHeight = 0,
		padding = { top: 0, right: 0, bottom: 0, left: 0 }
	}: {
		visible?: boolean;
		x?: number;
		y?: number;
		date?: Date | null;
		items?: Array<{ label: string; value: number | null; color: string; units: string }>;
		containerWidth?: number;
		containerHeight?: number;
		padding?: { top: number; right: number; bottom: number; left: number };
	} = $props();

	const OFFSET = 16;
	const TOOLTIP_W = 200;
	const TOOLTIP_H_EST = 40 + items.length * 24;

	const absX = $derived(x + padding.left);
	const absY = $derived(y + padding.top);

	const flipX = $derived(absX + OFFSET + TOOLTIP_W > containerWidth - 8);
	const left = $derived(flipX ? absX - OFFSET - TOOLTIP_W : absX + OFFSET);

	const clampedTop = $derived(
		Math.max(8, Math.min(absY - TOOLTIP_H_EST / 2, containerHeight - TOOLTIP_H_EST - 8))
	);

	function formatValue(v: number | null, units: string): string {
		if (v == null) return '--';
		const abs = Math.abs(v);
		if (abs >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
		if (abs >= 1_000) return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
		return v.toFixed(abs < 10 ? 2 : 1);
	}
</script>

{#if visible && date}
	<div
		class="absolute z-50 pointer-events-none"
		style="left: {left}px; top: {clampedTop}px;"
	>
		<div class="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 min-w-[160px] max-w-[260px]">
			<p class="text-[11px] font-medium text-muted-foreground mb-1.5 font-mono">
				{fmt(date)}
			</p>
			{#each items as item}
				<div class="flex items-center justify-between gap-3 py-0.5">
					<div class="flex items-center gap-1.5 min-w-0">
						<span
							class="shrink-0 w-2 h-2 rounded-full"
							style="background: {item.color};"
						></span>
						<span class="text-xs text-foreground/70 truncate">{item.label}</span>
					</div>
					<span class="text-xs font-mono font-semibold text-foreground tabular-nums whitespace-nowrap">
						{formatValue(item.value, item.units)}
						<span class="text-muted-foreground font-normal text-[10px]">{item.units}</span>
					</span>
				</div>
			{/each}
		</div>
	</div>
{/if}
