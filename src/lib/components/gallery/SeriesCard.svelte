<script lang="ts">
	import { goto } from '$app/navigation';
	import type { SeriesSummary } from '$lib/api';
	import { pinned, togglePin } from '$lib/stores/pinned';
	import Sparkline from './Sparkline.svelte';
	import { colorForSeries } from '$lib/utils/seriesColor';
	import { formatValue, formatFrequency } from '$lib/utils/format';

	let { series, sparkData }: { series: SeriesSummary; sparkData?: (number | null)[] } = $props();

	const isPinned = $derived($pinned.includes(series.id));
	const color = $derived(colorForSeries(series.id));

	const latest = $derived.by(() => {
		if (!sparkData) return null;
		for (let i = sparkData.length - 1; i >= 0; i--) {
			if (sparkData[i] != null) return sparkData[i] as number;
		}
		return null;
	});

	const prev = $derived.by(() => {
		if (!sparkData) return null;
		let seen = 0;
		for (let i = sparkData.length - 1; i >= 0; i--) {
			if (sparkData[i] != null) {
				seen++;
				if (seen === 2) return sparkData[i] as number;
			}
		}
		return null;
	});

	const delta = $derived.by(() => {
		if (latest == null || prev == null || prev === 0) return null;
		return ((latest - prev) / prev) * 100;
	});

	function onCardClick() { goto(`/charts/${encodeURIComponent(series.id)}`); }
	function onPin(e: MouseEvent) { e.stopPropagation(); togglePin(series.id); }
</script>

<div
	role="button"
	tabindex="0"
	onclick={onCardClick}
	onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(); } }}
	class="meridian-card relative flex flex-col text-left p-[14px_14px_10px] rounded-[6px] cursor-pointer transition-all"
	style:background="var(--bg)"
	style:border="1px solid var(--border)"
>
	<div class="flex items-start justify-between gap-2 mb-[2px]">
		<span class="font-mono text-[10px] tracking-[0.04em]" style:color="var(--ink-3)">{series.id}</span>
		<button
			type="button"
			onclick={onPin}
			class="p-0 border-0 bg-transparent cursor-pointer leading-none"
			style:color={isPinned ? 'var(--accent)' : 'var(--ink-4)'}
			aria-label={isPinned ? 'Unpin' : 'Pin'}
		>
			<svg width="11" height="11" viewBox="0 0 11 11" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.2">
				<path d="M5.5,0.5 L7,3.5 L10,4 L7.75,6 L8.5,9 L5.5,7.5 L2.5,9 L3.25,6 L1,4 L4,3.5 Z" />
			</svg>
		</button>
	</div>

	<div
		class="text-[13px] font-medium leading-[1.35] mb-[10px] overflow-hidden min-h-[36px] line-clamp-2"
		style:color="var(--ink-1)"
	>
		{series.title}
	</div>

	<div class="h-[44px] -mx-[6px] mb-[10px]">
		{#if sparkData}
			<Sparkline values={sparkData} {color} width={260} height={44} />
		{:else}
			<div class="w-full h-full animate-pulse rounded" style:background="var(--bg-soft)"></div>
		{/if}
	</div>

	<div class="flex items-end justify-between gap-2">
		<div class="min-w-0">
			<div class="font-mono text-[15px] font-medium tracking-[-0.01em]" style:color="var(--ink-1)">
				{latest != null ? formatValue(latest) : '—'}
			</div>
			<div class="text-[10px] mt-[1px] truncate max-w-[160px]" style:color="var(--ink-3)">
				{series.units_short || ''}
			</div>
		</div>
		{#if delta != null}
			<div class="font-mono text-[11px] flex items-center gap-[3px]"
				style:color={delta >= 0 ? 'var(--pos)' : 'var(--neg)'}>
				<span>{delta >= 0 ? '▲' : '▼'}</span>
				<span>{Math.abs(delta).toFixed(2)}%</span>
			</div>
		{/if}
	</div>

	<div class="flex gap-[6px] mt-[10px] pt-[8px] border-t items-center" style:border-color="var(--border-faint)">
		<span class="chip">{formatFrequency(series.frequency_short)}</span>
		<span class="chip ml-auto">
			{series.observation_count >= 1000 ? (series.observation_count / 1000).toFixed(1) + 'K' : series.observation_count} obs
		</span>
	</div>
</div>

<style>
	.meridian-card:hover {
		border-color: var(--ink-2) !important;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
	}
	.chip {
		font-size: 10px;
		font-family: var(--font-mono);
		color: var(--ink-3);
		background: var(--bg-soft);
		padding: 2px 6px;
		border-radius: 3px;
		letter-spacing: 0.02em;
	}
</style>
