<script lang="ts">
	import { searchSeries, listSeries, fetchStats, type SeriesSummary } from '$lib/api';
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

	$effect(() => {
		fetchStats().then((s) => { stats = s; }).catch(() => {});
	});

	// Load initial popular series
	let initialized = $state(false);
	$effect(() => {
		if (!initialized) {
			initialized = true;
			loading = true;
			listSeries(0, PAGE_SIZE)
				.then((s) => { results = s; hasMore = s.length >= PAGE_SIZE; })
				.catch(() => {})
				.finally(() => { loading = false; });
		}
	});

	async function handleSearch(q: string) {
		query = q;
		offset = 0;
		hasMore = true;

		if (q.length < 2) {
			searching = false;
			loading = true;
			listSeries(0, PAGE_SIZE)
				.then((s) => { results = s; hasMore = s.length >= PAGE_SIZE; })
				.catch(() => { results = []; })
				.finally(() => { loading = false; });
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
			const more = isSearching
				? await searchSeries(query, PAGE_SIZE)
				: await listSeries(offset, PAGE_SIZE);
			results = [...results, ...more];
			hasMore = more.length >= PAGE_SIZE;
		} catch {
			hasMore = false;
		}
		loading = false;
	}

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
			Federal Reserve Economic Data
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

{#if isSearching}
	<div class="flex items-center gap-2 mb-3">
		<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wider">
			Results for "{query}"
		</h2>
		{#if searching}
			<div class="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
		{/if}
	</div>
{:else}
	<h2 class="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Popular Series</h2>
{/if}

{#if results.length > 0}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
		{#each results as series (series.id)}
			<SeriesCard {series} />
		{/each}
	</div>
	<InfiniteScroll {hasMore} {loading} onloadmore={loadMore} />
{:else if !loading && !searching}
	<div class="text-center py-12">
		{#if isSearching}
			<Icon icon="material-symbols:search-off" width={40} class="text-muted-foreground/30 mx-auto" />
			<p class="text-sm text-muted-foreground mt-2">No series found for "{query}"</p>
		{:else}
			<div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto"></div>
			<p class="text-sm text-muted-foreground mt-2">Loading series...</p>
		{/if}
	</div>
{:else if loading && results.length === 0}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
		{#each Array(8) as _}
			<div class="rounded-xl bg-card border border-border h-[120px] animate-pulse"></div>
		{/each}
	</div>
{/if}
