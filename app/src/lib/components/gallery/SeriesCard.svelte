<script lang="ts">
	import type { SeriesSummary } from '$lib/api';
	import Sparkline from './Sparkline.svelte';

	const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

	let {
		series,
		sparkData = undefined as (number | null)[] | undefined,
		index = 0
	}: {
		series: SeriesSummary;
		sparkData?: (number | null)[];
		index?: number;
	} = $props();

	function formatCount(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return n.toLocaleString();
	}

	const color = $derived(COLORS[index % COLORS.length]);
</script>

<a
	href="/charts/{series.id}"
	data-sveltekit-preload-data="hover"
	class="block rounded-xl bg-card border border-border overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
>
	<div class="h-[80px] px-3 pt-2">
		<Sparkline values={sparkData ?? []} {color} />
	</div>

	<div class="px-4 py-3 border-t border-border/50">
		<p class="text-sm font-semibold text-card-foreground truncate">{series.title}</p>
		<p class="text-xs font-mono text-muted-foreground/60 mt-0.5">{series.id}</p>
		<div class="flex items-center justify-between mt-2">
			<span class="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
				{series.frequency_short}
			</span>
			<span class="text-xs text-muted-foreground/70">
				{formatCount(series.observation_count)} obs
			</span>
		</div>
	</div>
</a>
