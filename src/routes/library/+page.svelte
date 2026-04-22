<script lang="ts">
	import { getSeriesMetadata, fetchObservations, type SeriesMeta } from '$lib/api';
	import SeriesCard from '$lib/components/gallery/SeriesCard.svelte';
	import Sparkline from '$lib/components/gallery/Sparkline.svelte';
	import { pinned } from '$lib/stores/pinned';
	import { colorForSeries } from '$lib/utils/seriesColor';

	let section = $state<'pinned'|'collections'|'activity'>('pinned');

	let pinnedMeta = $state<SeriesMeta[]>([]);
	let pinnedSparks = $state<Record<string, (number|null)[]>>({});
	let loading = $state(true);

	$effect(() => {
		const ids = $pinned;
		if (ids.length === 0) { pinnedMeta = []; pinnedSparks = {}; loading = false; return; }
		loading = true;
		const start = new Date();
		start.setFullYear(start.getFullYear() - 5);
		Promise.all([
			getSeriesMetadata(ids),
			fetchObservations(ids, start.toISOString().slice(0, 10))
		]).then(([metas, obs]) => {
			pinnedMeta = metas;
			pinnedSparks = Object.fromEntries(Object.entries(obs).map(([id, o]) => [id, o.values]));
		}).catch(() => {
			pinnedMeta = []; pinnedSparks = {};
		}).finally(() => { loading = false; });
	});

	// Static starter collections — will become user-editable in a follow-up
	const COLLECTIONS = [
		{ id: 'macro-pulse', name: 'Macro Pulse', desc: 'Top-line indicators watched weekly', color: 'var(--accent)', ids: ['GDPC1','UNRATE','CPIAUCSL','FEDFUNDS','PAYEMS','INDPRO','PCE','SP500'] },
		{ id: 'rates-desk', name: 'Rates Desk', desc: 'Fixed income curves & spreads', color: 'var(--accent-2)', ids: ['DGS10','T10Y2Y','SOFR','MORTGAGE30US','T10YIE','FEDFUNDS'] },
		{ id: 'housing', name: 'Housing Cycle', desc: 'Prices, starts, mortgage rates', color: 'var(--accent-3)', ids: ['MSPUS','CSUSHPISA','HOUST','MORTGAGE30US','DGS10'] }
	];

	const statItems = $derived<[string, string | number, string][]>([
		['Pinned', $pinned.length, 'series'],
		['Collections', COLLECTIONS.length, 'groups'],
		['This session', pinnedMeta.length, 'loaded'],
		['Total obs', pinnedMeta.reduce((s, m) => s + (m.observation_count ?? 0), 0).toLocaleString(), 'in your picks']
	]);
</script>

<div class="max-w-[1280px] mx-auto px-10 py-7 pb-[60px]">
	<div class="flex items-baseline justify-between mb-1">
		<div>
			<h1 class="text-[26px] font-medium tracking-[-0.01em] m-0" style:color="var(--ink-0)">Library</h1>
			<div class="text-[13px] mt-1" style:color="var(--ink-3)">Your pinned series and working collections</div>
		</div>
	</div>

	<!-- stat strip -->
	<div class="grid grid-cols-4 gap-0 border-y my-6" style:border-color="var(--border-faint)">
		{#each statItems as [label, val, sub], i}
			<div class="py-4 pr-5" style:padding-left={i === 0 ? '0' : '20px'} style:border-left={i === 0 ? 'none' : '1px solid var(--border-faint)'}>
				<div class="font-mono text-[10px] tracking-[0.06em] uppercase mb-[6px]" style:color="var(--ink-3)">{label}</div>
				<div class="font-mono text-[22px] font-medium" style:color="var(--ink-0)">{val}</div>
				<div class="font-mono text-[11px] mt-[2px]" style:color="var(--ink-3)">{sub}</div>
			</div>
		{/each}
	</div>

	<!-- segmented tabs -->
	<div class="flex gap-[2px] mb-[22px] border-b" style:border-color="var(--border-faint)">
		{#each [['pinned','Pinned'], ['collections','Collections']] as [k, l]}
			<button type="button" onclick={() => (section = k as any)}
				class="h-[34px] px-[14px] text-[13px] bg-transparent border-0 cursor-pointer -mb-px"
				style:color={section === k ? 'var(--ink-0)' : 'var(--ink-3)'}
				style:font-weight={section === k ? 500 : 400}
				style:border-bottom="2px solid {section === k ? 'var(--ink-0)' : 'transparent'}">
				{l}
			</button>
		{/each}
	</div>

	{#if section === 'pinned'}
		{#if loading}
			<div class="grid gap-[10px]" style:grid-template-columns="repeat(auto-fill, minmax(260px, 1fr))">
				{#each Array(4) as _}
					<div class="rounded-[6px] h-[180px] animate-pulse" style:background="var(--bg-soft)" style:border="1px solid var(--border)"></div>
				{/each}
			</div>
		{:else if pinnedMeta.length === 0}
			<div class="py-14 text-center" style:color="var(--ink-3)">
				<div class="text-[13px] mb-1">No pinned series yet.</div>
				<div class="text-[12px]">Click the star on any series in Command Center to pin it.</div>
			</div>
		{:else}
			<div class="grid gap-[10px]" style:grid-template-columns="repeat(auto-fill, minmax(260px, 1fr))">
				{#each pinnedMeta as s (s.id)}
					<SeriesCard series={s} sparkData={pinnedSparks[s.id]} />
				{/each}
			</div>
		{/if}
	{:else if section === 'collections'}
		<div class="grid gap-[14px]" style:grid-template-columns="repeat(auto-fill, minmax(320px, 1fr))">
			{#each COLLECTIONS as c (c.id)}
				<a href="/gallery?q={encodeURIComponent(c.ids.join(' '))}" class="block rounded-[6px] p-4 relative overflow-hidden cursor-pointer no-underline"
					style:background="var(--bg)"
					style:border="1px solid var(--border)">
					<div class="absolute top-0 left-0 w-[3px] h-full" style:background={c.color}></div>
					<div class="flex items-start justify-between mb-1">
						<div class="text-[15px] font-medium tracking-[-0.005em]" style:color="var(--ink-0)">{c.name}</div>
						<span class="font-mono text-[10px] px-[6px] py-[2px] rounded-[3px]" style:color="var(--ink-3)" style:background="var(--bg-soft)">{c.ids.length}</span>
					</div>
					<div class="text-[12px] mb-[14px] leading-[1.4]" style:color="var(--ink-3)">{c.desc}</div>
					<div class="flex flex-wrap gap-[4px]">
						{#each c.ids as sid}
							<span class="font-mono text-[10px] px-[6px] py-[2px] rounded-[3px]"
								style:color="var(--ink-2)"
								style:background="var(--bg-soft)"
								style:border="1px solid var(--border-faint)">{sid}</span>
						{/each}
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
