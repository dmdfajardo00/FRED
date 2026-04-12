<script lang="ts">
	interface Props {
		title: string;
		description?: string;
		icon?: string;
	}
	let { title, description, icon = '📭' }: Props = $props();
</script>

<div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
	<span class="text-4xl" aria-hidden="true">{icon}</span>
	<h3 class="text-sm font-semibold">{title}</h3>
	{#if description}
		<p class="text-muted-foreground max-w-xs text-xs">{description}</p>
	{/if}
</div>
