<script lang="ts">
	import type { SeriesSummary } from '$lib/api';
	import Sparkline from '$lib/components/gallery/Sparkline.svelte';
	import { colorForSeries } from '$lib/utils/seriesColor';
	import { formatFrequency } from '$lib/utils/format';

	interface Props {
		series: SeriesSummary[];
		sparklines: Record<string, (number | null)[]>;
		onSelect: (seriesId: string) => void;
		maxShown?: number;
	}

	const { series, sparklines, onSelect, maxShown = 20 }: Props = $props();

	const visible = $derived(series.slice(0, maxShown));

	function formatObsCount(n: number): string {
		if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
		return String(n);
	}
</script>

<div class="flex flex-col">
	{#each visible as s, i (s.id)}
		<button
			type="button"
			onclick={() => onSelect(s.id)}
			class="csl-row flex items-center gap-[12px] w-full text-left px-[4px] py-[10px] bg-transparent cursor-pointer transition-colors"
			style:border-top={i === 0 ? 'none' : '1px solid var(--border-faint)'}
			aria-label={`Open ${s.id}: ${s.title}`}
		>
			<div class="flex-1 min-w-0">
				<div class="flex items-center gap-[6px] mb-[2px]">
					<span
						class="font-mono text-[10px] tracking-[0.04em] truncate"
						style:color="var(--ink-3)"
					>
						{s.id}
					</span>
					<span class="csl-chip">{formatFrequency(s.frequency_short)}</span>
					<span class="csl-chip">{formatObsCount(s.observation_count)} obs</span>
				</div>
				<div
					class="text-[13px] leading-[1.3] truncate"
					style:color="var(--ink-1)"
					title={s.title}
				>
					{s.title}
				</div>
			</div>

			<div class="w-[80px] h-[22px] flex-shrink-0">
				{#if sparklines[s.id]}
					<Sparkline
						values={sparklines[s.id]}
						color={colorForSeries(s.id)}
						width={80}
						height={22}
					/>
				{:else}
					<div
						class="csl-spark-placeholder w-full h-full rounded-[2px]"
						style:background="var(--bg-soft)"
					></div>
				{/if}
			</div>
		</button>
	{/each}
</div>

<style>
	.csl-row:hover {
		background: var(--bg-soft);
	}
	.csl-row:active {
		transform: translateY(1px);
	}
	.csl-chip {
		font-family: var(--font-mono);
		font-size: 9px;
		color: var(--ink-3);
		background: var(--bg-soft);
		padding: 2px 5px;
		border-radius: 3px;
		letter-spacing: 0.02em;
		line-height: 1;
	}
	.csl-spark-placeholder {
		animation: csl-pulse 1.6s ease-in-out infinite;
	}
	@keyframes csl-pulse {
		0%, 100% { opacity: 0.55; }
		50% { opacity: 0.9; }
	}
</style>
