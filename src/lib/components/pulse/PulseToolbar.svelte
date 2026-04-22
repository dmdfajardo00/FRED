<script lang="ts">
	interface MetricOption {
		key: string;
		label: string;
		annual: boolean;
		higherIsBetter: boolean;
	}

	interface Props {
		metrics: ReadonlyArray<MetricOption>;
		selected: string;
		onSelect: (key: string) => void;
		year: number;
		onYearChange: (y: number) => void;
		yearMin?: number;
		yearMax?: number;
		canStepYear: boolean;
		logScale: boolean;
		onLogToggle: (v: boolean) => void;
		coverage: 'global' | 'oecd' | null;
		min: number | null;
		max: number | null;
		countriesWithData: number | null;
		totalCountries: number | null;
		formatValue: (v: number | null) => string;
	}

	const {
		metrics,
		selected,
		onSelect,
		year,
		onYearChange,
		yearMin = 1990,
		yearMax = 2024,
		canStepYear,
		logScale,
		onLogToggle,
		coverage,
		min,
		max,
		countriesWithData,
		totalCountries,
		formatValue
	}: Props = $props();
</script>

<div class="flex items-center gap-3 mb-[14px] flex-wrap">
	<div class="flex gap-[6px] flex-wrap">
		{#each metrics as opt (opt.key)}
			{@const active = selected === opt.key}
			<button
				type="button"
				onclick={() => onSelect(opt.key)}
				class="metric-btn"
				style:background={active ? 'var(--ink-0)' : 'var(--bg)'}
				style:color={active ? 'var(--bg)' : 'var(--ink-2)'}
				style:border="1px solid {active ? 'var(--ink-0)' : 'var(--border)'}"
			>
				{opt.label}
			</button>
		{/each}
	</div>
</div>

<div class="divider mb-[14px]" style:background="var(--border-faint)"></div>

<div class="flex items-center gap-5 mb-[22px] flex-wrap">
	<div class="flex items-center gap-[6px]" style:opacity={canStepYear ? '1' : '0.35'}>
		<span class="font-mono text-[10px] tracking-[0.08em] uppercase mr-[6px]" style:color="var(--ink-3)">Year</span>
		<button
			type="button"
			aria-label="Previous year"
			disabled={!canStepYear || year <= yearMin}
			onclick={() => { if (year > yearMin) onYearChange(year - 1); }}
			class="stepper-btn"
		>
			<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M7.5 2.5 L4 6 L7.5 9.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
		<span class="font-mono text-[13px] min-w-[48px] text-center tabular-nums" style:color="var(--ink-0)">
			{canStepYear ? year : 'latest'}
		</span>
		<button
			type="button"
			aria-label="Next year"
			disabled={!canStepYear || year >= yearMax}
			onclick={() => { if (year < yearMax) onYearChange(year + 1); }}
			class="stepper-btn"
		>
			<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M4.5 2.5 L8 6 L4.5 9.5" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</button>
	</div>

	<label class="flex items-center gap-2 text-[12px] cursor-pointer select-none" style:color="var(--ink-2)">
		<input
			type="checkbox"
			checked={logScale}
			onchange={(e) => onLogToggle(e.currentTarget.checked)}
			class="accent-[color:var(--accent)]"
		/>
		<span class="font-mono text-[10px] tracking-[0.08em] uppercase" style:color="var(--ink-3)">Log scale</span>
	</label>

	{#if coverage != null && min != null && max != null}
		<div class="ml-auto font-mono text-[10px] tracking-[0.06em] uppercase flex items-center gap-[10px]" style:color="var(--ink-3)">
			<span>Range</span>
			<span class="tabular-nums" style:color="var(--ink-1)">{formatValue(min)} → {formatValue(max)}</span>
			{#if countriesWithData != null && totalCountries != null}
				<span>·</span>
				<span>{countriesWithData}/{totalCountries} ctr</span>
			{/if}
			<span>·</span>
			<span>{coverage}</span>
		</div>
	{/if}
</div>

<style>
	.metric-btn {
		height: 32px;
		padding: 0 14px;
		font-size: 12px;
		border-radius: 5px;
		cursor: pointer;
		transition: transform 120ms;
	}
	.metric-btn:active { transform: scale(0.98); }

	.divider {
		height: 1px;
		width: 100%;
	}

	.stepper-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		border-radius: 4px;
		background: var(--bg);
		color: var(--ink-2);
		border: 1px solid var(--border);
		cursor: pointer;
		transition: background 140ms, color 140ms, transform 120ms;
	}
	.stepper-btn:hover:not(:disabled) { background: var(--bg-soft); color: var(--ink-0); }
	.stepper-btn:active:not(:disabled) { transform: scale(0.94); }
	.stepper-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
