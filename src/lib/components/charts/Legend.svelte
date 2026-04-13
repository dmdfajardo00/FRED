<script lang="ts">
	interface LegendItem {
		label: string;
		color: string;
	}

	interface Props {
		items: LegendItem[];
		class?: string;
	}
	let { items, class: className = '' }: Props = $props();
</script>

{#if items.length > 0}
	<div class="flex flex-wrap items-center gap-3 {className}">
		{#each items as item}
			<div class="flex items-center gap-1.5 text-xs">
				<span
					class="inline-block h-2 w-5 rounded-full"
					style="background: {item.color}"
				></span>
				<span class="text-muted-foreground">{item.label}</span>
			</div>
		{/each}
	</div>
{/if}
