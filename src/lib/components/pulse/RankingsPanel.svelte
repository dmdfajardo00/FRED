<script lang="ts">
	import CountryFlag from './CountryFlag.svelte';

	interface Item {
		code: string;
		value: number;
		seriesId: string;
		name?: string;
	}

	interface Summary {
		label: string;
		value: number | null;
		subLabel?: string;
	}

	interface Props {
		items: Item[];
		unit: string;
		higherIsBetter: boolean;
		min: number;
		max: number;
		formatValue: (v: number | null, unit?: string) => string;
		showFlag?: boolean;
		summary?: Summary | null;
		onRowClick?: (item: { code: string; seriesId: string }) => void;
	}

	const {
		items,
		unit,
		higherIsBetter: _higherIsBetter,
		min,
		max,
		formatValue,
		showFlag = false,
		summary = null,
		onRowClick
	}: Props = $props();

	const highest = $derived(items.slice(0, 5));
	const lowest = $derived([...items].reverse().slice(0, 5));
	const range = $derived(max - min || 1);
</script>

{#snippet label(r: Item)}
	{#if r.name}
		<span class="row-name truncate" style:color="var(--ink-1)" title={r.name}>{r.name}</span>
		<span class="font-mono text-[10px] shrink-0" style:color="var(--ink-4)">{r.code}</span>
	{:else}
		<span class="font-mono text-[11px] truncate" style:color="var(--ink-2)">{r.code}</span>
	{/if}
{/snippet}

{#snippet row(r: Item, i: number, barColor: string)}
	{@const pct = ((r.value - min) / range) * 100}
	{#if onRowClick}
		<button
			type="button"
			class="row w-full text-left"
			style:border-color="var(--border-faint)"
			onclick={() => onRowClick({ code: r.code, seriesId: r.seriesId })}
		>
			<div class="flex items-center gap-[10px] min-w-0 flex-1">
				<span class="font-mono text-[10px] w-3 shrink-0" style:color="var(--ink-4)">{i + 1}</span>
				{#if showFlag}
					<CountryFlag iso3={r.code} size={14} />
				{/if}
				{@render label(r)}
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<div class="w-[44px] h-[3px] rounded overflow-hidden" style:background="var(--border)">
					<div class="h-full" style:width="{pct}%" style:background={barColor}></div>
				</div>
				<span class="font-mono text-[12px] min-w-[62px] text-right tabular-nums" style:color="var(--ink-1)">{formatValue(r.value, unit)}</span>
			</div>
		</button>
	{:else}
		<div class="row" style:border-color="var(--border-faint)">
			<div class="flex items-center gap-[10px] min-w-0 flex-1">
				<span class="font-mono text-[10px] w-3 shrink-0" style:color="var(--ink-4)">{i + 1}</span>
				{#if showFlag}
					<CountryFlag iso3={r.code} size={14} />
				{/if}
				{@render label(r)}
			</div>
			<div class="flex items-center gap-2 shrink-0">
				<div class="w-[44px] h-[3px] rounded overflow-hidden" style:background="var(--border)">
					<div class="h-full" style:width="{pct}%" style:background={barColor}></div>
				</div>
				<span class="font-mono text-[12px] min-w-[62px] text-right tabular-nums" style:color="var(--ink-1)">{formatValue(r.value, unit)}</span>
			</div>
		</div>
	{/if}
{/snippet}

<div>
	<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">Highest</div>
	<div class="border-t mb-7" style:border-color="var(--border-faint)">
		{#each highest as r, i (r.code)}
			{@render row(r, i, 'var(--accent)')}
		{/each}
	</div>

	<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style:color="var(--ink-3)">Lowest</div>
	<div class="border-t" style:border-color="var(--border-faint)">
		{#each lowest as r, i (r.code)}
			{@render row(r, i, 'var(--ink-3)')}
		{/each}
	</div>

	{#if summary}
		<div
			class="mt-7 p-[14px] rounded-[5px]"
			style:background="var(--bg-soft)"
			style:border="1px solid var(--border-faint)"
		>
			<div class="font-mono text-[11px] tracking-[0.06em] uppercase mb-[6px]" style:color="var(--ink-3)">{summary.label}</div>
			<div class="font-mono text-[20px] font-medium tracking-[-0.01em] tabular-nums" style:color="var(--ink-0)">
				{formatValue(summary.value, unit)}
			</div>
			{#if summary.subLabel}
				<div class="text-[11px] mt-[2px]" style:color="var(--ink-3)">{summary.subLabel}</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 9px 0;
		border-bottom: 1px solid;
		font-size: 13px;
		transition: background 140ms, transform 120ms;
	}
	button.row { cursor: pointer; background: transparent; }
	button.row:hover { background: var(--bg-soft); }
	button.row:active { transform: scale(0.98); }
	.row-name {
		font-size: 12.5px;
		letter-spacing: -0.005em;
		font-weight: 450;
		min-width: 0;
	}
</style>
