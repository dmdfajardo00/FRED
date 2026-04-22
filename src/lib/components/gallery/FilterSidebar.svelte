<script lang="ts">
	import { listCategories, type CategorySummary } from '$lib/api';

	export type GalleryFilters = {
		frequency: string[];
		category: string[];
		popMin: number;
	};

	let {
		filters = $bindable(),
		onClear
	}: {
		filters: GalleryFilters;
		onClear: () => void;
	} = $props();

	const FREQ_OPTIONS = [
		['M', 'Monthly'],
		['A', 'Annual'],
		['Q', 'Quarterly'],
		['D', 'Daily'],
		['W', 'Weekly'],
		['SA', 'Semi-Annual']
	] as const;

	let categories = $state<CategorySummary[]>([]);
	let catLoading = $state(true);

	$effect(() => {
		listCategories(0)
			.then((cats) => { categories = cats; })
			.catch(() => { categories = []; })
			.finally(() => { catLoading = false; });
	});

	function toggle(key: 'frequency' | 'category', val: string) {
		const arr = filters[key];
		filters = {
			...filters,
			[key]: arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
		};
	}

	let openFreq = $state(true);
	let openCat = $state(true);
	let openPop = $state(true);
</script>

<aside
	class="scrollbar-thin"
	style:position="fixed"
	style:left="0"
	style:top="52px"
	style:bottom="0"
	style:width="240px"
	style:padding="16px 22px 28px 28px"
	style:border-right="1px solid var(--border-faint)"
	style:background="var(--bg-soft)"
	style:overflow-y="auto"
	style:z-index="10"
>
	<div class="flex items-center justify-between mb-[18px]">
		<div class="font-mono text-[12px] tracking-[0.05em]" style:color="var(--ink-2)">FILTERS</div>
		<button type="button" onclick={onClear} class="bg-transparent border-0 font-mono text-[11px] cursor-pointer" style:color="var(--ink-3)">clear</button>
	</div>

	<!-- Frequency -->
	<div class="border-b pb-[14px] mb-[14px]" style:border-color="var(--border-faint)">
		<button type="button" onclick={() => (openFreq = !openFreq)} class="flex items-center justify-between w-full py-1 bg-transparent border-0 font-mono text-[11px] tracking-[0.08em] uppercase cursor-pointer" style:color="var(--ink-3)">
			<span>Frequency</span>
			<span class="text-[10px] opacity-60">{openFreq ? '−' : '+'}</span>
		</button>
		{#if openFreq}
			<div class="mt-[10px]">
				{#each FREQ_OPTIONS as [code, label] (code)}
					{@const checked = filters.frequency.includes(code)}
					<label class="flex items-center gap-2 py-[5px] text-[13px] cursor-pointer" style:color="var(--ink-1)">
						<span class="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center shrink-0"
							style:background={checked ? 'var(--accent)' : 'var(--bg)'}
							style:border="1px solid {checked ? 'var(--accent)' : 'var(--border)'}">
							{#if checked}
								<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1,4.5 L3.5,7 L8,1.5" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
							{/if}
						</span>
						<input type="checkbox" {checked} onchange={() => toggle('frequency', code)} class="hidden" />
						<span class="flex-1">{label}</span>
					</label>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Category -->
	<div class="border-b pb-[14px] mb-[14px]" style:border-color="var(--border-faint)">
		<button type="button" onclick={() => (openCat = !openCat)} class="flex items-center justify-between w-full py-1 bg-transparent border-0 font-mono text-[11px] tracking-[0.08em] uppercase cursor-pointer" style:color="var(--ink-3)">
			<span>Category</span>
			<span class="text-[10px] opacity-60">{openCat ? '−' : '+'}</span>
		</button>
		{#if openCat}
			<div class="mt-[10px]">
				{#if catLoading}
					<div class="py-2 text-[12px]" style:color="var(--ink-3)">Loading…</div>
				{:else}
					{#each categories as cat (cat.id)}
						{@const checked = filters.category.includes(String(cat.id))}
						<label class="flex items-center gap-2 py-[5px] text-[13px] cursor-pointer" style:color="var(--ink-1)">
							<span class="w-[14px] h-[14px] rounded-[3px] flex items-center justify-center shrink-0"
								style:background={checked ? 'var(--accent)' : 'var(--bg)'}
								style:border="1px solid {checked ? 'var(--accent)' : 'var(--border)'}">
								{#if checked}
									<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1,4.5 L3.5,7 L8,1.5" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
								{/if}
							</span>
							<input type="checkbox" {checked} onchange={() => toggle('category', String(cat.id))} class="hidden" />
							<span class="flex-1 truncate">{cat.name}</span>
						</label>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Popularity -->
	<div class="border-b pb-[14px] mb-[14px]" style:border-color="var(--border-faint)">
		<button type="button" onclick={() => (openPop = !openPop)} class="flex items-center justify-between w-full py-1 bg-transparent border-0 font-mono text-[11px] tracking-[0.08em] uppercase cursor-pointer" style:color="var(--ink-3)">
			<span>Popularity</span>
			<span class="text-[10px] opacity-60">{openPop ? '−' : '+'}</span>
		</button>
		{#if openPop}
			<div class="mt-[10px] py-[6px] px-[2px]">
				<div class="font-mono text-[11px] mb-2" style:color="var(--ink-3)">≥ {filters.popMin}</div>
				<input
					type="range"
					min="0"
					max="99"
					value={filters.popMin}
					oninput={(e) => (filters = { ...filters, popMin: +(e.currentTarget as HTMLInputElement).value })}
					class="w-full"
					style:accent-color="var(--accent)"
				/>
			</div>
		{/if}
	</div>
</aside>
