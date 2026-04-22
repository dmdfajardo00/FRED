<script lang="ts">
	import { listReleases, getRelease, type ReleaseSummary, type SeriesSummary } from '$lib/api';
	import { goto } from '$app/navigation';
	import { formatValue } from '$lib/utils/format';

	let releases = $state<ReleaseSummary[]>([]);
	let loading = $state(true);
	let selected = $state<ReleaseSummary | null>(null);
	let selectedSeries = $state<SeriesSummary[]>([]);
	let detailLoading = $state(false);
	let search = $state('');

	$effect(() => {
		loading = true;
		listReleases()
			.then((r) => { releases = r; })
			.catch(() => { releases = []; })
			.finally(() => { loading = false; });
	});

	function selectRelease(r: ReleaseSummary) {
		selected = r;
		detailLoading = true;
		selectedSeries = [];
		getRelease(r.id, 30)
			.then((d) => { selectedSeries = d.series; })
			.catch(() => { selectedSeries = []; })
			.finally(() => { detailLoading = false; });
	}

	const filtered = $derived.by(() => {
		if (!search.trim()) return releases;
		const q = search.toLowerCase();
		return releases.filter((r) => r.name.toLowerCase().includes(q));
	});

	const pressReleaseCount = $derived(releases.filter((r) => r.press_release).length);

	const statItems = $derived<[string, string | number][]>([
		['Total releases', releases.length],
		['With press releases', pressReleaseCount],
		['Categories', 'FRED-indexed'],
		['Selected', selected ? selected.name : '—']
	]);
</script>

<div class="max-w-[1280px] mx-auto px-10 py-7 pb-[60px]">
	<div class="flex items-baseline justify-between mb-1">
		<div>
			<h1 class="text-[26px] font-medium tracking-[-0.01em] m-0" style:color="var(--ink-0)">Releases</h1>
			<div class="text-[13px] mt-1" style:color="var(--ink-3)">Publication schedules, source agencies, and source-indexed series</div>
		</div>
		<div class="flex items-center gap-2 text-[12px]" style:color="var(--ink-3)">
			<span class="w-[6px] h-[6px] rounded-full" style:background="var(--pos)"></span>
			<span>{releases.length} releases indexed</span>
		</div>
	</div>

	<!-- stat strip -->
	<div class="grid grid-cols-4 gap-0 border-y my-6" style:border-color="var(--border-faint)">
		{#each statItems as [label, val], i}
			<div class="py-4 pr-5 truncate" style:padding-left={i === 0 ? '0' : '20px'} style:border-left={i === 0 ? 'none' : '1px solid var(--border-faint)'}>
				<div class="font-mono text-[10px] tracking-[0.06em] uppercase mb-[6px]" style:color="var(--ink-3)">{label}</div>
				<div class="font-mono text-[18px] font-medium truncate" style:color="var(--ink-0)">{val}</div>
			</div>
		{/each}
	</div>

	<div class="grid gap-8" style:grid-template-columns="360px 1fr">
		<!-- releases list -->
		<div>
			<div class="flex items-center h-[34px] px-[10px] rounded-[5px] mb-4" style:background="var(--bg)" style:border="1px solid var(--border)">
				<svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--ink-3)" stroke-width="1.4">
					<circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" stroke-linecap="round" />
				</svg>
				<input bind:value={search} placeholder="Filter releases…" class="border-0 outline-none bg-transparent px-[10px] flex-1 text-[13px]" style:color="var(--ink-1)" />
			</div>

			<div class="rounded-[6px] overflow-hidden" style:background="var(--bg)" style:border="1px solid var(--border)" style:max-height="72vh">
				<div class="overflow-auto" style:max-height="72vh">
					{#if loading}
						<div class="py-12 text-center text-[12px]" style:color="var(--ink-3)">Loading releases…</div>
					{:else}
						{#each filtered as r, i (r.id)}
							<button type="button" onclick={() => selectRelease(r)}
								class="grid w-full gap-3 items-center px-[14px] py-[12px] text-[13px] text-left cursor-pointer bg-transparent"
								style:grid-template-columns="50px 1fr auto"
								style:border-bottom={i === filtered.length - 1 ? 'none' : '1px solid var(--border-faint)'}
								style:background={selected?.id === r.id ? 'var(--bg-soft)' : 'transparent'}
							>
								<span class="font-mono text-[10px]" style:color="var(--ink-3)">#{r.id}</span>
								<span style:color="var(--ink-1)" class="truncate">{r.name}</span>
								{#if r.press_release}
									<span class="font-mono text-[9px] px-[5px] py-[1px] rounded-[3px]" style:color="var(--accent)" style:border="1px solid currentColor">PR</span>
								{/if}
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>

		<!-- detail -->
		<div>
			{#if !selected}
				<div class="rounded-[6px] py-20 text-center" style:background="var(--bg-soft)" style:border="1px dashed var(--border)">
					<div class="font-mono text-[11px] tracking-[0.05em] uppercase mb-2" style:color="var(--ink-3)">Select a release</div>
					<div class="text-[13px]" style:color="var(--ink-2)">Choose a release on the left to view its indexed series.</div>
				</div>
			{:else}
				<div class="relative rounded-[8px] p-6 mb-6 overflow-hidden"
					style:background="var(--bg)" style:border="1px solid var(--border)">
					<div class="absolute top-0 left-0 h-full w-[3px]" style:background="var(--accent)"></div>
					<div class="font-mono text-[10px] tracking-[0.08em] uppercase mb-2" style:color="var(--ink-3)">Release · #{selected.id}</div>
					<h2 class="text-[22px] font-medium tracking-[-0.01em] m-0 mb-2" style:color="var(--ink-0)">{selected.name}</h2>
					{#if selected.notes}
						<div class="text-[13px] leading-[1.55] max-w-[720px]" style:color="var(--ink-2)">{selected.notes}</div>
					{/if}
					{#if selected.link}
						<a href={selected.link} target="_blank" rel="noopener"
							class="inline-flex items-center gap-1 mt-3 font-mono text-[11px] no-underline"
							style:color="var(--accent)">
							SOURCE ↗
						</a>
					{/if}
				</div>

				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">
					Series in this release
				</div>

				{#if detailLoading}
					<div class="py-10 text-center text-[12px]" style:color="var(--ink-3)">Loading series…</div>
				{:else if selectedSeries.length === 0}
					<div class="py-10 text-center text-[12px]" style:color="var(--ink-3)">No indexed series in this release.</div>
				{:else}
					<div class="rounded-[6px] overflow-hidden" style:background="var(--bg)" style:border="1px solid var(--border)">
						<div class="grid gap-0 items-center px-[14px] py-[10px] font-mono text-[10px] tracking-[0.06em] uppercase border-b"
							style:grid-template-columns="110px 1fr 80px 90px 80px"
							style:background="var(--bg-soft)"
							style:color="var(--ink-3)"
							style:border-color="var(--border)">
							<span>ID</span><span>Title</span><span>Freq</span><span>Popularity</span><span class="text-right">Obs</span>
						</div>
						{#each selectedSeries as s, i (s.id)}
							<a href="/charts/{encodeURIComponent(s.id)}"
								class="grid gap-0 items-center px-[14px] py-[10px] text-[13px] no-underline cursor-pointer"
								style:grid-template-columns="110px 1fr 80px 90px 80px"
								style:border-bottom={i === selectedSeries.length - 1 ? 'none' : '1px solid var(--border-faint)'}
								onmouseenter={(e) => (e.currentTarget as HTMLElement).style.background = 'var(--bg-soft)'}
								onmouseleave={(e) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
							>
								<span class="font-mono text-[11px]" style:color="var(--ink-2)">{s.id}</span>
								<span class="truncate pr-3" style:color="var(--ink-1)">{s.title}</span>
								<span class="font-mono text-[11px]" style:color="var(--ink-3)">{s.frequency_short}</span>
								<span class="font-mono text-[11px]" style:color="var(--ink-2)">{s.popularity}</span>
								<span class="font-mono text-[11px] text-right" style:color="var(--ink-3)">{s.observation_count >= 1000 ? (s.observation_count/1000).toFixed(1)+'K' : s.observation_count}</span>
							</a>
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
