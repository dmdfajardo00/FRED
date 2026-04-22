<script lang="ts">
	import { goto } from '$app/navigation';
	import { searchSeries, type SeriesSummary } from '$lib/api';

	let { open = $bindable(false) }: { open: boolean } = $props();

	let q = $state('');
	let active = $state(0);
	let inputEl: HTMLInputElement | null = $state(null);
	let results = $state<SeriesSummary[]>([]);
	let searching = $state(false);

	const NAV_ITEMS = [
		{ id: 'gallery', label: 'Go to Command Center', hint: 'Gallery', path: '/gallery' },
		{ id: 'pulse', label: 'Go to Global Pulse', hint: 'Map', path: '/pulse' },
		{ id: 'library', label: 'Go to Library', hint: 'Library', path: '/library' },
		{ id: 'releases', label: 'Go to Releases', hint: 'Releases', path: '/releases' }
	] as const;

	const filteredNav = $derived.by(() => {
		if (!q.trim()) return NAV_ITEMS;
		const ql = q.toLowerCase();
		return NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(ql) || n.hint.toLowerCase().includes(ql));
	});

	type Item =
		| { kind: 'nav'; id: string; label: string; hint: string; path: string }
		| { kind: 'series'; id: string; label: string; hint: string; cat?: string };

	const items = $derived.by((): Item[] => {
		const nav: Item[] = filteredNav.map((n) => ({ kind: 'nav', ...n }));
		const series: Item[] = results.map((s) => ({ kind: 'series', id: s.id, label: s.title, hint: s.id }));
		return [...nav, ...series].slice(0, 10);
	});

	let debounceT: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		const term = q.trim();
		if (debounceT) clearTimeout(debounceT);
		if (!term) {
			results = [];
			return;
		}
		searching = true;
		debounceT = setTimeout(async () => {
			try {
				results = await searchSeries({ q: term, limit: 8 });
			} catch {
				results = [];
			}
			searching = false;
		}, 180);
	});

	$effect(() => {
		if (open) {
			setTimeout(() => inputEl?.focus(), 30);
			active = 0;
		} else {
			q = '';
			results = [];
		}
	});

	function select(it: Item) {
		if (it.kind === 'nav') {
			goto(it.path);
		} else {
			goto(`/charts/${encodeURIComponent(it.id)}`);
		}
		open = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); }
		else if (e.key === 'Enter') { e.preventDefault(); if (items[active]) select(items[active]); }
		else if (e.key === 'Escape') { open = false; }
	}
</script>

{#if open}
	<div
		role="dialog"
		aria-modal="true"
		class="fixed inset-0 z-[100] flex items-start justify-center pt-[100px]"
		style="background: rgba(20,22,24,0.25); backdrop-filter: blur(2px);"
		onclick={() => (open = false)}
		onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
		tabindex="-1"
	>
		<div
			role="document"
			class="w-[560px] max-w-[92vw] rounded-lg overflow-hidden"
			style:background="var(--bg)"
			style:border="1px solid var(--border)"
			style:box-shadow="0 20px 60px rgba(0,0,0,0.12)"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			tabindex="-1"
		>
			<div class="flex items-center h-[46px] px-[14px] border-b" style:border-color="var(--border-faint)">
				<svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="var(--ink-3)" stroke-width="1.4">
					<circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" stroke-linecap="round" />
				</svg>
				<input
					bind:this={inputEl}
					bind:value={q}
					onkeydown={onKey}
					placeholder="Search series, jump to view, run command…"
					class="flex-1 border-0 outline-none bg-transparent px-3 text-[14px]"
					style:color="var(--ink-0)"
				/>
				<span class="font-mono text-[10px] px-[6px] py-[2px] rounded-[3px]" style:color="var(--ink-4)" style:border="1px solid var(--border)">ESC</span>
			</div>

			<div class="max-h-[400px] overflow-auto p-[6px]">
				{#if items.length === 0}
					<div class="py-7 px-[14px] text-center text-[13px]" style:color="var(--ink-3)">
						{searching ? 'Searching…' : 'No matches.'}
					</div>
				{:else}
					{#each items as it, i (it.kind + ':' + it.id)}
						<button
							type="button"
							class="flex items-center gap-3 w-full px-[10px] py-[9px] rounded-[4px] text-left text-[13px]"
							style:background={active === i ? 'var(--bg-soft)' : 'transparent'}
							style:color="var(--ink-1)"
							onmouseenter={() => (active = i)}
							onclick={() => select(it)}
						>
							<span class="w-5 h-5 flex items-center justify-center" style:color="var(--ink-3)">
								{#if it.kind === 'nav'}
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2,6 L10,6 M6,2 L10,6 L6,10" stroke-linecap="round" stroke-linejoin="round"/></svg>
								{:else}
									<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1,9 L4,5 L7,7 L11,2" stroke-linecap="round" stroke-linejoin="round"/></svg>
								{/if}
							</span>
							<span class="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{it.label}</span>
							<span class="font-mono text-[10px]" style:color="var(--ink-4)">{it.hint}</span>
						</button>
					{/each}
				{/if}
			</div>

			<div class="flex gap-4 px-[14px] py-[8px] text-[10px] tracking-[0.03em]"
				style:background="var(--bg-soft)"
				style:border-top="1px solid var(--border-faint)"
				style:color="var(--ink-3)"
				style:font-family="var(--font-mono)"
			>
				<span>↑↓ NAVIGATE</span><span>↵ SELECT</span><span>ESC CLOSE</span>
			</div>
		</div>
	</div>
{/if}
