<script lang="ts">
	import { CHART_CONFIGS } from '$lib/mock/fred-data';
	import ChartCard from '$lib/components/gallery/ChartCard.svelte';
	import Icon from '@iconify/svelte';
</script>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-foreground">FRED Explorer</h1>
	<p class="text-sm text-muted-foreground mt-1">147M observations across 840K economic series</p>
</div>

<div class="flex flex-wrap gap-2">
	<div class="px-3 py-1.5 rounded-lg bg-card border border-border text-xs flex items-center gap-1.5">
		<Icon icon="lucide:database" width={14} class="text-muted-foreground" />
		<span class="font-mono font-medium text-foreground">840K</span>
		<span class="text-muted-foreground">Series</span>
	</div>
	<div class="px-3 py-1.5 rounded-lg bg-card border border-border text-xs flex items-center gap-1.5">
		<Icon icon="lucide:bar-chart-2" width={14} class="text-muted-foreground" />
		<span class="font-mono font-medium text-foreground">147M</span>
		<span class="text-muted-foreground">Observations</span>
	</div>
	<div class="px-3 py-1.5 rounded-lg bg-card border border-border text-xs flex items-center gap-1.5">
		<Icon icon="lucide:layers" width={14} class="text-muted-foreground" />
		<span class="font-mono font-medium text-foreground">324</span>
		<span class="text-muted-foreground">Releases</span>
	</div>
	<div class="px-3 py-1.5 rounded-lg bg-card border border-border text-xs flex items-center gap-1.5">
		<Icon icon="lucide:folder" width={14} class="text-muted-foreground" />
		<span class="font-mono font-medium text-foreground">5,186</span>
		<span class="text-muted-foreground">Categories</span>
	</div>
</div>

<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
	{#each CHART_CONFIGS as config (config.id)}
		<ChartCard {config} />
	{/each}
</div>
