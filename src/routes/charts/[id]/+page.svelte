<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { getSeriesMetadata, fetchObservations, listSeries, type SeriesMeta, type SeriesSummary } from '$lib/api';
	import ChartWrapper from '$lib/components/charts/ChartWrapper.svelte';
	import Sparkline from '$lib/components/gallery/Sparkline.svelte';
	import RichNotes from '$lib/components/shared/RichNotes.svelte';
	import type { ChartConfig } from '$lib/types/fred';
	import { pinned, togglePin } from '$lib/stores/pinned';
	import { formatValue, formatLongDate, formatFrequency } from '$lib/utils/format';
	import { colorForSeries } from '$lib/utils/seriesColor';

	const id = $derived($page.params.id ?? '');
	const isPinned = $derived($pinned.includes(id));

	let seriesMeta = $state<SeriesMeta | null>(null);
	let observations = $state<{ dates: string[]; values: (number | null)[] } | null>(null);
	let loading = $state(true);
	let errorMsg = $state<string | null>(null);

	let range = $state<'1Y'|'5Y'|'10Y'|'MAX'>('MAX');
	let compareIds = $state<string[]>([]);
	let compareOpen = $state(false);
	let compareData = $state<Record<string, { dates: string[]; values: (number|null)[] }>>({});
	let compareMeta = $state<Record<string, SeriesMeta>>({});

	let candidates = $state<SeriesSummary[]>([]);
	let related = $state<SeriesSummary[]>([]);
	let relatedSparks = $state<Record<string, (number|null)[]>>({});

	let notes = $state<{ id: number; text: string }[]>([]);
	let noteDraft = $state('');

	// Load main series data when id changes
	$effect(() => {
		const currentId = id;
		loading = true;
		errorMsg = null;
		seriesMeta = null;
		observations = null;
		compareIds = [];
		compareData = {};
		compareMeta = {};
		try {
			const raw = localStorage.getItem(`meridian.notes.${currentId}`);
			notes = raw ? JSON.parse(raw) : [];
		} catch { notes = []; }

		if (!currentId) { loading = false; errorMsg = 'Missing series id'; return; }
		Promise.all([
			getSeriesMetadata([currentId]),
			fetchObservations([currentId])
		])
			.then(([meta, obs]) => {
				if (meta.length === 0) {
					errorMsg = `Series "${currentId}" not found`;
					return;
				}
				seriesMeta = meta[0];
				observations = obs[currentId] ?? null;
			})
			.catch((e) => { errorMsg = String(e); })
			.finally(() => { loading = false; });
	});

	// Load related series from same category once meta arrives
	$effect(() => {
		const meta = seriesMeta;
		if (!meta) { related = []; relatedSparks = {}; return; }
		const cat = meta.category_ids?.[0];
		if (cat == null) { related = []; return; }
		listSeries({ category: String(cat), limit: 8, sort: 'popularity' })
			.then((rows) => {
				related = rows.filter((r) => r.id !== meta.id).slice(0, 4);
				if (related.length === 0) return;
				const end = new Date();
				const start = new Date();
				start.setFullYear(end.getFullYear() - 5);
				fetchObservations(related.map((r) => r.id), start.toISOString().slice(0, 10))
					.then((obsMap) => {
						relatedSparks = Object.fromEntries(Object.entries(obsMap).map(([rid, o]) => [rid, o.values]));
					}).catch(() => {});
			})
			.catch(() => { related = []; });

		listSeries({ limit: 20, sort: 'popularity' }).then((r) => { candidates = r.filter((c) => c.id !== meta.id); }).catch(() => {});
	});

	// Save notes per series
	$effect(() => {
		if (!seriesMeta) return;
		try { localStorage.setItem(`meridian.notes.${id}`, JSON.stringify(notes)); } catch {}
	});

	// Date slicing for range buttons
	function sliceByRange<T>(dates: string[], values: T[], r: typeof range): { dates: string[]; values: T[] } {
		if (r === 'MAX' || dates.length === 0) return { dates, values };
		const lastDate = new Date(dates[dates.length - 1] + 'T00:00:00');
		const startDate = new Date(lastDate);
		const months = r === '1Y' ? 12 : r === '5Y' ? 60 : 120;
		startDate.setMonth(startDate.getMonth() - months);
		const cutoff = startDate.getTime();
		let firstIdx = 0;
		for (let i = 0; i < dates.length; i++) {
			if (new Date(dates[i] + 'T00:00:00').getTime() >= cutoff) { firstIdx = i; break; }
		}
		return { dates: dates.slice(firstIdx), values: values.slice(firstIdx) };
	}

	const mainSliced = $derived.by(() => {
		if (!observations) return null;
		return sliceByRange(observations.dates, observations.values, range);
	});

	// Fetch compare data when user toggles compare ids
	$effect(() => {
		const current = new Set(Object.keys(compareData));
		const want = compareIds;
		const missing = want.filter((cid) => !current.has(cid));
		const extra = Array.from(current).filter((cid) => !want.includes(cid));
		if (extra.length) {
			const copy = { ...compareData };
			extra.forEach((cid) => delete copy[cid]);
			compareData = copy;
			const metaCopy = { ...compareMeta };
			extra.forEach((cid) => delete metaCopy[cid]);
			compareMeta = metaCopy;
		}
		if (missing.length) {
			fetchObservations(missing).then((obs) => { compareData = { ...compareData, ...obs }; }).catch(() => {});
			getSeriesMetadata(missing).then((metas) => {
				compareMeta = { ...compareMeta, ...Object.fromEntries(metas.map((m) => [m.id, m])) };
			}).catch(() => {});
		}
	});

	// Build chart configs
	const chartConfigs = $derived.by((): ChartConfig[] => {
		if (!seriesMeta || !mainSliced) return [];
		const mainColor = colorForSeries(seriesMeta.id);
		const mainCfg = {
			id: seriesMeta.id,
			title: seriesMeta.title,
			subtitle: seriesMeta.units ?? '',
			units: seriesMeta.units_short ?? '',
			chartType: 'line' as const,
			color: mainColor,
			series: {
				...seriesMeta,
				notes: seriesMeta.notes ?? '',
				observations: mainSliced.dates.map((d, i) => ({ date: d, value: mainSliced.values[i] }))
			}
		} satisfies ChartConfig;
		const COMPARE_COLORS = ['var(--c-maroon)', 'var(--c-moss)'];
		const compareCfgs = compareIds.flatMap((cid, i) => {
			const meta = compareMeta[cid];
			const obs = compareData[cid];
			if (!meta || !obs) return [];
			const sliced = sliceByRange(obs.dates, obs.values, range);
			const cfg = {
				id: meta.id,
				title: meta.title,
				subtitle: meta.units ?? '',
				units: meta.units_short ?? '',
				chartType: 'line' as const,
				color: COMPARE_COLORS[i % COMPARE_COLORS.length],
				series: {
					...meta,
					notes: meta.notes ?? '',
					observations: sliced.dates.map((d, j) => ({ date: d, value: sliced.values[j] }))
				}
			} satisfies ChartConfig;
			return [cfg];
		});
		return [mainCfg, ...compareCfgs];
	});

	const validValues = $derived.by(() => {
		if (!mainSliced) return [] as number[];
		return mainSliced.values.filter((v): v is number => v != null);
	});

	const latest = $derived(validValues[validValues.length - 1] ?? null);
	const first = $derived(validValues[0] ?? null);
	const latestDate = $derived.by(() => {
		if (!mainSliced) return null;
		for (let i = mainSliced.dates.length - 1; i >= 0; i--) if (mainSliced.values[i] != null) return mainSliced.dates[i];
		return null;
	});
	const rangeDelta = $derived(latest != null && first != null && first !== 0 ? ((latest - first) / first) * 100 : null);
	const rangeMin = $derived(validValues.length ? Math.min(...validValues) : null);
	const rangeMax = $derived(validValues.length ? Math.max(...validValues) : null);

	function addNote() {
		if (!noteDraft.trim()) return;
		notes = [...notes, { id: Date.now(), text: noteDraft.trim() }];
		noteDraft = '';
	}
	function removeNote(nid: number) { notes = notes.filter((n) => n.id !== nid); }

	function toggleCompare(cid: string) {
		if (compareIds.includes(cid)) compareIds = compareIds.filter((x) => x !== cid);
		else if (compareIds.length < 2) compareIds = [...compareIds, cid];
	}

	const COMPARE_COLORS_DISPLAY = ['var(--c-maroon)', 'var(--c-moss)'];

	const heroItems = $derived.by(() => {
		if (!seriesMeta) return [] as Array<{ label: string; v: string; sub: string; posneg?: 'pos' | 'neg' | null }>;
		return [
			{ label: 'Latest', v: latest != null ? formatValue(latest) : '—', sub: latestDate ? formatLongDate(latestDate) : '—' },
			{ label: 'Δ Period', v: rangeDelta != null ? (rangeDelta >= 0 ? '+' : '') + rangeDelta.toFixed(2) + '%' : '—', sub: range, posneg: rangeDelta != null ? (rangeDelta >= 0 ? 'pos' as const : 'neg' as const) : null },
			{ label: 'Min · Max', v: (rangeMin != null && rangeMax != null) ? formatValue(rangeMin) + ' / ' + formatValue(rangeMax) : '—', sub: 'range' },
			{ label: 'Observations', v: (seriesMeta.observation_count ?? 0).toLocaleString(), sub: formatFrequency(seriesMeta.frequency_short) }
		];
	});

	const metadataRows = $derived.by(() => {
		if (!seriesMeta) return [] as Array<[string, string]>;
		return [
			['Frequency', formatFrequency(seriesMeta.frequency_short)],
			['Seasonal Adjustment', seriesMeta.seasonal_adjustment_short || seriesMeta.seasonal_adjustment || '—'],
			['Date Range', `${formatLongDate(seriesMeta.observation_start)} — ${formatLongDate(seriesMeta.observation_end)}`],
			['Observations', (seriesMeta.observation_count ?? 0).toLocaleString()],
			['Units', seriesMeta.units],
			['Last Updated', seriesMeta.last_updated ? formatLongDate(new Date(seriesMeta.last_updated)) : '—']
		] as Array<[string, string]>;
	});
</script>

<div class="max-w-[1280px] mx-auto px-10 pt-6 pb-20">
	{#if loading}
		<div class="flex items-center justify-center py-20">
			<div class="w-5 h-5 border-2 rounded-full animate-spin" style:border-color="var(--border)" style:border-top-color="var(--accent)"></div>
		</div>
	{:else if errorMsg}
		<div class="py-20 text-center">
			<p class="text-lg font-medium" style:color="var(--ink-0)">Series not found</p>
			<p class="text-sm mt-2" style:color="var(--ink-3)">No series with ID <code class="font-mono">{id}</code></p>
			<a href="/gallery" class="text-sm mt-4 inline-block" style:color="var(--accent)">Back to Command Center</a>
		</div>
	{:else if seriesMeta}
		<!-- breadcrumb -->
		<button type="button" onclick={() => history.back()} class="inline-flex items-center gap-[6px] bg-transparent border-0 cursor-pointer text-[12px] mb-4" style:color="var(--ink-3)">
			<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6,1 L2,5 L6,9" stroke-linecap="round" stroke-linejoin="round" /></svg>
			Command Center
		</button>

		<!-- document header -->
		<div class="pb-[22px] mb-7 border-b" style:border-color="var(--border-faint)">
			<div class="flex items-baseline gap-[10px] mb-[6px] flex-wrap">
				<span class="font-mono text-[11px] px-[7px] py-[2px] rounded-[3px] tracking-[0.04em]" style:color="var(--ink-3)" style:border="1px solid var(--border)">{seriesMeta.id}</span>
				<span class="text-[12px]" style:color="var(--ink-3)">{formatFrequency(seriesMeta.frequency_short)}</span>
				<span class="text-[12px]" style:color="var(--ink-3)">·</span>
				<span class="text-[12px]" style:color="var(--ink-3)">Updated {seriesMeta.last_updated ? formatLongDate(new Date(seriesMeta.last_updated)) : '—'}</span>

				<button type="button" onclick={() => seriesMeta && togglePin(seriesMeta.id)} class="ml-auto bg-transparent border-0 cursor-pointer inline-flex items-center gap-[6px] text-[12px]"
					style:color={isPinned ? 'var(--accent)' : 'var(--ink-3)'}>
					<svg width="11" height="11" viewBox="0 0 11 11" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.2">
						<path d="M5.5,0.5 L7,3.5 L10,4 L7.75,6 L8.5,9 L5.5,7.5 L2.5,9 L3.25,6 L1,4 L4,3.5 Z" />
					</svg>
					{isPinned ? 'Pinned' : 'Pin'}
				</button>
			</div>
			<h1 class="text-[30px] font-medium tracking-[-0.015em] m-0 leading-[1.15] max-w-[900px]" style:color="var(--ink-0)">
				{seriesMeta.title}
			</h1>
			<div class="text-[14px] mt-[6px]" style:color="var(--ink-2)">{seriesMeta.units}</div>
		</div>

		<!-- hero stats -->
		<div class="grid grid-cols-4 gap-0 border-y mb-7" style:border-color="var(--border-faint)">
			{#each heroItems as k, i}
				<div class="py-[18px]" style:padding-left={i === 0 ? '0' : '24px'} style:border-left={i === 0 ? 'none' : '1px solid var(--border-faint)'}>
					<div class="font-mono text-[10px] tracking-[0.06em] uppercase mb-2" style:color="var(--ink-3)">{k.label}</div>
					<div class="font-mono text-[22px] font-medium tracking-[-0.01em]"
						style:color={k.posneg === 'pos' ? 'var(--pos)' : k.posneg === 'neg' ? 'var(--neg)' : 'var(--ink-0)'}>
						{k.v}
					</div>
					<div class="font-mono text-[11px] mt-[2px]" style:color="var(--ink-3)">{k.sub}</div>
				</div>
			{/each}
		</div>

		<!-- chart toolbar -->
		<div class="flex items-center gap-3 mb-[14px] flex-wrap">
			<div class="inline-flex gap-[2px] p-[2px] rounded-[5px]" style:background="var(--bg-soft)" style:border="1px solid var(--border)">
				{#each [['1Y','1Y'],['5Y','5Y'],['10Y','10Y'],['MAX','Max']] as [v, l] (v)}
					<button type="button" onclick={() => (range = v as any)}
						class="h-[24px] px-[10px] text-[11px] font-mono border-0 rounded-[3px] cursor-pointer"
						style:background={range === v ? 'var(--bg)' : 'transparent'}
						style:color={range === v ? 'var(--ink-0)' : 'var(--ink-3)'}
						style:box-shadow={range === v ? '0 1px 1px rgba(0,0,0,0.04)' : 'none'}
						style:font-weight={range === v ? 500 : 400}
					>{l}</button>
				{/each}
			</div>

			<button type="button" onclick={() => (compareOpen = !compareOpen)}
				class="inline-flex items-center gap-[6px] h-[28px] px-[10px] text-[12px] rounded-[5px] cursor-pointer"
				style:background={compareIds.length > 0 ? 'color-mix(in oklch, var(--accent) 10%, var(--bg))' : 'var(--bg)'}
				style:color={compareIds.length > 0 ? 'var(--accent)' : 'var(--ink-2)'}
				style:border="1px solid {compareIds.length > 0 ? 'var(--accent)' : 'var(--border)'}"
			>
				<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1,8 L4,3 L7,6 L10,1" stroke-linejoin="round" stroke-linecap="round"/></svg>
				Compare {compareIds.length > 0 ? `· ${compareIds.length}` : ''}
			</button>

			<div class="flex-1"></div>

			<div class="font-mono text-[11px] flex gap-[14px]" style:color="var(--ink-3)">
				<span>drag-to-zoom</span><span>dbl-click reset</span>
			</div>
		</div>

		<!-- compare panel -->
		{#if compareOpen}
			<div class="rounded-[6px] p-[14px] mb-[14px]" style:background="var(--bg)" style:border="1px solid var(--border)">
				<div class="font-mono text-[11px] tracking-[0.05em] uppercase mb-[10px]" style:color="var(--ink-3)">
					Drop up to 2 series to compare
				</div>
				<div class="grid gap-[6px]" style:grid-template-columns="repeat(auto-fill, minmax(220px, 1fr))">
					{#each candidates.slice(0, 12) as c (c.id)}
						{@const active = compareIds.includes(c.id)}
						<button
							type="button"
							onclick={() => toggleCompare(c.id)}
							class="flex items-center gap-2 p-[6px_8px] rounded-[4px] cursor-pointer text-left text-[12px]"
							style:background={active ? 'color-mix(in oklch, var(--accent) 6%, var(--bg))' : 'var(--bg)'}
							style:border="1px solid {active ? 'var(--accent)' : 'var(--border-faint)'}"
							style:color="var(--ink-1)"
						>
							<span class="font-mono text-[10px] w-[70px] shrink-0" style:color="var(--ink-3)">{c.id}</span>
							<span class="flex-1 truncate">{c.title}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<!-- chart card — keeps drag-to-zoom via ChartWrapper/ChartOverlay -->
		<div class="rounded-[6px] px-2 pt-3 pb-1" style:background="var(--bg)" style:border="1px solid var(--border)">
			{#if chartConfigs.length > 0}
				<ChartWrapper configs={chartConfigs} height={420} />
			{/if}
			{#if compareIds.length > 0}
				<div class="flex gap-[14px] flex-wrap px-2 py-3 border-t" style:border-color="var(--border-faint)">
					<div class="flex items-center gap-2 text-[12px]" style:color="var(--ink-1)">
						<span class="w-2 h-2 rounded-[2px]" style:background={colorForSeries(seriesMeta.id)}></span>
						<span class="font-mono text-[11px]" style:color="var(--ink-3)">{seriesMeta.id}</span>
					</div>
					{#each compareIds as cid, i}
						{@const cmeta = compareMeta[cid]}
						<div class="flex items-center gap-2 text-[12px]" style:color="var(--ink-1)">
							<span class="w-2 h-2 rounded-[2px]" style:background={COMPARE_COLORS_DISPLAY[i % 2]}></span>
							<span class="font-mono text-[11px]" style:color="var(--ink-3)">{cid}</span>
							{#if cmeta}<span class="truncate max-w-[260px]">{cmeta.title}</span>{/if}
							<button type="button" onclick={() => toggleCompare(cid)} class="bg-transparent border-0 cursor-pointer" style:color="var(--ink-4)" aria-label="Remove">×</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- metadata + notes -->
		<div class="grid gap-10 mt-9" style:grid-template-columns="1.4fr 1fr">
			<div>
				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-[14px]" style:color="var(--ink-3)">Metadata</div>
				<div class="grid gap-y-4 gap-x-6" style:grid-template-columns="repeat(2, 1fr)">
					{#each metadataRows as [label, val]}
						<div>
							<div class="font-mono text-[10px] tracking-[0.05em] uppercase mb-1" style:color="var(--ink-3)">{label}</div>
							<div class="text-[13px]" style:color="var(--ink-1)">{val}</div>
						</div>
					{/each}
					<div>
						<div class="font-mono text-[10px] tracking-[0.05em] uppercase mb-1" style:color="var(--ink-3)">Popularity</div>
						<div class="flex items-center gap-2">
							<div class="flex-1 h-[3px] rounded overflow-hidden max-w-[100px]" style:background="var(--border)">
								<div class="h-full" style:width="{seriesMeta.popularity}%" style:background="var(--accent)"></div>
							</div>
							<span class="font-mono text-[11px]" style:color="var(--ink-3)">{seriesMeta.popularity}</span>
						</div>
					</div>
					<div>
						<div class="font-mono text-[10px] tracking-[0.05em] uppercase mb-1" style:color="var(--ink-3)">Series ID</div>
						<div class="font-mono text-[13px]" style:color="var(--ink-1)">{seriesMeta.id}</div>
					</div>
				</div>
				{#if seriesMeta.notes}
					<div class="mt-6 max-w-[760px]">
						<RichNotes text={seriesMeta.notes} collapsedMaxPx={200} />
					</div>
				{/if}
			</div>

			<div>
				<div class="flex justify-between font-mono text-[11px] tracking-[0.06em] uppercase mb-[14px]" style:color="var(--ink-3)">
					<span>Research notes</span>
					<span>{notes.length}</span>
				</div>
				<div class="flex flex-col gap-2 mb-3">
					{#each notes as n (n.id)}
						<div class="relative p-[10px_12px] rounded-[4px] text-[13px] leading-[1.5]"
							style:color="var(--ink-1)"
							style:background="var(--bg)"
							style:border="1px solid var(--border-faint)"
							style:border-left="2px solid var(--accent)">
							{n.text}
							<button type="button" onclick={() => removeNote(n.id)} class="absolute top-1 right-2 bg-transparent border-0 cursor-pointer text-[14px] leading-none" style:color="var(--ink-4)" aria-label="Remove">×</button>
						</div>
					{/each}
				</div>
				<div class="flex gap-[6px]">
					<input
						bind:value={noteDraft}
						onkeydown={(e) => { if (e.key === 'Enter') addNote(); }}
						placeholder="Add a note…"
						class="flex-1 h-8 px-[10px] rounded-[4px] text-[12px] outline-none"
						style:background="var(--bg)"
						style:color="var(--ink-1)"
						style:border="1px solid var(--border)"
					/>
					<button type="button" onclick={addNote}
						class="h-8 px-3 rounded-[4px] text-[12px] cursor-pointer"
						style:background="var(--ink-0)" style:color="var(--bg)" style:border="1px solid var(--ink-0)">Add</button>
				</div>
			</div>
		</div>

		<!-- related -->
		{#if related.length > 0}
			<div class="mt-11">
				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-[14px]" style:color="var(--ink-3)">
					Related in category
				</div>
				<div class="grid gap-[10px]" style:grid-template-columns="repeat(auto-fill, minmax(240px, 1fr))">
					{#each related as r (r.id)}
						<a href="/charts/{encodeURIComponent(r.id)}" class="block rounded-[6px] p-3 cursor-pointer no-underline"
							style:background="var(--bg)"
							style:border="1px solid var(--border)">
							<div class="font-mono text-[10px] mb-[2px]" style:color="var(--ink-3)">{r.id}</div>
							<div class="text-[12px] mb-2 line-clamp-2 min-h-[32px]" style:color="var(--ink-1)">{r.title}</div>
							<div class="h-9">
								{#if relatedSparks[r.id]}
									<Sparkline values={relatedSparks[r.id]} color={colorForSeries(r.id)} width={240} height={36} />
								{/if}
							</div>
						</a>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>
