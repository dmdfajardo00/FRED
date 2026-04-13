<script lang="ts">
	import Icon from '@iconify/svelte';

	let {
		value = '',
		placeholder = 'Search...',
		debounceMs = 200,
		onsearch = (_q: string) => {}
	}: {
		value?: string;
		placeholder?: string;
		debounceMs?: number;
		onsearch?: (q: string) => void;
	} = $props();

	let timer: ReturnType<typeof setTimeout> | null = null;
	let inputEl: HTMLInputElement | undefined = $state();

	function handleInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		value = v;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => onsearch(v), debounceMs);
	}

	function clear() {
		value = '';
		onsearch('');
		inputEl?.focus();
	}
</script>

<div class="relative">
	<Icon
		icon="material-symbols:search"
		class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
		width="18"
		height="18"
	/>
	<input
		bind:this={inputEl}
		type="text"
		{value}
		{placeholder}
		oninput={handleInput}
		class="w-full pl-10 pr-9 py-2.5 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-colors"
	/>
	{#if value.length > 0}
		<button
			onclick={clear}
			class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
		>
			<Icon icon="material-symbols:close" width="16" height="16" />
		</button>
	{/if}
</div>
