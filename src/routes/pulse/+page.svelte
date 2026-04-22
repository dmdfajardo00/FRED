<script lang="ts">
	import { fetchPulseStates, type PulseResponse, type PulseState } from '$lib/api';
	import { US_TILE_GRID } from '$lib/us-tile-grid';
	import { goto } from '$app/navigation';
	import { formatValue } from '$lib/utils/format';

	const METRIC_OPTIONS = [
		{ key: 'unemployment', label: 'Unemployment Rate' },
		{ key: 'employment', label: 'Nonfarm Employment' },
		{ key: 'income', label: 'Per Capita Income' }
	] as const;

	let metric = $state<(typeof METRIC_OPTIONS)[number]['key']>('unemployment');
	let pulse = $state<PulseResponse | null>(null);
	let loading = $state(true);
	let hover = $state<{ code: string; x: number; y: number; value: number | null } | null>(null);

	$effect(() => {
		loading = true;
		hover = null;
		fetchPulseStates(metric)
			.then((r) => { pulse = r; })
			.catch((e) => { console.error(e); pulse = null; })
			.finally(() => { loading = false; });
	});

	const SIZE = 52;
	const GAP = 4;
	const COLS = US_TILE_GRID[0].length;
	const ROWS = US_TILE_GRID.length;
	const W = COLS * (SIZE + GAP);
	const H = ROWS * (SIZE + GAP);

	function tileColor(t: number, higherIsBetter: boolean, isIncome: boolean): string {
		if (!isFinite(t)) return 'var(--bg-soft)';
		const intensity = Math.max(0.05, Math.min(1, t));
		// Sequential — cobalt for "higher is better" (income/employment); terracotta for "higher is worse" (unemployment)
		const hue = higherIsBetter ? 250 : 25;
		return `oklch(${(96 - intensity * 52).toFixed(0)}% ${(0.02 + intensity * 0.16).toFixed(3)} ${hue})`;
	}

	function formatMetric(v: number | null, unit: string): string {
		if (v == null) return '—';
		if (unit === '$') return '$' + Math.round(v).toLocaleString();
		if (unit === 'k') return (v / 1000).toFixed(1) + 'k';
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
</script>

<div class="max-w-[1280px] mx-auto px-10 py-7 pb-[60px]">
	<div class="mb-[22px]">
		<h1 class="text-[26px] font-medium tracking-[-0.01em] m-0" style:color="var(--ink-0)">Global Pulse</h1>
		<div class="text-[13px] mt-1" style:color="var(--ink-3)">
			Geospatial snapshot across U.S. states · {pulse?.label ?? ''}
		</div>
	</div>

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
		<!-- map -->
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
								{@const bg = v != null ? tileColor(t, pulse.higherIsBetter, metric === 'income') : 'var(--bg-soft)'}
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

		<!-- rankings -->
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
</div>
