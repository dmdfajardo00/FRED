<script lang="ts">
	import type { ChartConfig } from '$lib/types/fred';
	import ChartWrapper from '$lib/components/charts/ChartWrapper.svelte';

	let { config }: { config: ChartConfig } = $props();

	function formatObsCount(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M obs';
		if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K obs';
		return n.toLocaleString() + ' obs';
	}
</script>

<a
	href="/charts/{config.id}"
	data-sveltekit-preload-data="hover"
	class="block rounded-xl bg-card border border-border overflow-hidden transition-all duration-200 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
>
	<div class="h-[140px] px-3 pt-3">
		<ChartWrapper {config} mini={true} />
	</div>

	<div class="px-4 py-3 border-t border-border/50">
		<p class="text-sm font-semibold text-card-foreground truncate">{config.title}</p>
		<p class="text-xs text-muted-foreground mt-0.5 truncate">{config.subtitle}</p>
		<div class="flex items-center justify-between mt-2">
			<span class="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-medium">
				{config.series.frequency_short}
			</span>
			<span class="text-xs text-muted-foreground/70">
				{formatObsCount(config.series.observation_count)}
			</span>
		</div>
	</div>
</a>
