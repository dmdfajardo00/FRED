<script lang="ts">
	import { page } from '$app/stores';
	import { pinned } from '$lib/stores/pinned';
	import { theme, toggleTheme } from '$lib/stores/theme';

	let { onCmd }: { onCmd: () => void } = $props();

	const tabs = [
		['/pulse', 'Global Pulse'],
		['/gallery', 'Command Center'],
		['/library', 'Library'],
		['/releases', 'Releases']
	] as const;

	const currentTab = $derived(tabs.find(([path]) => $page.url.pathname.startsWith(path))?.[0] ?? '/pulse');
</script>

<header class="sticky top-0 z-20 flex items-center h-[52px] px-7 bg-[var(--bg)] border-b border-[var(--border-faint)]">
	<a href="/pulse" class="flex items-center gap-[11px] mr-8 no-underline">
		<svg width="22" height="22" viewBox="0 0 22 22" class="block shrink-0">
			<rect x="2" y="4" width="4" height="14" fill="var(--ink-0)" />
			<rect x="7" y="8" width="4" height="10" fill="var(--ink-0)" opacity="0.75" />
			<rect x="12" y="6" width="4" height="12" fill="var(--ink-0)" opacity="0.55" />
			<rect x="17" y="10" width="3" height="8" fill="var(--accent)" />
		</svg>
		<div>
			<div class="text-[14px] font-medium leading-none text-[var(--ink-0)] tracking-[0.01em]">Meridian</div>
			<div class="text-[9px] font-mono text-[var(--ink-3)] tracking-[0.14em] mt-[3px]">ECON · INTELLIGENCE</div>
		</div>
	</a>

	<nav class="flex gap-[2px]">
		{#each tabs as [path, label] (path)}
			{@const active = currentTab === path}
			<a
				href={path}
				class="relative h-[30px] px-3 text-[13px] rounded-[4px] inline-flex items-center no-underline transition-colors"
				style:color={active ? 'var(--ink-0)' : 'var(--ink-2)'}
				style:font-weight={active ? 500 : 400}
				onmouseenter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-soft)'; }}
				onmouseleave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
			>
				{label}
				{#if active}
					<span class="absolute left-3 right-3 -bottom-[13px] h-[2px] bg-[var(--ink-0)]"></span>
				{/if}
			</a>
		{/each}
	</nav>

	<div class="flex-1"></div>

	<button
		type="button"
		onclick={onCmd}
		class="inline-flex items-center gap-[10px] h-[30px] pl-3 pr-[10px] rounded-[5px] text-[12px] text-[var(--ink-3)] cursor-pointer"
		style:background="var(--bg-soft)"
		style:border="1px solid var(--border)"
	>
		<svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="1.4">
			<circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" stroke-linecap="round" />
		</svg>
		<span>Jump to…</span>
		<span class="font-mono text-[10px] px-[5px] py-[1px] rounded-[3px]" style:background="var(--bg)" style:border="1px solid var(--border)">⌘K</span>
	</button>

	<div class="w-px h-5 mx-[14px]" style:background="var(--border)"></div>

	<div class="flex items-center gap-[14px] text-[12px] text-[var(--ink-3)]">
		<span class="font-mono text-[11px]">{$pinned.length}</span>
		<svg width="12" height="12" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="1.2">
			<path d="M5.5,0.5 L7,3.5 L10,4 L7.75,6 L8.5,9 L5.5,7.5 L2.5,9 L3.25,6 L1,4 L4,3.5 Z" />
		</svg>
		<button
			type="button"
			onclick={toggleTheme}
			aria-label="Toggle theme"
			class="w-6 h-6 rounded-full flex items-center justify-center cursor-pointer border"
			style:background="var(--bg-soft)"
			style:border-color="var(--border)"
			style:color="var(--ink-2)"
		>
			{#if $theme === 'dark'}
				<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="6" cy="6" r="2.5" /><g stroke-linecap="round"><line x1="6" y1="0.5" x2="6" y2="2" /><line x1="6" y1="10" x2="6" y2="11.5" /><line x1="0.5" y1="6" x2="2" y2="6" /><line x1="10" y1="6" x2="11.5" y2="6" /><line x1="2" y1="2" x2="3" y2="3" /><line x1="9" y1="9" x2="10" y2="10" /><line x1="10" y1="2" x2="9" y2="3" /><line x1="3" y1="9" x2="2" y2="10" /></g></svg>
			{:else}
				<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M10 7.5a4.5 4.5 0 0 1-5.5-5.5 5 5 0 1 0 5.5 5.5z" /></svg>
			{/if}
		</button>
	</div>
</header>
