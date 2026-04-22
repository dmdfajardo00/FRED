<script lang="ts">
	import { fetchPulseStates, fetchPulseCountries, listCountries, type PulseResponse, type CountryPulseResponse, type CountrySummary } from '$lib/api';
	import { goto } from '$app/navigation';
	import { formatPulseValue as fmt } from '$lib/pulse-format';
	import WorldMap from '$lib/components/pulse/WorldMap.svelte';
	import PulseHeader from '$lib/components/pulse/PulseHeader.svelte';
	import PulseToolbar from '$lib/components/pulse/PulseToolbar.svelte';
	import RankingsPanel from '$lib/components/pulse/RankingsPanel.svelte';
	import StatesTileMap from '$lib/components/pulse/StatesTileMap.svelte';
	import CountryDrawer from '$lib/components/pulse/CountryDrawer.svelte';

	const US_METRICS = [
		{ key: 'unemployment', label: 'Unemployment Rate', annual: false, higherIsBetter: false },
		{ key: 'employment', label: 'Nonfarm Employment', annual: false, higherIsBetter: true },
		{ key: 'income', label: 'Per Capita Income', annual: false, higherIsBetter: true }
	] as const;
	const GLOBAL_METRICS = [
		{ key: 'gdp_per_capita', label: 'GDP per capita', annual: true, higherIsBetter: true },
		{ key: 'life_expectancy', label: 'Life expectancy', annual: true, higherIsBetter: true },
		{ key: 'inflation', label: 'Inflation', annual: true, higherIsBetter: false },
		{ key: 'internet_users', label: 'Internet users', annual: true, higherIsBetter: true },
		{ key: 'population', label: 'Population', annual: true, higherIsBetter: true },
		{ key: 'unemployment', label: 'Unemployment', annual: false, higherIsBetter: false }
	] as const;

	type Scope = 'global' | 'us';
	let scope = $state<Scope>('global');
	let metric = $state<(typeof US_METRICS)[number]['key']>('unemployment');
	let pulse = $state<PulseResponse | null>(null);
	let loading = $state(true);
	let hover = $state<{ code: string; x: number; y: number; value: number | null } | null>(null);

	let globalMetric = $state<(typeof GLOBAL_METRICS)[number]['key']>('gdp_per_capita');
	let year = $state(2024);
	let logScale = $state(false);
	let countries = $state<CountryPulseResponse | null>(null);
	let loadingGlobal = $state(false);

	// Country name lookup — fetched once, used for ranking labels + drawer header
	let countryIndex = $state<Map<string, CountrySummary>>(new Map());
	$effect(() => {
		listCountries()
			.then((list) => {
				countryIndex = new Map(list.map((c) => [c.iso3, c]));
			})
			.catch(() => {});
	});

	// Drawer state — opens when user clicks a country on the world map
	let drawerIso = $state<string | null>(null);

	const currentGlobalMeta = $derived(GLOBAL_METRICS.find((m) => m.key === globalMetric)!);

	$effect(() => {
		if (scope !== 'us') return;
		loading = true; hover = null;
		fetchPulseStates(metric).then((r) => (pulse = r)).catch((e) => { console.error(e); pulse = null; }).finally(() => (loading = false));
	});
	$effect(() => {
		if (scope !== 'global') return;
		loadingGlobal = true;
		const meta = GLOBAL_METRICS.find((m) => m.key === globalMetric)!;
		fetchPulseCountries(globalMetric, meta.annual ? year : undefined).then((r) => (countries = r)).catch((e) => { console.error(e); countries = null; }).finally(() => (loadingGlobal = false));
	});

	const rankedStates = $derived.by(() => {
		if (!pulse) return [];
		return Object.entries(pulse.data)
			.map(([code, d]) => ({ code, value: d.value ?? NaN, seriesId: d.seriesId }))
			.filter((r) => isFinite(r.value)).sort((a, b) => b.value - a.value);
	});
	const nationalAvg = $derived(rankedStates.length === 0 ? null : rankedStates.reduce((s, r) => s + r.value, 0) / rankedStates.length);
	const rankedCountries = $derived.by(() => {
		if (!countries) return [];
		return Object.entries(countries.data)
			.map(([iso3, d]) => ({
				code: iso3,
				value: d.value ?? NaN,
				seriesId: d.seriesId,
				name: countryIndex.get(iso3)?.name
			}))
			.filter((r) => isFinite(r.value)).sort((a, b) => b.value - a.value);
	});
	const subtitle = $derived(
		scope === 'us'
			? `Geospatial snapshot across U.S. states · ${pulse?.label ?? ''}`
			: `Cross-country snapshot · ${countries?.label ?? ''}`
	);
	const goChart = (id: string) => goto(`/charts/${encodeURIComponent(id)}`);
</script>

<div class="max-w-[1280px] mx-auto px-10 py-7 pb-[60px]">
	<PulseHeader {scope} onScopeChange={(s) => (scope = s)} {subtitle} />

	{#if scope === 'us'}
		<div class="flex gap-[6px] mb-[22px] flex-wrap">
			{#each US_METRICS as opt (opt.key)}
				{@const active = metric === opt.key}
				<button type="button" onclick={() => (metric = opt.key)}
					class="h-8 px-[14px] text-[12px] rounded-[5px] cursor-pointer active:scale-[0.98] transition-transform"
					style:background={active ? 'var(--ink-0)' : 'var(--bg)'}
					style:color={active ? 'var(--bg)' : 'var(--ink-2)'}
					style:border="1px solid {active ? 'var(--ink-0)' : 'var(--border)'}">{opt.label}</button>
			{/each}
		</div>

		<div class="grid gap-8" style:grid-template-columns="1fr 300px">
			<div class="relative rounded-[6px] px-7 py-6" style:background="var(--bg)" style:border="1px solid var(--border)">
				<div class="flex justify-between items-start mb-4">
					<div>
						<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-1" style:color="var(--ink-3)">Viewing</div>
						<div class="text-[18px] font-medium" style:color="var(--ink-0)">{pulse?.label ?? 'Loading…'}</div>
					</div>
					{#if pulse}<div class="font-mono text-[11px] tabular-nums" style:color="var(--ink-3)">range: {fmt(pulse.min, pulse.unit)} — {fmt(pulse.max, pulse.unit)}</div>{/if}
				</div>
				{#if loading}<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">Loading state data…</div>
				{:else if !pulse || rankedStates.length === 0}<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">No data available for this metric.</div>
				{:else}<StatesTileMap data={pulse} {hover} onHoverChange={(h) => (hover = h)} onSelect={goChart} formatValue={fmt} />{/if}
			</div>

			{#if pulse && rankedStates.length > 0}
				<RankingsPanel
					items={rankedStates} unit={pulse.unit} higherIsBetter={pulse.higherIsBetter}
					min={pulse.min} max={pulse.max} formatValue={fmt}
					summary={nationalAvg != null ? { label: 'National', value: nationalAvg, subLabel: 'Cross-state average' } : null}
					onRowClick={({ seriesId }) => seriesId && goChart(seriesId)}
				/>
			{/if}
		</div>
	{:else}
		<PulseToolbar
			metrics={GLOBAL_METRICS} selected={globalMetric}
			onSelect={(k) => (globalMetric = k as typeof globalMetric)}
			{year} onYearChange={(y) => (year = y)} canStepYear={currentGlobalMeta.annual}
			{logScale} onLogToggle={(v) => (logScale = v)}
			coverage={countries?.coverage ?? null}
			min={countries?.min ?? null} max={countries?.max ?? null}
			countriesWithData={countries?.countries_with_data ?? null}
			totalCountries={countries?.total_countries ?? null}
			formatValue={(v) => fmt(v, countries?.unit ?? '')}
		/>

		<div class="grid gap-8" style:grid-template-columns="1fr 300px">
			<div class="relative rounded-[6px] px-4 py-4" style:background="var(--bg)" style:border="1px solid var(--border)">
				<div class="flex justify-between items-start mb-2 px-3">
					<div>
						<div class="font-mono text-[10px] tracking-[0.08em] uppercase mb-1" style:color="var(--ink-3)">Viewing</div>
						<div class="text-[17px] font-medium tracking-[-0.005em]" style:color="var(--ink-0)">{countries?.label ?? 'Loading…'}</div>
					</div>
				</div>
				{#if loadingGlobal}<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">Loading country data…</div>
				{:else if !countries}<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">No data available.</div>
				{:else}<WorldMap data={countries.data} metric={countries.label} min={countries.min} max={countries.max} unit={countries.unit} higherIsBetter={currentGlobalMeta.higherIsBetter} {logScale} onSelect={(iso3) => (drawerIso = iso3)} />{/if}
			</div>

			{#if countries && rankedCountries.length > 0}
				<RankingsPanel items={rankedCountries} unit={countries.unit}
					higherIsBetter={currentGlobalMeta.higherIsBetter}
					min={countries.min} max={countries.max} formatValue={fmt} showFlag={true}
					summary={{ label: 'Median', value: countries.median, subLabel: `Cross-country median · ${countries.coverage}` }}
					onRowClick={({ code }) => (drawerIso = code)}
				/>
			{/if}
		</div>
	{/if}
</div>

<CountryDrawer
	iso3={drawerIso}
	name={drawerIso ? countryIndex.get(drawerIso)?.name : undefined}
	onClose={() => (drawerIso = null)}
/>
