<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { searchSeries, listSeries, fetchStats, fetchObservations, type SeriesSummary } from '$lib/api';
	import SeriesCard from '$lib/components/gallery/SeriesCard.svelte';
	import SearchInput from '$lib/components/shared/SearchInput.svelte';
	import InfiniteScroll from '$lib/components/shared/InfiniteScroll.svelte';
	import Icon from '@iconify/svelte';

	const PAGE_SIZE = 24;
	const SPARK_YEARS = 5;

	// URL-driven state
	const urlQuery = $derived($page.url.searchParams.get('q') ?? '');
	const urlCategory = $derived($page.url.searchParams.get('category') ?? '');
	const urlTag = $derived($page.url.searchParams.get('tag') ?? '');
	const urlFrequency = $derived($page.url.searchParams.get('frequency') ?? '');

	let results = $state<SeriesSummary[]>([]);
	let sparklines = $state<Record<string, (number | null)[]>>({});
	let offset = $state(0);
	let hasMore = $state(true);
	let loading = $state(false);
	let stats = $state<Record<string, number> | null>(null);

	const isSearching = $derived(urlQuery.length >= 1);
	const seenIds = new Set<string>();

	function dedupe(incoming: SeriesSummary[]): SeriesSummary[] {
		const fresh: SeriesSummary[] = [];
		for (const s of incoming) {
			if (!seenIds.has(s.id)) {
				seenIds.add(s.id);
				fresh.push(s);
			}
		}
		return fresh;
	}

	function updateUrl(q: string) {
		const params = new URLSearchParams();
		if (q) params.set('q', q);
		if (urlCategory) params.set('category', urlCategory);
		if (urlTag) params.set('tag', urlTag);
		if (urlFrequency) params.set('frequency', urlFrequency);
		const qs = params.toString();
		goto(`/gallery${qs ? '?' + qs : ''}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function loadSparklines(series: SeriesSummary[]) {
		const ids = series.map((s) => s.id).filter((id) => !sparklines[id]);
		if (ids.length === 0) return;
		const startDate = new Date();
		startDate.setFullYear(startDate.getFullYear() - SPARK_YEARS);
		try {
			const data = await fetchObservations(ids, startDate.toISOString().slice(0, 10));
			sparklines = { ...sparklines, ...Object.fromEntries(Object.entries(data).map(([id, obs]) => [id, obs.values])) };
		} catch {}
	}

	async function loadPage() {
		loading = true;
		try {
			const raw = isSearching
				? await searchSeries({ q: urlQuery, limit: PAGE_SIZE, offset, category: urlCategory || undefined, tag: urlTag || undefined, frequency: urlFrequency || undefined })
				: await listSeries(offset, PAGE_SIZE);
			const fresh = dedupe(raw);
			results = [...results, ...fresh];
			hasMore = raw.length >= PAGE_SIZE;
			loadSparklines(fresh);
		} catch {
			hasMore = false;
		}
		loading = false;
	}

	// React to URL changes
	let lastKey = '';
	$effect(() => {
		const key = `${urlQuery}|${urlCategory}|${urlTag}|${urlFrequency}`;
		if (key !== lastKey) {
			lastKey = key;
			results = [];
			sparklines = {};
			offset = 0;
			hasMore = true;
			seenIds.clear();
			loadPage();
		}
	});

	$effect(() => { fetchStats().then((s) => { stats = s; }).catch(() => {}); });

	function handleSearch(q: string) { updateUrl(q); }

	function loadMore() {
		if (loading || !hasMore) return;
		offset += PAGE_SIZE;
		loadPage();
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
		value={urlQuery}
		placeholder="Search 840K series... (e.g. unemployment, CPI, UNRATE)"
		onsearch={handleSearch}
	/>
</div>

{#if urlTag || urlCategory || urlFrequency}
	<div class="flex flex-wrap gap-1.5 mb-4">
		{#if urlCategory}
			<span class="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
				Category: {urlCategory}
				<button onclick={() => { const p = new URLSearchParams($page.url.searchParams); p.delete('category'); goto(`/gallery?${p}`, { replaceState: true }); }} class="hover:text-foreground">&times;</button>
			</span>
		{/if}
		{#if urlTag}
			<span class="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
				Tag: {urlTag}
				<button onclick={() => { const p = new URLSearchParams($page.url.searchParams); p.delete('tag'); goto(`/gallery?${p}`, { replaceState: true }); }} class="hover:text-foreground">&times;</button>
			</span>
		{/if}
		{#if urlFrequency}
			<span class="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs flex items-center gap-1">
				Frequency: {urlFrequency}
				<button onclick={() => { const p = new URLSearchParams($page.url.searchParams); p.delete('frequency'); goto(`/gallery?${p}`, { replaceState: true }); }} class="hover:text-foreground">&times;</button>
			</span>
		{/if}
	</div>
{/if}

<h2 class="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
	{#if isSearching}
		Results for "{urlQuery}"
	{:else}
		Popular Series
	{/if}
</h2>

{#if results.length > 0}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
		{#each results as series, i (series.id)}
			<SeriesCard {series} sparkData={sparklines[series.id]} index={i} />
		{/each}
	</div>
	<InfiniteScroll {hasMore} {loading} onloadmore={loadMore} />
{:else if loading}
	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
		{#each Array(8) as _}
			<div class="rounded-xl bg-card border border-border h-[160px] animate-pulse"></div>
		{/each}
	</div>
{:else}
	<div class="text-center py-12">
		<Icon icon="material-symbols:search-off" width={40} class="text-muted-foreground/30 mx-auto" />
		<p class="text-sm text-muted-foreground mt-2">No series found for "{urlQuery}"</p>
	</div>
{/if}
