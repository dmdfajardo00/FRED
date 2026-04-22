<script lang="ts">
	import {
		fetchPulseStates,
		fetchPulseCountries,
		type PulseResponse,
		type PulseState,
		type CountryPulseResponse
	} from '$lib/api';
	import { US_TILE_GRID } from '$lib/us-tile-grid';
	import { goto } from '$app/navigation';
	import WorldMap from '$lib/components/pulse/WorldMap.svelte';

	const METRIC_OPTIONS = [
		{ key: 'unemployment', label: 'Unemployment Rate' },
		{ key: 'employment', label: 'Nonfarm Employment' },
		{ key: 'income', label: 'Per Capita Income' }
	] as const;

	const GLOBAL_METRICS = [
		{ key: 'gdp_per_capita', label: 'GDP/cap', higherIsBetter: true, annual: true },
		{ key: 'population', label: 'Population', higherIsBetter: true, annual: true },
		{ key: 'cpi_yoy', label: 'CPI y/y', higherIsBetter: false, annual: false },
		{ key: 'unemployment', label: 'Unemployment', higherIsBetter: false, annual: false }
	] as const;

	type Scope = 'us' | 'global';
	let scope = $state<Scope>('us');

	// US state scope
	let metric = $state<(typeof METRIC_OPTIONS)[number]['key']>('unemployment');
	let pulse = $state<PulseResponse | null>(null);
	let loading = $state(true);
	let hover = $state<{ code: string; x: number; y: number; value: number | null } | null>(null);

	// Global scope
	let globalMetric = $state<(typeof GLOBAL_METRICS)[number]['key']>('gdp_per_capita');
	let year = $state(2025);
	let logScale = $state(false);
	let projection = $state('equal_earth');
	let countries = $state<CountryPulseResponse | null>(null);
	let loadingGlobal = $state(false);

	const currentGlobalMeta = $derived(GLOBAL_METRICS.find((m) => m.key === globalMetric)!);

	$effect(() => {
		if (scope !== 'us') return;
		loading = true;
		hover = null;
		fetchPulseStates(metric)
			.then((r) => { pulse = r; })
			.catch((e) => { console.error(e); pulse = null; })
			.finally(() => { loading = false; });
	});

	$effect(() => {
		if (scope !== 'global') return;
		loadingGlobal = true;
		const meta = GLOBAL_METRICS.find((m) => m.key === globalMetric)!;
		fetchPulseCountries(globalMetric, meta.annual ? year : undefined)
			.then((r) => { countries = r; })
			.catch((e) => { console.error(e); countries = null; })
			.finally(() => { loadingGlobal = false; });
	});

	const SIZE = 52;
	const GAP = 4;
	const COLS = US_TILE_GRID[0].length;
	const ROWS = US_TILE_GRID.length;
	const W = COLS * (SIZE + GAP);
	const H = ROWS * (SIZE + GAP);

	function tileColor(t: number, higherIsBetter: boolean): string {
		if (!isFinite(t)) return 'var(--bg-soft)';
		const intensity = Math.max(0.05, Math.min(1, t));
		const hue = higherIsBetter ? 250 : 25;
		return `oklch(${(96 - intensity * 52).toFixed(0)}% ${(0.02 + intensity * 0.16).toFixed(3)} ${hue})`;
	}

	function formatMetric(v: number | null, unit: string): string {
		if (v == null) return '—';
		if (unit === '$') return '$' + Math.round(v).toLocaleString();
		if (unit === 'k') return (v / 1000).toFixed(1) + 'k';
		if (unit === 'people') {
			if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
			if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
			if (v >= 1e3) return (v / 1e3).toFixed(1) + 'k';
			return Math.round(v).toLocaleString();
		}
		if (unit === '%') return v.toFixed(2) + '%';
		return v.toFixed(2) + unit;
	}

	const rankedStates = $derived.by(() => {
		if (!pulse) return [] as { state: string; v: number; data: PulseState }[];
		return Object.entries(pulse.data)
			.map(([state, d]) => ({ state, v: d.value ?? NaN, data: d }))
			.filter((r) => isFinite(r.v))
			.sort((a, b) => b.v - a.v);
	});

	const nationalAvg = $derived.by(() => {
		if (!pulse || rankedStates.length === 0) return null;
		return rankedStates.reduce((s, r) => s + r.v, 0) / rankedStates.length;
	});

	const rankedCountries = $derived.by(() => {
		if (!countries) return [] as { iso3: string; v: number; seriesId: string }[];
		return Object.entries(countries.data)
			.map(([iso3, d]) => ({ iso3, v: d.value ?? NaN, seriesId: d.seriesId }))
			.filter((r) => isFinite(r.v))
			.sort((a, b) => b.v - a.v);
	});
</script>

<div class="max-w-[1280px] mx-auto px-10 py-7 pb-[60px]">
	<div class="mb-[18px] flex items-start justify-between gap-4">
		<div>
			<h1 class="text-[26px] font-medium tracking-[-0.01em] m-0" style:color="var(--ink-0)">Global Pulse</h1>
			<div class="text-[13px] mt-1" style:color="var(--ink-3)">
				{#if scope === 'us'}
					Geospatial snapshot across U.S. states · {pulse?.label ?? ''}
				{:else}
					Cross-country snapshot · {countries?.label ?? ''}
				{/if}
			</div>
		</div>

		<div class="flex gap-[6px]">
			<button type="button" onclick={() => (scope = 'us')}
				class="h-8 px-[14px] text-[12px] rounded-[5px] cursor-pointer"
				style:background={scope === 'us' ? 'var(--ink-0)' : 'var(--bg)'}
				style:color={scope === 'us' ? 'var(--bg)' : 'var(--ink-2)'}
				style:border="1px solid {scope === 'us' ? 'var(--ink-0)' : 'var(--border)'}">
				U.S. States
			</button>
			<button type="button" onclick={() => (scope = 'global')}
				class="h-8 px-[14px] text-[12px] rounded-[5px] cursor-pointer"
				style:background={scope === 'global' ? 'var(--ink-0)' : 'var(--bg)'}
				style:color={scope === 'global' ? 'var(--bg)' : 'var(--ink-2)'}
				style:border="1px solid {scope === 'global' ? 'var(--ink-0)' : 'var(--border)'}">
				Global
			</button>
		</div>
	</div>

	{#if scope === 'us'}
		<div class="flex gap-[6px] mb-[22px] flex-wrap">
			{#each METRIC_OPTIONS as opt (opt.key)}
				{@const active = metric === opt.key}
				<button type="button" onclick={() => (metric = opt.key)}
					class="h-8 px-[14px] text-[12px] rounded-[5px] cursor-pointer"
					style:background={active ? 'var(--ink-0)' : 'var(--bg)'}
					style:color={active ? 'var(--bg)' : 'var(--ink-2)'}
					style:border="1px solid {active ? 'var(--ink-0)' : 'var(--border)'}">
					{opt.label}
				</button>
			{/each}
		</div>

		<div class="grid gap-8" style:grid-template-columns="1fr 300px">
			<div class="relative rounded-[6px] px-7 py-6" style:background="var(--bg)" style:border="1px solid var(--border)">
				<div class="flex justify-between items-start mb-4">
					<div>
						<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-1" style:color="var(--ink-3)">Viewing</div>
						<div class="text-[18px] font-medium" style:color="var(--ink-0)">{pulse?.label ?? 'Loading…'}</div>
					</div>
					{#if pulse}
						<div class="font-mono text-[11px]" style:color="var(--ink-3)">
							range: {formatMetric(pulse.min, pulse.unit)} — {formatMetric(pulse.max, pulse.unit)}
						</div>
					{/if}
				</div>

				{#if loading}
					<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">Loading state data…</div>
				{:else if !pulse || rankedStates.length === 0}
					<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">No data available for this metric.</div>
				{:else}
					{@const range = pulse.max - pulse.min || 1}
					<svg viewBox="0 0 {W} {H + 40}" width="100%" style:display="block">
						{#each US_TILE_GRID as row, rIdx}
							{#each row as code, cIdx}
								{#if code && pulse.data[code]}
									{@const d = pulse.data[code]}
									{@const v = d.value}
									{@const t = v != null ? (v - pulse.min) / range : -1}
									{@const bg = v != null ? tileColor(t, pulse.higherIsBetter) : 'var(--bg-soft)'}
									{@const hovered = hover?.code === code}
									{@const isStrong = v != null && t > 0.55}
									{@const ink = isStrong ? 'white' : 'var(--ink-1)'}
									<g
										transform="translate({cIdx * (SIZE + GAP)}, {rIdx * (SIZE + GAP)})"
										role="button"
										tabindex="0"
										style="cursor: {d.seriesId ? 'pointer' : 'default'}"
										onmouseenter={() => (hover = { code, x: cIdx * (SIZE + GAP), y: rIdx * (SIZE + GAP), value: v })}
										onmouseleave={() => (hover = null)}
										onclick={() => d.seriesId && goto(`/charts/${encodeURIComponent(d.seriesId)}`)}
										onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && d.seriesId) goto(`/charts/${encodeURIComponent(d.seriesId)}`); }}
									>
										<rect width={SIZE} height={SIZE} fill={bg}
											stroke={hovered ? 'var(--ink-0)' : 'var(--border-faint)'}
											stroke-width={hovered ? 1.5 : 1} rx="2" />
										<text x={SIZE / 2} y={SIZE / 2 + 4} text-anchor="middle" font-size="10"
											font-family="var(--font-mono)" fill={ink}
											style="pointer-events: none; font-weight: 500;">{code}</text>
									</g>
								{/if}
							{/each}
						{/each}
					</svg>

					{#if hover}
						<div class="absolute px-3 py-2 rounded-[5px] text-[12px] z-10 pointer-events-none"
							style:background="var(--bg)"
							style:border="1px solid var(--border)"
							style:box-shadow="0 4px 12px rgba(0,0,0,0.06)"
							style:left="{28 + Math.min(hover.x + SIZE + 12, 600)}px"
							style:top="{24 + 40 + hover.y}px">
							<div class="font-mono text-[11px] mb-[2px]" style:color="var(--ink-3)">{hover.code}</div>
							<div class="font-mono text-[15px] font-medium" style:color="var(--ink-0)">{formatMetric(hover.value, pulse.unit)}</div>
							<div class="text-[10px] mt-[2px]" style:color="var(--ink-3)">{pulse.label}</div>
						</div>
					{/if}
				{/if}
			</div>

			<div>
				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">Highest</div>
				<div class="border-t mb-7" style:border-color="var(--border-faint)">
					{#each rankedStates.slice(0, 5) as r, i}
						<div class="flex items-center justify-between py-[9px] border-b text-[13px]" style:border-color="var(--border-faint)">
							<div class="flex items-center gap-[10px]">
								<span class="font-mono text-[10px] w-3" style:color="var(--ink-4)">{i + 1}</span>
								<span class="font-mono text-[11px]" style:color="var(--ink-2)">{r.state}</span>
							</div>
							<div class="flex items-center gap-2">
								{#if pulse}
									{@const pct = ((r.v - pulse.min) / (pulse.max - pulse.min || 1)) * 100}
									<div class="w-[60px] h-[3px] rounded overflow-hidden" style:background="var(--border)">
										<div class="h-full" style:width="{pct}%" style:background="var(--accent)"></div>
									</div>
									<span class="font-mono text-[12px] min-w-[62px] text-right" style:color="var(--ink-1)">{formatMetric(r.v, pulse.unit)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">Lowest</div>
				<div class="border-t" style:border-color="var(--border-faint)">
					{#each [...rankedStates].reverse().slice(0, 5) as r, i}
						<div class="flex items-center justify-between py-[9px] border-b text-[13px]" style:border-color="var(--border-faint)">
							<div class="flex items-center gap-[10px]">
								<span class="font-mono text-[10px] w-3" style:color="var(--ink-4)">{i + 1}</span>
								<span class="font-mono text-[11px]" style:color="var(--ink-2)">{r.state}</span>
							</div>
							<div class="flex items-center gap-2">
								{#if pulse}
									{@const pct = ((r.v - pulse.min) / (pulse.max - pulse.min || 1)) * 100}
									<div class="w-[60px] h-[3px] rounded overflow-hidden" style:background="var(--border)">
										<div class="h-full" style:width="{pct}%" style:background="var(--ink-3)"></div>
									</div>
									<span class="font-mono text-[12px] min-w-[62px] text-right" style:color="var(--ink-1)">{formatMetric(r.v, pulse.unit)}</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if nationalAvg != null && pulse}
					<div class="mt-7 p-[14px] rounded-[5px]"
						style:background="var(--bg-soft)"
						style:border="1px solid var(--border-faint)">
						<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-[6px]" style:color="var(--ink-3)">National</div>
						<div class="font-mono text-[20px] font-medium tracking-[-0.01em]" style:color="var(--ink-0)">
							{formatMetric(nationalAvg, pulse.unit)}
						</div>
						<div class="text-[11px] mt-[2px]" style:color="var(--ink-3)">Cross-state average</div>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- GLOBAL SCOPE -->
		<div class="flex items-center gap-3 mb-[16px] flex-wrap">
			<div class="flex gap-[6px] flex-wrap">
				{#each GLOBAL_METRICS as opt (opt.key)}
					{@const active = globalMetric === opt.key}
					<button type="button" onclick={() => (globalMetric = opt.key)}
						class="h-8 px-[14px] text-[12px] rounded-[5px] cursor-pointer"
						style:background={active ? 'var(--ink-0)' : 'var(--bg)'}
						style:color={active ? 'var(--bg)' : 'var(--ink-2)'}
						style:border="1px solid {active ? 'var(--ink-0)' : 'var(--border)'}">
						{opt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="flex items-center gap-4 mb-[18px] flex-wrap">
			<label class="flex items-center gap-2 text-[12px]" style:color="var(--ink-2)">
				<span class="font-mono text-[11px] tracking-[0.06em] uppercase" style:color="var(--ink-3)">Projection</span>
				<select bind:value={projection}
					class="h-8 px-2 text-[12px] rounded-[5px]"
					style:background="var(--bg)"
					style:color="var(--ink-1)"
					style:border="1px solid var(--border)">
					<option value="equal_earth">Equal Earth</option>
				</select>
			</label>

			<div class="flex items-center gap-1" style:opacity={currentGlobalMeta.annual ? '1' : '0.4'}>
				<span class="font-mono text-[11px] tracking-[0.06em] uppercase mr-1" style:color="var(--ink-3)">Year</span>
				<button type="button"
					disabled={!currentGlobalMeta.annual || year <= 1990}
					onclick={() => { if (year > 1990) year -= 1; }}
					class="h-8 w-8 rounded-[5px] cursor-pointer text-[13px]"
					style:background="var(--bg)"
					style:color="var(--ink-2)"
					style:border="1px solid var(--border)">◀</button>
				<span class="font-mono text-[13px] px-3 min-w-[56px] text-center" style:color="var(--ink-0)">{currentGlobalMeta.annual ? year : '—'}</span>
				<button type="button"
					disabled={!currentGlobalMeta.annual || year >= 2025}
					onclick={() => { if (year < 2025) year += 1; }}
					class="h-8 w-8 rounded-[5px] cursor-pointer text-[13px]"
					style:background="var(--bg)"
					style:color="var(--ink-2)"
					style:border="1px solid var(--border)">▶</button>
			</div>

			<label class="flex items-center gap-2 text-[12px] cursor-pointer" style:color="var(--ink-2)">
				<input type="checkbox" bind:checked={logScale} />
				<span>Log scale</span>
			</label>
		</div>

		<div class="grid gap-8" style:grid-template-columns="1fr 300px">
			<div class="relative rounded-[6px] px-4 py-4" style:background="var(--bg)" style:border="1px solid var(--border)">
				<div class="flex justify-between items-start mb-2 px-3">
					<div>
						<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-1" style:color="var(--ink-3)">Viewing</div>
						<div class="text-[18px] font-medium" style:color="var(--ink-0)">{countries?.label ?? 'Loading…'}</div>
					</div>
					{#if countries}
						<div class="font-mono text-[11px] text-right" style:color="var(--ink-3)">
							range: {formatMetric(countries.min, countries.unit)} — {formatMetric(countries.max, countries.unit)}
						</div>
					{/if}
				</div>

				{#if loadingGlobal}
					<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">Loading country data…</div>
				{:else if !countries}
					<div class="py-12 text-center text-[13px]" style:color="var(--ink-3)">No data available.</div>
				{:else}
					<WorldMap
						data={countries.data}
						metric={countries.label}
						min={countries.min}
						max={countries.max}
						unit={countries.unit}
						higherIsBetter={currentGlobalMeta.higherIsBetter}
						{logScale}
						onSelect={(_iso3, seriesId) => goto(`/charts/${encodeURIComponent(seriesId)}`)}
					/>

					<div class="mt-3 px-3 text-[11px]" style:color="var(--ink-3)">
						{countries.countries_with_data}/{countries.total_countries} countries have data ·
						{countries.total_countries - countries.countries_with_data} missing shown as hatched
					</div>
				{/if}
			</div>

			<div>
				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">Highest</div>
				<div class="border-t mb-7" style:border-color="var(--border-faint)">
					{#each rankedCountries.slice(0, 5) as r, i}
						<button type="button" class="w-full flex items-center justify-between py-[9px] border-b text-[13px] cursor-pointer text-left"
							style:border-color="var(--border-faint)"
							onclick={() => r.seriesId && goto(`/charts/${encodeURIComponent(r.seriesId)}`)}>
							<div class="flex items-center gap-[10px]">
								<span class="font-mono text-[10px] w-3" style:color="var(--ink-4)">{i + 1}</span>
								<span class="font-mono text-[11px]" style:color="var(--ink-2)">{r.iso3}</span>
							</div>
							<div class="flex items-center gap-2">
								{#if countries}
									{@const pct = ((r.v - countries.min) / (countries.max - countries.min || 1)) * 100}
									<div class="w-[60px] h-[3px] rounded overflow-hidden" style:background="var(--border)">
										<div class="h-full" style:width="{pct}%" style:background="var(--accent)"></div>
									</div>
									<span class="font-mono text-[12px] min-w-[62px] text-right" style:color="var(--ink-1)">{formatMetric(r.v, countries.unit)}</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>

				<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">Lowest</div>
				<div class="border-t" style:border-color="var(--border-faint)">
					{#each [...rankedCountries].reverse().slice(0, 5) as r, i}
						<button type="button" class="w-full flex items-center justify-between py-[9px] border-b text-[13px] cursor-pointer text-left"
							style:border-color="var(--border-faint)"
							onclick={() => r.seriesId && goto(`/charts/${encodeURIComponent(r.seriesId)}`)}>
							<div class="flex items-center gap-[10px]">
								<span class="font-mono text-[10px] w-3" style:color="var(--ink-4)">{i + 1}</span>
								<span class="font-mono text-[11px]" style:color="var(--ink-2)">{r.iso3}</span>
							</div>
							<div class="flex items-center gap-2">
								{#if countries}
									{@const pct = ((r.v - countries.min) / (countries.max - countries.min || 1)) * 100}
									<div class="w-[60px] h-[3px] rounded overflow-hidden" style:background="var(--border)">
										<div class="h-full" style:width="{pct}%" style:background="var(--ink-3)"></div>
									</div>
									<span class="font-mono text-[12px] min-w-[62px] text-right" style:color="var(--ink-1)">{formatMetric(r.v, countries.unit)}</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>

				{#if countries}
					<div class="mt-7 p-[14px] rounded-[5px]"
						style:background="var(--bg-soft)"
						style:border="1px solid var(--border-faint)">
						<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-[6px]" style:color="var(--ink-3)">Median</div>
						<div class="font-mono text-[20px] font-medium tracking-[-0.01em]" style:color="var(--ink-0)">
							{formatMetric(countries.median, countries.unit)}
						</div>
						<div class="text-[11px] mt-[2px]" style:color="var(--ink-3)">Cross-country median · {countries.coverage}</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
