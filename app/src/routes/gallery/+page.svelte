<script lang="ts">
	import { CHART_CONFIGS } from '$lib/mock/fred-data';
	import { searchSeries, listSeries, fetchStats, type SeriesSummary } from '$lib/api';
	import ChartCard from '$lib/components/gallery/ChartCard.svelte';
	import SeriesCard from '$lib/components/gallery/SeriesCard.svelte';
	import SearchInput from '$lib/components/shared/SearchInput.svelte';
	import InfiniteScroll from '$lib/components/shared/InfiniteScroll.svelte';
	import Icon from '@iconify/svelte';

	const PAGE_SIZE = 24;

	let query = $state('');
	let results = $state<SeriesSummary[]>([]);
	let offset = $state(0);
	let hasMore = $state(true);
	let loading = $state(false);
	let searching = $state(false);
	let stats = $state<Record<string, number> | null>(null);

	const isSearching = $derived(query.length >= 2);

	// Fetch stats on mount
	$effect(() => {
		fetchStats()
			.then((s) => { stats = s; })
			.catch(() => {});
	});

	async function handleSearch(q: string) {
		query = q;
		offset = 0;
		hasMore = true;

		if (q.length < 2) {
			results = [];
			searching = false;
			return;
		}

		searching = true;
		loading = true;
		try {
			results = await searchSeries(q, PAGE_SIZE);
			hasMore = results.length >= PAGE_SIZE;
		} catch {
			results = [];
			hasMore = false;
		}
		loading = false;
		searching = false;
	}

	async function loadMore() {
		if (loading || !hasMore) return;
		loading = true;
		offset += PAGE_SIZE;

		try {
			let more: SeriesSummary[];
			if (isSearching) {
				more = await searchSeries(query, PAGE_SIZE);
			} else {
				more = await listSeries(offset, PAGE_SIZE);
			}
			results = [...results, ...more];
			hasMore = more.length >= PAGE_SIZE;
		} catch {
			hasMore = false;
		}
		loading = false;
	}

	// Load initial browse results
	let browseLoaded = $state(false);
	$effect(() => {
		if (!browseLoaded && !isSearching) {
			browseLoaded = true;
			loading = true;
			listSeries(0, PAGE_SIZE)
				.then((s) => {
					results = s;
					hasMore = s.length >= PAGE_SIZE;
				})
				.catch(() => {})
				.finally(() => { loading = false; });
		}
	});

	function formatStat(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
		return n.toLocaleString();
	}

	const statPills: { icon: string; key: string; label: string }[] = [
		{ icon: 'lucide:database', key: 'series', label: 'Series' },
		{ icon: 'lucide:bar-chart-2', key: 'observations', label: 'Observations' },
		{ icon: 'lucide:layers', key: 'releases', label: 'Releases' },
		{ icon: 'lucide:folder', key: 'categories', label: 'Categories' }
	];
</script>

<div class="mb-6">
	<h1 class="text-2xl font-bold text-foreground">FRED Explorer</h1>
	<p class="text-sm text-muted-foreground mt-1">
		{#if stats}
			{formatStat(stats.observations)} observations across {formatStat(stats.series)} economic series
		{:else}
			147M observations across 840K economic series
		{/if}
	</p>
</div>

<div class="flex flex-wrap gap-2 mb-5">
	{#each statPills as pill}
		<div class="px-3 py-1.5 rounded-lg bg-card border border-border text-xs flex items-center gap-1.5">
			<Icon icon={pill.icon} width={14} class="text-muted-foreground" />
			<span class="font-mono font-medium text-foreground">
				{stats ? formatStat(stats[pill.key] ?? 0) : '...'}
			</span>
			<span class="text-muted-foreground">{pill.label}</span>
		</div>
	{/each}
</div>

<div class="max-w-md mb-6">
	<SearchInput
		placeholder="Search 840K series... (e.g. unemployment, CPI, GDP)"
		onsearch={handleSearch}
	/>
</div>

{#if !isSearching}
	<h2 class="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Featured</h2>
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
		{#each CHART_CONFIGS as config (config.id)}
			<ChartCard {config} />
		{/each}
	</div>

	{#if results.length > 0}
		<h2 class="text-sm font-medium text-muted-foreground mb-3 mt-8 uppercase tracking-wider">Browse All</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
			{#each results as series (series.id)}
				<SeriesCard {series} />
			{/each}
		</div>
		<InfiniteScroll {hasMore} {loading} onloadmore={loadMore} />
	{/if}
{:else}
	<div class="flex items-center gap-2 mb-3">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">
			Results for "{query}"
		</h2>
		{#if searching}
			<div class="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
		{/if}
	</div>

	{#if results.length > 0}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
			{#each results as series (series.id)}
				<SeriesCard {series} />
			{/each}
		</div>
		<InfiniteScroll {hasMore} {loading} onloadmore={loadMore} />
	{:else if !loading && !searching}
		<div class="text-center py-12">
			<Icon icon="material-symbols:search-off" width={40} class="text-muted-foreground/30 mx-auto" />
			<p class="text-sm text-muted-foreground mt-2">No series found for "{query}"</p>
		</div>
	{/if}
{/if}
