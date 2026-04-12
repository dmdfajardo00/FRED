<script lang="ts">
	import { page } from '$app/stores';
	import { getChartConfig } from '$lib/mock/fred-data';
	import ChartWrapper from '$lib/components/charts/ChartWrapper.svelte';
	import Icon from '@iconify/svelte';

	const id = $derived($page.params.id);
	const config = $derived(getChartConfig(id));

	const latestObs = $derived(
		config
			? [...config.series.observations].reverse().find((o) => o.value != null) ?? null
			: null
	);

	const latestValue = $derived(latestObs?.value ?? null);
	const latestDate = $derived(latestObs?.date ?? null);

	function formatValue(v: number | null): string {
		if (v == null) return '—';
		if (Math.abs(v) >= 10_000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
		if (Math.abs(v) >= 100) return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
		return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
	}

	function formatCount(n: number): string {
		return n.toLocaleString('en-US');
	}

	function formatDate(d: string): string {
		return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

{#if !config}
	<div class="flex flex-col items-center justify-center py-24 gap-4">
		<p class="text-lg font-semibold text-foreground">Series not found</p>
		<p class="text-sm text-muted-foreground">No series with ID <code class="font-mono">{id}</code> exists.</p>
		<a href="/gallery" class="text-sm text-primary hover:underline">Back to Gallery</a>
	</div>
{:else}
	<a
		href="/gallery"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
	>
		<Icon icon="lucide:arrow-left" width={14} />
		Back to Gallery
	</a>

	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
		<div class="flex-1 min-w-0">
			<h1 class="text-xl font-bold text-foreground">{config.title}</h1>
			<p class="text-sm text-muted-foreground mt-1">{config.subtitle}</p>
			{#if config.series.tags.length > 0}
				<div class="flex flex-wrap gap-1.5 mt-3">
					{#each config.series.tags as tag (tag)}
						<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="shrink-0 text-right">
			<p class="text-3xl font-mono font-bold text-foreground">
				{formatValue(latestValue)}
			</p>
			<p class="text-sm text-muted-foreground mt-0.5">{config.series.units_short}</p>
			{#if latestDate}
				<p class="text-xs text-muted-foreground/70 mt-0.5">{formatDate(latestDate)}</p>
			{/if}
		</div>
	</div>

	<div class="bg-card rounded-xl border border-border p-4 mt-6">
		<ChartWrapper {config} height={450} />
	</div>

	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Frequency</p>
			<p class="text-sm font-medium text-foreground mt-1">{config.series.frequency}</p>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Seasonal Adj.</p>
			<p class="text-sm font-medium text-foreground mt-1">{config.series.seasonal_adjustment_short}</p>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Date Range</p>
			<p class="text-sm font-medium text-foreground mt-1">
				{formatDate(config.series.observation_start)} — {formatDate(config.series.observation_end)}
			</p>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Observations</p>
			<p class="text-sm font-medium text-foreground mt-1">{formatCount(config.series.observation_count)}</p>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Units</p>
			<p class="text-sm font-medium text-foreground mt-1">{config.series.units}</p>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Popularity</p>
			<div class="flex items-center gap-2 mt-1">
				<div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
					<div
						class="h-full rounded-full bg-primary"
						style="width: {config.series.popularity}%"
					></div>
				</div>
				<span class="text-sm font-medium text-foreground tabular-nums">{config.series.popularity}</span>
			</div>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Last Updated</p>
			<p class="text-sm font-medium text-foreground mt-1">
				{new Date(config.series.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
			</p>
		</div>

		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Source</p>
			<p class="text-sm font-medium text-foreground mt-1">
				{config.series.release_ids.length > 0 ? `Release ${config.series.release_ids[0]}` : 'FRED'}
			</p>
		</div>
	</div>
{/if}
