<script lang="ts">
	import { CHART_CONFIGS } from '$lib/mock/fred-data';
	import { goto } from '$app/navigation';

	let query = $state('');

	const filtered = $derived(
		query.trim().length === 0
			? CHART_CONFIGS
			: CHART_CONFIGS.filter(
					(c) =>
						c.title.toLowerCase().includes(query.toLowerCase()) ||
						c.id.toLowerCase().includes(query.toLowerCase()) ||
						c.subtitle.toLowerCase().includes(query.toLowerCase())
				)
	);
</script>

<div class="flex h-full flex-col gap-6 overflow-auto p-6">
	<div class="flex flex-col gap-1">
		<h1 class="text-2xl font-semibold tracking-tight">Search Series</h1>
		<p class="text-muted-foreground text-sm">Find economic data series by name or symbol.</p>
	</div>

	<input
		type="search"
		bind:value={query}
		placeholder="Search series (e.g. GDP, CPI, UNRATE)…"
		class="border-border bg-card text-foreground placeholder:text-muted-foreground w-full max-w-xl rounded-lg border px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
	/>

	<div class="flex flex-col gap-1">
		{#each filtered as chart}
			<button
				onclick={() => goto(`/charts/${chart.id}`)}
				class="border-border bg-card hover:bg-accent flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors"
			>
				<span class="text-muted-foreground font-mono text-xs">{chart.id}</span>
				<div class="flex flex-col gap-0.5">
					<span class="text-sm font-medium">{chart.title}</span>
					<span class="text-muted-foreground text-xs">{chart.subtitle}</span>
				</div>
				<span class="text-muted-foreground ml-auto text-xs">{chart.units}</span>
			</button>
		{/each}

		{#if filtered.length === 0}
			<p class="text-muted-foreground py-8 text-center text-sm">No series match "{query}".</p>
		{/if}
	</div>
</div>
