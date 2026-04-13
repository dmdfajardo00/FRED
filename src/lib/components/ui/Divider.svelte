<script lang="ts">
	interface Props {
		orientation?: 'horizontal' | 'vertical';
		class?: string;
	}
	let { orientation = 'horizontal', class: className = '' }: Props = $props();
</script>

{#if orientation === 'horizontal'}
	<hr class="border-border w-full {className}" />
{:else}
	<div class="border-border h-full w-px border-l {className}"></div>
{/if}
