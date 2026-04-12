<script lang="ts">
	interface Props {
		title: string;
		subtitle?: string;
		units?: string;
		class?: string;
	}
	let { title, subtitle, units, class: className = '' }: Props = $props();
</script>

<div class="flex flex-col gap-0.5 {className}">
	<div class="flex items-baseline gap-2">
		<h2 class="text-foreground text-base font-semibold leading-tight">{title}</h2>
		{#if units}
			<span class="text-muted-foreground text-xs">({units})</span>
		{/if}
	</div>
	{#if subtitle}
		<p class="text-muted-foreground text-xs">{subtitle}</p>
	{/if}
</div>
