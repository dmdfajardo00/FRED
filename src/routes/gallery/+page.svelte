<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { searchSeries, listSeries, fetchStats, fetchObservations, type SeriesSummary } from '$lib/api';
	import SeriesCard from '$lib/components/gallery/SeriesCard.svelte';
	import Sparkline from '$lib/components/gallery/Sparkline.svelte';
	import FilterSidebar, { type GalleryFilters } from '$lib/components/gallery/FilterSidebar.svelte';
	import InfiniteScroll from '$lib/components/shared/InfiniteScroll.svelte';
	import { pinned, togglePin } from '$lib/stores/pinned';
	import { formatValue, formatLongDate } from '$lib/utils/format';
	import { colorForSeries } from '$lib/utils/seriesColor';

	const PAGE_SIZE = 24;
	const SPARK_YEARS = 5;

	// URL state
	const urlQuery = $derived($page.url.searchParams.get('q') ?? '');
	const urlCategory = $derived($page.url.searchParams.get('category') ?? '');
	const urlFrequency = $derived($page.url.searchParams.get('frequency') ?? '');
	const urlSort = $derived(($page.url.searchParams.get('sort') as 'popularity'|'alpha'|'obs'|'recent') ?? 'popularity');
	const urlView = $derived(($page.url.searchParams.get('view') as 'gallery'|'table') ?? 'gallery');
	const urlPop = $derived(parseInt($page.url.searchParams.get('popMin') ?? '0') || 0);

	let filters = $state<GalleryFilters>({
		frequency: urlFrequency ? urlFrequency.split(',') : [],
		category: urlCategory ? urlCategory.split(',') : [],
		popMin: urlPop
	});

	let query = $state(urlQuery);

	let results = $state<SeriesSummary[]>([]);
	let sparklines = $state<Record<string, (number | null)[]>>({});
	let offset = $state(0);
	let hasMore = $state(true);
	let loading = $state(false);
	let stats = $state<Record<string, number> | null>(null);

	const seenIds = new Set<string>();

	function dedupe(incoming: SeriesSummary[]): SeriesSummary[] {
		const out: SeriesSummary[] = [];
		for (const s of incoming) {
			if (!seenIds.has(s.id)) { seenIds.add(s.id); out.push(s); }
		}
		return out;
	}

	function writeUrl() {
		const params = new URLSearchParams();
		if (query) params.set('q', query);
		if (filters.frequency.length) params.set('frequency', filters.frequency.join(','));
		if (filters.category.length) params.set('category', filters.category.join(','));
		if (filters.popMin > 0) params.set('popMin', String(filters.popMin));
		if (urlSort !== 'popularity') params.set('sort', urlSort);
		if (urlView !== 'gallery') params.set('view', urlView);
		const qs = params.toString();
		goto(`/gallery${qs ? '?' + qs : ''}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function loadSparklines(series: SeriesSummary[]) {
		const ids = series.map((s) => s.id).filter((id) => !sparklines[id]);
		if (ids.length === 0) return;
		const start = new Date();
		start.setFullYear(start.getFullYear() - SPARK_YEARS);
		try {
			const data = await fetchObservations(ids, start.toISOString().slice(0, 10));
			sparklines = {
				...sparklines,
				...Object.fromEntries(Object.entries(data).map(([id, obs]) => [id, obs.values]))
			};
		} catch {}
	}

	async function loadPage() {
		loading = true;
		try {
			const isSearching = query.trim().length > 0;
			const params = {
				limit: PAGE_SIZE,
				offset,
				sort: urlSort,
				category: filters.category[0] || undefined,
				frequency: filters.frequency[0] || undefined,
				popMin: filters.popMin || undefined
			};
			const raw = isSearching
				? await searchSeries({ q: query, ...params })
				: await listSeries(params);
			const fresh = dedupe(raw);
			results = [...results, ...fresh];
			hasMore = raw.length >= PAGE_SIZE;
			loadSparklines(fresh);
		} catch {
			hasMore = false;
		}
		loading = false;
	}

	let lastKey = '';
	$effect(() => {
		const key = `${query}|${filters.frequency.join(',')}|${filters.category.join(',')}|${filters.popMin}|${urlSort}`;
		if (key !== lastKey) {
			lastKey = key;
			results = [];
			sparklines = {};
			offset = 0;
			hasMore = true;
			seenIds.clear();
			writeUrl();
			loadPage();
		}
	});

	$effect(() => {
		fetchStats().then((s) => { stats = s; }).catch(() => {});
	});

	function handleSearchInput(v: string) { query = v; }
	function loadMore() { if (loading || !hasMore) return; offset += PAGE_SIZE; loadPage(); }
	function setSort(s: 'popularity'|'alpha'|'obs'|'recent') {
		const p = new URLSearchParams($page.url.searchParams);
		if (s === 'popularity') p.delete('sort'); else p.set('sort', s);
		goto(`/gallery${p.toString() ? '?' + p : ''}`, { replaceState: true });
	}
	function setView(v: 'gallery'|'table') {
		const p = new URLSearchParams($page.url.searchParams);
		if (v === 'gallery') p.delete('view'); else p.set('view', v);
		goto(`/gallery${p.toString() ? '?' + p : ''}`, { replaceState: true });
	}
	function onClearFilters() { filters = { frequency: [], category: [], popMin: 0 }; }

	function formatCount(n: number): string {
		if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M';
		if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
		return n.toLocaleString();
	}
</script>

<div class="min-h-screen" style:padding-left="240px">
	<FilterSidebar bind:filters onClear={onClearFilters} />

	<main class="px-10 py-7 pb-[60px] max-w-[1360px] mx-auto">
		<div class="flex items-baseline justify-between mb-1">
			<div>
				<h1 class="text-[26px] font-medium tracking-[-0.01em] m-0" style:color="var(--ink-0)">Command Center</h1>
				<div class="text-[13px] mt-1" style:color="var(--ink-3)">
					{#if stats}
						<span class="font-mono">{formatCount(stats.observations)}</span> observations across
						<span class="font-mono">{formatCount(stats.series)}</span> economic series
					{:else}
						Federal Reserve Economic Data
					{/if}
				</div>
			</div>
			<div class="flex gap-[6px]">
				<button type="button" class="pill" class:active={urlView === 'gallery'} onclick={() => setView('gallery')}>
					<svg width="11" height="11" viewBox="0 0 11 11"><rect x="0.5" y="0.5" width="4" height="4" fill="none" stroke="currentColor"/><rect x="6.5" y="0.5" width="4" height="4" fill="none" stroke="currentColor"/><rect x="0.5" y="6.5" width="4" height="4" fill="none" stroke="currentColor"/><rect x="6.5" y="6.5" width="4" height="4" fill="none" stroke="currentColor"/></svg>
					Gallery
				</button>
				<button type="button" class="pill" class:active={urlView === 'table'} onclick={() => setView('table')}>
					<svg width="11" height="11" viewBox="0 0 11 11"><line x1="0.5" y1="2.5" x2="10.5" y2="2.5" stroke="currentColor"/><line x1="0.5" y1="5.5" x2="10.5" y2="5.5" stroke="currentColor"/><line x1="0.5" y1="8.5" x2="10.5" y2="8.5" stroke="currentColor"/></svg>
					Table
				</button>
			</div>
		</div>

		<div class="flex gap-3 mt-6 mb-6 items-center">
			<div class="flex-1 flex items-center h-[34px] px-[10px] rounded-[5px]" style:background="var(--bg)" style:border="1px solid var(--border)">
				<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--ink-3)" stroke-width="1.4">
					<circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" stroke-linecap="round" />
				</svg>
				<input
					value={query}
					oninput={(e) => handleSearchInput((e.currentTarget as HTMLInputElement).value)}
					placeholder="Search 840K series — press ⌘K for command menu"
					class="border-0 outline-none bg-transparent px-[10px] flex-1 text-[13px]"
					style:color="var(--ink-1)"
				/>
				<span class="font-mono text-[10px] px-[6px] py-[1px] rounded-[3px]"
					style:color="var(--ink-4)" style:border="1px solid var(--border)">⌘K</span>
			</div>

			<select
				value={urlSort}
				onchange={(e) => setSort((e.currentTarget as HTMLSelectElement).value as any)}
				class="h-[34px] px-[10px] text-[12px] rounded-[5px] cursor-pointer"
				style:background="var(--bg)"
				style:color="var(--ink-1)"
				style:border="1px solid var(--border)"
			>
				<option value="popularity">Sort: Popularity</option>
				<option value="obs">Sort: Observations</option>
				<option value="recent">Sort: Most Recent</option>
				<option value="alpha">Sort: Alphabetical</option>
			</select>
		</div>

		<div class="flex justify-between font-mono text-[11px] tracking-[0.05em] uppercase mb-[14px]" style:color="var(--ink-3)">
			<span>
				{#if loading && results.length === 0}
					Loading…
				{:else}
					{results.length} series shown
				{/if}
			</span>
			{#if $pinned.length > 0}<span>{$pinned.length} pinned</span>{/if}
		</div>

		{#if urlView === 'gallery'}
			<div class="grid gap-[10px]" style:grid-template-columns="repeat(auto-fill, minmax(260px, 1fr))">
				{#each results as s (s.id)}
					<SeriesCard series={s} sparkData={sparklines[s.id]} />
				{/each}
			</div>

			{#if loading && results.length === 0}
				<div class="grid gap-[10px]" style:grid-template-columns="repeat(auto-fill, minmax(260px, 1fr))">
					{#each Array(8) as _}
						<div class="rounded-[6px] h-[180px] animate-pulse" style:background="var(--bg-soft)" style:border="1px solid var(--border)"></div>
					{/each}
				</div>
			{/if}

			<InfiniteScroll {hasMore} {loading} onloadmore={loadMore} />
		{:else}
			<div class="rounded-[6px] overflow-hidden" style:background="var(--bg)" style:border="1px solid var(--border)">
				<div class="grid gap-0 px-[14px] py-[10px] font-mono text-[11px] tracking-[0.04em] uppercase border-b"
					style:grid-template-columns="28px 120px 1fr 180px 90px 90px 90px"
					style:background="var(--bg-soft)"
					style:color="var(--ink-3)"
					style:border-color="var(--border)"
				>
					<span></span><span>ID</span><span>Title</span><span>Trend</span><span>Latest</span><span>Δ%</span><span class="text-right">Freq · Obs</span>
				</div>
				{#each results as s, i (s.id)}
					{@const spark = sparklines[s.id]}
					{@const latest = spark ? [...spark].reverse().find((v) => v != null) ?? null : null}
					{@const prev = spark ? (() => { let seen = 0; for (let j = spark.length - 1; j >= 0; j--) { if (spark[j] != null) { seen++; if (seen === 2) return spark[j] as number; } } return null; })() : null}
					{@const delta = latest != null && prev != null && prev !== 0 ? ((latest as number - prev) / prev) * 100 : null}
					<a
						href="/charts/{encodeURIComponent(s.id)}"
						class="grid gap-0 items-center px-[14px] py-[10px] text-[13px] cursor-pointer no-underline"
						style:grid-template-columns="28px 120px 1fr 180px 90px 90px 90px"
						style:border-bottom={i === results.length - 1 ? 'none' : '1px solid var(--border-faint)'}
						onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--bg-soft)'}
						onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
					>
						<button
							type="button"
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(s.id); }}
							class="bg-transparent border-0 cursor-pointer"
							style:color={$pinned.includes(s.id) ? 'var(--accent)' : 'var(--ink-4)'}
							aria-label="Pin"
						>
							<svg width="11" height="11" viewBox="0 0 11 11" fill={$pinned.includes(s.id) ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.2">
								<path d="M5.5,0.5 L7,3.5 L10,4 L7.75,6 L8.5,9 L5.5,7.5 L2.5,9 L3.25,6 L1,4 L4,3.5 Z" />
							</svg>
						</button>
						<span class="font-mono text-[11px]" style:color="var(--ink-2)">{s.id}</span>
						<span class="truncate pr-[14px]" style:color="var(--ink-1)">{s.title}</span>
						<div class="h-[28px]">
							{#if spark}
								<Sparkline values={spark} color={colorForSeries(s.id)} width={170} height={28} />
							{:else}
								<div class="w-full h-full rounded animate-pulse" style:background="var(--bg-soft)"></div>
							{/if}
						</div>
						<span class="font-mono text-[12px]" style:color="var(--ink-1)">{latest != null ? formatValue(latest as number) : '—'}</span>
						<span class="font-mono text-[12px]" style:color={delta == null ? 'var(--ink-3)' : delta >= 0 ? 'var(--pos)' : 'var(--neg)'}>
							{#if delta != null}{delta >= 0 ? '+' : ''}{delta.toFixed(2)}%{:else}—{/if}
						</span>
						<span class="font-mono text-[11px] text-right" style:color="var(--ink-3)">{s.frequency_short} · {s.observation_count >= 1000 ? (s.observation_count/1000).toFixed(1)+'K' : s.observation_count}</span>
					</a>
				{/each}
			</div>
			<InfiniteScroll {hasMore} {loading} onloadmore={loadMore} />
		{/if}
	</main>
</div>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 11px;
		font-size: 12px;
		background: var(--bg);
		color: var(--ink-2);
		border: 1px solid var(--border);
		border-radius: 5px;
		cursor: pointer;
	}
	.pill.active {
		background: var(--ink-0);
		color: var(--bg);
		border-color: var(--ink-0);
	}
</style>
