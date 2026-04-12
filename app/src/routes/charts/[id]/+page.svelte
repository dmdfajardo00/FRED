<script lang="ts">
	import { page } from '$app/stores';
	import { getSeriesMetadata, fetchObservations } from '$lib/api';
	import ChartWrapper from '$lib/components/charts/ChartWrapper.svelte';
	import Icon from '@iconify/svelte';
	import type { ChartConfig } from '$lib/types/fred';

	const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

	const id = $derived($page.params.id);

	let seriesMeta = $state<any>(null);
	let observations = $state<{ dates: string[]; values: (number | null)[] } | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Fetch data when id changes
	$effect(() => {
		const currentId = id;
		loading = true;
		error = null;
		seriesMeta = null;
		observations = null;

		Promise.all([
			getSeriesMetadata([currentId]),
			fetchObservations([currentId])
		])
			.then(([metaList, obsMap]) => {
				if (metaList.length === 0) {
					error = `Series "${currentId}" not found`;
					return;
				}
				seriesMeta = metaList[0];
				observations = obsMap[currentId] ?? null;
			})
			.catch((e) => { error = String(e); })
			.finally(() => { loading = false; });
	});

	const chartConfig = $derived.by((): ChartConfig | undefined => {
		if (!seriesMeta || !observations) return undefined;
		return {
			id: seriesMeta.id,
			title: seriesMeta.title,
			subtitle: seriesMeta.units ?? '',
			units: seriesMeta.units_short ?? '',
			chartType: 'line',
			color: CHART_COLORS[0],
			series: {
				...seriesMeta,
				observations: observations.dates.map((d: string, i: number) => ({
					date: d,
					value: observations!.values[i]
				}))
			}
		};
	});

	const latestValue = $derived.by(() => {
		if (!observations) return null;
		for (let i = observations.values.length - 1; i >= 0; i--) {
			if (observations.values[i] != null) return observations.values[i];
		}
		return null;
	});

	const latestDate = $derived.by(() => {
		if (!observations) return null;
		for (let i = observations.dates.length - 1; i >= 0; i--) {
			if (observations.values[i] != null) return observations.dates[i];
		}
		return null;
	});

	function formatValue(v: number | null): string {
		if (v == null) return '\u2014';
		if (Math.abs(v) >= 10_000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
		if (Math.abs(v) >= 100) return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
		return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
	}

	function formatDate(d: string): string {
		return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
			year: 'numeric', month: 'short', day: 'numeric'
		});
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-24">
		<div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
	</div>
{:else if error}
	<div class="flex flex-col items-center justify-center py-24 gap-4">
		<p class="text-lg font-semibold text-foreground">Series not found</p>
		<p class="text-sm text-muted-foreground">No series with ID <code class="font-mono">{id}</code> exists.</p>
		<a href="/gallery" class="text-sm text-primary hover:underline">Back to Gallery</a>
	</div>
{:else if seriesMeta && chartConfig}
	<a
		href="/gallery"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
	>
		<Icon icon="lucide:arrow-left" width={14} />
		Back to Gallery
	</a>

	<div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
		<div class="flex-1 min-w-0">
			<h1 class="text-xl font-bold text-foreground">{seriesMeta.title}</h1>
			<p class="text-sm text-muted-foreground mt-1">{seriesMeta.units}</p>
			{#if seriesMeta.tags?.length > 0}
				<div class="flex flex-wrap gap-1.5 mt-3">
					{#each seriesMeta.tags as tag (tag)}
						<span class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{tag}</span>
					{/each}
				</div>
			{/if}
		</div>

		<div class="shrink-0 text-right">
			<p class="text-3xl font-mono font-bold text-foreground">{formatValue(latestValue)}</p>
			<p class="text-sm text-muted-foreground mt-0.5">{seriesMeta.units_short}</p>
			{#if latestDate}
				<p class="text-xs text-muted-foreground/70 mt-0.5">{formatDate(latestDate)}</p>
			{/if}
		</div>
	</div>

	<div class="bg-card rounded-xl border border-border p-4 mt-6">
		<ChartWrapper config={chartConfig} height={450} />
	</div>

	<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Frequency</p>
			<p class="text-sm font-medium text-foreground mt-1">{seriesMeta.frequency}</p>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Seasonal Adj.</p>
			<p class="text-sm font-medium text-foreground mt-1">{seriesMeta.seasonal_adjustment_short}</p>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Date Range</p>
			<p class="text-sm font-medium text-foreground mt-1">
				{formatDate(seriesMeta.observation_start)} — {formatDate(seriesMeta.observation_end)}
			</p>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Observations</p>
			<p class="text-sm font-medium text-foreground mt-1">{seriesMeta.observation_count?.toLocaleString()}</p>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Units</p>
			<p class="text-sm font-medium text-foreground mt-1">{seriesMeta.units}</p>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Popularity</p>
			<div class="flex items-center gap-2 mt-1">
				<div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
					<div class="h-full rounded-full bg-primary" style="width: {seriesMeta.popularity}%"></div>
				</div>
				<span class="text-sm font-medium text-foreground tabular-nums">{seriesMeta.popularity}</span>
			</div>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Last Updated</p>
			<p class="text-sm font-medium text-foreground mt-1">
				{new Date(seriesMeta.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
			</p>
		</div>
		<div class="bg-card rounded-lg border border-border p-4">
			<p class="text-xs text-muted-foreground uppercase tracking-wider">Series ID</p>
			<p class="text-sm font-mono font-medium text-foreground mt-1">{seriesMeta.id}</p>
		</div>
	</div>
{/if}
