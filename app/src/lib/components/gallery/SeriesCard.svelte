<script lang="ts">
	import type { SeriesSummary } from '$lib/api';

	let { series }: { series: SeriesSummary } = $props();

	function formatCount(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
		return n.toLocaleString();
	}
</script>

<a
	href="/charts/{series.id}"
	data-sveltekit-preload-data="hover"
	class="block rounded-xl bg-card border border-border overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
>
	<div class="px-4 py-4">
		<div class="flex items-start justify-between gap-2">
			<div class="min-w-0">
				<p class="text-sm font-semibold text-card-foreground truncate">{series.title}</p>
				<p class="text-xs font-mono text-muted-foreground/60 mt-0.5">{series.id}</p>
			</div>
			<span class="shrink-0 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
				{series.frequency_short}
			</span>
		</div>
		<div class="flex items-center justify-between mt-3 text-xs text-muted-foreground">
			<span>{formatCount(series.observation_count)} obs</span>
			<span>{series.units_short}</span>
		</div>
		<div class="mt-2 h-1 rounded-full bg-muted overflow-hidden">
			<div class="h-full rounded-full bg-primary/40" style="width: {series.popularity}%"></div>
		</div>
	</div>
</a>
